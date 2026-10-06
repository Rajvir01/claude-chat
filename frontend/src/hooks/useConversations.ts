"use client";

import { useCallback, useEffect, useState } from "react";
import { deleteConversation, listConversations } from "@/lib/api";
import type { ConversationSummary } from "@/lib/types";

/** The sidebar's list of conversations, newest activity first. */
export function useConversations() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    () =>
      listConversations().then(
        (list) => {
          setConversations(list);
          setError(null);
        },
        (err) => setError(err instanceof Error ? err.message : "Couldn't load chats"),
      ),
    [],
  );

  // Initial load when the page opens. State is only set in the .then
  // callbacks (when data arrives), which is the pattern React recommends.
  useEffect(() => {
    load();
  }, [load]);

  async function remove(id: string) {
    try {
      await deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete chat");
    }
  }

  return { conversations, error, refresh: load, remove };
}
