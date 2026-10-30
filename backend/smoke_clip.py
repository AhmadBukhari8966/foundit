"""Real CLIP + HTTP API + Qdrant check, using temporary data and synthetic images.

This verifies the inference path, not lost-item retrieval accuracy. For that,
evaluate real photos from different angles as described in the README.
"""
import io
import os
from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient
from PIL import Image

from .app import create_app
from .embeddings import ClipEncoder


def main():
    root = Path(__file__).resolve().parents[1]
    directory = Path(os.environ.get("FOUNDIT_DATA_DIR", root / "data"))
    encoder = ClipEncoder(directory / "models")
    encoder.load()
    with TemporaryDirectory(prefix="foundit-clip-") as temporary:
        with TestClient(create_app(Path(temporary), encoder)) as client:
            ids = {}
            photos = {}
            for color in ("red", "blue"):
                buffer = io.BytesIO()
                Image.new("RGB", (224, 224), color).save(buffer, "PNG")
                photos[color] = buffer.getvalue()
                response = client.post("/api/items", data={
                    "title": f"{color} test image", "description": "Synthetic image for inference verification.",
                    "category": "Other", "location": "Library", "found_date": "2026-01-01",
                }, files={"image": (f"{color}.png", photos[color], "image/png")})
                assert response.status_code == 201, response.text
                ids[color] = response.json()["id"]
            result = client.post("/api/search/text", json={"query": "a blue square"})
            assert result.status_code == 200, result.text
            assert result.json()["items"][0]["id"] == ids["blue"], result.text
            result = client.post("/api/search/image", files={"image": ("red.png", photos["red"], "image/png")})
            assert result.status_code == 200, result.text
            assert result.json()["items"][0]["id"] == ids["red"], result.text
            print("Real CLIP check passed: upload, text ranking, photo ranking, and Qdrant retrieval.")


if __name__ == "__main__":
    main()
