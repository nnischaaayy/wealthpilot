import uuid
from datetime import date, datetime

import pytest

from db import close_pool, get_pool
from tools.transactions import get_transactions


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


async def _seed_workspace_with_transactions() -> tuple[str, str]:
    """Creates a workspace + account + a handful of transactions.

    Returns (workspace_id, account_id).
    """
    pool = await get_pool()
    workspace_id = _id("ws")
    account_id = _id("acc")

    await pool.execute(
        'INSERT INTO workspaces (id, name) VALUES ($1, $2)', workspace_id, "ai-service test"
    )
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

    rows = [
        (_id("txn"), datetime(2025, 3, 1), -5000, "Groceries at BigBasket", "groceries"),
        (_id("txn"), datetime(2025, 3, 5), -2000, "Zomato order", "dining"),
        (_id("txn"), datetime(2025, 3, 10), 200000, "Salary credit", "income"),
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


async def _cleanup_workspace(workspace_id: str) -> None:
    pool = await get_pool()
    await pool.execute('DELETE FROM workspaces WHERE id = $1', workspace_id)


@pytest.fixture(autouse=True)
async def _fresh_pool_per_test():
    # pytest-asyncio gives each test function its own event loop, but
    # db.get_pool() caches a module-level singleton — without resetting it
    # here, test 2 would try to reuse connections bound to test 1's already-
    # closed loop. Function-scoped reset keeps the pool's lifetime matched
    # to the loop that created it.
    yield
    await close_pool()


async def test_returns_transactions_for_the_workspace_most_recent_first() -> None:
    workspace_id, _ = await _seed_workspace_with_transactions()
    try:
        results = await get_transactions(workspace_id)
        assert len(results) == 3
        assert [r.description for r in results] == [
            "Salary credit",
            "Zomato order",
            "Groceries at BigBasket",
        ]
    finally:
        await _cleanup_workspace(workspace_id)


async def test_filters_by_category() -> None:
    workspace_id, _ = await _seed_workspace_with_transactions()
    try:
        results = await get_transactions(workspace_id, category="dining")
        assert len(results) == 1
        assert results[0].description == "Zomato order"
    finally:
        await _cleanup_workspace(workspace_id)


async def test_filters_by_date_range() -> None:
    workspace_id, _ = await _seed_workspace_with_transactions()
    try:
        results = await get_transactions(
            workspace_id, start=date(2025, 3, 5), end=date(2025, 3, 10)
        )
        assert [r.description for r in results] == ["Zomato order"]
    finally:
        await _cleanup_workspace(workspace_id)


async def test_never_returns_another_workspaces_transactions() -> None:
    workspace_a, _ = await _seed_workspace_with_transactions()
    workspace_b, _ = await _seed_workspace_with_transactions()
    try:
        results = await get_transactions(workspace_a)
        assert all(r.category != "" for r in results)  # sanity: got real rows
        # workspace_b's rows must never leak into workspace_a's result set
        b_results = await get_transactions(workspace_b)
        a_ids = {r.id for r in results}
        b_ids = {r.id for r in b_results}
        assert a_ids.isdisjoint(b_ids)
    finally:
        await _cleanup_workspace(workspace_a)
        await _cleanup_workspace(workspace_b)


async def test_rejects_out_of_range_limit() -> None:
    with pytest.raises(ValueError):
        await get_transactions("some-workspace", limit=0)
    with pytest.raises(ValueError):
        await get_transactions("some-workspace", limit=1001)
