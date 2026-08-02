import json

import pytest
from test_budget_coach import ScriptedBackend, _collect

from agents.portfolio_analyst import run_portfolio_analyst
from llm_client import LLMClient, StopEvent, TextEvent, ToolUseEvent
from tools.holdings import HoldingRecord


async def test_not_configured_yields_a_single_graceful_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    llm = LLMClient()

    events = await _collect(
        run_portfolio_analyst(llm, "ws-1", [{"role": "user", "content": "hi"}])
    )
    assert len(events) == 1
    assert events[0].type == "error"
    assert "ANTHROPIC_API_KEY" in events[0].text


async def test_risk_score_tool_call_uses_real_holdings(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_get_holdings(workspace_id: str) -> list[HoldingRecord]:
        return [
            HoldingRecord(
                id="h1", symbol="BTC", name="Bitcoin", quantity=1.0, cost_basis_minor=100_000,
                current_price_minor=100_000, currency="USD", asset_class="crypto",
            ),
        ]

    monkeypatch.setattr("agents.portfolio_analyst.get_holdings", fake_get_holdings)

    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(id="t1", name="calculate_risk_score", input={}),
                StopEvent("tool_use"),
            ],
            [TextEvent("Your portfolio is highly concentrated in crypto."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    events = await _collect(
        run_portfolio_analyst(llm, "ws-1", [{"role": "user", "content": "what's my risk score?"}])
    )

    second_call_messages = backend.calls[1]["messages"]
    result_payload = json.loads(second_call_messages[-1]["content"][0]["content"])
    assert result_payload["risk_score"] == 10

    assert events[-1].type == "done"
    assert "informational analysis" in events[-1].text


async def test_allocation_tool_groups_by_requested_dimension(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_get_holdings(workspace_id: str) -> list[HoldingRecord]:
        return [
            HoldingRecord(
                id="h1", symbol="AAPL", name=None, quantity=10.0, cost_basis_minor=15000,
                current_price_minor=None, currency="USD", asset_class="equity",
            ),
            HoldingRecord(
                id="h2", symbol="BND", name=None, quantity=10.0, cost_basis_minor=5000,
                current_price_minor=None, currency="USD", asset_class="bond",
            ),
        ]

    monkeypatch.setattr("agents.portfolio_analyst.get_holdings", fake_get_holdings)

    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(
                    id="t1", name="calculate_allocation", input={"group_by": "asset_class"}
                ),
                StopEvent("tool_use"),
            ],
            [TextEvent("You're mostly in equities."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    await _collect(
        run_portfolio_analyst(llm, "ws-1", [{"role": "user", "content": "how am I allocated?"}])
    )

    second_call_messages = backend.calls[1]["messages"]
    result_payload = json.loads(second_call_messages[-1]["content"][0]["content"])
    keys = {slice_["key"] for slice_ in result_payload}
    assert keys == {"equity", "bond"}
