import os

from dotenv import load_dotenv

from app.model_registry import MODELS

# Reads backend/.env into os.environ. In production (Render/Railway) there is
# no .env file; the host injects real environment variables instead, and this
# call simply does nothing.
load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "")

# The secret key bypasses Row Level Security, so it must only ever live on
# the server. Never send it to the browser or put it in a NEXT_PUBLIC_ var.
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")

# Shared password the frontend must send with every request.
APP_PASSWORD = os.getenv("APP_PASSWORD", "")

# Most input tokens we'll send per request. Models accept far more (Sonnet 4.5
# takes 1M), but every request pays for its whole input, so this is a cost cap.
# Set it very low (e.g. 1500) to watch old messages get trimmed.
MAX_CONTEXT_TOKENS = int(os.getenv("MAX_CONTEXT_TOKENS", "100000"))

# Comma-separated list of browser origins allowed to call this API (CORS).
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Fail at startup, not on the first request, if config is missing.
assert ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY cannot be empty. Update backend/.env"
assert CLAUDE_MODEL, "CLAUDE_MODEL cannot be empty. Update backend/.env"
assert CLAUDE_MODEL in MODELS, f"CLAUDE_MODEL must be one of {list(MODELS)}. Update backend/.env"
assert SUPABASE_URL, "SUPABASE_URL cannot be empty. Update backend/.env"
assert SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY cannot be empty. Update backend/.env"
assert len(APP_PASSWORD) >= 12, "APP_PASSWORD must be at least 12 characters. Update backend/.env"
