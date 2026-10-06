import os

from dotenv import load_dotenv

# Reads backend/.env into os.environ. In production (Render/Railway) there is
# no .env file; the host injects real environment variables instead, and this
# call simply does nothing.
load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "")

# Comma-separated list of browser origins allowed to call this API (CORS).
FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000").split(",")
    if origin.strip()
]

# Fail at startup, not on the first request, if config is missing.
assert ANTHROPIC_API_KEY, "ANTHROPIC_API_KEY cannot be empty. Update backend/.env"
assert CLAUDE_MODEL, "CLAUDE_MODEL cannot be empty. Update backend/.env"
