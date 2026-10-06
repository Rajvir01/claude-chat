import { readSSE } from "./sse";
import type { ChatRequest, StreamEvent } from "./types";

// NEXT_PUBLIC_ variables are baked into the browser bundle at build time.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export class ChatError extends Error {
  constructor(
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

/**
 * POSTs to the backend and yields each stream event as it arrives.
 *
 * We use fetch instead of the browser's built-in EventSource because
 * EventSource can only make GET requests, and we need to POST a JSON body.
 */
export async function* streamChat(
  request: ChatRequest,
  signal: AbortSignal,
): AsyncGenerator<StreamEvent> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
      signal,
    });
  } catch (err) {
    if (signal.aborted) throw err;
    throw new ChatError("Can't reach the server. Is the backend running?", true);
  }

  // Errors *before* streaming starts arrive as normal HTTP status codes
  // (e.g. 422 from Pydantic). Errors *during* streaming arrive as events.
  if (!response.ok || !response.body) {
    throw new ChatError(`Request failed with status ${response.status}`, false);
  }

  for await (const { event, data } of readSSE(response.body)) {
    yield { event, data: JSON.parse(data) } as StreamEvent;
  }
}
