import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdvisorChat } from "@/features/advisor/hooks/use-advisor-chat";

function sseResponse(events: object[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("");
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

describe("useAdvisorChat", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("streams text chunks into the assistant message and marks it done", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: "text", text: "You spent " },
          { type: "text", text: "$50 on dining." },
          { type: "done", text: "This is informational analysis, not licensed financial advice." },
        ]),
      ),
    );

    const { result } = renderHook(() => useAdvisorChat());

    await act(async () => {
      await result.current.sendMessage("How much did I spend on dining?");
    });

    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    const [userMessage, assistantMessage] = result.current.messages;
    expect(userMessage.role).toBe("user");
    expect(userMessage.content).toBe("How much did I spend on dining?");
    expect(assistantMessage.role).toBe("assistant");
    expect(assistantMessage.status).toBe("done");
    expect(assistantMessage.content).toBe(
      "You spent $50 on dining.\n\nThis is informational analysis, not licensed financial advice.",
    );
  });

  it("records tool_call events as sources on the assistant message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        sseResponse([
          { type: "tool_call", toolName: "get_transactions" },
          { type: "text", text: "You spent $50." },
          { type: "done", text: "disclaimer" },
        ]),
      ),
    );

    const { result } = renderHook(() => useAdvisorChat());
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    await waitFor(() => expect(result.current.messages[1]?.toolCalls).toEqual(["get_transactions"]));
  });

  it("marks the assistant message errored on an error event", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(sseResponse([{ type: "error", text: "not configured" }])),
    );

    const { result } = renderHook(() => useAdvisorChat());
    await act(async () => {
      await result.current.sendMessage("hi");
    });

    await waitFor(() => expect(result.current.messages[1]?.status).toBe("error"));
    expect(result.current.messages[1]?.content).toBe("not configured");
  });

  it("ignores blank input and never calls fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(() => useAdvisorChat());
    await act(async () => {
      await result.current.sendMessage("   ");
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });
});
