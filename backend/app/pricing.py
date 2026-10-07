"""Turn token counts into dollars.

Prices are USD per million tokens, from
https://platform.claude.com/docs/en/about-claude/pricing (checked 2026-10-07).
They change over time, so re-check that page when adding a model.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Price:
    input: float  # normal (uncached) input
    cache_write: float  # writing a prefix to the 5-minute prompt cache (1.25x input)
    cache_read: float  # reading a cached prefix (0.05x-0.1x input)
    output: float  # output, including any thinking tokens


PRICES: dict[str, Price] = {
    "claude-haiku-4-5": Price(input=1.00, cache_write=1.25, cache_read=0.10, output=5.00),
    "claude-sonnet-4-5": Price(input=3.00, cache_write=3.75, cache_read=0.30, output=15.00),
    "claude-sonnet-5-5": Price(input=2.00, cache_write=2.50, cache_read=0.20, output=10.00),
    "claude-opus-5-5": Price(input=4.00, cache_write=5.00, cache_read=0.20, output=20.00),
    # Not offered in the app, but Sonnet/Opus 5.5 can fall back to them on a refusal.
    "claude-opus-5": Price(input=5.00, cache_write=6.25, cache_read=0.50, output=25.00),
    "claude-opus-4-8": Price(input=5.00, cache_write=6.25, cache_read=0.50, output=25.00),
}


def price_for(model: str) -> Price | None:
    """Look up a model's price. The API reports some models with a date suffix
    (e.g. "claude-sonnet-4-5-20250929"), so match the longest known prefix."""
    matches = [key for key in PRICES if model == key or model.startswith(key + "-")]
    return PRICES[max(matches, key=len)] if matches else None


def cost_usd(usage: dict) -> float | None:
    """Cost of one reply from its usage numbers. None if the model's price is unknown.

    `input_tokens` counts only the *uncached* part of the input; the cached
    parts are reported separately and priced differently.
    """
    price = price_for(usage.get("model") or "")
    if price is None or usage.get("input_tokens") is None:
        return None
    total = (
        usage["input_tokens"] * price.input
        + (usage.get("cache_creation_input_tokens") or 0) * price.cache_write
        + (usage.get("cache_read_input_tokens") or 0) * price.cache_read
        + (usage.get("output_tokens") or 0) * price.output
    )
    return total / 1_000_000
