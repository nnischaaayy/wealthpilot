import "server-only";
import { prisma } from "@wealthpilot/db";
import { getCategoryLabel } from "@/lib/categories";
import { getMonthRange } from "@/lib/date-range";
import {
  bucketCashFlowByMonth,
  capCategorySlices,
  sumByBudgetGroup,
  type CashFlowPoint,
  type CategorySlice,
} from "@/features/dashboard/lib/aggregate";

async function getPrimaryCurrency(workspaceId: string): Promise<string | null> {
  const accounts = await prisma.account.findMany({
    where: { workspaceId },
    select: { currency: true },
  });
  if (accounts.length === 0) return null;

  const counts = new Map<string, number>();
  for (const a of accounts) counts.set(a.currency, (counts.get(a.currency) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export interface DashboardSummary {
  currency: string | null;
  hasTransactions: boolean;
  netWorthMinor: number;
  monthIncomeMinor: number;
  monthExpensesMinor: number;
  monthNetMinor: number;
  savingsRatePct: number | null;
}

export async function getDashboardSummary(workspaceId: string): Promise<DashboardSummary> {
  const currency = await getPrimaryCurrency(workspaceId);
  if (!currency) {
    return {
      currency: null,
      hasTransactions: false,
      netWorthMinor: 0,
      monthIncomeMinor: 0,
      monthExpensesMinor: 0,
      monthNetMinor: 0,
      savingsRatePct: null,
    };
  }

  const { start, end } = getMonthRange(0);

  const [netWorthAgg, monthTransactions, anyTransaction] = await Promise.all([
    prisma.transaction.aggregate({
      where: { workspaceId, currency },
      _sum: { amountMinor: true },
    }),
    prisma.transaction.findMany({
      where: { workspaceId, currency, postedAt: { gte: start, lt: end } },
      select: { amountMinor: true },
    }),
    prisma.transaction.findFirst({ where: { workspaceId }, select: { id: true } }),
  ]);

  const monthIncomeMinor = monthTransactions
    .filter((t) => t.amountMinor > 0)
    .reduce((sum, t) => sum + t.amountMinor, 0);
  const monthExpensesMinor = monthTransactions
    .filter((t) => t.amountMinor < 0)
    .reduce((sum, t) => sum + Math.abs(t.amountMinor), 0);
  const monthNetMinor = monthIncomeMinor - monthExpensesMinor;

  return {
    currency,
    hasTransactions: Boolean(anyTransaction),
    netWorthMinor: netWorthAgg._sum.amountMinor ?? 0,
    monthIncomeMinor,
    monthExpensesMinor,
    monthNetMinor,
    savingsRatePct: monthIncomeMinor > 0 ? Math.round((monthNetMinor / monthIncomeMinor) * 100) : null,
  };
}

export async function getCashFlowTrend(
  workspaceId: string,
  currency: string,
  months = 6,
): Promise<CashFlowPoint[]> {
  const now = new Date();
  const { start } = getMonthRange(months - 1, now);

  const transactions = await prisma.transaction.findMany({
    where: { workspaceId, currency, postedAt: { gte: start } },
    select: { amountMinor: true, postedAt: true },
  });

  return bucketCashFlowByMonth(transactions, months, now);
}

async function getSortedCategorySpend(workspaceId: string, currency: string): Promise<CategorySlice[]> {
  const { start, end } = getMonthRange(0);

  const grouped = await prisma.transaction.groupBy({
    by: ["category"],
    where: { workspaceId, currency, amountMinor: { lt: 0 }, postedAt: { gte: start, lt: end } },
    _sum: { amountMinor: true },
  });

  return grouped
    .map((g) => ({
      category: g.category,
      label: getCategoryLabel(g.category),
      amountMinor: Math.abs(g._sum.amountMinor ?? 0),
    }))
    .sort((a, b) => b.amountMinor - a.amountMinor);
}

/** Top 5 categories + "Other" — for the dashboard donut, where a legend has to stay short. */
export async function getCategoryBreakdown(workspaceId: string, currency: string): Promise<CategorySlice[]> {
  return capCategorySlices(await getSortedCategorySpend(workspaceId, currency));
}

/** Every category with spend this month, uncapped — for the full budgets breakdown. */
export async function getCategoryBreakdownFull(
  workspaceId: string,
  currency: string,
): Promise<CategorySlice[]> {
  return getSortedCategorySpend(workspaceId, currency);
}

export interface BudgetGroupSummary {
  group: "needs" | "wants" | "savings";
  label: string;
  spentMinor: number;
  targetPct: number;
  actualPct: number | null;
}

const GROUP_LABELS: Record<"needs" | "wants" | "savings", string> = {
  needs: "Needs",
  wants: "Wants",
  savings: "Savings",
};
const GROUP_TARGETS: Record<"needs" | "wants" | "savings", number> = {
  needs: 50,
  wants: 30,
  savings: 20,
};

export async function getBudgetGroups(
  workspaceId: string,
  currency: string,
): Promise<{ incomeMinor: number; groups: BudgetGroupSummary[] }> {
  const { start, end } = getMonthRange(0);

  const [expenseRows, incomeAgg] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["category"],
      where: { workspaceId, currency, amountMinor: { lt: 0 }, postedAt: { gte: start, lt: end } },
      _sum: { amountMinor: true },
    }),
    prisma.transaction.aggregate({
      where: { workspaceId, currency, amountMinor: { gt: 0 }, postedAt: { gte: start, lt: end } },
      _sum: { amountMinor: true },
    }),
  ]);

  const incomeMinor = incomeAgg._sum.amountMinor ?? 0;
  const totals = sumByBudgetGroup(
    expenseRows.map((r) => ({ category: r.category, amountMinor: r._sum.amountMinor ?? 0 })),
  );

  const groups = (["needs", "wants", "savings"] as const).map((group) => ({
    group,
    label: GROUP_LABELS[group],
    spentMinor: totals[group],
    targetPct: GROUP_TARGETS[group],
    actualPct: incomeMinor > 0 ? Math.round((totals[group] / incomeMinor) * 100) : null,
  }));

  return { incomeMinor, groups };
}
