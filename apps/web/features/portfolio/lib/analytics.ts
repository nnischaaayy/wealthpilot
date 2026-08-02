import { getAssetClassLabel } from "@/lib/asset-classes";

export interface HoldingLike {
  id: string;
  symbol: string;
  name: string | null;
  quantity: number;
  costBasisMinor: number; // per-unit
  currentPriceMinor: number | null; // per-unit, manually entered
  assetClass: string;
}

export interface HoldingAnalytics {
  id: string;
  symbol: string;
  label: string;
  quantity: number;
  costBasisMinor: number;
  currentPriceMinor: number;
  hasLivePrice: boolean;
  marketValueMinor: number;
  totalCostMinor: number;
  gainLossMinor: number;
  gainLossPct: number | null;
  assetClass: string;
}

/** Per-holding value/gain-loss. Falls back to cost basis when no current price has been entered. */
export function analyzeHolding(h: HoldingLike): HoldingAnalytics {
  const priceMinor = h.currentPriceMinor ?? h.costBasisMinor;
  const marketValueMinor = Math.round(priceMinor * h.quantity);
  const totalCostMinor = Math.round(h.costBasisMinor * h.quantity);
  const gainLossMinor = marketValueMinor - totalCostMinor;

  return {
    id: h.id,
    symbol: h.symbol,
    label: h.name || h.symbol,
    quantity: h.quantity,
    costBasisMinor: h.costBasisMinor,
    currentPriceMinor: priceMinor,
    hasLivePrice: h.currentPriceMinor !== null,
    marketValueMinor,
    totalCostMinor,
    gainLossMinor,
    gainLossPct: totalCostMinor > 0 ? Math.round((gainLossMinor / totalCostMinor) * 1000) / 10 : null,
    assetClass: h.assetClass,
  };
}

export interface AllocationSlice {
  key: string;
  label: string;
  valueMinor: number;
  pct: number;
}

function pctOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 1000) / 10 : 0;
}

export function computeAllocationByHolding(holdings: HoldingAnalytics[]): AllocationSlice[] {
  const total = holdings.reduce((sum, h) => sum + h.marketValueMinor, 0);
  return holdings
    .map((h) => ({ key: h.id, label: h.symbol, valueMinor: h.marketValueMinor, pct: pctOf(h.marketValueMinor, total) }))
    .sort((a, b) => b.valueMinor - a.valueMinor);
}

export function computeAllocationByAssetClass(holdings: HoldingAnalytics[]): AllocationSlice[] {
  const totals = new Map<string, number>();
  for (const h of holdings) {
    totals.set(h.assetClass, (totals.get(h.assetClass) ?? 0) + h.marketValueMinor);
  }
  const total = holdings.reduce((sum, h) => sum + h.marketValueMinor, 0);

  return [...totals.entries()]
    .map(([key, valueMinor]) => ({
      key,
      label: getAssetClassLabel(key),
      valueMinor,
      pct: pctOf(valueMinor, total),
    }))
    .sort((a, b) => b.valueMinor - a.valueMinor);
}

// Simple, deterministic, documented heuristic — not a real financial risk
// model. Weighted average of each asset class's risk weight by its share of
// portfolio value, on a 0-10 scale. Revisit once ai-service's
// calculate_risk_score tool (architecture.md §13.1) replaces this.
const ASSET_CLASS_RISK_WEIGHT: Record<string, number> = {
  crypto: 10,
  equity: 8,
  commodity: 7,
  real_estate: 6,
  other: 5,
  bond: 3,
  cash: 1,
};

export function computeRiskScore(holdings: HoldingAnalytics[]): number | null {
  const total = holdings.reduce((sum, h) => sum + h.marketValueMinor, 0);
  if (total === 0) return null;

  const weighted = holdings.reduce(
    (sum, h) => sum + (ASSET_CLASS_RISK_WEIGHT[h.assetClass] ?? 5) * h.marketValueMinor,
    0,
  );
  return Math.round((weighted / total) * 10) / 10;
}

export function getRiskLabel(score: number | null): string {
  if (score === null) return "—";
  if (score < 3) return "Conservative";
  if (score < 7) return "Moderate";
  return "Aggressive";
}

export interface PortfolioSummary {
  totalValueMinor: number;
  totalCostMinor: number;
  totalGainLossMinor: number;
  totalGainLossPct: number | null;
  riskScore: number | null;
  /** True once every holding has a manually-entered current price, not just cost basis. */
  hasLivePricing: boolean;
}

export function computePortfolioSummary(holdings: HoldingAnalytics[]): PortfolioSummary {
  const totalValueMinor = holdings.reduce((sum, h) => sum + h.marketValueMinor, 0);
  const totalCostMinor = holdings.reduce((sum, h) => sum + h.totalCostMinor, 0);
  const totalGainLossMinor = totalValueMinor - totalCostMinor;

  return {
    totalValueMinor,
    totalCostMinor,
    totalGainLossMinor,
    totalGainLossPct: totalCostMinor > 0 ? Math.round((totalGainLossMinor / totalCostMinor) * 1000) / 10 : null,
    riskScore: computeRiskScore(holdings),
    hasLivePricing: holdings.length > 0 && holdings.every((h) => h.hasLivePrice),
  };
}
