"use client";

import { useState, useSyncExternalStore } from "react";
import { checkPassword } from "@/lib/api";
import { getPassword, setPassword, subscribe } from "@/lib/auth";
import { Chat } from "./Chat";

/** Shows the login screen until a working password is stored, then the chat. */
export function AuthGate() {
  // The third argument is used on the server (no localStorage there) and for
  // the browser's first render, so both produce the same HTML. React then
  // re-renders with the real stored value.
  const password = useSyncExternalStore(subscribe, getPassword, () => undefined);

  if (password === undefined) return null;
  return password ? <Chat /> : <LoginForm />;
}

function LoginForm() {
  const [value, setValue] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setChecking(true);
    setError(null);
    try {
      if (await checkPassword(value)) setPassword(value);
      else setError("Wrong password.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check the password.");
    } finally {
      setChecking(false);
    }
  }

  return (
    <main className="flex h-dvh items-center justify-center p-4">
      <form onSubmit={submit} className="flex w-full max-w-sm flex-col gap-3">
        <h1 className="text-xl font-semibold">Claude Chat</h1>
        <p className="text-sm text-zinc-500">Enter the password to continue.</p>
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          autoComplete="current-password"
          placeholder="Password"
          aria-label="Password"
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={!value || checking}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {checking ? "Checking…" : "Unlock"}
        </button>
      </form>
    </main>
  );
}
