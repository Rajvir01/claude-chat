from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

DEFAULT_TITLE = "New chat"

# --- Request bodies (what the frontend sends) ---


class ConversationCreate(BaseModel):
    title: str = Field(default=DEFAULT_TITLE, min_length=1, max_length=200)
    system_prompt: str | None = None
    # None means "use CLAUDE_MODEL from .env".
    model: str | None = None


class ConversationUpdate(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class ReplyRequest(BaseModel):
    # A new user message to add before Claude replies. Leave it out to retry:
    # Claude then replies to the conversation as it already is.
    content: str | None = Field(default=None, min_length=1)


# --- Response bodies (what the API returns) ---
# These mirror the columns in migrations/001_chat_schema.sql.


class ConversationSummary(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class Conversation(ConversationSummary):
    system_prompt: str | None
    model: str | None
    created_at: datetime


class Message(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    stop_reason: str | None
    model: str | None
    input_tokens: int | None
    output_tokens: int | None
    cache_read_input_tokens: int | None
    cache_creation_input_tokens: int | None
    created_at: datetime


class ConversationDetail(Conversation):
    messages: list[Message]
