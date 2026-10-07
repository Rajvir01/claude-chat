"""Every database query lives here, so the rest of the app never writes SQL-ish code."""

from uuid import UUID

from supabase import AsyncClient, acreate_client

from app import config

_client: AsyncClient | None = None


async def connect() -> None:
    """Create the shared client once, at server startup (see lifespan in main.py)."""
    global _client
    _client = await acreate_client(config.SUPABASE_URL, config.SUPABASE_SECRET_KEY)


def _db() -> AsyncClient:
    if _client is None:
        raise RuntimeError("Database not connected. Was connect() called at startup?")
    return _client


# --- Conversations ---


async def list_conversations() -> list[dict]:
    res = await (
        _db().table("conversations")
        .select("id, title, updated_at")
        .order("updated_at", desc=True)
        .execute()
    )
    return res.data


async def create_conversation(fields: dict) -> dict:
    res = await _db().table("conversations").insert(fields).execute()
    return res.data[0]


async def get_conversation(conversation_id: UUID) -> dict | None:
    res = await (
        _db().table("conversations").select("*").eq("id", str(conversation_id)).limit(1).execute()
    )
    return res.data[0] if res.data else None


async def update_conversation(conversation_id: UUID, fields: dict) -> dict | None:
    res = await _db().table("conversations").update(fields).eq("id", str(conversation_id)).execute()
    return res.data[0] if res.data else None


async def delete_conversation(conversation_id: UUID) -> bool:
    """Returns False if there was nothing to delete. Messages go too (on delete cascade)."""
    res = await _db().table("conversations").delete().eq("id", str(conversation_id)).execute()
    return bool(res.data)


# --- Messages ---


async def list_messages(conversation_id: UUID) -> list[dict]:
    res = await (
        _db().table("messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("created_at")
        .execute()
    )
    return res.data


async def add_message(conversation_id: UUID, role: str, content: str, **fields) -> dict:
    """Insert one message. `fields` holds assistant extras: stop_reason, model, token counts."""
    row = {"conversation_id": str(conversation_id), "role": role, "content": content, **fields}
    res = await _db().table("messages").insert(row).execute()
    return res.data[0]
