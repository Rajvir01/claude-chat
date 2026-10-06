"use client";

import { useState } from "react";
import type { ChatStatus } from "@/hooks/useChat";

export function Composer({
  status,
  onSend,
  onStop,
}: {
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState("");
  const streaming = status === "streaming";

  function submit() {
    if (!text.trim() || streaming) return;
    onSend(text);
    setText("");
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="mx-auto flex w-full max-w-3xl items-end gap-2 px-4 pb-6"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter adds a newline. isComposing avoids sending
          // mid-word for IME keyboards (e.g. typing in Hindi or Japanese).
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        autoFocus
        placeholder="Message Claude…"
        className="field-sizing-content max-h-48 min-h-11 flex-1 resize-none rounded-xl border border-zinc-300 bg-transparent px-4 py-2.5 outline-none focus:border-zinc-500 dark:border-zinc-700"
      />
      {streaming ? (
        <button
          type="button"
          onClick={onStop}
          className="h-11 rounded-xl border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Stop
        </button>
      ) : (
        <button
          type="submit"
          disabled={!text.trim()}
          className="h-11 rounded-xl bg-zinc-900 px-4 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          Send
        </button>
      )}
    </form>
  );
}
