"""The models this app offers, and which request settings each one accepts.

Claude models differ in what they accept: newer models reject `temperature`
and take `effort` instead; older ones are the other way round. Sending the
wrong one is a 400 error, so every request is built from this table.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class ModelInfo:
    id: str
    label: str
    description: str
    supports_temperature: bool
    supports_effort: bool
    # Server-side refusal fallback: if this model's safety classifiers decline
    # a request, the API re-runs it on another model in the same call.
    supports_fallbacks: bool


MODELS: dict[str, ModelInfo] = {
    m.id: m
    for m in [
        ModelInfo(
            "claude-haiku-4-5", "Haiku 4.5", "Fastest and cheapest",
            supports_temperature=True, supports_effort=False, supports_fallbacks=False,
        ),
        ModelInfo(
            "claude-sonnet-4-5", "Sonnet 4.5", "Previous-generation Sonnet",
            supports_temperature=True, supports_effort=False, supports_fallbacks=False,
        ),
        ModelInfo(
            "claude-sonnet-5-5", "Sonnet 5.5", "Fast and capable; cheaper than Sonnet 4.5",
            supports_temperature=False, supports_effort=True, supports_fallbacks=True,
        ),
        ModelInfo(
            "claude-opus-5-5", "Opus 5.5", "Most capable; slower and pricier",
            supports_temperature=False, supports_effort=True, supports_fallbacks=True,
        ),
    ]
}


def get_model(model_id: str) -> ModelInfo:
    return MODELS[model_id]
