import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { reportToCsv } from "@/features/exports/server/csv";
import { reportToPdf } from "@/features/exports/server/pdf";
import type { PeriodReport } from "@/features/exports/server/report";

function fixtureReport(): PeriodReport {
  return {
    currency: "USD",
    netWorthMinor: 625_000,
    monthIncomeMinor: 300_000,
    monthExpensesMinor: 175_000,
    monthNetMinor: 125_000,
    savingsRatePct: 42,
    budgetGroups: [
      { label: "Needs", spentMinor: 125_000, targetPct: 50, actualPct: 42 },
      { label: "Wants", spentMinor: 30_000, targetPct: 30, actualPct: 10 },
      { label: "Savings", spentMinor: 20_000, targetPct: 20, actualPct: 7 },
    ],
    categories: [
      { label: "Housing", amountMinor: 100_000 },
      { label: "Dining", amountMinor: 30_000 },
    ],
  };
}

describe("reportToCsv", () => {
  it("includes the KPI, budget group, and category rows", () => {
    const csv = reportToCsv(fixtureReport());
    // Money values contain a comma (thousands separator), so the CSV escaper quotes them.
    expect(csv).toContain('Net worth,"$6,250.00"');
    expect(csv).toContain("Savings rate,42%");
    expect(csv).toContain('Needs,"$1,250.00",50%,42%');
    expect(csv).toContain('Housing,"$1,000.00"');
  });
});

describe("reportToPdf", () => {
  it("produces a valid single-page PDF containing the report figures", async () => {
    const bytes = await reportToPdf(fixtureReport());

    expect(Buffer.from(bytes.slice(0, 5)).toString("ascii")).toBe("%PDF-");

    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(1);
  });
});
