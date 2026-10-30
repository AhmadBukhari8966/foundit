"""Exercise the real API, image validation, and on-disk Qdrant with a tiny test encoder.

The test encoder checks retrieval plumbing without downloading CLIP. Real-model
verification lives in backend.smoke_clip and must be run separately.
"""
import io
from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.app import MAX_IMAGE_BYTES, create_app
from backend.embeddings import EmbeddingUnavailable


class TestEncoder:
    __test__ = False
    ready = True

    def encode(self, value):
        if isinstance(value, str):
            channel = 2 if "blue" in value.lower() else 0
        else:
            rgb = value.resize((1, 1)).getpixel((0, 0))
            channel = max(range(3), key=lambda i: rgb[i])
        vector = [0.0] * 512
        vector[channel] = 1.0
        return vector


def image_bytes(color="blue"):
    stream = io.BytesIO()
    Image.new("RGB", (32, 32), color).save(stream, "PNG")
    return stream.getvalue()


def post(client, color="blue", **overrides):
    data = dict(title=f"{color} backpack", description="Found beside the study tables.",
                category="Bags", location="Library", found_date="2026-01-01")
    data.update(overrides)
    return client.post("/api/items", data=data,
                       files={"image": ("../../item.png", image_bytes(color), "image/png")})


@pytest.fixture
def client(tmp_path):
    with TestClient(create_app(tmp_path, TestEncoder())) as client:
        yield client


def test_post_retrieve_and_persist(tmp_path):
    with TestClient(create_app(tmp_path, TestEncoder())) as client:
        response = post(client)
        assert response.status_code == 201
        item = response.json()
        assert item["image"] == f"/uploads/{item['id']}.jpg"
        photo = client.get(item["image"])
        assert photo.status_code == 200
        assert photo.headers["content-type"] == "image/jpeg"
        assert client.get(f"/api/items/{item['id']}").json() == item
        assert "found_day" not in item
    with TestClient(create_app(tmp_path, TestEncoder())) as client:
        assert client.get("/api/items").json()["items"] == [item]
        assert client.get("/api/health").json()["items"] == 1


def test_text_and_image_search_rank_and_filter(client):
    red = post(client, "red", location="Student Center").json()
    blue = post(client, "blue").json()
    hits = client.post("/api/search/text", json={"query": "blue bag"}).json()["items"]
    assert hits[0]["id"] == blue["id"]
    assert hits[0]["score"] > hits[1]["score"]
    hits = client.post("/api/search/image", files={"image": ("photo.png", image_bytes("red"), "image/png")}).json()["items"]
    assert hits[0]["id"] == red["id"]
    hits = client.post("/api/search/text", json={"query": "blue bag", "location": "Student Center"}).json()["items"]
    assert [item["id"] for item in hits] == [red["id"]]
    assert client.post("/api/search/text", json={"query": "bag", "category": "Electronics"}).json()["items"] == []


def test_list_filters_dates_and_pagination(client):
    for _ in range(3):
        assert post(client).status_code == 201
    first = client.get("/api/items?limit=2").json()
    assert len(first["items"]) == 2
    second = client.get("/api/items", params={"offset": first["next_offset"], "limit": 2}).json()
    assert len(second["items"]) == 1
    assert {i["id"] for i in first["items"]}.isdisjoint({i["id"] for i in second["items"]})
    assert client.get("/api/items?date_from=2026-01-02").json()["items"] == []
    assert len(client.get("/api/items?date_to=2026-01-01").json()["items"]) == 3
    assert client.get("/api/items?date_from=2026-02-01&date_to=2026-01-01").status_code == 422


@pytest.mark.parametrize("overrides", [
    {"title": "   "}, {"description": " "}, {"category": "Invalid"}, {"category": ""},
    {"location": "Nowhere"}, {"found_date": (date.today() + timedelta(days=1)).isoformat()},
])
def test_invalid_metadata(client, overrides):
    assert post(client, **overrides).status_code == 422
    assert client.get("/api/health").json()["items"] == 0


def test_invalid_and_oversize_images(client):
    assert client.post("/api/search/image", files={"image": ("fake.jpg", b"not a photo", "image/jpeg")}).status_code == 422
    assert client.post("/api/search/image", files={"image": ("big.jpg", b"x" * (MAX_IMAGE_BYTES + 1), "image/jpeg")}).status_code == 413


def test_invalid_search_and_unknown_items(client):
    for payload in [{"query": " "}, {"query": "bag", "limit": 0}, {"query": "bag", "category": "x"}]:
        assert client.post("/api/search/text", json=payload).status_code == 422
    assert client.get(f"/api/items/{uuid4()}").status_code == 404
    assert client.get("/api/items/not-an-id").status_code == 422


def test_model_failure_is_actionable_and_does_not_save(tmp_path):
    class BrokenEncoder(TestEncoder):
        ready = False
        def encode(self, value):
            raise EmbeddingUnavailable("Model could not load. Run warmup.")
    with TestClient(create_app(tmp_path, BrokenEncoder())) as client:
        response = post(client)
        assert response.status_code == 503
        assert "warmup" in response.json()["detail"]
        assert client.get("/api/health").json()["items"] == 0
        assert list((tmp_path / "uploads").iterdir()) == []
