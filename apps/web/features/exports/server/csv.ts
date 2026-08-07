import "server-only";
import { toCsv } from "@/lib/csv";
import { formatMoney } from "@/lib/format-money";
import type { PeriodReport } from "./report";

export function reportToCsv(report: PeriodReport): string {
  const rows: (string | number)[][] = [
    ["WealthPilot — Monthly Summary"],
    [],
    ["Metric", "Amount"],
    ["Net worth", formatMoney(report.netWorthMinor, report.currency)],
    ["Income this month", formatMoney(report.monthIncomeMinor, report.currency)],
    ["Expenses this month", formatMoney(report.monthExpensesMinor, report.currency)],
    ["Net this month", formatMoney(report.monthNetMinor, report.currency)],
    ["Savings rate", report.savingsRatePct === null ? "—" : `${report.savingsRatePct}%`],
    [],
    ["Budget group", "Spent", "Target %", "Actual %"],
    ...report.budgetGroups.map((g) => [
      g.label,
      formatMoney(g.spentMinor, report.currency),
      `${g.targetPct}%`,
      g.actualPct === null ? "—" : `${g.actualPct}%`,
    ]),
    [],
    ["Category", "Amount"],
    ...report.categories.map((c) => [c.label, formatMoney(c.amountMinor, report.currency)]),
  ];
  return toCsv(rows);
}
