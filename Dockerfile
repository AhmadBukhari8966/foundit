# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS frontend
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY index.html vite.config.js ./
COPY src ./src
RUN npm run build

FROM python:3.11-slim-bookworm AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    FOUNDIT_DATA_DIR=/data \
    FOUNDIT_MODEL_DIR=/opt/foundit-models \
    HF_HOME=/opt/huggingface \
    FOUNDIT_PRELOAD_MODEL=1 \
    TOKENIZERS_PARALLELISM=false \
    OMP_NUM_THREADS=2 \
    PORT=8000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends gosu && \
    rm -rf /var/lib/apt/lists/* && \
    useradd --create-home --uid 1000 appuser && \
    mkdir -p /data /opt/foundit-models /opt/huggingface && \
    chown -R appuser:appuser /app /data /opt/foundit-models /opt/huggingface
COPY backend/requirements.txt ./backend/requirements.txt
# CPU wheels avoid installing CUDA packages on the hosting server.
RUN pip install torch==2.8.0 --index-url https://download.pytorch.org/whl/cpu && \
    pip install -r backend/requirements.txt
COPY --chown=appuser:appuser backend ./backend
COPY --from=frontend --chown=appuser:appuser /build/dist ./dist
USER appuser
# Cache model weights in the image, separate from the mounted data volume.
RUN python -m backend.warmup
USER root
COPY docker-entrypoint.sh /usr/local/bin/foundit-entrypoint
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import os,urllib.request; urllib.request.urlopen('http://127.0.0.1:'+os.environ.get('PORT','8000')+'/api/health',timeout=4)" || exit 1
ENTRYPOINT ["sh", "/usr/local/bin/foundit-entrypoint"]
CMD ["sh", "-c", "exec python -m uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1"]
