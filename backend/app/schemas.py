from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.model_registry import MODELS

DEFAULT_TITLE = "New chat"

Effort = Literal["low", "medium", "high"]

# --- Request bodies (what the frontend sends) ---


class ConversationSettings(BaseModel):
    """Per-chat settings. None means "use the default"."""

    system_prompt: str | None = None
    model: str | None = None
    temperature: float | None = Field(default=None, ge=0, le=1)
    effort: Effort | None = None
    max_tokens: int | None = Field(default=None, ge=1, le=64000)

    @field_validator("model")
    @classmethod
    def known_model(cls, model: str | None) -> str | None:
        # Only models we know the capabilities of (and, in step 6, the prices of).
        if model is not None and model not in MODELS:
            raise ValueError(f"Unknown model. Choose one of: {', '.join(MODELS)}")
        return model

    @field_validator("system_prompt")
    @classmethod
    def blank_means_default(cls, prompt: str | None) -> str | None:
        return prompt if prompt and prompt.strip() else None


class ConversationCreate(ConversationSettings):
    title: str = Field(default=DEFAULT_TITLE, min_length=1, max_length=200)


class ConversationUpdate(ConversationSettings):
    # PATCH semantics: only the fields actually sent are changed (see the
    # route's exclude_unset). Sending a setting as null resets it to default.
    title: str | None = Field(default=None, min_length=1, max_length=200)


class ReplyRequest(BaseModel):
    # A new user message to add before Claude replies. Leave it out to retry:
    # Claude then replies to the conversation as it already is.
    content: str | None = Field(default=None, min_length=1)


# --- Response bodies (what the API returns) ---
# These mirror the columns in migrations/*.sql.


class ConversationSummary(BaseModel):
    id: UUID
    title: str
    updated_at: datetime


class Conversation(ConversationSummary):
    system_prompt: str | None
    model: str | None
    temperature: float | None
    effort: Effort | None
    max_tokens: int | None
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


class ModelOption(BaseModel):
    id: str
    label: str
    description: str
    supports_temperature: bool
    supports_effort: bool


class ModelsResponse(BaseModel):
    default: str
    models: list[ModelOption]
