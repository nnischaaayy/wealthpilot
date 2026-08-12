import json

import pytest
from test_budget_coach import ScriptedBackend, _collect

from agents.report_summarizer import run_report_summarizer
from embedding_client import EmbeddingClient
from llm_client import LLMClient, StopEvent, TextEvent, ToolUseEvent
from rag.retriever import ArticleMatch
from tools.dashboard_snapshot import DashboardSnapshot


async def test_not_configured_yields_a_single_graceful_error(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)
    llm = LLMClient()

    events = await _collect(
        run_report_summarizer(llm, "ws-1", [{"role": "user", "content": "summarize my month"}])
    )
    assert len(events) == 1
    assert events[0].type == "error"
    assert "ANTHROPIC_API_KEY" in events[0].text


async def test_dashboard_snapshot_tool_uses_real_data(monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_snapshot(workspace_id: str) -> DashboardSnapshot:
        return DashboardSnapshot(
            currency="USD",
            has_transactions=True,
            net_worth_minor=500_000,
            month_income_minor=300_000,
            month_expenses_minor=175_000,
            month_net_minor=125_000,
            savings_rate_pct=42,
        )

    monkeypatch.setattr("agents.report_summarizer.get_dashboard_snapshot", fake_snapshot)

    backend = ScriptedBackend(
        [
            [ToolUseEvent(id="t1", name="get_dashboard_snapshot", input={}), StopEvent("tool_use")],
            [TextEvent("You saved 42% of your income this month."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)

    events = await _collect(
        run_report_summarizer(llm, "ws-1", [{"role": "user", "content": "summarize my month"}])
    )

    second_call_messages = backend.calls[1]["messages"]
    result_payload = json.loads(second_call_messages[-1]["content"][0]["content"])
    assert result_payload["savings_rate_pct"] == 42
    assert events[-1].type == "done"


async def test_rag_lookup_returns_kb_matches_when_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_rag_lookup(embedding_client, query, top_k=3):
        return [
            ArticleMatch(
                slug="emergency-fund",
                title="What is an emergency fund?",
                content="...",
                similarity=0.9,
            )
        ]

    monkeypatch.setattr("agents.report_summarizer.rag_lookup", fake_rag_lookup)

    class FakeConfiguredBackend:
        async def embed(self, texts, *, input_type):
            return [[0.1] for _ in texts]

    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(
                    id="t1", name="rag_lookup", input={"query": "what is an emergency fund"}
                ),
                StopEvent("tool_use"),
            ],
            [TextEvent("An emergency fund is..."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)
    embedding_client = EmbeddingClient(backend=FakeConfiguredBackend())

    message = [{"role": "user", "content": "what's an emergency fund?"}]
    await _collect(run_report_summarizer(llm, "ws-1", message, embedding_client))

    second_call_messages = backend.calls[1]["messages"]
    result_payload = json.loads(second_call_messages[-1]["content"][0]["content"])
    assert result_payload == [{"title": "What is an emergency fund?", "content": "..."}]


async def test_rag_lookup_degrades_gracefully_when_embeddings_not_configured() -> None:
    backend = ScriptedBackend(
        [
            [
                ToolUseEvent(
                    id="t1", name="rag_lookup", input={"query": "what is diversification"}
                ),
                StopEvent("tool_use"),
            ],
            [TextEvent("I can't look that up right now."), StopEvent("end_turn")],
        ]
    )
    llm = LLMClient(backend=backend)
    embedding_client = EmbeddingClient(backend=None)

    events = await _collect(
        run_report_summarizer(
            llm, "ws-1", [{"role": "user", "content": "what is diversification?"}], embedding_client
        )
    )

    second_call_messages = backend.calls[1]["messages"]
    result_payload = json.loads(second_call_messages[-1]["content"][0]["content"])
    assert "VOYAGE_API_KEY" in result_payload["error"]
    assert events[-1].type == "done"
