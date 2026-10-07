import { readSSE } from "./sse";
import type {
  Conversation,
  ConversationDetail,
  ConversationSummary,
  StreamEvent,
} from "./types";

// NEXT_PUBLIC_ variables are baked into the browser bundle at build time.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ChatError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
    // HTTP status if the server rejected the request before streaming.
    public status?: number,
  ) {
    super(message);
  }
}

// fetch() only throws when the server can't be reached at all; turn that into a readable error.
async function send(path: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...init.headers },
    });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new ChatError("Can't reach the server. Is the backend running?", true);
  }
}

// Turn a 4xx/5xx response into a ChatError, using FastAPI's `detail` message when there is one.
async function errorFrom(response: Response): Promise<ChatError> {
  const body = await response.json().catch(() => null);
  const detail = typeof body?.detail === "string" ? body.detail : null;
  return new ChatError(
    detail ?? `Request failed with status ${response.status}`,
    response.status >= 500,
    response.status,
  );
}

// For normal JSON endpoints: throw on 4xx/5xx, otherwise parse the body.
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await send(path, init);
  if (!response.ok) throw await errorFrom(response);
  return response.status === 204 ? (undefined as T) : response.json();
}

export function listConversations() {
  return request<ConversationSummary[]>("/conversations");
}

export function createConversation() {
  return request<Conversation>("/conversations", { method: "POST", body: "{}" });
}

export function getConversation(id: string) {
  return request<ConversationDetail>(`/conversations/${id}`);
}

export function deleteConversation(id: string) {
  return request<void>(`/conversations/${id}`, { method: "DELETE" });
}

/**
 * Asks Claude to reply in a conversation, yielding stream events as they arrive.
 * Pass `content` to add a new user message first; omit it to retry the last one.
 *
 * We use fetch instead of the browser's built-in EventSource because
 * EventSource can only make GET requests, and we need to POST a JSON body.
 */
export async function* streamReply(
  conversationId: string,
  content: string | undefined,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const response = await send(`/conversations/${conversationId}/reply`, {
    method: "POST",
    body: JSON.stringify({ content }),
    signal,
  });

  // Errors *before* streaming starts arrive as normal HTTP status codes
  // (e.g. 404, 409, 413, 422). Errors *during* streaming arrive as events.
  if (!response.ok) throw await errorFrom(response);
  if (!response.body) throw new ChatError("Empty response from server", true);

  for await (const { event, data } of readSSE(response.body)) {
    yield { event, data: JSON.parse(data) } as StreamEvent;
  }
}
