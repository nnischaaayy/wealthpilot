"""Real Anthropic-backed implementation of llm_client.AnthropicLike.

Imported lazily by llm_client._make_default_backend() only when
ANTHROPIC_API_KEY is set, so the rest of the app (and every test) never pays
for or depends on the network SDK being reachable.
"""

from __future__ import annotations

from collections.abc import AsyncIterator, Sequence
from typing import Any

from anthropic import AsyncAnthropic

from llm_client import LLMEvent, StopEvent, TextEvent, ToolUseEvent


class AnthropicBackend:
    def __init__(self, api_key: str) -> None:
        self._client = AsyncAnthropic(api_key=api_key)

    async def stream_message(
        self,
        *,
        model: str,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[LLMEvent]:
        async with self._client.messages.stream(
            model=model,
            system=system,
            messages=list(messages),
            tools=list(tools),
            max_tokens=max_tokens,
        ) as stream:
            async for text in stream.text_stream:
                yield TextEvent(text=text)
            final = await stream.get_final_message()

        for block in final.content:
            if block.type == "tool_use":
                yield ToolUseEvent(id=block.id, name=block.name, input=dict(block.input))

        yield StopEvent(stop_reason=final.stop_reason or "end_turn")
