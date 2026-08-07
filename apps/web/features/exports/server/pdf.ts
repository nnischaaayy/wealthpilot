import "server-only";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatMoney } from "@/lib/format-money";
import type { PeriodReport } from "./report";

const PAGE_SIZE: [number, number] = [612, 792]; // US Letter, points
const MARGIN_X = 56;
const LINE_HEIGHT = 18;

export async function reportToPdf(report: PeriodReport): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage(PAGE_SIZE);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let y = 740;
  function writeLine(text: string, options: { bold?: boolean; size?: number } = {}) {
    page.drawText(text, {
      x: MARGIN_X,
      y,
      size: options.size ?? 11,
      font: options.bold ? bold : font,
      color: rgb(0.1, 0.1, 0.1),
    });
    y -= LINE_HEIGHT;
  }

  writeLine("WealthPilot — Monthly Summary", { bold: true, size: 18 });
  y -= 6;
  writeLine(`Generated ${new Date().toISOString().slice(0, 10)}`, { size: 9 });
  y -= 12;

  writeLine("Overview", { bold: true, size: 13 });
  writeLine(`Net worth: ${formatMoney(report.netWorthMinor, report.currency)}`);
  writeLine(`Income this month: ${formatMoney(report.monthIncomeMinor, report.currency)}`);
  writeLine(`Expenses this month: ${formatMoney(report.monthExpensesMinor, report.currency)}`);
  writeLine(`Net this month: ${formatMoney(report.monthNetMinor, report.currency)}`);
  writeLine(`Savings rate: ${report.savingsRatePct === null ? "—" : `${report.savingsRatePct}%`}`);
  y -= 12;

  writeLine("50/30/20 budget", { bold: true, size: 13 });
  for (const g of report.budgetGroups) {
    const actual = g.actualPct === null ? "—" : `${g.actualPct}%`;
    writeLine(`${g.label}: ${formatMoney(g.spentMinor, report.currency)} (target ${g.targetPct}%, actual ${actual})`);
  }
  y -= 12;

  writeLine("Spending by category", { bold: true, size: 13 });
  for (const c of report.categories) {
    writeLine(`${c.label}: ${formatMoney(c.amountMinor, report.currency)}`);
  }

  return doc.save();
}
