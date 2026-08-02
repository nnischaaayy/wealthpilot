import json
from collections.abc import AsyncIterator, Sequence
from datetime import datetime
from typing import Any

import pytest

from agents.budget_coach import run_budget_coach
from llm_client import LLMClient, LLMEvent, StopEvent, TextEvent, ToolUseEvent
from tools.transactions import TransactionRecord


class ScriptedBackend:
    """Fake AnthropicLike backend: each call to stream_message pops the next
    pre-scripted event list, so tool-loop orchestration can be tested without
    a network round trip."""

    def __init__(self, responses: list[list[LLMEvent]]) -> None:
        self._responses = list(responses)
        self.calls: list[dict[str, Any]] = []

    async def stream_message(
        self,
        *,
        model: str,
        system: str,
        messages: Sequence[dict[str, Any]],
        tools: Sequence[dict[str, Any]],
        max_tokens: int,
    ) -> AsyncIterator[LLMEvent]:
        self.calls.append({"messages": list(messages), "tools": list(tools)})
        for event in self._responses.pop(0):
            yield event


async def _collect(agen: AsyncIterator[Any]) -> list[Any]:
    return [item async for item in agen]


async def test_not_configured_yields_a_single_graceful_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    llm = LLMClient()
    assert llm.configured is False

    events = await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "hi"}]))
    assert len(events) == 1
    assert events[0].type == "error"
    assert "ANTHROPIC_API_KEY" in events[0].text


async def test_direct_answer_with_no_tool_calls() -> None:
    backend = ScriptedBackend(
        [[TextEvent("Sure, "), TextEvent("here's your answer."), StopEvent("end_turn")]]
    )
    llm = LLMClient(backend=backend)

    events = await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "hi"}]))

    text_events = [e for e in events if e.type == "text"]
    assert [e.text for e in text_events] == ["Sure, ", "here's your answer."]
    assert events[-1].type == "done"
    assert "informational analysis" in events[-1].text
    assert len(backend.calls) == 1


async def test_tool_call_result_is_fed_back_into_the_next_round() -> None:
    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(
                    id="t1",
                    name="calculate_loan_payment",
                    input={"principal_minor": 1_200_000, "annual_rate_pct": 0, "term_months": 12},
                ),
                StopEvent("tool_use"),
            ],
            [TextEvent("Your monthly payment would be $1,000."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    events = await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "loan?"}]))

    tool_call_events = [e for e in events if e.type == "tool_call"]
    assert len(tool_call_events) == 1
    assert tool_call_events[0].tool_name == "calculate_loan_payment"

    assert len(backend.calls) == 2
    second_call_messages = backend.calls[1]["messages"]
    tool_result_message = second_call_messages[-1]
    assert tool_result_message["role"] == "user"
    result_payload = json.loads(tool_result_message["content"][0]["content"])
    assert result_payload["monthly_payment_minor"] == 100_000

    assert events[-1].type == "done"


async def test_get_transactions_tool_redacts_descriptions_before_reaching_the_model(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_transactions(workspace_id: str, **kwargs: Any) -> list[TransactionRecord]:
        return [
            TransactionRecord(
                id="txn-1",
                posted_at=datetime(2025, 3, 1),
                amount_minor=-5000,
                currency="USD",
                description="NEFT to account 123456789012 for rent",
                category="housing",
                subcategory=None,
            )
        ]

    monkeypatch.setattr("agents.budget_coach.get_transactions", fake_get_transactions)

    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(id="t1", name="get_transactions", input={"category": "housing"}),
                StopEvent("tool_use"),
            ],
            [TextEvent("You paid rent."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "rent?"}]))

    second_call_messages = backend.calls[1]["messages"]
    tool_result_content = second_call_messages[-1]["content"][0]["content"]
    assert "123456789012" not in tool_result_content
    assert "[REDACTED:account_number]" in tool_result_content


async def test_tool_execution_error_is_fed_back_as_is_error() -> None:
    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(
                    id="t1",
                    name="calculate_loan_payment",
                    input={"principal_minor": 0, "annual_rate_pct": 5, "term_months": 12},
                ),
                StopEvent("tool_use"),
            ],
            [TextEvent("Let's try different numbers."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "loan?"}]))

    second_call_messages = backend.calls[1]["messages"]
    tool_result_message = second_call_messages[-1]["content"][0]
    assert tool_result_message["is_error"] is True
    assert tool_result_message["content"].startswith("Error:")


async def test_gives_up_after_max_tool_rounds() -> None:
    always_calls_a_tool = [
        ToolUseEvent(
            id="t1",
            name="calculate_loan_payment",
            input={"principal_minor": 100, "annual_rate_pct": 0, "term_months": 1},
        ),
        StopEvent("tool_use"),
    ]
    backend = ScriptedBackend([always_calls_a_tool] * 4)
    llm = LLMClient(backend=backend)

    events = await _collect(run_budget_coach(llm, "ws-1", [{"role": "user", "content": "loan?"}]))

    assert len(backend.calls) == 4
    assert events[-1].type == "error"
    assert "tool-call budget" in events[-1].text
