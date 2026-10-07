import json
import logging
from collections.abc import AsyncIterator

import anthropic

from app import config
from app.model_registry import get_model

logger = logging.getLogger(__name__)

MAX_TOKENS = 64000
FALLBACK_BETA = "server-side-fallback-2026-07-01"

# One shared async client for the whole app. It holds a connection pool, so
# creating one per request would waste connections.
client = anthropic.AsyncAnthropic(api_key=config.ANTHROPIC_API_KEY)

StreamEvent = tuple[str, dict]


def sse(event: str, data: dict) -> str:
    """Format one Server-Sent Event: an `event:` line, a `data:` line, a blank line."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


def api_error_message(e: anthropic.APIStatusError) -> str:
    """Pull the human-readable message out of the API's error JSON body."""
    if isinstance(e.body, dict):
        message = e.body.get("error", {}).get("message")
        if message:
            return message
    return f"Claude API error ({e.status_code})"


async def stream_claude(
    messages: list[dict],
    *,
    model: str,
    system: str | None = None,
    max_tokens: int = MAX_TOKENS,
    temperature: float | None = None,
    effort: str | None = None,
) -> AsyncIterator[StreamEvent]:
    """Stream Claude's reply as (event, data) pairs: text_delta*, then usage + done, or error.

    Knows nothing about HTTP or the database; callers decide what to do with each event.
    Settings the model doesn't support are left out (sending them would be a 400).
    """
    info = get_model(model)
    params = {"model": model, "max_tokens": max_tokens, "messages": messages}
    if system:
        params["system"] = system
    if effort is not None and info.supports_effort:
        params["output_config"] = {"effort": effort}
    if temperature is not None and info.supports_temperature:
        # SDK 1.x removed `temperature` from its signatures (newer models reject
        # it), so for the older models that still accept it we pass it raw.
        params["extra_body"] = {"temperature": temperature}

    if info.supports_fallbacks:
        # Beta feature: if a safety classifier declines, the API re-runs the
        # request on a recommended fallback model instead of returning a refusal.
        stream_cm = client.beta.messages.stream(
            **params, betas=[FALLBACK_BETA], fallbacks="default"
        )
    else:
        stream_cm = client.messages.stream(**params)

    try:
        async with stream_cm as stream:
            async for text in stream.text_stream:
                yield "text_delta", {"text": text}

            final = await stream.get_final_message()

        yield "usage", {
            "model": final.model,
            "input_tokens": final.usage.input_tokens,
            "output_tokens": final.usage.output_tokens,
            "cache_read_input_tokens": final.usage.cache_read_input_tokens or 0,
            "cache_creation_input_tokens": final.usage.cache_creation_input_tokens or 0,
        }
        yield "done", {"stop_reason": final.stop_reason}

    # Most specific first: each tells the UI whether "Retry" makes sense.
    except anthropic.AuthenticationError:
        yield "error", {"message": "Server API key is invalid", "retryable": False}
    except anthropic.RateLimitError:
        yield "error", {"message": "Rate limited, try again shortly", "retryable": True}
    except anthropic.BadRequestError as e:
        yield "error", {"message": api_error_message(e), "retryable": False}
    except anthropic.APIStatusError as e:
        yield "error", {"message": api_error_message(e), "retryable": e.status_code >= 500}
    except anthropic.APIConnectionError:
        yield "error", {"message": "Could not reach the Claude API", "retryable": True}
    except Exception:
        logger.exception("Unexpected error while streaming")
        yield "error", {"message": "Unexpected server error", "retryable": True}
