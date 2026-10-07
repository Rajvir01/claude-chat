"use client";

import { useState } from "react";
import { useChat } from "@/hooks/useChat";
import { useConversations } from "@/hooks/useConversations";
import { useModels } from "@/hooks/useModels";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";
import { SettingsPanel } from "./SettingsPanel";
import { Sidebar } from "./Sidebar";

export function Chat() {
  const { conversations, error: listError, refresh, remove } = useConversations();
  const {
    conversationId: activeId,
    messages,
    settings,
    status,
    error,
    loading,
    open,
    send,
    stop,
    retry,
    saveSettings,
  } = useChat(refresh);
  const models = useModels();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const modelId = settings.model ?? models?.default;
  const modelLabel = models?.models.find((m) => m.id === modelId)?.label;

  function select(id: string | null) {
    open(id);
    setSidebarOpen(false);
  }

  async function handleDelete(id: string) {
    if (id === activeId) open(null);
    await remove(id);
  }

  return (
    <div className="flex h-dvh">
      {/* On small screens the sidebar is a slide-over; from md up it's always visible. */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-10 bg-black/30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <aside
        className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-20 block" : "hidden"} w-64 shrink-0 border-r border-zinc-200 bg-white md:static md:block dark:border-zinc-800 dark:bg-zinc-950`}
      >
        <Sidebar
          conversations={conversations}
          activeId={activeId}
          error={listError}
          onSelect={select}
          onNew={() => select(null)}
          onDelete={handleDelete}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open chats"
            className="rounded px-1 text-lg md:hidden"
          >
            ☰
          </button>
          <h1 className="truncate text-sm font-semibold">
            {conversations.find((c) => c.id === activeId)?.title ?? "New chat"}
          </h1>
          <button
            onClick={() => setSettingsOpen(true)}
            className="ml-auto flex shrink-0 items-center gap-2 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
          >
            {modelLabel && <span className="text-zinc-500">{modelLabel}</span>}
            Settings
          </button>
        </header>

        {settingsOpen && (
          <SettingsPanel
            settings={settings}
            models={models}
            isNewChat={activeId === null}
            onSave={saveSettings}
            onClose={() => setSettingsOpen(false)}
          />
        )}

        <MessageList messages={messages} status={status} loading={loading} />

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
    </div>
  );
}
