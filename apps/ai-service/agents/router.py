"""Intent router (architecture.md §13.1).

v1 ships one sub-agent, Budget Coach; Portfolio Analyst and Report
Summarizer land in Phase 6. The router still classifies all three intents
now, so main.py can give an honest "not built yet" for the other two
instead of silently routing everything through Budget Coach.

Keyword-based, not LLM-based: classification needs to be instant, free, and
auditable, and the intent set is small and stable enough that it doesn't
need a model call of its own.
"""

from __future__ import annotations

from enum import StrEnum


class Intent(StrEnum):
    BUDGET = "budget"
    PORTFOLIO = "portfolio"
    REPORT = "report"


_PORTFOLIO_KEYWORDS = (
    "portfolio",
    "holding",
    "stock",
    "allocation",
    "invest",
    "risk score",
    "diversif",
)
_REPORT_KEYWORDS = ("summarize", "summary", "this month", "this quarter", "overview")
_BUDGET_KEYWORDS = (
    "budget",
    "spend",
    "spent",
    "spending",
    "expense",
    "transaction",
    "category",
    "save",
    "saving",
    "emergency fund",
    "loan",
    "afford",
    "cash flow",
)


def classify_intent(message: str) -> Intent:
    text = message.lower()

    if any(keyword in text for keyword in _PORTFOLIO_KEYWORDS):
        return Intent.PORTFOLIO
    if any(keyword in text for keyword in _REPORT_KEYWORDS):
        return Intent.REPORT
    if any(keyword in text for keyword in _BUDGET_KEYWORDS):
        return Intent.BUDGET

    # No confident match: default to Budget Coach rather than a hard wall —
    # most finance questions are budget-adjacent, and it can say "I don't
    # know" better than a router-level rejection can.
    return Intent.BUDGET
