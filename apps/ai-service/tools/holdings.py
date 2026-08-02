"""get_holdings tool (architecture.md §13.1) — Portfolio Analyst's read path
over the user's own portfolio holdings.

Same tenant-isolation chokepoint as tools/transactions.py: every query is
filtered on workspaceId at the SQL level.
"""

from __future__ import annotations

from dataclasses import dataclass

from db import get_pool


@dataclass
class HoldingRecord:
    id: str
    symbol: str
    name: str | None
    quantity: float
    cost_basis_minor: int
    current_price_minor: int | None
    currency: str
    asset_class: str


async def get_holdings(workspace_id: str) -> list[HoldingRecord]:
    pool = await get_pool()
    rows = await pool.fetch(
        """
        SELECT id, symbol, name, quantity, "costBasisMinor", "currentPriceMinor",
               currency, "assetClass"
        FROM holdings
        WHERE "workspaceId" = $1
        ORDER BY "createdAt" ASC
        """,
        workspace_id,
    )
    return [
        HoldingRecord(
            id=r["id"],
            symbol=r["symbol"],
            name=r["name"],
            quantity=r["quantity"],
            cost_basis_minor=r["costBasisMinor"],
            current_price_minor=r["currentPriceMinor"],
            currency=r["currency"],
            asset_class=r["assetClass"],
        )
        for r in rows
    ]
