// The app password, remembered in this browser's localStorage.
// A tiny "external store": components read it with useSyncExternalStore and
// re-render whenever it changes (log in, log out, or a 401 from the server).

const KEY = "chat-app-password";
const listeners = new Set<() => void>();

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPassword(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null; // storage blocked (e.g. some private-browsing modes)
  }
}

export function setPassword(password: string | null): void {
  try {
    if (password) localStorage.setItem(KEY, password);
    else localStorage.removeItem(KEY);
  } catch {
    // Not fatal: the user just has to log in again next visit.
  }
  listeners.forEach((listener) => listener());
}
