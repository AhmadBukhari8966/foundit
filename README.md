# FoundIt

A campus lost-and-found app. Post a photo of a found item, then search for possible matches using a description or another photo.

For full-app public deployment, see [hosting instructions](docs/HOSTING.md). The repository includes a Dockerfile and a Render deployment template. Committing the template does not create a hosted service.

## Run locally

The backend dependencies and CLIP weights are already installed on the development machine. For a single-server demo, run:

```sh
npm start
```

Open http://127.0.0.1:8000. This builds the frontend and serves it from FastAPI alongside the API and photos. In a second terminal, optionally populate the board with labeled stock-photo examples:

```sh
npm run seed
```

Seeding needs internet to fetch six stock photos on the first run. Repeating it skips existing tracked samples. The resulting listings are labeled SAMPLE, and the manifest records image source URLs. These are illustrative examples, not actual campus lost items. Keep the server running while seeding or evaluating.

For frontend development with automatic updates, use two terminals instead:

**Terminal 1 — API**

```sh
.venv/bin/python -m uvicorn backend.app:app --host 127.0.0.1 --port 8000
```

**Terminal 2 — frontend**

```sh
npm run dev
```

Open http://127.0.0.1:5173. API documentation is at http://127.0.0.1:8000/docs. Vite proxies `/api` and `/uploads` to the backend.

On a fresh install, the board starts empty until you post photos or run the seed command. The backpack in the hero is decorative imagery, not a listing. Real posts can include optional finder-written pickup notes; those notes are not verified by the app.

## Install on another machine

Use Python 3.9–3.12 and Node.js 20.19+ or 22.12+. The tested development environment uses Python 3.9 on Apple Silicon. Python 3.15 is not supported by this dependency set.

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r backend/requirements.txt
npm install
.venv/bin/python -m backend.warmup
```

The first warmup downloads CLIP model files from Hugging Face and needs internet access. Keep enough disk space for PyTorch, its dependencies, and model files. Later searches use the local cache. Warmup is optional, but running it before a demo avoids waiting during the first upload or search.

Run one backend process. Qdrant's embedded database cannot be shared by multiple workers or independently running API processes. An optional `FOUNDIT_DATA_DIR` environment variable changes the data folder; set it consistently for the API, warmup, and real-model smoke check.

## How search works

1. The API validates uploaded image bytes, applies EXIF orientation, converts to RGB, resizes the photo, and strips image metadata by saving it as a new JPEG.
2. Sentence Transformers loads `sentence-transformers/clip-ViT-B-32` on CPU. Its image encoder produces a normalized 512-dimensional vector.
3. Qdrant stores that vector alongside the item's title, description, category, location, and found date. Original normalized photos are served from `/uploads`.
4. A search description goes through CLIP's text encoder; a search photo goes through its image encoder. Qdrant ranks stored photos using cosine similarity.
5. Category, location, and optional date filters restrict candidates before similarity ranking.

Written item descriptions are displayed but are not embedded in this version. Search is against visual appearance, so private details in a notebook or a tiny logo may not be retrievable. Scores measure similarity, not the probability that an item belongs to someone. No model training is required.

Qdrant runs in persistent local mode; Docker and cloud accounts are not needed. See the official [Qdrant client documentation](https://github.com/qdrant/qdrant-client) and [CLIP image-search example](https://sbert.net/examples/sentence_transformer/applications/image-search/README.html).

## API

All endpoints below use the `/api` prefix.

| Method | Endpoint | Input / behavior |
| --- | --- | --- |
| GET | `/health` | Database status, item count, model name, and whether CLIP has loaded |
| GET | `/items` | Listings; supports `category`, `location`, `date_from`, `date_to`, `limit`, and `offset` |
| GET | `/items/{id}` | A single listing |
| POST | `/items` | Multipart: `image`, `title`, `description`, `category`, `location`, `found_date`; optional `pickup_notes`, `is_sample` |
| POST | `/search/text` | JSON: `query`, optional filters, and `limit` |
| POST | `/search/image` | Multipart: `image`, optional filters, and `limit` |

Dates use `YYYY-MM-DD`. Listing responses include `items` and `next_offset`; pass the latter as `offset` to fetch another page. Search responses include `items` with similarity scores, ranked highest first, up to 100 results. The frontend preserves similarity order during searches and supports date sorting while browsing.

Uploads are limited to 8 MB and 20 megapixels. Titles must contain 1–70 characters; descriptions 1–500. Categories are Bags, Bottles, Electronics, Accessories, and Other. Locations are Student Center, Library, and Engineering Hall.

Example text search:

```sh
curl http://127.0.0.1:8000/api/search/text \
  -H 'Content-Type: application/json' \
  -d '{"query":"a black backpack","category":"Bags","limit":5}'
```

## Storage and scope

- `data/qdrant/`: vectors and listing metadata, persisted across restarts.
- `data/uploads/`: normalized photos.
- `data/models/` and `data/huggingface/`: local model cache.
- Browser local storage: bookmarked item IDs only.

`data/` and `.venv/` are excluded from Git. This version is a local demo without accounts, ownership verification, messaging, or verified pickup instructions. Anyone with access to the API can view listings and post items. The documented commands bind to localhost. Hero imagery, avatars, and fonts load from external services.

## Verification

```sh
.venv/bin/python -m pytest backend/tests -q
.venv/bin/python -m backend.smoke_clip
npm run build
```

The API tests use real on-disk Qdrant with a small deterministic encoder to test persistence, filtering, pagination, ranking, upload validation, and model errors. The separate smoke check uses real CLIP with synthetic images and temporary records. Neither measures accuracy on real lost belongings.

For the competition, photograph 20–40 objects, then test descriptions and different photos of those same objects. Measure how often the correct item appears in the first five results. Include similar objects and report failures as well as successes.

## Evaluation and judging

With the server running and the sample board seeded:

```sh
npm run evaluate
```

This compares CLIP text retrieval against a token-overlap keyword baseline and writes `data/evaluation.json`. The output reports top-one and top-five success and the rank for each query. Six stock photos are too few to establish real-world accuracy. The tool caps semantic results at 100 candidates and reports an unfound expected item as a miss.

For independently chosen queries, create a JSON array of `{"query":"your description","expected_id":"listing UUID"}` objects and run:

```sh
.venv/bin/python -m backend.evaluate --cases cases.json --output data/real-evaluation.json
```

Use queries chosen before seeing search results. Do not submit private evaluation data to Git. The baseline uses title and description token overlap; zero-overlap records are excluded, with UUIDs breaking ties. This is a simple baseline, not a tuned search engine.

See [the judging walkthrough](docs/DEMO.md) for a three-minute demo script, the architecture explanation, and limitations to discuss.
