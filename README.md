# Claude Chat

A streaming chat app for Claude, with saved conversations, per-chat settings, and live token and cost tracking.
Next.js frontend, FastAPI backend, Supabase (Postgres) for storage.

**Live demo:** _add your Vercel URL here_ (password-protected)

## Features

- **Streaming replies.** Tokens appear as Claude writes them, over Server-Sent Events. Stop mid-reply, retry after errors.
- **Saved conversations.** Every chat is stored in Postgres and listed in a sidebar. A reply you stop halfway is saved too.
- **Per-chat settings.** Model, system prompt, reply-length cap, and temperature or effort. The app only offers the setting each model accepts: newer models reject `temperature` and take `effort` instead.
- **Token and cost display.** Per reply and per chat, priced from the API's usage numbers, including prompt-cache reads and writes.
- **Prompt caching.** Each message re-sends the whole conversation; caching makes the repeated part about 10× cheaper.
- **Context budget.** Long chats are counted with the token-counting API and trimmed from the oldest message so they stay within a cost cap. Claude is told when that happens.
- **Password protection** on every API route.

## Architecture

```
Browser (Next.js, Vercel)
   │  JSON + Server-Sent Events, "Authorization: Bearer <password>"
   ▼
FastAPI (Render) ──────────────▶ Claude API (streaming, token counting, models)
   │
   └──────────────────────────▶ Supabase Postgres (conversations, messages)
```

The browser never talks to the database or holds an API key. The backend holds every secret. Supabase tables have Row Level Security on with no policies, so only the backend's secret key can read them.

| Path | What's there |
|---|---|
| `backend/app/main.py` | Routes. All except `/health` sit behind the password. |
| `backend/app/chat.py` | Streams a reply to the browser and saves it, including partial replies on Stop. |
| `backend/app/streaming.py` | Calls Claude: builds each request from the model's capabilities, yields events. |
| `backend/app/context.py` | Counts tokens and trims old messages to fit the budget. |
| `backend/app/pricing.py`, `model_registry.py` | Prices and per-model capabilities. |
| `backend/app/db.py` | Every database query. |
| `backend/migrations/` | SQL schema, applied in order. |
| `frontend/src/hooks/useChat.ts` | Chat state: open, send, stream, stop, retry. |
| `frontend/src/lib/sse.ts` | Parses the event stream from raw bytes. |

## Run it locally

You need Python 3.12+, Node 22+, a [Claude API key](https://console.anthropic.com/settings/keys), and a free [Supabase](https://supabase.com) project.

**1. Database.** In the Supabase SQL editor, run the files in `backend/migrations/` in order.

**2. Backend**

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env            # then fill in the values
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

**3. Frontend**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev                     # http://localhost:3000
```

## Tests

```bash
cd backend
pytest
```

The tests replace the database and Claude with in-memory fakes, so they're free and run offline. They cover auth on every route, request validation, context trimming, cost math, and saving a partial reply when a stream is cancelled.

## Deploy

- **Backend → Render.** `render.yaml` describes the service. In Render, choose New → Blueprint, pick this repo, and fill in the secret env vars.
- **Frontend → Vercel.** Import the repo, set the root directory to `frontend` and `NEXT_PUBLIC_API_URL` to the Render URL.
- Then set `FRONTEND_ORIGINS` on Render to the Vercel URL, so the browser is allowed to call the API.

## Background

Built as the capstone of the first phase of my AI-engineering roadmap, after Anthropic Academy's *Building with the Claude API* course. The course's MCP chat CLI is kept in `backend/course/` for reference.
