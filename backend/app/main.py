from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app import config, db
from app.chat import make_title, reply_stream
from app.schemas import (
    DEFAULT_TITLE,
    Conversation,
    ConversationCreate,
    ConversationDetail,
    ConversationSummary,
    ConversationUpdate,
    ReplyRequest,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Code before `yield` runs once at startup, code after it at shutdown.
    await db.connect()
    yield


app = FastAPI(title="Claude Chat API", lifespan=lifespan)

# Browsers block a page on localhost:3000 from calling localhost:8000 unless
# the API says that origin is allowed. That permission is CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def get_conversation_or_404(conversation_id: UUID) -> dict:
    conversation = await db.get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@app.get("/health")
async def health():
    return {"status": "ok"}


# `response_model` makes FastAPI validate and filter what we return, and
# documents the response shape on /docs.


@app.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations():
    return await db.list_conversations()


@app.post("/conversations", response_model=Conversation, status_code=201)
async def create_conversation(body: ConversationCreate):
    return await db.create_conversation(body.title, body.system_prompt, body.model)


@app.get("/conversations/{conversation_id}", response_model=ConversationDetail)
async def get_conversation(conversation_id: UUID):
    conversation = await get_conversation_or_404(conversation_id)
    return {**conversation, "messages": await db.list_messages(conversation_id)}


@app.patch("/conversations/{conversation_id}", response_model=Conversation)
async def update_conversation(conversation_id: UUID, body: ConversationUpdate):
    updated = await db.update_conversation(conversation_id, body.model_dump())
    if updated is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return updated


@app.delete("/conversations/{conversation_id}", status_code=204)
async def delete_conversation(conversation_id: UUID):
    if not await db.delete_conversation(conversation_id):
        raise HTTPException(status_code=404, detail="Conversation not found")
    return Response(status_code=204)


@app.post("/conversations/{conversation_id}/reply")
async def reply(conversation_id: UUID, body: ReplyRequest):
    # Everything that can fail with a normal HTTP error happens *before* we
    # start streaming, while we can still send a 404 or 409 status.
    conversation = await get_conversation_or_404(conversation_id)
    history = await db.list_messages(conversation_id)

    if body.content is not None:
        if not history and conversation["title"] == DEFAULT_TITLE:
            conversation = await db.update_conversation(
                conversation_id, {"title": make_title(body.content)}
            )
        history.append(await db.add_message(conversation_id, "user", body.content))

    if not history or history[-1]["role"] != "user":
        raise HTTPException(status_code=409, detail="Last message isn't from the user; nothing to reply to")

    return StreamingResponse(
        reply_stream(conversation, history),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            # Stops reverse proxies (e.g. nginx on the host) from buffering
            # the stream and delivering it all at once.
            "X-Accel-Buffering": "no",
        },
    )
