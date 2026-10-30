"""Compare CLIP retrieval with a token-overlap keyword baseline.

Default cases use the small stock-photo demo catalog and are illustrative only.
For real evaluation, pass --cases cases.json containing an array of
{"query": "...", "expected_id": "UUID"} objects. Choose cases before running.
"""
import argparse
import json
import os
import re
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]


def keywords(text):
    return set(re.findall(r"\b\w+\b", text.lower()))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--api", default="http://127.0.0.1:8000")
    parser.add_argument("--cases", type=Path)
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "evaluation.json")
    args = parser.parse_args()
    if args.cases:
        cases = json.loads(args.cases.read_text())
    else:
        directory = Path(os.environ.get("FOUNDIT_DATA_DIR", ROOT / "data"))
        manifest = json.loads((directory / "demo-manifest.json").read_text())
        cases = [{"query": entry["query"], "expected_id": entry["id"]} for entry in manifest.values()]
    if not cases:
        raise SystemExit("No cases. Seed the board first or provide --cases.")
    with httpx.Client(timeout=180) as client:
        listings = []
        offset = None
        while True:
            response = client.get(f"{args.api}/api/items", params={"limit":100, **({"offset":offset} if offset else {})})
            response.raise_for_status()
            page = response.json()
            listings.extend(page["items"])
            offset = page["next_offset"]
            if not offset:
                break
        ids = {item["id"] for item in listings}
        for case in cases:
            if case["expected_id"] not in ids or not case["query"].strip():
                raise SystemExit(f"Invalid evaluation case: {case}")
        rows = []
        for case in cases:
            response = client.post(f"{args.api}/api/search/text", json={"query":case["query"], "limit":100})
            response.raise_for_status()
            semantic_ids = [item["id"] for item in response.json()["items"]]
            tokens = keywords(case["query"])
            scores = [(len(tokens & keywords(f"{item['title']} {item['description']}")), item["id"]) for item in listings]
            # Zero-overlap records are not keyword matches. UUID breaks ties
            # consistently without reference to the expected answer.
            baseline_ids = [item_id for score,item_id in sorted(scores,key=lambda pair:(-pair[0],pair[1])) if score > 0]
            def rank(order):
                return order.index(case["expected_id"])+1 if case["expected_id"] in order else None
            rows.append({**case,"clip_rank":rank(semantic_ids),"keyword_rank":rank(baseline_ids)})
    summary = {}
    for method in ("clip", "keyword"):
        summary[method] = {f"top_{k}":sum(row[f"{method}_rank"] is not None and row[f"{method}_rank"] <= k for row in rows)/len(rows) for k in (1,5)}
    result = {"kind":"custom cases" if args.cases else "illustrative stock-photo demo", "items":len(listings), "cases":len(rows), "summary":summary,"results":rows,
              "limitations":"Small demo cases are not a benchmark. Top-five success is weak evidence when there are only six candidates. Search ranks are capped at 100 candidates."}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))


if __name__ == "__main__":
    main()
