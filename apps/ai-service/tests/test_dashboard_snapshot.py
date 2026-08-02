import uuid
from datetime import date, datetime

import pytest

from db import close_pool, get_pool
from tools.dashboard_snapshot import get_dashboard_snapshot


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


def _this_month_day(day: int) -> datetime:
    today = date.today()
    return datetime(today.year, today.month, day)


async def _seed_workspace() -> tuple[str, str]:
    pool = await get_pool()
    workspace_id = _id("ws")
    account_id = _id("acc")

    await pool.execute('INSERT INTO workspaces (id, name) VALUES ($1, $2)', workspace_id, "test")
    await pool.execute(
        """
        INSERT INTO accounts (id, "workspaceId", name, type, currency)
        VALUES ($1, $2, $3, $4, $5)
        """,
        account_id,
        workspace_id,
        "Test Checking",
        "checking",
        "USD",
    )

    # A prior-month transaction (fixed, well outside "this month" regardless
    # of when the test runs) so net worth differs from this month's net.
    rows = [
        (_id("txn"), datetime(2020, 1, 1), 500_000, "Old salary", "income"),
        (_id("txn"), _this_month_day(2), 300_000, "Salary", "income"),
        (_id("txn"), _this_month_day(3), -100_000, "Rent", "housing"),
        (_id("txn"), _this_month_day(4), -30_000, "Dinner out", "dining"),
        (_id("txn"), _this_month_day(5), -25_000, "Groceries", "groceries"),
        (_id("txn"), _this_month_day(6), -20_000, "Index fund", "savings"),
    ]
    for txn_id, posted_at, amount_minor, description, category in rows:
        await pool.execute(
            """
            INSERT INTO transactions
                (id, "workspaceId", "accountId", "postedAt", "amountMinor",
                 currency, description, category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            """,
            txn_id,
            workspace_id,
            account_id,
            posted_at,
            amount_minor,
            "USD",
            description,
            category,
        )

    return workspace_id, account_id


async def _cleanup(workspace_id: str) -> None:
    pool = await get_pool()
    await pool.execute('DELETE FROM workspaces WHERE id = $1', workspace_id)


@pytest.fixture(autouse=True)
async def _fresh_pool_per_test():
    yield
    await close_pool()


async def test_returns_empty_snapshot_for_a_workspace_with_no_accounts() -> None:
    snapshot = await get_dashboard_snapshot("nonexistent-ws")
    assert snapshot.currency is None
    assert snapshot.has_transactions is False
    assert snapshot.net_worth_minor == 0
    assert snapshot.savings_rate_pct is None


async def test_computes_month_and_net_worth_totals_correctly() -> None:
    workspace_id, _ = await _seed_workspace()
    try:
        snapshot = await get_dashboard_snapshot(workspace_id)

        assert snapshot.currency == "USD"
        assert snapshot.has_transactions is True
        assert snapshot.net_worth_minor == 625_000  # 500000 + 300000 - 175000
        assert snapshot.month_income_minor == 300_000
        assert snapshot.month_expenses_minor == 175_000
        assert snapshot.month_net_minor == 125_000
        assert snapshot.savings_rate_pct == 42  # round(125000/300000*100)
    finally:
        await _cleanup(workspace_id)


async def test_category_breakdown_sorted_descending() -> None:
    workspace_id, _ = await _seed_workspace()
    try:
        snapshot = await get_dashboard_snapshot(workspace_id)
        labels = [c["label"] for c in snapshot.top_categories]
        assert labels == ["Housing", "Dining", "Groceries", "Savings & investing"]
    finally:
        await _cleanup(workspace_id)


async def test_budget_groups_match_50_30_20_targets_and_actuals() -> None:
    workspace_id, _ = await _seed_workspace()
    try:
        snapshot = await get_dashboard_snapshot(workspace_id)
        by_group = {g["group"]: g for g in snapshot.budget_groups}

        assert by_group["needs"]["spent_minor"] == 125_000  # housing + groceries
        assert by_group["needs"]["target_pct"] == 50
        assert by_group["needs"]["actual_pct"] == 42

        assert by_group["wants"]["spent_minor"] == 30_000  # dining
        assert by_group["wants"]["actual_pct"] == 10

        assert by_group["savings"]["spent_minor"] == 20_000
        assert by_group["savings"]["actual_pct"] == 7
    finally:
        await _cleanup(workspace_id)


async def test_never_returns_another_workspaces_data() -> None:
    workspace_a, _ = await _seed_workspace()
    other_ws = _id("ws-empty")
    pool = await get_pool()
    await pool.execute('INSERT INTO workspaces (id, name) VALUES ($1, $2)', other_ws, "empty")
    try:
        snapshot = await get_dashboard_snapshot(other_ws)
        assert snapshot.currency is None
        assert snapshot.net_worth_minor == 0
    finally:
        await _cleanup(workspace_a)
        await _cleanup(other_ws)
