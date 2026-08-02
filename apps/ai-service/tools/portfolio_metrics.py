"""Portfolio analytics calculators (architecture.md §13.1, Portfolio Analyst
tools). Ported 1:1 from apps/web/features/portfolio/lib/analytics.ts so the
AI advisor's numbers always match what the Portfolio page shows — same
per-unit cost-basis interpretation, same risk-weight heuristic, same
rounding. If one changes, the other must too.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

# Same heuristic, same weights as apps/web/features/portfolio/lib/analytics.ts
# — not a real financial risk model, revisit once a real risk-scoring tool
# exists.
ASSET_CLASS_RISK_WEIGHT: dict[str, int] = {
    "crypto": 10,
    "equity": 8,
    "commodity": 7,
    "real_estate": 6,
    "other": 5,
    "bond": 3,
    "cash": 1,
}


@dataclass
class HoldingAnalytics:
    id: str
    symbol: str
    label: str
    quantity: float
    cost_basis_minor: int
    current_price_minor: int
    has_live_price: bool
    market_value_minor: int
    total_cost_minor: int
    gain_loss_minor: int
    gain_loss_pct: float | None
    asset_class: str


def analyze_holding(
    id: str,
    symbol: str,
    name: str | None,
    quantity: float,
    cost_basis_minor: int,
    current_price_minor: int | None,
    asset_class: str,
) -> HoldingAnalytics:
    """Falls back to cost basis when no current price has been entered."""
    price_minor = current_price_minor if current_price_minor is not None else cost_basis_minor
    market_value_minor = round(price_minor * quantity)
    total_cost_minor = round(cost_basis_minor * quantity)
    gain_loss_minor = market_value_minor - total_cost_minor
    gain_loss_pct = (
        round((gain_loss_minor / total_cost_minor) * 1000) / 10 if total_cost_minor > 0 else None
    )
    return HoldingAnalytics(
        id=id,
        symbol=symbol,
        label=name or symbol,
        quantity=quantity,
        cost_basis_minor=cost_basis_minor,
        current_price_minor=price_minor,
        has_live_price=current_price_minor is not None,
        market_value_minor=market_value_minor,
        total_cost_minor=total_cost_minor,
        gain_loss_minor=gain_loss_minor,
        gain_loss_pct=gain_loss_pct,
        asset_class=asset_class,
    )


@dataclass
class AllocationSlice:
    key: str
    label: str
    value_minor: int
    pct: float


def _pct_of(part: int, total: int) -> float:
    return round((part / total) * 1000) / 10 if total > 0 else 0.0


def calculate_allocation(
    holdings: list[HoldingAnalytics],
    group_by: Literal["holding", "asset_class"],
) -> list[AllocationSlice]:
    total = sum(h.market_value_minor for h in holdings)

    if group_by == "holding":
        slices = [
            AllocationSlice(
                key=h.id, label=h.symbol, value_minor=h.market_value_minor,
                pct=_pct_of(h.market_value_minor, total),
            )
            for h in holdings
        ]
    else:
        totals: dict[str, int] = {}
        for h in holdings:
            totals[h.asset_class] = totals.get(h.asset_class, 0) + h.market_value_minor
        slices = [
            AllocationSlice(key=key, label=key, value_minor=value, pct=_pct_of(value, total))
            for key, value in totals.items()
        ]

    return sorted(slices, key=lambda s: s.value_minor, reverse=True)


def calculate_risk_score(holdings: list[HoldingAnalytics]) -> float | None:
    total = sum(h.market_value_minor for h in holdings)
    if total == 0:
        return None
    weighted = sum(
        ASSET_CLASS_RISK_WEIGHT.get(h.asset_class, 5) * h.market_value_minor for h in holdings
    )
    return round((weighted / total) * 10) / 10
