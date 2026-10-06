"use client";

import { useEffect, useRef } from "react";
import type { ChatStatus, UIMessage } from "@/hooks/useChat";
import { MessageBubble } from "./MessageBubble";

export function MessageList({ messages, status }: { messages: UIMessage[]; status: ChatStatus }) {
  const containerRef = useRef<HTMLDivElement>(null);
  // Auto-scroll only while the user is at the bottom. If they scroll up to
  // re-read something mid-stream, we stop yanking them back down.
  const stickToBottom = useRef(true);
  const prevCount = useRef(messages.length);

  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // A newly sent message always scrolls into view.
    if (messages.length > prevCount.current) stickToBottom.current = true;
    prevCount.current = messages.length;
    if (stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
        {messages.length === 0 ? (
          <div className="mt-24 text-center">
            <h2 className="text-2xl font-semibold">How can I help?</h2>
            <p className="mt-2 text-sm text-zinc-500">Replies stream in as Claude writes them.</p>
          </div>
        ) : (
          messages.map((m, i) => (
            <MessageBubble
              key={m.id}
              message={m}
              isStreaming={status === "streaming" && i === messages.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}
