"""Budget Coach agent (architecture.md §13.1) — spending/cash-flow/budget
questions. Tools: get_transactions, calculate_budget_projection,
calculate_emergency_fund, calculate_loan_payment, calculate_investment_growth.

search_transactions_semantic and categorize_transaction (also named for
Budget Coach in architecture.md §13.1) are deferred to Phase 6 alongside the
pgvector-backed RAG knowledge base — semantic search needs the same
embedding infra RAG does, and categorization already has a working rules
engine on the TS side (apps/web/features/transactions).

Non-negotiable rule (architecture.md §13.2): the LLM never computes money.
Every numeric answer must come from a tool call result — the model narrates
it, it does not derive it.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import date
from typing import Any

from llm_client import LLMClient, StopEvent, TextEvent, ToolSpec, ToolUseEvent
from privacy.redaction import redact
from tools import calculators
from tools.transactions import get_transactions

SYSTEM_PROMPT = """You are WealthPilot's Budget Coach, one of a small set of role-scoped agents \
in an AI financial assistant.

Scope: spending, cash flow, budgeting, saving, and simple loan/investment-growth questions about \
the user's own transactions.

Rules you must always follow:
- You are not a licensed financial advisor. Everything you say is informational analysis, not \
financial advice.
- Never compute money yourself. Every number you state about the user's finances must come from a \
tool call result you were given in this conversation — narrate it, do not derive it by arithmetic \
of your own.
- When you state a number, briefly say what transactions or calculation it's based on.
- Keep responses concise and conversational."""

DISCLAIMER = "This is informational analysis, not licensed financial advice."

MAX_TOOL_ROUNDS = 4

TOOLS = [
    ToolSpec(
        name="get_transactions",
        description=(
            "Fetch the user's own transactions, optionally filtered by category and date range, "
            "most recent first."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "category": {"type": "string", "description": "e.g. 'dining', 'groceries'."},
                "start_date": {
                    "type": "string",
                    "description": "ISO date (YYYY-MM-DD), inclusive.",
                },
                "end_date": {
                    "type": "string",
                    "description": "ISO date (YYYY-MM-DD), exclusive.",
                },
                "limit": {"type": "integer", "description": "Max rows to return, default 50."},
            },
        },
    ),
    ToolSpec(
        name="calculate_budget_projection",
        description=(
            "Projects month-end spend per 50/30/20 group (needs/wants/savings) by linearly "
            "extrapolating spend-so-far, and compares it against the income-based target."
        ),
        input_schema={
            "type": "object",
            "properties": {
                "monthly_income_minor": {"type": "integer"},
                "group_spent_minor": {
                    "type": "object",
                    "description": "Minor-unit spend so far, keyed by needs/wants/savings.",
                    "properties": {
                        "needs": {"type": "integer"},
                        "wants": {"type": "integer"},
                        "savings": {"type": "integer"},
                    },
                },
                "days_elapsed": {"type": "integer"},
                "days_in_month": {"type": "integer"},
            },
            "required": [
                "monthly_income_minor",
                "group_spent_minor",
                "days_elapsed",
                "days_in_month",
            ],
        },
    ),
    ToolSpec(
        name="calculate_emergency_fund",
        description="Computes an emergency-fund target, shortfall, and current coverage in months.",
        input_schema={
            "type": "object",
            "properties": {
                "monthly_essential_expenses_minor": {"type": "integer"},
                "months_of_coverage": {"type": "integer", "description": "Default 6."},
                "current_savings_minor": {"type": "integer", "description": "Default 0."},
            },
            "required": ["monthly_essential_expenses_minor"],
        },
    ),
    ToolSpec(
        name="calculate_loan_payment",
        description="Computes a fixed-rate loan's monthly payment, total paid, and total interest.",
        input_schema={
            "type": "object",
            "properties": {
                "principal_minor": {"type": "integer"},
                "annual_rate_pct": {"type": "number"},
                "term_months": {"type": "integer"},
            },
            "required": ["principal_minor", "annual_rate_pct", "term_months"],
        },
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


@dataclass
class AgentEvent:
    type: str  # "text" | "tool_call" | "done" | "error"
    text: str | None = None
    tool_name: str | None = None
    detail: dict[str, Any] | None = None


async def _execute_tool(workspace_id: str, name: str, tool_input: dict[str, Any]) -> Any:
    if name == "get_transactions":
        start_date = tool_input.get("start_date")
        end_date = tool_input.get("end_date")
        start = date.fromisoformat(start_date) if start_date else None
        end = date.fromisoformat(end_date) if end_date else None
        rows = await get_transactions(
            workspace_id,
            start=start,
            end=end,
            category=tool_input.get("category"),
            limit=tool_input.get("limit", 50),
        )
        # Transaction descriptions are free-text bank narration — the one
        # field in this payload that can carry account numbers, UPI handles,
        # or reference IDs. Redact before it ever reaches the model.
        return [
            {
                "id": r.id,
                "posted_at": r.posted_at.date().isoformat(),
                "amount_minor": r.amount_minor,
                "currency": r.currency,
                "description": redact(r.description).text,
                "category": r.category,
            }
            for r in rows
        ]
    if name == "calculate_budget_projection":
        results = calculators.calculate_budget_projection(
            monthly_income_minor=tool_input["monthly_income_minor"],
            group_spent_minor=tool_input["group_spent_minor"],
            days_elapsed=tool_input["days_elapsed"],
            days_in_month=tool_input["days_in_month"],
        )
        return [r.__dict__ for r in results]
    if name == "calculate_emergency_fund":
        plan = calculators.calculate_emergency_fund(
            monthly_essential_expenses_minor=tool_input["monthly_essential_expenses_minor"],
            months_of_coverage=tool_input.get("months_of_coverage", 6),
            current_savings_minor=tool_input.get("current_savings_minor", 0),
        )
        return plan.__dict__
    if name == "calculate_loan_payment":
        plan = calculators.calculate_loan_payment(
            principal_minor=tool_input["principal_minor"],
            annual_rate_pct=tool_input["annual_rate_pct"],
            term_months=tool_input["term_months"],
        )
        return plan.__dict__
    if name == "calculate_investment_growth":
        result = calculators.calculate_investment_growth(
            principal_minor=tool_input["principal_minor"],
            monthly_contribution_minor=tool_input["monthly_contribution_minor"],
            annual_rate_pct=tool_input["annual_rate_pct"],
            years=tool_input["years"],
        )
        return result.__dict__
    raise ValueError(f"Unknown tool: {name}")


async def run_budget_coach(
    llm: LLMClient,
    workspace_id: str,
    conversation: list[dict[str, Any]],
) -> AsyncIterator[AgentEvent]:
    """`conversation` is [{"role": "user"|"assistant", "content": str}, ...], oldest first."""
    if not llm.configured:
        yield AgentEvent(
            type="error",
            text=(
                "The AI advisor isn't configured yet (no ANTHROPIC_API_KEY set). "
                "The rest of WealthPilot works fully without it."
            ),
        )
        return

    messages: list[dict[str, Any]] = [dict(m) for m in conversation]

    for _round in range(MAX_TOOL_ROUNDS):
        text_buffer = ""
        tool_calls: list[ToolUseEvent] = []

        async for event in llm.stream(
            system=SYSTEM_PROMPT, messages=messages, tools=TOOLS, max_tokens=1024
        ):
            if isinstance(event, TextEvent):
                text_buffer += event.text
                yield AgentEvent(type="text", text=event.text)
            elif isinstance(event, ToolUseEvent):
                tool_calls.append(event)
            elif isinstance(event, StopEvent):
                pass  # stop_reason isn't currently branched on

        if not tool_calls:
            yield AgentEvent(type="done", text=DISCLAIMER)
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
                result = await _execute_tool(workspace_id, call.name, call.input)
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
