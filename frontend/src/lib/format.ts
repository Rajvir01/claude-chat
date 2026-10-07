import type { Usage } from "./types";

/** 1234 -> "1,234"; 12345 -> "12.3K"; 1234567 -> "1.2M" */
export function formatTokens(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Small amounts need more decimals to show anything: $0.0042 vs $1.25. */
export function formatCost(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

/** Everything Claude read for this reply. The API splits it into uncached, cache-write and cache-read parts. */
export function totalInputTokens(u: Usage): number {
  return u.input_tokens + u.cache_creation_input_tokens + u.cache_read_input_tokens;
}
