from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    # Shown as the pre-filled body in /docs, instead of "string" placeholders.
    model_config = ConfigDict(
        json_schema_extra={
            "examples": [
                {"messages": [{"role": "user", "content": "Explain what a token is in one short paragraph."}]}
            ]
        }
    )

    # The Claude API is stateless: every request carries the whole conversation.
    messages: list[ChatMessage] = Field(min_length=1)
    system: str | None = None
    # None means "use CLAUDE_MODEL from .env".
    model: str | None = None
    max_tokens: int = Field(default=64000, ge=1, le=128000)

    @model_validator(mode="after")
    def check_turn_order(self) -> "ChatRequest":
        if self.messages[0].role != "user":
            raise ValueError("The first message must be from the user")
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be from the user")
        return self
