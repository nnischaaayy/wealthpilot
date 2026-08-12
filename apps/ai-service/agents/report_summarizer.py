"""Report Summarizer agent (architecture.md §13.1) — "summarize my month/
quarter" requests. Tools: get_dashboard_snapshot, rag_lookup.

Non-negotiable rule (architecture.md §13.2): the LLM never computes money.
Every numeric answer about the user's own finances must come from a tool
call result — the model narrates it, it does not derive it. RAG is used
only for conceptual questions (architecture.md §13.3), never a substitute
for get_dashboard_snapshot when the question is about the user's own numbers.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from agents._loop import AgentEvent, run_tool_calling_agent
from embedding_client import EmbeddingClient
from llm_client import LLMClient, ToolSpec
from rag.retriever import rag_lookup
from tools.dashboard_snapshot import get_dashboard_snapshot

SYSTEM_PROMPT = """You are WealthPilot's Report Summarizer, one of a small set of role-scoped \
agents in an AI financial assistant.

Scope: "summarize my month/quarter"-style requests, and conceptual financial-education questions \
(e.g. "what is an emergency fund").

Rules you must always follow:
- You are not a licensed financial advisor. Everything you say is informational analysis, not \
financial advice.
- Never compute money yourself. Every number about the user's own finances must come from a tool \
call result you were given in this conversation — narrate it, do not derive it by arithmetic of \
your own.
- Use rag_lookup only for general financial-education concepts, never as a substitute for \
get_dashboard_snapshot when the question is about the user's own numbers.
- When you cite a knowledge-base article, mention its title.
- Keep responses concise and conversational."""

DISCLAIMER = "This is informational analysis, not licensed financial advice."
NOT_CONFIGURED = (
    "The AI advisor isn't configured yet (no ANTHROPIC_API_KEY or GEMINI_API_KEY set). "
    "The rest of WealthPilot works fully without it."
)

TOOLS = [
    ToolSpec(
        name="get_dashboard_snapshot",
        description=(
            "Fetch the user's aggregate financial snapshot: net worth, this-month income/"
            "expenses/savings rate, top spending categories, and 50/30/20 budget groups."
        ),
        input_schema={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="rag_lookup",
        description=(
            "Looks up general financial-education concepts (e.g. 'what is diversification', "
            "'50/30/20 rule') from a curated knowledge base. Not for the user's own numbers."
        ),
        input_schema={
            "type": "object",
            "properties": {"query": {"type": "string"}},
            "required": ["query"],
        },
    ),
]


async def _execute_tool(
    workspace_id: str,
    embedding_client: EmbeddingClient,
    name: str,
    tool_input: dict[str, Any],
) -> Any:
    if name == "get_dashboard_snapshot":
        snapshot = await get_dashboard_snapshot(workspace_id)
        return snapshot.__dict__
    if name == "rag_lookup":
        if not embedding_client.configured:
            return {
                "error": (
                    "Knowledge base search isn't configured "
                    "(VOYAGE_API_KEY or GEMINI_API_KEY unset)."
                )
            }
        matches = await rag_lookup(embedding_client, tool_input["query"])
        return [{"title": m.title, "content": m.content} for m in matches]
    raise ValueError(f"Unknown tool: {name}")


def run_report_summarizer(
    llm: LLMClient,
    workspace_id: str,
    conversation: list[dict[str, Any]],
    embedding_client: EmbeddingClient | None = None,
) -> AsyncIterator[AgentEvent]:
    embedding_client = embedding_client if embedding_client is not None else EmbeddingClient()

    async def execute(name: str, tool_input: dict[str, Any]) -> Any:
        return await _execute_tool(workspace_id, embedding_client, name, tool_input)

    return run_tool_calling_agent(
        llm, SYSTEM_PROMPT, TOOLS, execute, conversation, DISCLAIMER, NOT_CONFIGURED
    )
