// Request shapes. These mirror backend/app/schemas.py; keep the two in sync.

export type Role = "user" | "assistant";

export interface ChatMessage {
  role: Role;
  content: string;
}

export interface ChatRequest {
  messages: ChatMessage[];
  system?: string;
  model?: string;
  max_tokens?: number;
}

// Stream events. These mirror what backend/app/streaming.py yields.

export interface Usage {
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

// A discriminated union: checking `event` tells TypeScript the shape of `data`.
export type StreamEvent =
  | { event: "text_delta"; data: { text: string } }
  | { event: "usage"; data: Usage }
  | { event: "done"; data: { stop_reason: string | null } }
  | { event: "error"; data: { message: string; retryable: boolean } };
