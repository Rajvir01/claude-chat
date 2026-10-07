import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "@/hooks/useChat";
import { formatCost, formatTokens, totalInputTokens } from "@/lib/format";
import type { Usage } from "@/lib/types";

/** "2,104 in (1,816 cached) · 312 out · $0.0012". Hover for the full breakdown. */
function UsageLine({ usage }: { usage: Usage }) {
  const cached = usage.cache_read_input_tokens;
  const breakdown = [
    `Model: ${usage.model}`,
    `Uncached input: ${usage.input_tokens.toLocaleString()}`,
    `Cache writes: ${usage.cache_creation_input_tokens.toLocaleString()}`,
    `Cache reads: ${cached.toLocaleString()}`,
    `Output (incl. any thinking): ${usage.output_tokens.toLocaleString()}`,
  ].join("\n");

  return (
    <p title={breakdown} className="mt-2 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
      {formatTokens(totalInputTokens(usage))} in
      {cached > 0 && ` (${formatTokens(cached)} cached)`} · {formatTokens(usage.output_tokens)} out
      {usage.cost_usd !== null && ` · ${formatCost(usage.cost_usd)}`}
    </p>
  );
}

const STOP_NOTICES: Record<string, string> = {
  stopped: "Stopped",
  max_tokens: "Reply cut off: reached the max token limit",
  refusal: "Claude declined to respond",
};

export function MessageBubble({
  message,
  isStreaming,
}: {
  message: UIMessage;
  isStreaming: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-zinc-900 px-4 py-2.5 text-white dark:bg-zinc-100 dark:text-zinc-900">
          {message.content}
        </div>
      </div>
    );
  }

  const notice = message.stopReason ? STOP_NOTICES[message.stopReason] : undefined;

  return (
    <div>
      {!!message.trimmedMessages && (
        <p className="mb-2 text-xs text-amber-700 dark:text-amber-400">
          {message.trimmedMessages} earliest messages weren&apos;t sent to Claude, to keep this
          chat within its context limit.
        </p>
      )}
      {/* react-markdown never renders raw HTML from the model, so a reply
          containing <script> shows up as text instead of running. */}
      <div className="prose prose-zinc max-w-none dark:prose-invert prose-pre:bg-[#0d1117] prose-pre:p-0">
        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
          {message.content}
        </ReactMarkdown>
      </div>
      {isStreaming && (
        <span
          aria-label="Claude is typing"
          className="mt-1 inline-block h-4 w-2 animate-pulse rounded-sm bg-zinc-400"
        />
      )}
      {notice && <p className="mt-2 text-xs text-zinc-500">{notice}</p>}
      {message.usage && !isStreaming && <UsageLine usage={message.usage} />}
    </div>
  );
}
