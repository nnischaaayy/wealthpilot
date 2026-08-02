"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAdvisorChat } from "../hooks/use-advisor-chat";
import { AdvisorMessageBubble } from "./advisor-message-bubble";
import { AdvisorSuggestedPrompts } from "./advisor-suggested-prompts";

export function AdvisorChatPanel() {
  const { messages, sendMessage, isStreaming } = useAdvisorChat();
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  function submit() {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    void sendMessage(trimmed);
    setInput("");
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex h-[calc(100vh-11rem)] flex-col rounded-xl ring-1 ring-foreground/10">
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-sm text-sm text-muted-foreground">
              Ask the Budget Coach about your spending, budget, or savings — every number it
              gives you comes straight from your real transactions.
            </p>
            <AdvisorSuggestedPrompts onSelect={(prompt) => void sendMessage(prompt)} />
          </div>
        ) : (
          messages.map((message) => <AdvisorMessageBubble key={message.id} message={message} />)
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-end gap-2 border-t p-3">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your spending, budget, or savings…"
          className="min-h-9 py-1.5"
          rows={1}
          disabled={isStreaming}
        />
        <Button type="submit" size="icon" disabled={isStreaming || !input.trim()}>
          <Send className="size-4" />
        </Button>
      </form>

      <p className="border-t px-3 py-2 text-center text-[11px] text-muted-foreground">
        Informational analysis only — not licensed financial advice.
      </p>
    </div>
  );
}
