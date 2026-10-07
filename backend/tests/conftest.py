"""Shared test setup. pytest loads this file automatically before any test.

Tests must never touch the real Claude API or database (that would cost money
and change your data), so we set fake config *before* the app is imported.
load_dotenv() never overrides variables that are already set, so these win
over backend/.env.
"""

import os

os.environ["ANTHROPIC_API_KEY"] = "test-key"
os.environ["CLAUDE_MODEL"] = "claude-sonnet-4-5"
os.environ["SUPABASE_URL"] = "https://test.invalid"
os.environ["SUPABASE_SECRET_KEY"] = "test-key"
os.environ["APP_PASSWORD"] = "test-password-123"
os.environ["MAX_CONTEXT_TOKENS"] = "100000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402

AUTH = {"Authorization": "Bearer test-password-123"}


@pytest.fixture
def anyio_backend():
    """Run `@pytest.mark.anyio` tests on asyncio (what uvicorn uses)."""
    return "asyncio"


@pytest.fixture
def client():
    """An HTTP client for the app. Not used with `with`, so the startup
    lifespan (which would connect to Supabase) doesn't run."""
    return TestClient(app)
