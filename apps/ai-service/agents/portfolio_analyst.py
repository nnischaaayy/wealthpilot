"""Portfolio Analyst agent (architecture.md §13.1) — allocation, risk, and
performance questions. Tools: get_holdings, calculate_allocation,
calculate_risk_score, calculate_investment_growth.

Non-negotiable rule (architecture.md §13.2): the LLM never computes money.
Every numeric answer must come from a tool call result — the model narrates
it, it does not derive it.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from agents._loop import AgentEvent, run_tool_calling_agent
from llm_client import LLMClient, ToolSpec
from tools import calculators
from tools.holdings import get_holdings
from tools.portfolio_metrics import (
    HoldingAnalytics,
    analyze_holding,
    calculate_allocation,
    calculate_risk_score,
)

SYSTEM_PROMPT = """You are WealthPilot's Portfolio Analyst, one of a small set of role-scoped \
agents in an AI financial assistant.

Scope: allocation, diversification, risk, and investment-growth questions about the user's own \
portfolio holdings.

Rules you must always follow:
- You are not a licensed financial advisor. Everything you say is informational analysis, not \
investment advice.
- Never compute money or percentages yourself. Every number you state must come from a tool call \
result you were given in this conversation — narrate it, do not derive it by arithmetic of your own.
- When you state a number, briefly say what holdings or calculation it's based on.
- Keep responses concise and conversational."""

DISCLAIMER = "This is informational analysis, not licensed investment advice."
NOT_CONFIGURED = (
    "The AI advisor isn't configured yet (no ANTHROPIC_API_KEY set). "
    "The rest of WealthPilot works fully without it."
)

TOOLS = [
    ToolSpec(
        name="get_holdings",
        description=(
            "Fetch the user's own portfolio holdings: symbol, quantity, cost basis, current "
            "price (if entered), and asset class."
        ),
        input_schema={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="calculate_allocation",
        description=(
            "Computes allocation percentages, grouped either by individual holding or by asset "
            "class."
        ),
        input_schema={
            "type": "object",
            "properties": {"group_by": {"type": "string", "enum": ["holding", "asset_class"]}},
            "required": ["group_by"],
        },
    ),
    ToolSpec(
        name="calculate_risk_score",
        description=(
            "Computes a 0-10 portfolio risk score, weighted by asset-class risk and market value."
        ),
        input_schema={"type": "object", "properties": {}},
    ),
    ToolSpec(
        name="calculate_investment_growth",
        description=(
            "Projects investment future value with monthly compounding and a level monthly "
            "contribution."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "principal_minor": {"type": "integer"},
                "monthly_contribution_minor": {"type": "integer"},
                "annual_rate_pct": {"type": "number"},
                "years": {"type": "integer"},
            },
            "required": [
                "principal_minor",
                "monthly_contribution_minor",
                "annual_rate_pct",
                "years",
            ],
        },
    ),
]


async def _get_analytics(workspace_id: str) -> list[HoldingAnalytics]:
    rows = await get_holdings(workspace_id)
    return [
        analyze_holding(
            r.id, r.symbol, r.name, r.quantity, r.cost_basis_minor, r.current_price_minor,
            r.asset_class,
        )
        for r in rows
    ]


async def _execute_tool(workspace_id: str, name: str, tool_input: dict[str, Any]) -> Any:
    if name == "get_holdings":
        analytics = await _get_analytics(workspace_id)
        return [a.__dict__ for a in analytics]
    if name == "calculate_allocation":
        analytics = await _get_analytics(workspace_id)
        slices = calculate_allocation(analytics, tool_input["group_by"])
        return [s.__dict__ for s in slices]
    if name == "calculate_risk_score":
        analytics = await _get_analytics(workspace_id)
        return {"risk_score": calculate_risk_score(analytics)}
    if name == "calculate_investment_growth":
        result = calculators.calculate_investment_growth(
            principal_minor=tool_input["principal_minor"],
            monthly_contribution_minor=tool_input["monthly_contribution_minor"],
            annual_rate_pct=tool_input["annual_rate_pct"],
            years=tool_input["years"],
        )
        return result.__dict__
    raise ValueError(f"Unknown tool: {name}")


def run_portfolio_analyst(
    llm: LLMClient,
    workspace_id: str,
    conversation: list[dict[str, Any]],
) -> AsyncIterator[AgentEvent]:
    async def execute(name: str, tool_input: dict[str, Any]) -> Any:
        return await _execute_tool(workspace_id, name, tool_input)

    return run_tool_calling_agent(
        llm, SYSTEM_PROMPT, TOOLS, execute, conversation, DISCLAIMER, NOT_CONFIGURED
    )
