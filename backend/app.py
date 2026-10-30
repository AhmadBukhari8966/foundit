import io
import logging
import os
import warnings
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from threading import RLock
from typing import Optional
from uuid import UUID, uuid4

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, ImageOps, UnidentifiedImageError
from pydantic import BaseModel, Field, field_validator
from qdrant_client import QdrantClient, models

from .embeddings import ClipEncoder, EmbeddingUnavailable, MODEL_NAME, VECTOR_SIZE

ROOT = Path(__file__).resolve().parents[1]
COLLECTION = "foundit_clip_v1"
MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_IMAGE_PIXELS = 20_000_000
CATEGORIES = {"Bags", "Bottles", "Electronics", "Accessories", "Other"}
LOCATIONS = {"Student Center", "Library", "Engineering Hall"}
logger = logging.getLogger(__name__)


class TextSearch(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    limit: int = Field(default=60, ge=1, le=100)
    category: Optional[str] = None
    location: Optional[str] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None

    @field_validator("query")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Describe the item you are searching for.")
        return value.strip()


def decode_image(upload: UploadFile):
    """Inspect actual bytes, cap dimensions, strip metadata and normalize orientation."""
    raw = upload.file.read(MAX_IMAGE_BYTES + 1)
    if len(raw) > MAX_IMAGE_BYTES:
        raise HTTPException(413, "Choose a photo smaller than 8 MB.")
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(raw)) as source:
                if source.width * source.height > MAX_IMAGE_PIXELS:
                    raise HTTPException(413, "Photo dimensions are too large (maximum 20 megapixels).")
                source.load()
                image = ImageOps.exif_transpose(source).convert("RGB")
                image.thumbnail((1600, 1600))
                return image
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise HTTPException(422, "That file could not be opened as an image. Try JPG or PNG.")


def build_filter(category=None, location=None, date_from=None, date_to=None):
    conditions = []
    for field, value, allowed in [("category", category, CATEGORIES), ("location", location, LOCATIONS)]:
        if value:
            if value not in allowed:
                raise HTTPException(422, f"Unknown {field}.")
            conditions.append(models.FieldCondition(key=field, match=models.MatchValue(value=value)))
    if date_from and date_to and date_from > date_to:
        raise HTTPException(422, "Start date must not be after end date.")
    if date_from or date_to:
        conditions.append(models.FieldCondition(key="found_day", range=models.Range(
            gte=date_from.toordinal() if date_from else None,
            lte=date_to.toordinal() if date_to else None,
        )))
    return models.Filter(must=conditions) if conditions else None


def public_item(point):
    payload = dict(point.payload or {})
    payload.pop("found_day", None)
    return {"id": str(point.id), **payload}


def create_app(data_dir=None, encoder=None):
    directory = Path(data_dir or os.environ.get("FOUNDIT_DATA_DIR", ROOT / "data")).resolve()
    uploads = directory / "uploads"
    uploads.mkdir(parents=True, exist_ok=True)
    clip = encoder if encoder is not None else ClipEncoder(directory / "models")
    db_lock = RLock()

    @asynccontextmanager
    async def lifespan(app):
        # FastAPI runs sync handlers in worker threads. All database access is
        # serialized by db_lock, including writes to local Qdrant's SQLite store.
        client = QdrantClient(path=str(directory / "qdrant"), force_disable_check_same_thread=True)
        if not client.collection_exists(COLLECTION):
            client.create_collection(COLLECTION, vectors_config=models.VectorParams(
                size=VECTOR_SIZE, distance=models.Distance.COSINE))
        app.state.db = client
        app.state.encoder = clip
        try:
            yield
        finally:
            client.close()

    app = FastAPI(title="FoundIt API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(CORSMiddleware,
        allow_origins=["http://127.0.0.1:5173", "http://localhost:5173"],
        allow_methods=["GET", "POST"], allow_headers=["Content-Type"])
    app.mount("/uploads", StaticFiles(directory=str(uploads)), name="uploads")

    @app.exception_handler(EmbeddingUnavailable)
    async def embedding_error(request, exc):
        return JSONResponse(status_code=503, content={"detail": str(exc)})

    @app.get("/api/health")
    def health():
        with db_lock:
            count = app.state.db.count(COLLECTION, exact=True).count
        return {"status": "ok", "database": "qdrant-local", "model": MODEL_NAME,
                "model_loaded": clip.ready, "items": count}

    @app.get("/api/items")
    def list_items(category: Optional[str] = None, location: Optional[str] = None,
                   date_from: Optional[date] = None, date_to: Optional[date] = None,
                   limit: int = Query(default=60, ge=1, le=100), offset: Optional[UUID] = None):
        filters = build_filter(category, location, date_from, date_to)
        with db_lock:
            points, next_offset = app.state.db.scroll(COLLECTION, scroll_filter=filters,
                limit=limit, offset=str(offset) if offset else None, with_payload=True, with_vectors=False)
        return {"items": [public_item(p) for p in points],
                "next_offset": str(next_offset) if next_offset else None}

    @app.get("/api/items/{item_id}")
    def get_item(item_id: UUID):
        with db_lock:
            points = app.state.db.retrieve(COLLECTION, ids=[str(item_id)], with_payload=True)
        if not points:
            raise HTTPException(404, "Item not found.")
        return public_item(points[0])

    @app.post("/api/items", status_code=201)
    def create_item(image: UploadFile = File(...), title: str = Form(...),
                    description: str = Form(...), category: str = Form(...),
                    location: str = Form(...), found_date: date = Form(...),
                    pickup_notes: str = Form(""), is_sample: bool = Form(False)):
        title, description = title.strip(), description.strip()
        if not 1 <= len(title) <= 70 or not 1 <= len(description) <= 500:
            raise HTTPException(422, "Provide a title (1–70 characters) and description (1–500 characters).")
        if category not in CATEGORIES or location not in LOCATIONS:
            raise HTTPException(422, "Select a valid category and location.")
        if found_date > date.today():
            raise HTTPException(422, "The found date cannot be in the future.")
        pickup_notes = pickup_notes.strip()
        if len(pickup_notes) > 500:
            raise HTTPException(422, "Pickup notes must be at most 500 characters.")
        picture = decode_image(image)
        vector = clip.encode(picture)
        item_id = str(uuid4())
        path = uploads / f"{item_id}.jpg"
        payload = {"title": title, "description": description, "category": category,
                   "location": location, "date": found_date.isoformat(),
                   "found_day": found_date.toordinal(), "image": f"/uploads/{item_id}.jpg",
                   "pickup_notes": pickup_notes, "is_sample": is_sample}
        picture.save(path, "JPEG", quality=88)
        try:
            with db_lock:
                app.state.db.upsert(COLLECTION, points=[models.PointStruct(
                    id=item_id, vector=vector, payload=payload)], wait=True)
        except Exception:
            path.unlink(missing_ok=True)
            raise
        return {"id": item_id, **{k: v for k, v in payload.items() if k != "found_day"}}

    def search(vector, filters, limit):
        with db_lock:
            result = app.state.db.query_points(COLLECTION, query=vector, query_filter=filters,
                limit=limit, with_payload=True, with_vectors=False)
        return {"items": [{**public_item(p), "score": p.score} for p in result.points]}

    @app.post("/api/search/text")
    def search_text(body: TextSearch):
        filters = build_filter(body.category, body.location, body.date_from, body.date_to)
        return search(clip.encode(body.query), filters, body.limit)

    @app.post("/api/search/image")
    def search_image(image: UploadFile = File(...), category: Optional[str] = Form(None),
                     location: Optional[str] = Form(None), date_from: Optional[date] = Form(None),
                     date_to: Optional[date] = Form(None), limit: int = Form(60, ge=1, le=100)):
        filters = build_filter(category, location, date_from, date_to)
        return search(clip.encode(decode_image(image)), filters, limit)

    # Serve the built frontend from the same origin for the one-command demo.
    # API and upload routes must be registered before this catch-all mount.
    if (ROOT / "dist" / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(ROOT / "dist"), html=True), name="frontend")

    return app


app = create_app()
