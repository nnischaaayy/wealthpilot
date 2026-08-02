"""get_dashboard_snapshot tool (architecture.md §13.1) — Report Summarizer's
read path over the user's aggregate financial picture. Ported from
apps/web/features/dashboard/server/service.ts (and lib/categories.ts /
lib/aggregate.ts) so the numbers match the Dashboard page exactly.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime

from db import get_pool

# Mirrors apps/web/lib/categories.ts's CATEGORIES table.
CATEGORY_GROUPS: dict[str, str] = {
    "housing": "needs",
    "utilities": "needs",
    "groceries": "needs",
    "transport": "needs",
    "health": "needs",
    "insurance": "needs",
    "dining": "wants",
    "shopping": "wants",
    "entertainment": "wants",
    "subscriptions": "wants",
    "travel": "wants",
    "education": "wants",
    "fees": "wants",
    "savings": "savings",
    "income": "income",
    "transfer": "transfer",
    "other": "wants",
    "uncategorized": "wants",
}

CATEGORY_LABELS: dict[str, str] = {
    "housing": "Housing",
    "utilities": "Utilities",
    "groceries": "Groceries",
    "transport": "Transport",
    "health": "Health",
    "insurance": "Insurance",
    "dining": "Dining",
    "shopping": "Shopping",
    "entertainment": "Entertainment",
    "subscriptions": "Subscriptions",
    "travel": "Travel",
    "education": "Education",
    "fees": "Fees & charges",
    "savings": "Savings & investing",
    "income": "Income",
    "transfer": "Transfer",
    "other": "Other",
    "uncategorized": "Uncategorized",
}

BUDGET_GROUP_TARGET_PCT: dict[str, int] = {"needs": 50, "wants": 30, "savings": 20}
MAX_CATEGORY_SLICES = 5


def _category_group(category: str) -> str:
    return CATEGORY_GROUPS.get(category, "wants")


def _category_label(category: str) -> str:
    return CATEGORY_LABELS.get(category, category)


def _this_month_range(today: date | None = None) -> tuple[datetime, datetime]:
    today = today or date.today()
    start = datetime(today.year, today.month, 1)
    if today.month == 12:
        end = datetime(today.year + 1, 1, 1)
    else:
        end = datetime(today.year, today.month + 1, 1)
    return start, end


@dataclass
class DashboardSnapshot:
    currency: str | None
    has_transactions: bool
    net_worth_minor: int
    month_income_minor: int
    month_expenses_minor: int
    month_net_minor: int
    savings_rate_pct: int | None
    top_categories: list[dict] = field(default_factory=list)
    budget_groups: list[dict] = field(default_factory=list)


async def get_dashboard_snapshot(workspace_id: str) -> DashboardSnapshot:
    pool = await get_pool()

    currency_row = await pool.fetchrow(
        """
        SELECT currency, COUNT(*) AS n
        FROM accounts
        WHERE "workspaceId" = $1
        GROUP BY currency
        ORDER BY n DESC
        LIMIT 1
        """,
        workspace_id,
    )
    if currency_row is None:
        return DashboardSnapshot(
            currency=None,
            has_transactions=False,
            net_worth_minor=0,
            month_income_minor=0,
            month_expenses_minor=0,
            month_net_minor=0,
            savings_rate_pct=None,
        )
    currency = currency_row["currency"]
    start, end = _this_month_range()

    net_worth_row = await pool.fetchrow(
        """
        SELECT COALESCE(SUM("amountMinor"), 0) AS total
        FROM transactions WHERE "workspaceId" = $1 AND currency = $2
        """,
        workspace_id,
        currency,
    )
    any_txn = await pool.fetchval(
        'SELECT EXISTS(SELECT 1 FROM transactions WHERE "workspaceId" = $1)', workspace_id
    )
    month_income_row = await pool.fetchrow(
        """
        SELECT COALESCE(SUM("amountMinor"), 0) AS total FROM transactions
        WHERE "workspaceId" = $1 AND currency = $2 AND "amountMinor" > 0
          AND "postedAt" >= $3 AND "postedAt" < $4
        """,
        workspace_id,
        currency,
        start,
        end,
    )
    month_expense_rows = await pool.fetch(
        """
        SELECT category, SUM("amountMinor") AS total FROM transactions
        WHERE "workspaceId" = $1 AND currency = $2 AND "amountMinor" < 0
          AND "postedAt" >= $3 AND "postedAt" < $4
        GROUP BY category
        """,
        workspace_id,
        currency,
        start,
        end,
    )

    month_income_minor = month_income_row["total"]
    month_expenses_minor = sum(abs(r["total"]) for r in month_expense_rows)
    month_net_minor = month_income_minor - month_expenses_minor

    category_totals = sorted(
        (
            {
                "category": r["category"],
                "label": _category_label(r["category"]),
                "amount_minor": abs(r["total"]),
            }
            for r in month_expense_rows
        ),
        key=lambda c: c["amount_minor"],
        reverse=True,
    )
    top_categories = category_totals[:MAX_CATEGORY_SLICES]
    if len(category_totals) > MAX_CATEGORY_SLICES:
        other_total = sum(c["amount_minor"] for c in category_totals[MAX_CATEGORY_SLICES:])
        other_slice = {"category": "other", "label": "Other", "amount_minor": other_total}
        top_categories = [*top_categories, other_slice]

    group_totals = {"needs": 0, "wants": 0, "savings": 0}
    for r in month_expense_rows:
        group = _category_group(r["category"])
        if group in group_totals:
            group_totals[group] += abs(r["total"])

    budget_groups = [
        {
            "group": group,
            "spent_minor": group_totals[group],
            "target_pct": pct,
            "actual_pct": (
                round((group_totals[group] / month_income_minor) * 100)
                if month_income_minor > 0
                else None
            ),
        }
        for group, pct in BUDGET_GROUP_TARGET_PCT.items()
    ]

    return DashboardSnapshot(
        currency=currency,
        has_transactions=bool(any_txn),
        net_worth_minor=net_worth_row["total"],
        month_income_minor=month_income_minor,
        month_expenses_minor=month_expenses_minor,
        month_net_minor=month_net_minor,
        savings_rate_pct=(
            round((month_net_minor / month_income_minor) * 100) if month_income_minor > 0 else None
        ),
        top_categories=top_categories,
        budget_groups=budget_groups,
    )
