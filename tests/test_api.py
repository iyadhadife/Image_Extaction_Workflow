import io

import pytest
from fastapi.testclient import TestClient


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.delenv("GROQ_API_KEY", raising=False)
    from backend import settings_store, main

    monkeypatch.setattr(settings_store, "DATA_DIR", tmp_path)
    monkeypatch.setattr(settings_store, "SETTINGS_FILE", tmp_path / "settings.json")
    monkeypatch.setattr(main, "extract_document", lambda img, model, key, schema: {"type": "id_card", "key": key, "schema": schema})
    return TestClient(main.app)


def test_key_lifecycle_is_masked(client, tmp_path):
    assert client.get("/api/settings/keys").json()[0]["configured"] is False

    keys = client.put("/api/settings/keys/GROQ_API_KEY", json={"value": "gsk_secretvalue1234"}).json()
    assert keys[0] == {
        "name": "GROQ_API_KEY",
        "description": keys[0]["description"],
        "configured": True,
        "source": "ui",
        "masked": "gsk_••••••••1234",
    }
    assert "gsk_secretvalue1234" not in client.get("/api/settings/keys").text
    assert (tmp_path / "settings.json").stat().st_mode & 0o777 == 0o600

    assert client.delete("/api/settings/keys/GROQ_API_KEY").json()[0]["configured"] is False


def test_env_key_is_fallback(client, monkeypatch):
    monkeypatch.setenv("GROQ_API_KEY", "gsk_fromenvironment")
    assert client.get("/api/settings/keys").json()[0]["source"] == "env"


def test_unknown_or_empty_key_rejected(client):
    assert client.put("/api/settings/keys/OTHER", json={"value": "x"}).status_code == 404
    assert client.put("/api/settings/keys/GROQ_API_KEY", json={"value": "  "}).status_code == 400


def _upload(client, **form):
    files = {"file": ("doc.png", io.BytesIO(b"\x89PNG fake"), "image/png")}
    return client.post("/api/extract", files=files, data=form)


def test_extract_requires_key(client):
    r = _upload(client)
    assert r.status_code == 400
    assert "GROQ_API_KEY" in r.json()["detail"]


def test_extract_uses_ui_key_and_schema(client):
    client.put("/api/settings/keys/GROQ_API_KEY", json={"value": "gsk_secretvalue1234"})
    r = _upload(client, schema_json='{"type": "id_card"}')
    assert r.status_code == 200
    body = r.json()
    assert body["file"] == "doc.png"
    assert body["data"]["key"] == "gsk_secretvalue1234"
    assert body["data"]["schema"] == '{"type": "id_card"}'


def test_extract_validates_input(client):
    client.put("/api/settings/keys/GROQ_API_KEY", json={"value": "gsk_secretvalue1234"})
    assert _upload(client, schema_json="{not json").status_code == 400
    assert _upload(client, model="unknown").status_code == 400


def test_schemas_and_models(client):
    names = [s["name"] for s in client.get("/api/schemas").json()]
    assert "id_card_schema.json" in names
    assert any(m["id"] == "easyocr" for m in client.get("/api/models").json())
