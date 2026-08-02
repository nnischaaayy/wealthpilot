import { describe, expect, it } from "vitest";
import {
  analyzeHolding,
  computeAllocationByAssetClass,
  computeAllocationByHolding,
  computePortfolioSummary,
  computeRiskScore,
  getRiskLabel,
  type HoldingLike,
} from "@/features/portfolio/lib/analytics";

function holding(overrides: Partial<HoldingLike> = {}): HoldingLike {
  return {
    id: "h1",
    symbol: "AAPL",
    name: null,
    quantity: 10,
    costBasisMinor: 15000, // $150.00/share
    currentPriceMinor: null,
    assetClass: "equity",
    ...overrides,
  };
}

describe("analyzeHolding", () => {
  it("falls back to cost basis when no current price is set", () => {
    const result = analyzeHolding(holding());
    expect(result.hasLivePrice).toBe(false);
    expect(result.marketValueMinor).toBe(150000); // 15000 * 10
    expect(result.totalCostMinor).toBe(150000);
    expect(result.gainLossMinor).toBe(0);
  });

  it("computes gain/loss once a current price is set", () => {
    const result = analyzeHolding(holding({ currentPriceMinor: 18000 })); // $180.00/share
    expect(result.hasLivePrice).toBe(true);
    expect(result.marketValueMinor).toBe(180000);
    expect(result.totalCostMinor).toBe(150000);
    expect(result.gainLossMinor).toBe(30000);
    expect(result.gainLossPct).toBeCloseTo(20, 5); // 30000/150000 = 20%
  });

  it("computes a loss correctly", () => {
    const result = analyzeHolding(holding({ currentPriceMinor: 12000 }));
    expect(result.gainLossMinor).toBe(-30000);
    expect(result.gainLossPct).toBeCloseTo(-20, 5);
  });
});

describe("computeAllocationByHolding", () => {
  it("sorts descending and sums percentages to ~100", () => {
    const holdings = [
      analyzeHolding(holding({ id: "a", symbol: "AAPL", quantity: 10, costBasisMinor: 10000 })), // 100000
      analyzeHolding(holding({ id: "b", symbol: "GOOG", quantity: 1, costBasisMinor: 30000 })), // 30000
    ];
    const allocation = computeAllocationByHolding(holdings);
    expect(allocation[0].key).toBe("a");
    expect(allocation[0].pct).toBeCloseTo(76.9, 1);
    expect(allocation[1].pct).toBeCloseTo(23.1, 1);
  });
});

describe("computeAllocationByAssetClass", () => {
  it("groups holdings sharing an asset class", () => {
    const holdings = [
      analyzeHolding(holding({ id: "a", assetClass: "equity", quantity: 10, costBasisMinor: 10000 })),
      analyzeHolding(holding({ id: "b", assetClass: "equity", quantity: 5, costBasisMinor: 10000 })),
      analyzeHolding(holding({ id: "c", assetClass: "bond", quantity: 1, costBasisMinor: 50000 })),
    ];
    const allocation = computeAllocationByAssetClass(holdings);
    expect(allocation.find((a) => a.key === "equity")?.valueMinor).toBe(150000);
    expect(allocation.find((a) => a.key === "bond")?.valueMinor).toBe(50000);
  });
});

describe("computeRiskScore", () => {
  it("returns null for an empty portfolio", () => {
    expect(computeRiskScore([])).toBeNull();
  });

  it("scores an all-cash portfolio near the bottom", () => {
    const holdings = [analyzeHolding(holding({ assetClass: "cash", quantity: 1, costBasisMinor: 100000 }))];
    expect(computeRiskScore(holdings)).toBe(1);
  });

  it("scores an all-crypto portfolio at the top", () => {
    const holdings = [analyzeHolding(holding({ assetClass: "crypto", quantity: 1, costBasisMinor: 100000 }))];
    expect(computeRiskScore(holdings)).toBe(10);
  });

  it("weights a mixed portfolio by value share", () => {
    const holdings = [
      analyzeHolding(holding({ id: "a", assetClass: "cash", quantity: 1, costBasisMinor: 50000 })),
      analyzeHolding(holding({ id: "b", assetClass: "crypto", quantity: 1, costBasisMinor: 50000 })),
    ];
    // Equal value split between risk-weight 1 (cash) and 10 (crypto) -> average 5.5
    expect(computeRiskScore(holdings)).toBe(5.5);
  });
});

describe("computePortfolioSummary", () => {
  it("aggregates totals and flags mixed pricing correctly", () => {
    const holdings = [
      analyzeHolding(holding({ id: "a", currentPriceMinor: 18000, quantity: 10, costBasisMinor: 15000 })),
      analyzeHolding(holding({ id: "b", currentPriceMinor: null, quantity: 5, costBasisMinor: 20000 })),
    ];
    const summary = computePortfolioSummary(holdings);
    expect(summary.totalCostMinor).toBe(150000 + 100000);
    expect(summary.totalValueMinor).toBe(180000 + 100000);
    expect(summary.totalGainLossMinor).toBe(30000);
    expect(summary.hasLivePricing).toBe(false); // holding "b" has no live price
  });

  it("hasLivePricing is true only when every holding has a manual price", () => {
    const holdings = [
      analyzeHolding(holding({ id: "a", currentPriceMinor: 18000 })),
      analyzeHolding(holding({ id: "b", currentPriceMinor: 20000 })),
    ];
    expect(computePortfolioSummary(holdings).hasLivePricing).toBe(true);
  });
});

describe("getRiskLabel", () => {
  it("maps score bands to labels", () => {
    expect(getRiskLabel(null)).toBe("—");
    expect(getRiskLabel(1)).toBe("Conservative");
    expect(getRiskLabel(5)).toBe("Moderate");
    expect(getRiskLabel(9)).toBe("Aggressive");
  });
});
