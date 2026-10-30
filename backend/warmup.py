"""Download and verify CLIP before the demonstration."""
import os
from pathlib import Path
from .embeddings import ClipEncoder

if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    cache = Path(os.environ.get("FOUNDIT_DATA_DIR", root / "data")) / "models"
    encoder = ClipEncoder(cache)
    vector = encoder.encode("a blue backpack")
    print(f"CLIP ready: {len(vector)} dimensions. Model cached in {cache}.")
