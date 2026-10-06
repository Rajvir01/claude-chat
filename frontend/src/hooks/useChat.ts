"use client";

import { useRef, useState } from "react";
import { ChatError, streamChat } from "@/lib/api";
import type { ChatMessage, Usage } from "@/lib/types";

export interface UIMessage extends ChatMessage {
  id: string;
  usage?: Usage;
  // From the API ("end_turn", "max_tokens", "refusal"), or "stopped" when the user hit Stop.
  stopReason?: string | null;
}

export type ChatStatus = "idle" | "streaming" | "error";

export interface ChatErrorState {
  message: string;
  retryable: boolean;
}

export function useChat() {
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<ChatErrorState | null>(null);
  // A ref, not state: changing it shouldn't re-render, we just need to reach it from stop().
  const abortRef = useRef<AbortController | null>(null);

  function patchMessage(id: string, patch: (m: UIMessage) => Partial<UIMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));
  }

  // Streams a reply to `history` (which must end with a user message).
  async function run(history: UIMessage[]) {
    const assistantId = crypto.randomUUID();
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setStatus("streaming");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // The backend is stateless, so every request sends the whole conversation.
      const request = { messages: history.map(({ role, content }) => ({ role, content })) };
      let finished = false;

      for await (const ev of streamChat(request, controller.signal)) {
        switch (ev.event) {
          case "text_delta":
            patchMessage(assistantId, (m) => ({ content: m.content + ev.data.text }));
            break;
          case "usage":
            patchMessage(assistantId, () => ({ usage: ev.data }));
            break;
          case "done":
            finished = true;
            patchMessage(assistantId, () => ({ stopReason: ev.data.stop_reason }));
            break;
          case "error":
            throw new ChatError(ev.data.message, ev.data.retryable);
        }
      }

      // The stream closed without a `done` event: the connection dropped mid-reply.
      if (!finished) throw new ChatError("Connection lost before the reply finished", true);
      setStatus("idle");
    } catch (err) {
      if (controller.signal.aborted) {
        // User pressed Stop: keep whatever text arrived, drop the bubble if nothing did.
        setMessages((prev) =>
          prev.flatMap((m) =>
            m.id !== assistantId ? [m] : m.content ? [{ ...m, stopReason: "stopped" }] : [],
          ),
        );
        setStatus("idle");
      } else {
        // Remove the failed reply so Retry can regenerate it from the user's message.
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
        setError(
          err instanceof ChatError
            ? { message: err.message, retryable: err.retryable }
            : { message: "Something went wrong", retryable: true },
        );
        setStatus("error");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function send(text: string) {
    const content = text.trim();
    if (!content || status === "streaming") return;
    run([...messages, { id: crypto.randomUUID(), role: "user", content }]);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function retry() {
    if (status === "streaming" || messages.at(-1)?.role !== "user") return;
    run(messages);
  }

  return { messages, status, error, send, stop, retry };
}
