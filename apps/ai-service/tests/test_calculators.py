import pytest

from tools.calculators import (
    calculate_budget_projection,
    calculate_emergency_fund,
    calculate_income_split,
    calculate_investment_growth,
    calculate_loan_payment,
)


class TestBudgetProjection:
    def test_projects_over_and_under_target_groups(self) -> None:
        results = calculate_budget_projection(
            monthly_income_minor=500_000,
            group_spent_minor={"needs": 100_000, "wants": 60_000, "savings": 20_000},
            days_elapsed=10,
            days_in_month=30,
        )
        by_group = {r.group: r for r in results}

        assert by_group["needs"].target_minor == 250_000
        assert by_group["needs"].projected_minor == 300_000
        assert by_group["needs"].on_track is False

        assert by_group["wants"].target_minor == 150_000
        assert by_group["wants"].projected_minor == 180_000
        assert by_group["wants"].on_track is False

        assert by_group["savings"].target_minor == 100_000
        assert by_group["savings"].projected_minor == 60_000
        assert by_group["savings"].on_track is True

    def test_missing_group_defaults_to_zero_spend(self) -> None:
        results = calculate_budget_projection(
            monthly_income_minor=300_000,
            group_spent_minor={"needs": 50_000},
            days_elapsed=5,
            days_in_month=30,
        )
        by_group = {r.group: r for r in results}
        assert by_group["wants"].spent_minor == 0
        assert by_group["wants"].projected_minor == 0
        assert by_group["wants"].on_track is True

    def test_rejects_days_elapsed_greater_than_days_in_month(self) -> None:
        with pytest.raises(ValueError):
            calculate_budget_projection(100_000, {}, days_elapsed=31, days_in_month=30)

    def test_rejects_negative_income(self) -> None:
        with pytest.raises(ValueError):
            calculate_budget_projection(-1, {}, days_elapsed=1, days_in_month=30)


class TestIncomeSplit:
    def test_splits_income_by_the_50_30_20_targets(self) -> None:
        results = calculate_income_split(400_000)
        by_group = {r.group: r.target_minor for r in results}

        assert by_group == {"needs": 200_000, "wants": 120_000, "savings": 80_000}

    def test_rejects_negative_income(self) -> None:
        with pytest.raises(ValueError):
            calculate_income_split(-1)


class TestEmergencyFund:
    def test_computes_target_shortfall_and_current_coverage(self) -> None:
        plan = calculate_emergency_fund(
            monthly_essential_expenses_minor=200_000,
            months_of_coverage=6,
            current_savings_minor=500_000,
        )
        assert plan.target_minor == 1_200_000
        assert plan.shortfall_minor == 700_000
        assert plan.months_covered_now == 2.5

    def test_shortfall_floors_at_zero_when_already_fully_funded(self) -> None:
        plan = calculate_emergency_fund(
            monthly_essential_expenses_minor=100_000,
            months_of_coverage=3,
            current_savings_minor=1_000_000,
        )
        assert plan.shortfall_minor == 0

    def test_months_covered_is_none_when_no_essential_expenses(self) -> None:
        plan = calculate_emergency_fund(
            monthly_essential_expenses_minor=0, current_savings_minor=1000
        )
        assert plan.months_covered_now is None

    def test_rejects_non_positive_months_of_coverage(self) -> None:
        with pytest.raises(ValueError):
            calculate_emergency_fund(100_000, months_of_coverage=0)


class TestInvestmentGrowth:
    def test_zero_rate_is_pure_addition(self) -> None:
        result = calculate_investment_growth(
            principal_minor=0,
            monthly_contribution_minor=10_000,
            annual_rate_pct=0,
            years=1,
        )
        assert result.future_value_minor == 120_000
        assert result.total_contributions_minor == 120_000
        assert result.total_growth_minor == 0

    def test_compounds_at_a_nonzero_rate(self) -> None:
        # 100,000 principal, no contributions, 12% annual / monthly compounding, 1 year.
        result = calculate_investment_growth(
            principal_minor=100_000,
            monthly_contribution_minor=0,
            annual_rate_pct=12,
            years=1,
        )
        assert result.future_value_minor == 112_683
        assert result.total_contributions_minor == 100_000
        assert result.total_growth_minor == 12_683

    def test_rejects_non_positive_years(self) -> None:
        with pytest.raises(ValueError):
            calculate_investment_growth(1000, 0, 5, years=0)


class TestLoanPayment:
    def test_zero_rate_splits_principal_evenly(self) -> None:
        plan = calculate_loan_payment(principal_minor=1_200_000, annual_rate_pct=0, term_months=12)
        assert plan.monthly_payment_minor == 100_000
        assert plan.total_paid_minor == 1_200_000
        assert plan.total_interest_minor == 0

    def test_amortizes_at_a_nonzero_rate(self) -> None:
        # 100,000,000 principal, 6% annual, 12-month term.
        plan = calculate_loan_payment(
            principal_minor=100_000_000, annual_rate_pct=6, term_months=12
        )
        assert plan.monthly_payment_minor == 8_606_643
        assert plan.total_paid_minor == 103_279_716
        assert plan.total_interest_minor == 3_279_716

    def test_rejects_non_positive_principal(self) -> None:
        with pytest.raises(ValueError):
            calculate_loan_payment(principal_minor=0, annual_rate_pct=5, term_months=12)
