import pytest

from tools.portfolio_metrics import analyze_holding, calculate_allocation, calculate_risk_score

# Mirrors apps/web/tests/portfolio-analytics.test.ts — same numbers, same
# expectations, since these calculators are a 1:1 port and must stay
# consistent with what the Portfolio page shows.


def holding(**overrides):
    defaults = {
        "id": "h1",
        "symbol": "AAPL",
        "name": None,
        "quantity": 10,
        "cost_basis_minor": 15000,
        "current_price_minor": None,
        "asset_class": "equity",
    }
    defaults.update(overrides)
    return analyze_holding(**defaults)


class TestAnalyzeHolding:
    def test_falls_back_to_cost_basis_when_no_current_price(self) -> None:
        result = holding()
        assert result.has_live_price is False
        assert result.market_value_minor == 150_000
        assert result.total_cost_minor == 150_000
        assert result.gain_loss_minor == 0

    def test_computes_gain_once_a_current_price_is_set(self) -> None:
        result = holding(current_price_minor=18_000)
        assert result.has_live_price is True
        assert result.market_value_minor == 180_000
        assert result.gain_loss_minor == 30_000
        assert result.gain_loss_pct == pytest.approx(20, abs=1e-5)

    def test_computes_a_loss_correctly(self) -> None:
        result = holding(current_price_minor=12_000)
        assert result.gain_loss_minor == -30_000
        assert result.gain_loss_pct == pytest.approx(-20, abs=1e-5)


class TestCalculateAllocationByHolding:
    def test_sorts_descending_and_sums_to_roughly_100(self) -> None:
        holdings = [
            holding(id="a", symbol="AAPL", quantity=10, cost_basis_minor=10_000),  # 100000
            holding(id="b", symbol="GOOG", quantity=1, cost_basis_minor=30_000),  # 30000
        ]
        allocation = calculate_allocation(holdings, "holding")
        assert allocation[0].key == "a"
        assert allocation[0].pct == pytest.approx(76.9, abs=0.1)
        assert allocation[1].pct == pytest.approx(23.1, abs=0.1)


class TestCalculateAllocationByAssetClass:
    def test_groups_holdings_sharing_an_asset_class(self) -> None:
        holdings = [
            holding(id="a", asset_class="equity", quantity=10, cost_basis_minor=10_000),
            holding(id="b", asset_class="equity", quantity=5, cost_basis_minor=10_000),
            holding(id="c", asset_class="bond", quantity=1, cost_basis_minor=50_000),
        ]
        allocation = calculate_allocation(holdings, "asset_class")
        by_key = {a.key: a for a in allocation}
        assert by_key["equity"].value_minor == 150_000
        assert by_key["bond"].value_minor == 50_000


class TestCalculateRiskScore:
    def test_returns_none_for_an_empty_portfolio(self) -> None:
        assert calculate_risk_score([]) is None

    def test_scores_an_all_cash_portfolio_near_the_bottom(self) -> None:
        holdings = [holding(asset_class="cash", quantity=1, cost_basis_minor=100_000)]
        assert calculate_risk_score(holdings) == 1

    def test_scores_an_all_crypto_portfolio_at_the_top(self) -> None:
        holdings = [holding(asset_class="crypto", quantity=1, cost_basis_minor=100_000)]
        assert calculate_risk_score(holdings) == 10

    def test_weights_a_mixed_portfolio_by_value_share(self) -> None:
        holdings = [
            holding(id="a", asset_class="cash", quantity=1, cost_basis_minor=50_000),
            holding(id="b", asset_class="crypto", quantity=1, cost_basis_minor=50_000),
        ]
        # Equal value split between risk-weight 1 (cash) and 10 (crypto) -> average 5.5
        assert calculate_risk_score(holdings) == 5.5
