"""HTTP-level tests: auth, validation, and what each route sends to the database."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app import main
from tests.conftest import AUTH

NOW = datetime.now(timezone.utc).isoformat()


def conversation_row(**overrides) -> dict:
    row = {
        "id": str(uuid4()), "title": "New chat", "updated_at": NOW, "created_at": NOW,
        "system_prompt": None, "model": None, "temperature": None, "effort": None, "max_tokens": None,
    }
    return {**row, **overrides}


# --- Password ---


def test_health_needs_no_password(client):
    assert client.get("/health").status_code == 200


@pytest.mark.parametrize(
    "method, path",
    [
        ("get", "/conversations"),
        ("get", "/models"),
        ("post", "/conversations"),
        ("get", f"/conversations/{uuid4()}"),
        ("delete", f"/conversations/{uuid4()}"),
        ("post", f"/conversations/{uuid4()}/reply"),
    ],
)
def test_every_api_route_needs_the_password(client, method, path):
    assert getattr(client, method)(path).status_code == 401
    assert getattr(client, method)(path, headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_auth_check_accepts_the_right_password(client):
    assert client.get("/auth/check", headers=AUTH).json() == {"ok": True}


# --- Validation (rejected before any database call) ---


def test_unknown_model_is_rejected(client):
    response = client.post("/conversations", json={"model": "gpt-5"}, headers=AUTH)
    assert response.status_code == 422


def test_invalid_conversation_id_is_rejected(client):
    assert client.get("/conversations/not-a-uuid", headers=AUTH).status_code == 422


def test_missing_conversation_is_404(client, monkeypatch):
    async def get_conversation(conversation_id):
        return None

    monkeypatch.setattr(main.db, "get_conversation", get_conversation)
    assert client.get(f"/conversations/{uuid4()}", headers=AUTH).status_code == 404


# --- PATCH only changes what was sent ---


def test_patch_sends_only_the_fields_given(client, monkeypatch):
    sent = {}

    async def update_conversation(conversation_id, fields):
        sent.update(fields)
        return conversation_row(**fields)

    monkeypatch.setattr(main.db, "update_conversation", update_conversation)

    response = client.patch(f"/conversations/{uuid4()}", json={"title": "Renamed"}, headers=AUTH)

    assert response.status_code == 200
    assert sent == {"title": "Renamed"}  # settings untouched, not reset to null


# --- /reply rejects an over-long message without saving it ---


def test_too_long_message_is_rejected_and_not_saved(client, monkeypatch):
    saved = []

    async def get_conversation(conversation_id):
        return conversation_row(id=str(conversation_id))

    async def list_messages(conversation_id):
        return []

    async def add_message(*args, **kwargs):
        saved.append(args)

    async def fit_to_context(*args, **kwargs):
        raise main.ContextTooLongError("too long")

    monkeypatch.setattr(main.db, "get_conversation", get_conversation)
    monkeypatch.setattr(main.db, "list_messages", list_messages)
    monkeypatch.setattr(main.db, "add_message", add_message)
    monkeypatch.setattr(main, "fit_to_context", fit_to_context)

    response = client.post(f"/conversations/{uuid4()}/reply", json={"content": "x" * 5000}, headers=AUTH)

    assert response.status_code == 413
    assert saved == []
