"""Make a conversation fit in the context window (and our token budget) before calling Claude."""

import logging
from dataclasses import dataclass

import anthropic

from app import config
from app.streaming import MAX_TOKENS, client

logger = logging.getLogger(__name__)

# Room we always leave for Claude's reply. Input and output share the window.
RESERVED_FOR_REPLY = 16_000
# Used if the Models API can't be reached.
FALLBACK_CONTEXT_WINDOW = 200_000
# Our "which messages to drop" guess is based on character counts, which is
# only approximate, so aim a bit under the budget.
SAFETY_MARGIN = 0.9

_context_windows: dict[str, int] = {}


class ContextTooLongError(Exception):
    """Even the newest message alone doesn't fit."""


@dataclass
class FittedContext:
    messages: list[dict]
    system: str | None
    max_tokens: int
    input_tokens: int | None  # exact count, or None if counting failed
    trimmed_messages: int  # how many of the oldest messages were left out


async def context_window(model: str) -> int:
    """The model's maximum input size, asked once from the Models API and then cached."""
    if model not in _context_windows:
        try:
            info = await client.models.retrieve(model)
            _context_windows[model] = info.max_input_tokens or FALLBACK_CONTEXT_WINDOW
        except anthropic.APIError:
            logger.warning("Couldn't look up context window for %s; assuming %d", model, FALLBACK_CONTEXT_WINDOW)
            return FALLBACK_CONTEXT_WINDOW
    return _context_windows[model]


async def count_tokens(model: str, messages: list[dict], system: str | None) -> int:
    """Exact input size, from the API's free token-counting endpoint."""
    params = {"model": model, "messages": messages}
    if system:
        params["system"] = system
    return (await client.messages.count_tokens(**params)).input_tokens


def with_trim_note(system: str | None, trimmed: int) -> str | None:
    """Tell Claude that earlier messages are missing, so it doesn't act as if they never happened."""
    if trimmed == 0:
        return system
    note = (
        f"Note: the earliest {trimmed} messages of this conversation were left out "
        "to fit the context limit. If the user refers to something you can't see, say so."
    )
    return f"{system}\n\n{note}" if system else note


def oldest_messages_to_drop(messages: list[dict], total_tokens: int, budget: int) -> int:
    """Estimate how many of the oldest messages to drop to get under `budget`.

    We only know the total token count, so we guess each message's share from
    its share of the characters. Always keeps the newest message, and makes
    sure what's left starts with a user message (the API requires that).
    """
    excess = total_tokens - budget * SAFETY_MARGIN
    tokens_per_char = total_tokens / max(sum(len(m["content"]) for m in messages), 1)

    drop, freed = 0, 0.0
    while drop < len(messages) - 1 and freed < excess:
        freed += len(messages[drop]["content"]) * tokens_per_char
        drop += 1
    while drop < len(messages) - 1 and messages[drop]["role"] != "user":
        drop += 1
    return drop


async def fit_to_context(messages: list[dict], *, model: str, system: str | None) -> FittedContext:
    window = await context_window(model)
    budget = min(window - RESERVED_FOR_REPLY, config.MAX_CONTEXT_TOKENS)

    try:
        total = await count_tokens(model, messages, system)
    except anthropic.APIError:
        # Counting is a nice-to-have: if it fails, send everything and let the
        # API tell us if it's too long.
        logger.warning("Token counting failed; sending the full conversation", exc_info=True)
        return FittedContext(messages, system, MAX_TOKENS, None, 0)

    trimmed = 0
    while total > budget:
        drop = oldest_messages_to_drop(messages, total, budget)
        if drop == 0:
            raise ContextTooLongError(
                f"Your message is about {total:,} tokens, over this chat's limit of {budget:,}."
            )
        messages = messages[drop:]
        trimmed += drop
        # Re-count: our estimate might not have dropped enough.
        total = await count_tokens(model, messages, with_trim_note(system, trimmed))

    return FittedContext(
        messages=messages,
        system=with_trim_note(system, trimmed),
        # Input + output must fit in the window together.
        max_tokens=min(MAX_TOKENS, window - total),
        input_tokens=total,
        trimmed_messages=trimmed,
    )
