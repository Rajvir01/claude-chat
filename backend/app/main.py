from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import config
from app.schemas import ChatRequest
from app.streaming import stream_chat

app = FastAPI(title="Claude Chat API")

# Browsers block a page on localhost:3000 from calling localhost:8000 unless
# the API says that origin is allowed. That permission is CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/chat")
async def chat(req: ChatRequest):
    # FastAPI validates the JSON body against ChatRequest before we get here;
    # bad input gets an automatic 422 response and never reaches Claude.
    return StreamingResponse(
        stream_chat(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # Stops reverse proxies (e.g. nginx on the host) from buffering
            # the stream and delivering it all at once.
            "X-Accel-Buffering": "no",
        },
    )
