# FoundIt

A campus lost-and-found project for the ACM Codeathon. Search for found items using a text description or a photo.

## Planned features

- Post a found item with a photo, description, location, and date.
- Search photos using a text description or another photo.
- Filter possible matches by location and date.
- View item details.

## Planned architecture

- React + Vite frontend
- Python + FastAPI backend
- CLIP image and text embeddings through Sentence Transformers
- Qdrant vector database
- Local photo storage for the initial demo

Uploaded photos are encoded into vectors and stored in Qdrant with item metadata. Text or image queries are encoded with the same CLIP model, and Qdrant retrieves similar items.

Search results are possible matches, not proof that two photos show the same object.

## Status

Planning and repository setup. The application is not implemented yet.

## First milestone

Index ten item photos and retrieve matching items from a text query. Then add API endpoints and a browser interface.

## Evaluation plan

Test with different photos of the indexed objects and measure how often the correct item appears in the first five results. Compare text queries against a keyword-search baseline.
