import uuid

import pytest

from db import close_pool, get_pool
from tools.holdings import get_holdings


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:12]}"


async def _seed_workspace_with_holdings() -> tuple[str, str]:
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
        "Test Brokerage",
        "brokerage",
        "USD",
    )

    rows = [
        (_id("hold"), "AAPL", "Apple Inc.", 10.0, 15000, 18000, "equity"),
        (_id("hold"), "BTC", "Bitcoin", 0.5, 4000000, None, "crypto"),
    ]
    for holding_id, symbol, name, quantity, cost_basis, current_price, asset_class in rows:
        await pool.execute(
            """
            INSERT INTO holdings
                (id, "workspaceId", "accountId", symbol, name, quantity,
                 "costBasisMinor", "currentPriceMinor", currency, "assetClass", "updatedAt")
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
            """,
            holding_id,
            workspace_id,
            account_id,
            symbol,
            name,
            quantity,
            cost_basis,
            current_price,
            "USD",
            asset_class,
        )

    return workspace_id, account_id


async def _cleanup_workspace(workspace_id: str) -> None:
    pool = await get_pool()
    await pool.execute('DELETE FROM workspaces WHERE id = $1', workspace_id)


@pytest.fixture(autouse=True)
async def _fresh_pool_per_test():
    yield
    await close_pool()


async def test_returns_holdings_for_the_workspace() -> None:
    workspace_id, _ = await _seed_workspace_with_holdings()
    try:
        results = await get_holdings(workspace_id)
        assert len(results) == 2
        assert {r.symbol for r in results} == {"AAPL", "BTC"}
        aapl = next(r for r in results if r.symbol == "AAPL")
        assert aapl.cost_basis_minor == 15000
        assert aapl.current_price_minor == 18000
        btc = next(r for r in results if r.symbol == "BTC")
        assert btc.current_price_minor is None
    finally:
        await _cleanup_workspace(workspace_id)


async def test_never_returns_another_workspaces_holdings() -> None:
    workspace_a, _ = await _seed_workspace_with_holdings()
    workspace_b, _ = await _seed_workspace_with_holdings()
    try:
        a_results = await get_holdings(workspace_a)
        b_results = await get_holdings(workspace_b)
        a_ids = {r.id for r in a_results}
        b_ids = {r.id for r in b_results}
        assert a_ids.isdisjoint(b_ids)
    finally:
        await _cleanup_workspace(workspace_a)
        await _cleanup_workspace(workspace_b)


async def test_returns_empty_list_for_a_workspace_with_no_holdings() -> None:
    workspace_id, _ = await _seed_workspace_with_holdings()
    other_workspace_id = _id("ws-empty")
    pool = await get_pool()
    await pool.execute(
        'INSERT INTO workspaces (id, name) VALUES ($1, $2)', other_workspace_id, "empty ws"
    )
    try:
        assert await get_holdings(other_workspace_id) == []
    finally:
        await _cleanup_workspace(workspace_id)
        await _cleanup_workspace(other_workspace_id)
