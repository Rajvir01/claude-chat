import os

from dotenv import load_dotenv

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

# Comma-separated list of browser origins allowed to call this API (CORS).
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Fail at startup, not on the first request, if config is missing.
assert ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY cannot be empty. Update backend/.env"
assert CLAUDE_MODEL, "CLAUDE_MODEL cannot be empty. Update backend/.env"
assert SUPABASE_URL, "SUPABASE_URL cannot be empty. Update backend/.env"
assert SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY cannot be empty. Update backend/.env"
