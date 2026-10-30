"""One shared CLIP encoder for uploaded photos and search queries."""
import logging
import os
from pathlib import Path
from threading import RLock

logger = logging.getLogger(__name__)
MODEL_NAME = "sentence-transformers/clip-ViT-B-32"
VECTOR_SIZE = 512


class EmbeddingUnavailable(RuntimeError):
    pass


class ClipEncoder:
    def __init__(self, cache_dir: Path):
        self.cache_dir = Path(os.environ.get("FOUNDIT_MODEL_DIR", cache_dir))
        self.model = None
        self.lock = RLock()

    @property
    def ready(self):
        return self.model is not None

    def load(self):
        with self.lock:
            if self.model is None:
                try:
                    os.environ.setdefault("HF_HOME", str(self.cache_dir.parent / "huggingface"))
                    from sentence_transformers import SentenceTransformer
                    options = {"cache_folder": str(self.cache_dir), "device": "cpu"}
                    try:
                        # Prefer the cache so a campus demo works without Wi-Fi.
                        self.model = SentenceTransformer(MODEL_NAME, local_files_only=True, **options)
                    except OSError:
                        self.model = SentenceTransformer(MODEL_NAME, **options)
                except Exception as exc:
                    logger.exception("Could not load CLIP")
                    raise EmbeddingUnavailable(
                        "CLIP could not load. The first run needs internet access to download "
                        "the model. Check the backend logs and run python -m backend.warmup."
                    ) from exc
        return self.model

    def encode(self, value):
        with self.lock:
            model = self.load()
            return model.encode(value, normalize_embeddings=True, show_progress_bar=False).tolist()
