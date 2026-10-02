"""FastAPI backend of the IDP project.

Run with:  uvicorn backend.main:app --reload --port 8000
"""
import json
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from groq import APIConnectionError, AuthenticationError, Groq
from pydantic import BaseModel

from backend import settings_store
from src.pipeline import OCR_MODEL, VISION_MODELS, extract_document

load_dotenv()

ROOT_DIR = Path(__file__).resolve().parent.parent
SCHEMA_DIR = ROOT_DIR / "schemas"
FRONTEND_DIST = ROOT_DIR / "frontend" / "dist"
MAX_FILE_SIZE = 20 * 1024 * 1024
ALLOWED_TYPES = {"image/png", "image/jpeg", "image/jpg", "image/webp"}

app = FastAPI(title="IDP GenAI API", version="2.0.0")


class KeyPayload(BaseModel):
    value: str


class KeyTestPayload(BaseModel):
    value: str | None = None


def _require_known_key(name):
    if name not in settings_store.KNOWN_KEYS:
        raise HTTPException(404, f"Clé inconnue : {name}")


def _check_groq_key(api_key):
    try:
        Groq(api_key=api_key).models.list()
    except AuthenticationError:
        return False, "Clé refusée par Groq (invalide ou révoquée)"
    except APIConnectionError:
        return False, "Impossible de joindre l'API Groq (vérifiez la connexion réseau)"
    except Exception as e:
        return False, str(e)
    return True, None


# ---------- health & config ----------

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/models")
def list_models():
    models = [{"id": m, "label": "Llama 4 Vision", "kind": "vision",
               "description": "Analyse directe de l'image par un LLM multimodal"} for m in VISION_MODELS]
    models.append({"id": OCR_MODEL, "label": "EasyOCR + LLM", "kind": "ocr",
                   "description": "OCR local puis structuration du texte par Llama 3.1"})
    return models


@app.get("/api/schemas")
def list_schemas():
    schemas = []
    for path in sorted(SCHEMA_DIR.glob("*.json")):
        schemas.append({"name": path.name, "content": path.read_text()})
    return schemas


# ---------- api keys ----------

@app.get("/api/settings/keys")
def get_keys():
    return settings_store.describe_keys()


@app.put("/api/settings/keys/{name}")
def put_key(name: str, payload: KeyPayload):
    _require_known_key(name)
    value = payload.value.strip()
    if not value:
        raise HTTPException(400, "La clé ne peut pas être vide")
    settings_store.set_key(name, value)
    return settings_store.describe_keys()


@app.delete("/api/settings/keys/{name}")
def delete_key(name: str):
    _require_known_key(name)
    settings_store.delete_key(name)
    return settings_store.describe_keys()


@app.post("/api/settings/keys/{name}/test")
async def test_key(name: str, payload: KeyTestPayload):
    _require_known_key(name)
    value = (payload.value or "").strip() or settings_store.get_key(name)[0]
    if not value:
        raise HTTPException(400, "Aucune clé à tester")
    ok, error = await run_in_threadpool(_check_groq_key, value)
    return {"valid": ok, "error": error}


# ---------- extraction ----------

@app.post("/api/extract")
async def extract(
    file: UploadFile = File(...),
    model: str = Form(VISION_MODELS[0]),
    schema_text: str | None = Form(None, alias="schema_json"),
):
    if model not in VISION_MODELS and model != OCR_MODEL:
        raise HTTPException(400, f"Modèle inconnu : {model}")
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, f"Format non supporté : {file.content_type}")

    api_key, _ = settings_store.get_key("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(400, "Clé GROQ_API_KEY manquante : renseignez-la dans les paramètres")

    schema = (schema_text or "").strip() or None
    if schema:
        try:
            json.loads(schema)
        except json.JSONDecodeError as e:
            raise HTTPException(400, f"Schéma JSON invalide : {e}")

    img_bytes = await file.read()
    if len(img_bytes) > MAX_FILE_SIZE:
        raise HTTPException(413, "Fichier trop volumineux (max 20 Mo)")

    try:
        data = await run_in_threadpool(extract_document, img_bytes, model, api_key, schema)
    except Exception as e:
        raise HTTPException(502, f"Erreur d'extraction : {e}")

    return {"file": file.filename, "model": model, "data": data}


# ---------- frontend (production build) ----------

if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        target = FRONTEND_DIST / path
        if path and target.is_file() and FRONTEND_DIST in target.resolve().parents:
            return FileResponse(target)
        return FileResponse(FRONTEND_DIST / "index.html")
