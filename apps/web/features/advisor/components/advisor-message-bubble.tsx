import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AdvisorMessage } from "../hooks/use-advisor-chat";
import { formatToolName } from "../lib/tool-labels";

function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1 py-0.5" aria-label="AI advisor is typing">
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
      <span className="size-1.5 animate-bounce rounded-full bg-current" />
    </span>
  );
}

export function AdvisorMessageBubble({ message }: { message: AdvisorMessage }) {
  const isUser = message.role === "user";
  const isEmptyStreaming = message.status === "streaming" && message.content.length === 0;

  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser && "items-end")}>
        <div
          className={cn(
            "rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
            message.status === "error" &&
              "border border-destructive/40 bg-destructive/10 text-destructive",
          )}
        >
          {isEmptyStreaming ? <TypingIndicator /> : message.content}
        </div>
        {message.toolCalls.length > 0 && (
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none">Sources</summary>
            <ul className="mt-1 list-disc pl-4">
              {message.toolCalls.map((tool, i) => (
                <li key={`${tool}-${i}`}>{formatToolName(tool)}</li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
