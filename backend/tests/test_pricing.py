import pytest

from app.pricing import cost_usd, price_for


def test_price_lookup_ignores_date_suffix():
    assert price_for("claude-sonnet-4-5-20250929") == price_for("claude-sonnet-4-5")


def test_unknown_model_has_no_price():
    assert price_for("gpt-5") is None
    assert cost_usd({"model": "gpt-5", "input_tokens": 10, "output_tokens": 10}) is None


def test_cost_uses_a_different_price_for_each_token_type():
    # Real numbers from a cached Sonnet 4.5 reply.
    usage = {
        "model": "claude-sonnet-4-5-20250929",
        "input_tokens": 3,  # $3.00 / MTok
        "cache_creation_input_tokens": 12,  # $3.75 / MTok
        "cache_read_input_tokens": 1816,  # $0.30 / MTok
        "output_tokens": 4,  # $15.00 / MTok
    }
    expected = (3 * 3.00 + 12 * 3.75 + 1816 * 0.30 + 4 * 15.00) / 1_000_000
    assert cost_usd(usage) == pytest.approx(expected)


def test_user_messages_have_no_cost():
    # User rows in the database have no token counts.
    assert cost_usd({"model": None, "input_tokens": None}) is None
