import pytest

from app import config, context


def conversation(turns: int) -> list[dict]:
    """`turns` question/answer pairs plus a final question, each ~400 characters."""
    messages = []
    for i in range(turns):
        messages.append({"role": "user", "content": f"Q{i} " + "x" * 400})
        messages.append({"role": "assistant", "content": f"A{i} " + "y" * 400})
    messages.append({"role": "user", "content": "final question"})
    return messages


@pytest.fixture
def fake_counting(monkeypatch):
    """Replace the API calls with a fake: 1 token per 4 characters, 1M window."""

    async def count_tokens(model, messages, system):
        return sum(len(m["content"]) for m in messages) // 4 + len(system or "") // 4

    async def context_window(model):
        return 1_000_000

    monkeypatch.setattr(context, "count_tokens", count_tokens)
    monkeypatch.setattr(context, "context_window", context_window)


@pytest.mark.anyio
async def test_short_conversation_is_sent_whole(fake_counting):
    messages = conversation(3)
    fitted = await context.fit_to_context(messages, model="claude-sonnet-4-5", system=None)
    assert fitted.messages == messages
    assert fitted.trimmed_messages == 0
    assert fitted.system is None


@pytest.mark.anyio
async def test_long_conversation_drops_oldest_messages(fake_counting, monkeypatch):
    monkeypatch.setattr(config, "MAX_CONTEXT_TOKENS", 500)
    messages = conversation(10)  # ~2,000 fake tokens

    fitted = await context.fit_to_context(messages, model="claude-sonnet-4-5", system="Be brief.")

    assert fitted.input_tokens <= 500
    assert fitted.messages[-1]["content"] == "final question"  # newest always kept
    assert fitted.messages[0]["role"] == "user"  # API requires a user message first
    assert fitted.messages == messages[fitted.trimmed_messages :]  # only the oldest dropped
    assert "left out" in fitted.system and fitted.system.startswith("Be brief.")


@pytest.mark.anyio
async def test_a_single_huge_message_is_rejected(fake_counting, monkeypatch):
    monkeypatch.setattr(config, "MAX_CONTEXT_TOKENS", 50)
    huge = [{"role": "user", "content": "z" * 1000}]
    with pytest.raises(context.ContextTooLongError):
        await context.fit_to_context(huge, model="claude-sonnet-4-5", system=None)


@pytest.mark.anyio
async def test_reply_length_cap_is_respected(fake_counting):
    fitted = await context.fit_to_context(
        conversation(1), model="claude-sonnet-4-5", system=None, max_reply_tokens=300
    )
    assert fitted.max_tokens == 300
