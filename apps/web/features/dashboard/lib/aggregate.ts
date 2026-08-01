import { getCategoryGroup, type BudgetGroup } from "@/lib/categories";
import { monthKey, monthLabel } from "@/lib/date-range";

export interface CashFlowPoint {
  month: string;
  label: string;
  incomeMinor: number;
  expensesMinor: number;
  netMinor: number;
}

/** Buckets transactions into `months` consecutive calendar months ending at `now`, zero-filling gaps. */
export function bucketCashFlowByMonth(
  transactions: { amountMinor: number; postedAt: Date }[],
  months: number,
  now: Date,
): CashFlowPoint[] {
  const buckets = new Map<string, { incomeMinor: number; expensesMinor: number }>();
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    buckets.set(monthKey(d), { incomeMinor: 0, expensesMinor: 0 });
  }

  for (const t of transactions) {
    const bucket = buckets.get(monthKey(t.postedAt));
    if (!bucket) continue;
    if (t.amountMinor > 0) bucket.incomeMinor += t.amountMinor;
    else bucket.expensesMinor += Math.abs(t.amountMinor);
  }

  return [...buckets.entries()].map(([key, v]) => ({
    month: key,
    label: monthLabel(key),
    incomeMinor: v.incomeMinor,
    expensesMinor: v.expensesMinor,
    netMinor: v.incomeMinor - v.expensesMinor,
  }));
}

/**
 * Reconstructs a trailing net-worth-per-month series by walking the cash-flow
 * trend backwards from the current all-time total — we only store the running
 * sum of every transaction, not historical balance snapshots.
 */
export function reconstructNetWorthSeries(trend: CashFlowPoint[], currentNetWorthMinor: number): number[] {
  const reversed = [...trend].reverse();
  const series: number[] = [];
  let running = currentNetWorthMinor;
  for (const point of reversed) {
    series.push(running);
    running -= point.netMinor;
  }
  return series.reverse();
}

const BUDGET_GROUPS: BudgetGroup[] = ["needs", "wants", "savings"];

/** Sums expense rows (positive minor units) into needs/wants/savings buckets; income/transfer are excluded from the 50/30/20 view. */
export function sumByBudgetGroup(
  expenseRows: { category: string; amountMinor: number }[],
): Record<"needs" | "wants" | "savings", number> {
  const totals: Record<"needs" | "wants" | "savings", number> = { needs: 0, wants: 0, savings: 0 };
  for (const row of expenseRows) {
    const group = getCategoryGroup(row.category);
    if (BUDGET_GROUPS.includes(group) && group !== "income" && group !== "transfer") {
      totals[group as "needs" | "wants" | "savings"] += Math.abs(row.amountMinor);
    }
  }
  return totals;
}

export interface CategorySlice {
  category: string;
  label: string;
  amountMinor: number;
}

const MAX_SLICES = 5;

/** Caps a sorted-desc category breakdown to the top N slices, folding the remainder into "Other". */
export function capCategorySlices(sorted: CategorySlice[], max = MAX_SLICES): CategorySlice[] {
  if (sorted.length <= max) return sorted;
  const head = sorted.slice(0, max);
  const tail = sorted.slice(max);
  const otherTotal = tail.reduce((sum, s) => sum + s.amountMinor, 0);
  return [...head, { category: "other", label: "Other", amountMinor: otherTotal }];
}
