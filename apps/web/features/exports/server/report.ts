import "server-only";
import {
  getBudgetGroups,
  getCategoryBreakdownFull,
  getDashboardSummary,
} from "@/features/dashboard/server/service";

export interface PeriodReportBudgetGroup {
  label: string;
  spentMinor: number;
  targetPct: number;
  actualPct: number | null;
}

export interface PeriodReportCategory {
  label: string;
  amountMinor: number;
}

export interface PeriodReport {
  currency: string;
  netWorthMinor: number;
  monthIncomeMinor: number;
  monthExpensesMinor: number;
  monthNetMinor: number;
  savingsRatePct: number | null;
  budgetGroups: PeriodReportBudgetGroup[];
  categories: PeriodReportCategory[];
}

/**
 * v1 only supports the current calendar month — getDashboardSummary/
 * getBudgetGroups/getCategoryBreakdownFull all hard-code getMonthRange(0)
 * internally (Phase 3). A `period` param for other ranges would need those
 * parameterized first; deferred until there's a real use case for it.
 */
export async function buildPeriodReport(workspaceId: string): Promise<PeriodReport | null> {
  const summary = await getDashboardSummary(workspaceId);
  if (!summary.hasTransactions || !summary.currency) return null;

  const currency = summary.currency;
  const [budget, categories] = await Promise.all([
    getBudgetGroups(workspaceId, currency),
    getCategoryBreakdownFull(workspaceId, currency),
  ]);

  return {
    currency,
    netWorthMinor: summary.netWorthMinor,
    monthIncomeMinor: summary.monthIncomeMinor,
    monthExpensesMinor: summary.monthExpensesMinor,
    monthNetMinor: summary.monthNetMinor,
    savingsRatePct: summary.savingsRatePct,
    budgetGroups: budget.groups.map((g) => ({
      label: g.label,
      spentMinor: g.spentMinor,
      targetPct: g.targetPct,
      actualPct: g.actualPct,
    })),
    categories: categories.map((c) => ({ label: c.label, amountMinor: c.amountMinor })),
  };
}
