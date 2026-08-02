"""get_transactions tool (architecture.md §13.1) — Budget Coach's read path
over the user's real transaction data.

Every query is filtered on workspaceId at the SQL level: the same
tenant-isolation chokepoint the TS service layer enforces via
`findFirst({id, workspaceId})`, just expressed as a WHERE clause since this
is a raw read path over asyncpg, not Prisma.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime

from db import get_pool


@dataclass
class TransactionRecord:
    id: str
    posted_at: datetime
    amount_minor: int
    currency: str
    description: str
    category: str
    subcategory: str | None


async def get_transactions(
    workspace_id: str,
    *,
    start: date | None = None,
    end: date | None = None,
    category: str | None = None,
    limit: int = 200,
) -> list[TransactionRecord]:
    if limit <= 0 or limit > 1000:
        raise ValueError("limit must be in (0, 1000]")

    conditions = ['"workspaceId" = $1']
    params: list[object] = [workspace_id]

    if start is not None:
        params.append(start)
        conditions.append(f'"postedAt" >= ${len(params)}')
    if end is not None:
        params.append(end)
        conditions.append(f'"postedAt" < ${len(params)}')
    if category is not None:
        params.append(category)
        conditions.append(f'"category" = ${len(params)}')

    params.append(limit)
    query = f"""
        SELECT id, "postedAt", "amountMinor", currency, description, category, subcategory
        FROM transactions
        WHERE {" AND ".join(conditions)}
        ORDER BY "postedAt" DESC
        LIMIT ${len(params)}
    """  # noqa: S608 - conditions/columns are fixed strings, only values are parameterized

    pool = await get_pool()
    rows = await pool.fetch(query, *params)
    return [
        TransactionRecord(
            id=r["id"],
            posted_at=r["postedAt"],
            amount_minor=r["amountMinor"],
            currency=r["currency"],
            description=r["description"],
            category=r["category"],
            subcategory=r["subcategory"],
        )
        for r in rows
    ]
