import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import type { UIMessage } from "@/hooks/useChat";

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
    </div>
  );
}
