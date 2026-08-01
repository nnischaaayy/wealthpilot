import { describe, expect, it } from "vitest";
import {
  bucketCashFlowByMonth,
  capCategorySlices,
  reconstructNetWorthSeries,
  sumByBudgetGroup,
  type CashFlowPoint,
} from "@/features/dashboard/lib/aggregate";

describe("bucketCashFlowByMonth", () => {
  const now = new Date(Date.UTC(2026, 2, 15)); // Mar 15, 2026

  it("zero-fills months with no transactions", () => {
    const points = bucketCashFlowByMonth([], 3, now);
    expect(points).toHaveLength(3);
    expect(points.map((p) => p.month)).toEqual(["2026-01", "2026-02", "2026-03"]);
    expect(points.every((p) => p.incomeMinor === 0 && p.expensesMinor === 0)).toBe(true);
  });

  it("splits income and expenses into the right month", () => {
    const points = bucketCashFlowByMonth(
      [
        { amountMinor: 100000, postedAt: new Date(Date.UTC(2026, 1, 2)) }, // Feb income
        { amountMinor: -25000, postedAt: new Date(Date.UTC(2026, 1, 10)) }, // Feb expense
        { amountMinor: -5000, postedAt: new Date(Date.UTC(2026, 2, 1)) }, // Mar expense
      ],
      3,
      now,
    );

    const feb = points.find((p) => p.month === "2026-02")!;
    expect(feb.incomeMinor).toBe(100000);
    expect(feb.expensesMinor).toBe(25000);
    expect(feb.netMinor).toBe(75000);

    const mar = points.find((p) => p.month === "2026-03")!;
    expect(mar.expensesMinor).toBe(5000);
    expect(mar.netMinor).toBe(-5000);
  });

  it("ignores transactions outside the bucketed range", () => {
    const points = bucketCashFlowByMonth(
      [{ amountMinor: 1000, postedAt: new Date(Date.UTC(2025, 0, 1)) }],
      3,
      now,
    );
    expect(points.every((p) => p.incomeMinor === 0)).toBe(true);
  });
});

describe("sumByBudgetGroup", () => {
  it("groups categories into needs/wants/savings", () => {
    const totals = sumByBudgetGroup([
      { category: "housing", amountMinor: -20000 },
      { category: "groceries", amountMinor: -10000 },
      { category: "dining", amountMinor: -5000 },
      { category: "savings", amountMinor: -15000 },
    ]);
    expect(totals).toEqual({ needs: 30000, wants: 5000, savings: 15000 });
  });

  it("excludes income and transfer categories", () => {
    const totals = sumByBudgetGroup([
      { category: "income", amountMinor: -100000 },
      { category: "transfer", amountMinor: -5000 },
    ]);
    expect(totals).toEqual({ needs: 0, wants: 0, savings: 0 });
  });
});

describe("capCategorySlices", () => {
  const make = (n: number) =>
    Array.from({ length: n }, (_, i) => ({
      category: `cat${i}`,
      label: `Cat ${i}`,
      amountMinor: (n - i) * 100,
    }));

  it("passes through when at or under the cap", () => {
    const slices = make(5);
    expect(capCategorySlices(slices)).toEqual(slices);
  });

  it("folds the tail into Other beyond the cap", () => {
    const slices = make(7);
    const capped = capCategorySlices(slices);
    expect(capped).toHaveLength(6);
    expect(capped[5].category).toBe("other");
    // slice 5 and 6 (amountMinor 200, 100) folded into Other
    expect(capped[5].amountMinor).toBe(300);
  });
});

describe("reconstructNetWorthSeries", () => {
  const point = (netMinor: number): CashFlowPoint => ({
    month: "x",
    label: "x",
    incomeMinor: 0,
    expensesMinor: 0,
    netMinor,
  });

  it("ends at the current net worth and walks backwards by each month's net", () => {
    // Three months of net +100, +200, +300; current net worth is 1000.
    const series = reconstructNetWorthSeries([point(100), point(200), point(300)], 1000);
    expect(series).toEqual([500, 700, 1000]);
  });

  it("returns an empty array for an empty trend", () => {
    expect(reconstructNetWorthSeries([], 500)).toEqual([]);
  });
});
