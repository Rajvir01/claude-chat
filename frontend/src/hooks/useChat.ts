"use client";

import { useRef, useState } from "react";
import { ChatError, createConversation, getConversation, streamReply } from "@/lib/api";
import type { Message, Role, Usage } from "@/lib/types";

export interface UIMessage {
  id: string;
  role: Role;
  content: string;
  usage?: Usage;
  // From the API ("end_turn", "max_tokens", "refusal"), or "stopped" when the user hit Stop.
  stopReason?: string | null;
}

export type ChatStatus = "idle" | "streaming" | "error";

export interface ChatErrorState {
  message: string;
  retryable: boolean;
}

function toUIMessage(m: Message): UIMessage {
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    stopReason: m.stop_reason,
    usage:
      m.model && m.input_tokens !== null && m.output_tokens !== null
        ? {
            model: m.model,
            input_tokens: m.input_tokens,
            output_tokens: m.output_tokens,
            cache_read_input_tokens: m.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens: m.cache_creation_input_tokens ?? 0,
          }
        : undefined,
  };
}

function toErrorState(err: unknown): ChatErrorState {
  return err instanceof ChatError
    ? { message: err.message, retryable: err.retryable }
    : { message: "Something went wrong", retryable: true };
}

/**
 * The open conversation: its messages, and streaming replies into it.
 * `onChange` fires when the sidebar may need refreshing (chat created, reply settled).
 */
export function useChat(onChange: () => void) {
  // null = a fresh chat that isn't saved yet (it's created on the first message).
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [status, setStatus] = useState<ChatStatus>("idle");
  const [error, setError] = useState<ChatErrorState | null>(null);
  const [loading, setLoading] = useState(false);
  // Refs, not state: changing them shouldn't re-render, we just need to read them later.
  const abortRef = useRef<AbortController | null>(null);
  // Bumped on every open(). A load that finishes after the user already
  // clicked another chat sees a newer number and throws its result away.
  const openCountRef = useRef(0);

  /** Switch to a saved conversation, or to a new empty chat with `null`. */
  async function open(id: string | null) {
    // Switching away stops any reply in progress; the backend saves what was written.
    abortRef.current?.abort();
    const openCount = ++openCountRef.current;

    setConversationId(id);
    setMessages([]);
    setError(null);
    setStatus("idle");
    if (id === null) return;

    setLoading(true);
    try {
      const conversation = await getConversation(id);
      if (openCount === openCountRef.current) setMessages(conversation.messages.map(toUIMessage));
    } catch (err) {
      if (openCount !== openCountRef.current) return;
      setError({ ...toErrorState(err), retryable: false });
      setStatus("error");
    } finally {
      if (openCount === openCountRef.current) setLoading(false);
    }
  }

  function patchMessage(id: string, patch: (m: UIMessage) => Partial<UIMessage>) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch(m) } : m)));
  }

  // Streams a reply in conversation `id`. `history` is what to show (ending
  // with a user message); `content` is the new message to save, if any.
  async function run(id: string, history: UIMessage[], content?: string) {
    const assistantId = crypto.randomUUID();
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setStatus("streaming");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let finished = false;

      for await (const ev of streamReply(id, content, controller.signal)) {
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
        setError(toErrorState(err));
        setStatus("error");
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      onChange();
    }
  }

  async function send(text: string) {
    const content = text.trim();
    if (!content || status === "streaming" || loading) return;

    let id = conversationId;
    if (id === null) {
      // First message of a new chat: create the conversation, then reply in it.
      try {
        id = (await createConversation()).id;
      } catch (err) {
        setError({ ...toErrorState(err), retryable: false });
        setStatus("error");
        return;
      }
      setConversationId(id);
      onChange();
    }

    run(id, [...messages, { id: crypto.randomUUID(), role: "user", content }], content);
  }

  function stop() {
    abortRef.current?.abort();
  }

  function retry() {
    if (conversationId === null || status === "streaming") return;
    if (messages.at(-1)?.role !== "user") return;
    run(conversationId, messages);
  }

  return { conversationId, messages, status, error, loading, open, send, stop, retry };
}
