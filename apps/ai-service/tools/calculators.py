"""Deterministic financial calculators (architecture.md §13.2).

The LLM never computes money — every numeric answer an agent gives must come
from one of these functions, not free generation. Pure functions, no I/O, no
LLM calls, so they're trivial to unit test with exact numeric assertions and
trivial to reason about for correctness/audit.

All money is minor units (cents/paise), matching the convention used
throughout the rest of the app (packages/db Prisma schema, apps/web
analytics).
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass

BUDGET_GROUP_TARGET_PCT: dict[str, int] = {"needs": 50, "wants": 30, "savings": 20}


@dataclass
class BudgetGroupProjection:
    group: str
    target_minor: int
    spent_minor: int
    projected_minor: int
    on_track: bool


def calculate_budget_projection(
    monthly_income_minor: int,
    group_spent_minor: Mapping[str, int],
    days_elapsed: int,
    days_in_month: int,
) -> list[BudgetGroupProjection]:
    """Projects month-end spend per 50/30/20 group by linear extrapolation
    of spend-so-far, and compares it against that group's income-based target.
    """
    if monthly_income_minor < 0:
        raise ValueError("monthly_income_minor must be non-negative")
    if days_elapsed <= 0 or days_in_month <= 0 or days_elapsed > days_in_month:
        raise ValueError("days_elapsed must be in (0, days_in_month]")

    results: list[BudgetGroupProjection] = []
    for group, pct in BUDGET_GROUP_TARGET_PCT.items():
        target_minor = round(monthly_income_minor * pct / 100)
        spent_minor = group_spent_minor.get(group, 0)
        projected_minor = round(spent_minor / days_elapsed * days_in_month)
        results.append(
            BudgetGroupProjection(
                group=group,
                target_minor=target_minor,
                spent_minor=spent_minor,
                projected_minor=projected_minor,
                on_track=projected_minor <= target_minor,
            )
        )
    return results


@dataclass
class IncomeSplit:
    group: str
    target_minor: int


def calculate_income_split(monthly_income_minor: int) -> list[IncomeSplit]:
    """The 50/30/20 target split for a given income, independent of actual
    spending — for "how should I split $X income" questions. Use
    calculate_budget_projection instead when comparing against real
    spend-so-far this month.
    """
    if monthly_income_minor < 0:
        raise ValueError("monthly_income_minor must be non-negative")

    return [
        IncomeSplit(group=group, target_minor=round(monthly_income_minor * pct / 100))
        for group, pct in BUDGET_GROUP_TARGET_PCT.items()
    ]


@dataclass
class EmergencyFundPlan:
    target_minor: int
    shortfall_minor: int
    months_covered_now: float | None


def calculate_emergency_fund(
    monthly_essential_expenses_minor: int,
    months_of_coverage: int = 6,
    current_savings_minor: int = 0,
) -> EmergencyFundPlan:
    if monthly_essential_expenses_minor < 0:
        raise ValueError("monthly_essential_expenses_minor must be non-negative")
    if months_of_coverage <= 0:
        raise ValueError("months_of_coverage must be positive")
    if current_savings_minor < 0:
        raise ValueError("current_savings_minor must be non-negative")

    target_minor = monthly_essential_expenses_minor * months_of_coverage
    shortfall_minor = max(0, target_minor - current_savings_minor)
    months_covered_now = (
        round(current_savings_minor / monthly_essential_expenses_minor, 1)
        if monthly_essential_expenses_minor > 0
        else None
    )
    return EmergencyFundPlan(
        target_minor=target_minor,
        shortfall_minor=shortfall_minor,
        months_covered_now=months_covered_now,
    )


@dataclass
class InvestmentGrowthProjection:
    future_value_minor: int
    total_contributions_minor: int
    total_growth_minor: int


def calculate_investment_growth(
    principal_minor: int,
    monthly_contribution_minor: int,
    annual_rate_pct: float,
    years: int,
) -> InvestmentGrowthProjection:
    """Future value with monthly compounding and a level monthly contribution."""
    if principal_minor < 0 or monthly_contribution_minor < 0:
        raise ValueError("principal_minor and monthly_contribution_minor must be non-negative")
    if years <= 0:
        raise ValueError("years must be positive")

    months = years * 12
    monthly_rate = annual_rate_pct / 100 / 12

    if monthly_rate == 0:
        future_value = principal_minor + monthly_contribution_minor * months
    else:
        growth_factor = (1 + monthly_rate) ** months
        future_value = principal_minor * growth_factor + monthly_contribution_minor * (
            (growth_factor - 1) / monthly_rate
        )

    total_contributions_minor = principal_minor + monthly_contribution_minor * months
    future_value_minor = round(future_value)
    return InvestmentGrowthProjection(
        future_value_minor=future_value_minor,
        total_contributions_minor=total_contributions_minor,
        total_growth_minor=future_value_minor - total_contributions_minor,
    )


@dataclass
class LoanPaymentPlan:
    monthly_payment_minor: int
    total_paid_minor: int
    total_interest_minor: int


def calculate_loan_payment(
    principal_minor: int,
    annual_rate_pct: float,
    term_months: int,
) -> LoanPaymentPlan:
    """Standard fixed-rate amortization (level monthly payment)."""
    if principal_minor <= 0:
        raise ValueError("principal_minor must be positive")
    if term_months <= 0:
        raise ValueError("term_months must be positive")
    if annual_rate_pct < 0:
        raise ValueError("annual_rate_pct must be non-negative")

    monthly_rate = annual_rate_pct / 100 / 12

    if monthly_rate == 0:
        monthly_payment = principal_minor / term_months
    else:
        growth_factor = (1 + monthly_rate) ** term_months
        monthly_payment = principal_minor * (monthly_rate * growth_factor) / (growth_factor - 1)

    monthly_payment_minor = round(monthly_payment)
    total_paid_minor = monthly_payment_minor * term_months
    return LoanPaymentPlan(
        monthly_payment_minor=monthly_payment_minor,
        total_paid_minor=total_paid_minor,
        total_interest_minor=total_paid_minor - principal_minor,
    )
