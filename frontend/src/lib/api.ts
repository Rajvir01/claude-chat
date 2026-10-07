import { getPassword, setPassword } from "./auth";
import { readSSE } from "./sse";
import type {
  Conversation,
  ConversationDetail,
  ConversationSettings,
  ConversationSummary,
  ModelsResponse,
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

// Every request goes through here: adds the password, and turns "server
// unreachable" (the only case where fetch() itself throws) into a readable error.
async function send(path: string, init: RequestInit = {}): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${getPassword() ?? ""}`,
        ...init.headers,
      },
    });
  } catch (err) {
    if (init.signal?.aborted) throw err;
    throw new ChatError("Can't reach the server. Is the backend running?", true);
  }
  // Wrong or changed password: forget it, which sends the user back to the login screen.
  if (response.status === 401) setPassword(null);
  return response;
}

/** True if `password` is accepted. Used by the login screen before saving it. */
export async function checkPassword(password: string): Promise<boolean> {
  const response = await send("/auth/check", { headers: { Authorization: `Bearer ${password}` } });
  if (response.ok) return true;
  if (response.status === 401) return false;
  throw await errorFrom(response);
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

export function listModels() {
  return request<ModelsResponse>("/models");
}

export function createConversation(settings: ConversationSettings) {
  return request<Conversation>("/conversations", { method: "POST", body: JSON.stringify(settings) });
}

export function updateConversation(id: string, patch: Partial<ConversationSettings & { title: string }>) {
  return request<Conversation>(`/conversations/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
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
