"""Populate a running API with clearly labeled stock-photo examples.

Re-runs skip records already tracked in the local manifest. No existing records
are deleted. Stock images are illustrative and are not real campus reports.
"""
import argparse
import json
import os
from datetime import date, timedelta
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    args = parser.parse_args()
    directory = Path(os.environ.get("FOUNDIT_DATA_DIR", ROOT / "data"))
    directory.mkdir(parents=True, exist_ok=True)
    manifest_path = directory / "demo-manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    catalog = json.loads((ROOT / "backend" / "demo_catalog.json").read_text())
    with httpx.Client(timeout=180) as client:
        client.get(f"{args.api}/api/health").raise_for_status()
        for index, item in enumerate(catalog):
            existing = manifest.get(item["key"])
            if existing:
                response = client.get(f"{args.api}/api/items/{existing['id']}")
                if response.status_code == 200:
                    print(f"Already present: {item['title']}")
                    continue
                if response.status_code != 404:
                    response.raise_for_status()
            url = f"https://images.unsplash.com/{item['photo']}?auto=format&fit=crop&w=900&q=85"
            photo = client.get(url)
            photo.raise_for_status()
            response = client.post(f"{args.api}/api/items", data={
                "title": item["title"], "description": item["description"],
                "category": item["category"], "location": item["location"],
                "found_date": (date.today() - timedelta(days=index)).isoformat(),
                "is_sample": "true", "pickup_notes": "Sample listing only. This item is not held at a campus pickup location.",
            }, files={"image": (f"{item['key']}.jpg", photo.content, "image/jpeg")})
            response.raise_for_status()
            manifest[item["key"]] = {"id": response.json()["id"], "image_source": url, "query": item["query"]}
            manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
            print(f"Added sample: {item['title']}")
    print("Sample board ready. These six stock photos are not an accuracy benchmark.")


if __name__ == "__main__":
    main()
