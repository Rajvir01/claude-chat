"use client";

import { useChat } from "@/hooks/useChat";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

export function Chat() {
  const { messages, status, error, send, stop, retry } = useChat();

  return (
    <div className="flex h-dvh flex-col">
      <header className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h1 className="text-sm font-semibold">Claude Chat</h1>
      </header>

      <MessageList messages={messages} status={status} />

      {error && (
        <div
          role="alert"
          className="mx-auto mb-3 flex w-full max-w-3xl items-center justify-between gap-4 rounded-xl border border-red-300 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <span>{error.message}</span>
          {error.retryable && (
            <button onClick={retry} className="shrink-0 font-medium underline">
              Retry
            </button>
          )}
        </div>
      )}

      <Composer status={status} onSend={send} onStop={stop} />
    </div>
  );
}
