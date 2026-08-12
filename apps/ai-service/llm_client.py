"""Model-agnostic LLM wrapper (architecture.md §13.4).

Agents depend only on this interface, never the Anthropic SDK directly, so
the underlying provider/model can be swapped without touching agent code.
`AnthropicLike` is the thin slice of the real SDK's surface this needs —
tests inject a fake implementation instead of hitting the network.
"""

from __future__ import annotations

import os
from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, Protocol

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5"
DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_MODEL = DEFAULT_ANTHROPIC_MODEL  # kept for backward compatibility


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    input_schema: dict[str, Any]


@dataclass(frozen=True)
class TextEvent:
    text: str


@dataclass(frozen=True)
class ToolUseEvent:
    id: str
    name: str
    input: dict[str, Any]


@dataclass(frozen=True)
class StopEvent:
    stop_reason: str


LLMEvent = TextEvent | ToolUseEvent | StopEvent


class AnthropicLike(Protocol):
    def stream_message(
        self,
        *,
        model: str,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[LLMEvent]: ...


class LLMClient:
    def __init__(self, backend: AnthropicLike | None = None, model: str | None = None) -> None:
        self._model = model or _default_model()
        self._backend = backend if backend is not None else _make_default_backend()

    @property
    def configured(self) -> bool:
        return self._backend is not None

    async def stream(
        self,
        *,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[ToolSpec] = (),
        max_tokens: int = 1024,
    ) -> AsyncIterator[LLMEvent]:
        if self._backend is None:
            raise RuntimeError(
                "LLMClient is not configured (ANTHROPIC_API_KEY or GEMINI_API_KEY unset)"
            )

        anthropic_tools = [
            {"name": t.name, "description": t.description, "input_schema": t.input_schema}
            for t in tools
        ]
        async for event in self._backend.stream_message(
            model=self._model,
            system=system,
            messages=messages,
            tools=anthropic_tools,
            max_tokens=max_tokens,
        ):
            yield event


def _default_model() -> str:
    if os.environ.get("ANTHROPIC_API_KEY"):
        return os.environ.get("ANTHROPIC_MODEL", DEFAULT_ANTHROPIC_MODEL)
    if os.environ.get("GEMINI_API_KEY"):
        return os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL)
    return DEFAULT_ANTHROPIC_MODEL


def _make_default_backend() -> AnthropicLike | None:
    # Anthropic takes priority when both are configured — Gemini is a
    # free-tier fallback, not a replacement.
    anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
    if anthropic_key:
        from anthropic_backend import AnthropicBackend

        return AnthropicBackend(api_key=anthropic_key)

    gemini_key = os.environ.get("GEMINI_API_KEY")
    if gemini_key:
        from gemini_backend import GeminiBackend

        return GeminiBackend(api_key=gemini_key)

    return None
