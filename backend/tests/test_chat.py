"""reply_stream: relaying Claude's events and saving the reply, including on Stop."""

import anyio
import pytest

from app import chat
from app.context import FittedContext

CONVERSATION = {"id": "c1", "temperature": None, "effort": None}
CONTEXT = FittedContext(
    messages=[{"role": "user", "content": "hi"}], system=None, max_tokens=100, input_tokens=5, trimmed_messages=0
)


@pytest.fixture
def saved(monkeypatch):
    """Fake database: records saved messages instead of writing them."""
    rows = []

    async def add_message(conversation_id, role, content, **fields):
        await anyio.sleep(0.01)  # like a real network call, so cancellation can hit it
        rows.append({"role": role, "content": content, **fields})
        return rows[-1]

    monkeypatch.setattr(chat.db, "add_message", add_message)
    return rows


def fake_claude(words, finish=True):
    async def stream_claude(messages, **kwargs):
        for word in words:
            await anyio.sleep(0.02)
            yield "text_delta", {"text": word}
        if finish:
            yield "usage", {"model": "claude-sonnet-4-5", "input_tokens": 5, "output_tokens": 2,
                            "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0}
            yield "done", {"stop_reason": "end_turn"}

    return stream_claude


@pytest.mark.anyio
async def test_full_reply_is_relayed_and_saved(saved, monkeypatch):
    monkeypatch.setattr(chat, "stream_claude", fake_claude(["Hello", " there"]))

    events = [e async for e in chat.reply_stream(CONVERSATION, "claude-sonnet-4-5", CONTEXT)]

    assert events[0].startswith("event: context")
    assert sum(e.startswith("event: text_delta") for e in events) == 2
    assert '"cost_usd"' in next(e for e in events if e.startswith("event: usage"))
    assert events[-1].startswith("event: done")
    assert saved == [{
        "role": "assistant", "content": "Hello there", "stop_reason": "end_turn", "model": "claude-sonnet-4-5",
        "input_tokens": 5, "output_tokens": 2, "cache_read_input_tokens": 0, "cache_creation_input_tokens": 0,
    }]


@pytest.mark.anyio
async def test_stopped_reply_keeps_partial_text(saved, monkeypatch):
    """Pressing Stop cancels the stream; the shielded save must still happen."""
    monkeypatch.setattr(chat, "stream_claude", fake_claude(["one", " two", " three", " four", " five"]))

    with anyio.move_on_after(0.05):  # cancel mid-reply, like a browser disconnect
        async for _ in chat.reply_stream(CONVERSATION, "claude-sonnet-4-5", CONTEXT):
            pass

    assert len(saved) == 1
    assert saved[0]["stop_reason"] == "stopped"
    assert saved[0]["content"].startswith("one")
    assert saved[0]["content"] != "one two three four five"


@pytest.mark.anyio
async def test_failed_reply_saves_nothing(saved, monkeypatch):
    async def failing_claude(messages, **kwargs):
        yield "text_delta", {"text": "partial"}
        yield "error", {"message": "Overloaded", "retryable": True}

    monkeypatch.setattr(chat, "stream_claude", failing_claude)

    events = [e async for e in chat.reply_stream(CONVERSATION, "claude-sonnet-4-5", CONTEXT)]

    assert events[-1].startswith("event: error")
    assert saved == []  # so Retry starts clean from the user's message


def test_title_is_trimmed_to_one_short_line():
    assert chat.make_title("  Explain\n\ntokens   please ") == "Explain tokens please"
    long_title = chat.make_title("word " * 50)
    assert len(long_title) <= 60 and long_title.endswith("…")
