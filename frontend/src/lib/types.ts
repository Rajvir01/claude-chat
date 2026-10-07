// API shapes. These mirror backend/app/schemas.py; keep the two in sync.
// (UUIDs and datetimes arrive as strings in JSON.)

export type Role = "user" | "assistant";

export interface ConversationSummary {
  id: string;
  title: string;
  updated_at: string;
}

export interface Conversation extends ConversationSummary {
  system_prompt: string | null;
  model: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  stop_reason: string | null;
  model: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  cache_read_input_tokens: number | null;
  cache_creation_input_tokens: number | null;
  created_at: string;
}

export interface ConversationDetail extends Conversation {
  messages: Message[];
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
  | { event: "context"; data: { input_tokens: number | null; trimmed_messages: number } }
  | { event: "text_delta"; data: { text: string } }
  | { event: "usage"; data: Usage }
  | { event: "done"; data: { stop_reason: string | null } }
  | { event: "error"; data: { message: string; retryable: boolean } };
