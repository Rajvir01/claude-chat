"""Glue between Claude streaming and the database: relay events, then save the reply."""

import logging
from collections.abc import AsyncIterator

import anyio

from app import db
from app.context import FittedContext
from app.pricing import cost_usd
from app.streaming import sse, stream_claude

logger = logging.getLogger(__name__)


def make_title(first_message: str, limit: int = 60) -> str:
    text = " ".join(first_message.split())  # collapse newlines and repeated spaces
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


async def reply_stream(conversation: dict, model: str, context: FittedContext) -> AsyncIterator[str]:
    """Stream Claude's reply as SSE, saving it to the database as it finishes."""
    conversation_id = conversation["id"]
    parts: list[str] = []
    usage: dict = {}
    # True once the reply is saved or failed: nothing left to clean up.
    settled = False

    # First event: what we're sending Claude, so the UI can say if history was trimmed.
    yield sse("context", {"input_tokens": context.input_tokens, "trimmed_messages": context.trimmed_messages})

    try:
        async for event, data in stream_claude(
            context.messages,
            model=model,
            system=context.system,
            max_tokens=context.max_tokens,
            temperature=conversation["temperature"],
            effort=conversation["effort"],
        ):
            if event == "text_delta":
                parts.append(data["text"])
            elif event == "usage":
                usage = data  # saved to the database as-is (these keys are table columns)
                data = {**data, "cost_usd": cost_usd(data)}
            elif event == "error":
                settled = True
            elif event == "done":
                settled = True
                text = "".join(parts)
                # A reply can legitimately be empty (e.g. a refusal); there's nothing to save then.
                if text:
                    try:
                        await db.add_message(
                            conversation_id, "assistant", text, stop_reason=data["stop_reason"], **usage
                        )
                    except Exception:
                        logger.exception("Failed to save assistant message")
                        yield sse("error", {"message": "Reply finished but couldn't be saved", "retryable": True})
                        return

            yield sse(event, data)

    finally:
        # We only get here unsettled if the stream was cut off: the user pressed
        # Stop, closed the tab, or switched chats. Keep what Claude wrote so far.
        #
        # The server cancels this generator when the browser disconnects, and
        # that cancellation would also hit our database `await`. A shielded
        # scope lets this one save finish before the cancellation continues.
        if not settled and parts:
            with anyio.CancelScope(shield=True):
                try:
                    await db.add_message(
                        conversation_id, "assistant", "".join(parts), stop_reason="stopped", **usage
                    )
                except Exception:
                    logger.exception("Failed to save partial reply")
