"""Real Gemini-backed implementation of llm_client.AnthropicLike.

Imported lazily by llm_client._make_default_backend() only when
GEMINI_API_KEY is set (and ANTHROPIC_API_KEY isn't), so nothing else in the
app pays for or depends on this being reachable. Talks to the Gemini REST
API directly over httpx — same reasoning as embedding_client.py's Voyage
backend: no need for the official SDK's dependency weight for the thin
slice of the API this uses.

Gemini has no native concept of Anthropic's per-call tool_use id — its
functionResponse parts are matched to a functionCall by *name*, not id. So
_to_gemini_contents rebuilds an id -> name map from every tool_use block in
the conversation history on each call, to bridge the two shapes.
"""

from __future__ import annotations

import json
import uuid
from collections.abc import AsyncIterator, Sequence
from typing import Any

import httpx

from llm_client import LLMEvent, StopEvent, TextEvent, ToolUseEvent

_API_BASE = "https://generativelanguage.googleapis.com/v1beta"


class GeminiBackend:
    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    async def stream_message(
        self,
        *,
        model: str,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[LLMEvent]:
        body: dict[str, Any] = {
            "system_instruction": {"parts": [{"text": system}]},
            "contents": _to_gemini_contents(messages),
            "generationConfig": {
                "maxOutputTokens": max_tokens,
                # 2.5-series models spend part of max_tokens on invisible
                # "thinking" tokens before writing the visible answer — with
                # this app's max_tokens budget that can consume the whole
                # response and leave nothing to show. AnthropicLike has no
                # thinking-event type to surface it either, so turn it off.
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        if tools:
            body["tools"] = [{"function_declarations": _to_gemini_tools(tools)}]

        finish_reason = "end_turn"
        async with httpx.AsyncClient(timeout=60.0) as client:
            async with client.stream(
                "POST",
                f"{_API_BASE}/models/{model}:streamGenerateContent",
                params={"alt": "sse", "key": self._api_key},
                json=body,
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    payload = line[len("data:") :].strip()
                    if not payload:
                        continue
                    candidates = json.loads(payload).get("candidates") or []
                    if not candidates:
                        continue
                    candidate = candidates[0]
                    for part in candidate.get("content", {}).get("parts", []):
                        if "text" in part:
                            yield TextEvent(text=part["text"])
                        elif "functionCall" in part:
                            call = part["functionCall"]
                            yield ToolUseEvent(
                                id=uuid.uuid4().hex[:12],
                                name=call["name"],
                                input=dict(call.get("args") or {}),
                            )
                    if candidate.get("finishReason") == "MAX_TOKENS":
                        finish_reason = "max_tokens"

        yield StopEvent(stop_reason=finish_reason)


def _to_gemini_tools(tools: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {"name": t["name"], "description": t["description"], "parameters": t["input_schema"]}
        for t in tools
    ]


def _to_gemini_contents(messages: Sequence[dict[str, Any]]) -> list[dict[str, Any]]:
    tool_call_names: dict[str, str] = {}
    for message in messages:
        content = message["content"]
        if isinstance(content, list):
            for block in content:
                if block.get("type") == "tool_use":
                    tool_call_names[block["id"]] = block["name"]

    return [_to_gemini_content(message, tool_call_names) for message in messages]


def _to_gemini_content(
    message: dict[str, Any], tool_call_names: dict[str, str]
) -> dict[str, Any]:
    role = "model" if message["role"] == "assistant" else "user"
    content = message["content"]
    if isinstance(content, str):
        return {"role": role, "parts": [{"text": content}]}

    parts: list[dict[str, Any]] = []
    for block in content:
        block_type = block.get("type")
        if block_type == "text":
            parts.append({"text": block["text"]})
        elif block_type == "tool_use":
            parts.append({"functionCall": {"name": block["name"], "args": block["input"]}})
        elif block_type == "tool_result":
            name = tool_call_names.get(block["tool_use_id"], "unknown_tool")
            response = _as_response_object(block["content"])
            parts.append({"functionResponse": {"name": name, "response": response}})
    return {"role": role, "parts": parts}


def _as_response_object(raw: str) -> dict[str, Any]:
    """Gemini's functionResponse.response must be a JSON object; our tool_result
    content is a JSON string of whatever the tool returned (often a list or a
    plain error string), so non-object payloads get wrapped."""
    try:
        parsed = json.loads(raw)
    except (TypeError, ValueError):
        return {"result": raw}
    return parsed if isinstance(parsed, dict) else {"result": parsed}
