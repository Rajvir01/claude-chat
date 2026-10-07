"use client";

import { useState } from "react";
import type { ConversationSettings, Effort, ModelsResponse } from "@/lib/types";

const EFFORTS: Effort[] = ["low", "medium", "high"];

const fieldClass =
  "w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900";

export function SettingsPanel({
  settings,
  models,
  isNewChat,
  onSave,
  onClose,
}: {
  settings: ConversationSettings;
  models: ModelsResponse | null;
  isNewChat: boolean;
  onSave: (next: ConversationSettings) => Promise<void>;
  onClose: () => void;
}) {
  // A local copy to edit. Nothing changes for real until Save. (This component
  // is only mounted while open, so each opening starts from the saved settings.)
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<ConversationSettings>) => setDraft((d) => ({ ...d, ...patch }));

  // The model actually used: the chosen one, or the server default.
  const modelId = draft.model ?? models?.default;
  const model = models?.models.find((m) => m.id === modelId);
  const defaultLabel = models?.models.find((m) => m.id === models.default)?.label;

  async function save() {
    const max = draft.max_tokens;
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 64000)) {
      setError("Max reply length must be a whole number from 1 to 64,000.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        ...draft,
        // Drop settings the chosen model doesn't accept, so no stale value lingers.
        temperature: model?.supports_temperature ? draft.temperature : null,
        effort: model?.supports_effort ? draft.effort : null,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save settings");
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-full w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900"
      >
        <div>
          <h2 id="settings-title" className="text-lg font-semibold">
            Chat settings
          </h2>
          <p className="text-sm text-zinc-500">
            {isNewChat
              ? "Applies to this new chat once you send the first message."
              : "Applies to this chat from the next reply on."}
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Model</span>
          {models ? (
            <select
              value={draft.model ?? ""}
              onChange={(e) => update({ model: e.target.value || null })}
              className={fieldClass}
            >
              <option value="">Default ({defaultLabel})</option>
              {models.models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}: {m.description}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-zinc-500">Loading models…</span>
          )}
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">System prompt</span>
          <textarea
            value={draft.system_prompt ?? ""}
            onChange={(e) => update({ system_prompt: e.target.value || null })}
            rows={5}
            placeholder="e.g. You are a patient tutor. Explain with short examples."
            className={`${fieldClass} resize-y`}
          />
          <span className="text-xs text-zinc-500">
            Instructions Claude follows for the whole chat. Leave empty for none.
          </span>
        </label>

        {model?.supports_temperature && (
          <div className="flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.temperature !== null}
                onChange={(e) => update({ temperature: e.target.checked ? 1 : null })}
              />
              Custom temperature
              {draft.temperature !== null && (
                <span className="ml-auto tabular-nums text-zinc-500">{draft.temperature.toFixed(1)}</span>
              )}
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              disabled={draft.temperature === null}
              value={draft.temperature ?? 1}
              onChange={(e) => update({ temperature: Number(e.target.value) })}
              aria-label="Temperature"
            />
            <span className="text-xs text-zinc-500">
              Lower is more focused and repeatable; higher is more varied. Default is 1.0.
            </span>
          </div>
        )}

        {model?.supports_effort && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">Effort</span>
            <select
              value={draft.effort ?? ""}
              onChange={(e) => update({ effort: (e.target.value || null) as Effort | null })}
              className={fieldClass}
            >
              <option value="">Default</option>
              {EFFORTS.map((level) => (
                <option key={level} value={level}>
                  {level[0].toUpperCase() + level.slice(1)}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              How much Claude thinks before answering. Higher helps on hard questions but is
              slower and costs more; low is usually plenty for chat.
            </span>
          </label>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">Max reply length (tokens)</span>
          <input
            type="number"
            min={1}
            max={64000}
            value={draft.max_tokens ?? ""}
            onChange={(e) => update({ max_tokens: e.target.value ? Number(e.target.value) : null })}
            placeholder="Default (64,000)"
            className={fieldClass}
          />
          <span className="text-xs text-zinc-500">
            Replies stop at this length. About 750 words per 1,000 tokens.
          </span>
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
