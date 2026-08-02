"""Shared tool-calling loop (architecture.md §13.1).

Every role-scoped agent (Budget Coach, Portfolio Analyst, Report Summarizer)
runs the same "LLM calls tools until it has enough to answer" pattern, so it
lives here once instead of being copy-pasted per agent. Each agent module
only supplies its system prompt, tool specs, and a tool executor.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator, Awaitable, Callable
from dataclasses import dataclass
from typing import Any

from llm_client import LLMClient, StopEvent, TextEvent, ToolSpec, ToolUseEvent

MAX_TOOL_ROUNDS = 4

ToolExecutor = Callable[[str, dict[str, Any]], Awaitable[Any]]


@dataclass
class AgentEvent:
    type: str  # "text" | "tool_call" | "done" | "error"
    text: str | None = None
    tool_name: str | None = None
    detail: dict[str, Any] | None = None


async def run_tool_calling_agent(
    llm: LLMClient,
    system_prompt: str,
    tools: list[ToolSpec],
    execute_tool: ToolExecutor,
    conversation: list[dict[str, Any]],
    done_text: str,
    not_configured_text: str,
) -> AsyncIterator[AgentEvent]:
    """`conversation` is [{"role": "user"|"assistant", "content": str}, ...], oldest first.
    `execute_tool(name, input)` runs one tool call and returns a JSON-serializable result.
    """
    if not llm.configured:
        yield AgentEvent(type="error", text=not_configured_text)
        return

    messages: list[dict[str, Any]] = [dict(m) for m in conversation]

    for _round in range(MAX_TOOL_ROUNDS):
        text_buffer = ""
        tool_calls: list[ToolUseEvent] = []

        async for event in llm.stream(
            system=system_prompt, messages=messages, tools=tools, max_tokens=1024
        ):
            if isinstance(event, TextEvent):
                text_buffer += event.text
                yield AgentEvent(type="text", text=event.text)
            elif isinstance(event, ToolUseEvent):
                tool_calls.append(event)
            elif isinstance(event, StopEvent):
                pass  # stop_reason isn't currently branched on

        if not tool_calls:
            yield AgentEvent(type="done", text=done_text)
            return

        assistant_content: list[dict[str, Any]] = []
        if text_buffer:
            assistant_content.append({"type": "text", "text": text_buffer})
        for call in tool_calls:
            assistant_content.append(
                {"type": "tool_use", "id": call.id, "name": call.name, "input": call.input}
            )
        messages.append({"role": "assistant", "content": assistant_content})

        tool_result_content: list[dict[str, Any]] = []
        for call in tool_calls:
            yield AgentEvent(type="tool_call", tool_name=call.name, detail=call.input)
            try:
                result = await execute_tool(call.name, call.input)
                tool_result_content.append(
                    {"type": "tool_result", "tool_use_id": call.id, "content": json.dumps(result)}
                )
            except Exception as exc:  # noqa: BLE001 - fed back to the model, not raised
                tool_result_content.append(
                    {
                        "type": "tool_result",
                        "tool_use_id": call.id,
                        "content": f"Error: {exc}",
                        "is_error": True,
                    }
                )
        messages.append({"role": "user", "content": tool_result_content})

    yield AgentEvent(
        type="error",
        text=(
            "I wasn't able to finish that within the allotted tool-call budget — "
            "try a more specific question."
        ),
    )
