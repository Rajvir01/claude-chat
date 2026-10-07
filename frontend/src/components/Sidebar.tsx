"use client";

import { setPassword } from "@/lib/auth";
import type { ConversationSummary } from "@/lib/types";

export function Sidebar({
  conversations,
  activeId,
  error,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: ConversationSummary[];
  activeId: string | null;
  error: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <nav className="flex h-full flex-col gap-2 p-3">
      <button
        onClick={onNew}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-left text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        + New chat
      </button>

      {error && <p className="px-1 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <ul className="-mx-1 flex-1 overflow-y-auto px-1">
        {conversations.map((c) => (
          <li key={c.id} className="group relative">
            <button
              onClick={() => onSelect(c.id)}
              aria-current={c.id === activeId ? "page" : undefined}
              className="w-full truncate rounded-lg py-2 pl-3 pr-8 text-left text-sm hover:bg-zinc-100 aria-[current=page]:bg-zinc-200 dark:hover:bg-zinc-800 dark:aria-[current=page]:bg-zinc-800"
            >
              {c.title}
            </button>
            <button
              onClick={() => {
                if (window.confirm(`Delete "${c.title}"?`)) onDelete(c.id);
              }}
              aria-label={`Delete ${c.title}`}
              className="absolute right-1 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-zinc-500 opacity-0 hover:text-red-600 focus:opacity-100 group-hover:opacity-100"
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setPassword(null)}
        className="rounded-lg px-3 py-2 text-left text-xs text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        Lock (forget password on this device)
      </button>
    </nav>
  );
}
