# ---------- 1. build the React frontend ----------
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. python backend serving the API + built frontend ----------
FROM python:3.11-slim AS runtime

# set to "true" to enable the "EasyOCR + LLM" mode (adds torch, ~2 GB)
ARG INSTALL_EASYOCR=false

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    IDP_DATA_DIR=/data

WORKDIR /app

COPY backend/requirements.txt backend/requirements.txt
RUN pip install -r backend/requirements.txt \
    && if [ "$INSTALL_EASYOCR" = "true" ]; then \
         apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
         && rm -rf /var/lib/apt/lists/* \
         && pip install --extra-index-url https://download.pytorch.org/whl/cpu easyocr; \
       fi

COPY src/ src/
COPY backend/ backend/
COPY schemas/ schemas/
COPY --from=frontend /app/frontend/dist frontend/dist

# api keys entered from the interface are persisted here
RUN useradd --create-home --uid 1000 app && mkdir -p /data && chown app:app /data
USER app
VOLUME ["/data"]

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/health')" || exit 1

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
