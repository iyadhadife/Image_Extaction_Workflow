"""Persistent storage of the API keys entered from the web interface.

Keys are saved in a local JSON file (git-ignored, chmod 600) and are never
sent back to the frontend in clear: only a masked version is exposed.
Keys set from the UI take precedence over the environment (.env).
"""
import json
import os
import threading
from pathlib import Path

DATA_DIR = Path(os.getenv("IDP_DATA_DIR", Path(__file__).resolve().parent / ".data"))
SETTINGS_FILE = DATA_DIR / "settings.json"

# api keys managed by the interface: name -> description
KNOWN_KEYS = {
    "GROQ_API_KEY": "Clé API Groq (modèles vision Llama 4 et structuration OCR)",
}

_lock = threading.Lock()


def _load():
    if not SETTINGS_FILE.exists():
        return {}
    try:
        return json.loads(SETTINGS_FILE.read_text())
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = SETTINGS_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(data, indent=2))
    os.chmod(tmp, 0o600)
    tmp.replace(SETTINGS_FILE)


def mask(value):
    if not value:
        return None
    if len(value) <= 8:
        return "•" * len(value)
    return f"{value[:4]}{'•' * 8}{value[-4:]}"


def get_key(name):
    """Return (value, source) where source is 'ui', 'env' or None."""
    with _lock:
        stored = _load().get(name)
    if stored:
        return stored, "ui"
    env_value = os.getenv(name)
    if env_value:
        return env_value, "env"
    return None, None


def set_key(name, value):
    with _lock:
        data = _load()
        data[name] = value
        _save(data)


def delete_key(name):
    with _lock:
        data = _load()
        if data.pop(name, None) is not None:
            _save(data)


def describe_keys():
    result = []
    for name, description in KNOWN_KEYS.items():
        value, source = get_key(name)
        result.append({
            "name": name,
            "description": description,
            "configured": value is not None,
            "source": source,
            "masked": mask(value),
        })
    return result
