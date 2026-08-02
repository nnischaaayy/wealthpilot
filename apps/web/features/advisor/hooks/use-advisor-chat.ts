"use client";

import { useCallback, useRef, useState } from "react";

export interface AdvisorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls: string[];
  status: "streaming" | "done" | "error";
}

interface ChatEvent {
  type: "text" | "tool_call" | "done" | "error";
  text?: string | null;
  toolName?: string | null;
}

function makeId(): string {
  return Math.random().toString(36).slice(2);
}

export function useAdvisorChat() {
  const [messages, setMessages] = useState<AdvisorMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const applyEvent = useCallback((assistantId: string, event: ChatEvent) => {
    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== assistantId) return m;
        switch (event.type) {
          case "text":
            return { ...m, content: m.content + (event.text ?? "") };
          case "tool_call":
            return event.toolName ? { ...m, toolCalls: [...m.toolCalls, event.toolName] } : m;
          case "done":
            return {
              ...m,
              content: event.text
                ? m.content
                  ? `${m.content}\n\n${event.text}`
                  : event.text
                : m.content,
              status: "done",
            };
          case "error":
            return { ...m, content: event.text ?? "Something went wrong.", status: "error" };
          default:
            return m;
        }
      }),
    );
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      const userMessage: AdvisorMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        toolCalls: [],
        status: "done",
      };
      const assistantId = makeId();
      const historyForRequest = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      setMessages((prev) => [
        ...prev,
        userMessage,
        { id: assistantId, role: "assistant", content: "", toolCalls: [], status: "streaming" },
      ]);
      setIsStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch("/api/advisor/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForRequest }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error("AI advisor request failed");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const parts = buffer.split("\n\n");
          buffer = parts.pop() ?? "";

          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith("data: ")) continue;
            const event: ChatEvent = JSON.parse(line.slice("data: ".length));
            applyEvent(assistantId, event);
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          applyEvent(assistantId, {
            type: "error",
            text: "Something went wrong reaching the AI advisor. Please try again.",
          });
        }
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, isStreaming, applyEvent],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, isStreaming, stop };
}
