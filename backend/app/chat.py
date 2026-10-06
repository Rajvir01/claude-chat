"""Glue between Claude streaming and the database: relay events, then save the reply."""

import logging
from collections.abc import AsyncIterator

import anyio

from app import config, db
from app.streaming import sse, stream_claude

logger = logging.getLogger(__name__)


def make_title(first_message: str, limit: int = 60) -> str:
    text = " ".join(first_message.split())  # collapse newlines and repeated spaces
    return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"


async def reply_stream(conversation: dict, history: list[dict]) -> AsyncIterator[str]:
    """Stream Claude's reply to `history` as SSE, saving it to the database as it finishes."""
    conversation_id = conversation["id"]
    parts: list[str] = []
    usage: dict = {}
    # True once the reply is saved or failed: nothing left to clean up.
    settled = False

    try:
        async for event, data in stream_claude(
            [{"role": m["role"], "content": m["content"]} for m in history],
            model=conversation["model"] or config.CLAUDE_MODEL,
            system=conversation["system_prompt"],
        ):
            if event == "text_delta":
                parts.append(data["text"])
            elif event == "usage":
                usage = data
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
