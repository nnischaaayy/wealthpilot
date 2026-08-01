import { looksLikeDate, parseAmount, sniffDateFormat } from "./format";
import type { ColumnMapping, DetectionResult, RawTable } from "./types";

export const CONFIDENCE_THRESHOLD = 0.9;

const DATE_KEYWORDS = ["date", "posted", "value date", "txn date"];
const DESCRIPTION_KEYWORDS = ["description", "narration", "particulars", "details", "remarks", "merchant"];
const AMOUNT_KEYWORDS = ["amount", "value", "txn amount"];
const DEBIT_KEYWORDS = ["debit", "withdrawal", "paid out", "money out", "dr"];
const CREDIT_KEYWORDS = ["credit", "deposit", "paid in", "money in", "cr"];

const SAMPLE_SIZE = 20;

function headerMatches(header: string, keywords: string[]): boolean {
  const lower = header.toLowerCase();
  return keywords.some((k) => lower.includes(k));
}

function columnSamples(table: RawTable, columnIndex: number): string[] {
  return table.rows
    .slice(0, SAMPLE_SIZE)
    .map((row) => row[columnIndex] ?? "")
    .filter((v) => v.trim().length > 0);
}

function fraction(samples: string[], predicate: (s: string) => boolean): number {
  if (samples.length === 0) return 0;
  return samples.filter(predicate).length / samples.length;
}

/**
 * Auto-detects which columns hold the date, description, and amount (either
 * a single signed column or separate debit/credit columns) using header
 * keywords plus sampled-value shape. Returns confidence 0-1; callers should
 * fall back to the manual mapping wizard below `CONFIDENCE_THRESHOLD`.
 */
export function detectColumns(table: RawTable): DetectionResult {
  const { headers } = table;
  if (headers.length === 0) return { mapping: null, confidence: 0 };

  const columnStats = headers.map((header, index) => {
    const samples = columnSamples(table, index);
    return {
      index,
      header,
      samples,
      dateFraction: fraction(samples, looksLikeDate),
      numericFraction: fraction(samples, (s) => parseAmount(s) !== null),
      avgLength: samples.length ? samples.reduce((sum, s) => sum + s.length, 0) / samples.length : 0,
    };
  });

  const dateColumn = columnStats
    .map((c) => ({ ...c, score: (headerMatches(c.header, DATE_KEYWORDS) ? 0.4 : 0) + c.dateFraction * 0.6 }))
    .filter((c) => c.score > 0.5)
    .sort((a, b) => b.score - a.score)[0];

  const remaining = columnStats.filter((c) => c.index !== dateColumn?.index);

  const debitColumn = remaining.find(
    (c) => headerMatches(c.header, DEBIT_KEYWORDS) && c.numericFraction > 0.5,
  );
  const creditColumn = remaining.find(
    (c) => headerMatches(c.header, CREDIT_KEYWORDS) && c.numericFraction > 0.5,
  );

  let amountColumn: (typeof remaining)[number] | undefined;
  if (!debitColumn || !creditColumn) {
    amountColumn = remaining
      .filter((c) => c.numericFraction > 0.5)
      .map((c) => ({ ...c, score: (headerMatches(c.header, AMOUNT_KEYWORDS) ? 0.4 : 0) + c.numericFraction * 0.6 }))
      .sort((a, b) => b.score - a.score)[0];
  }

  const usedIndexes = new Set(
    [dateColumn?.index, debitColumn?.index, creditColumn?.index, amountColumn?.index].filter(
      (v): v is number => v !== undefined,
    ),
  );

  const descriptionColumn =
    remaining.find((c) => headerMatches(c.header, DESCRIPTION_KEYWORDS) && !usedIndexes.has(c.index)) ??
    remaining
      .filter((c) => !usedIndexes.has(c.index) && c.numericFraction < 0.5)
      .sort((a, b) => b.avgLength - a.avgLength)[0];

  const hasAmount = Boolean(amountColumn) || Boolean(debitColumn && creditColumn);

  let confidence = 0;
  if (dateColumn) confidence += 0.4;
  if (hasAmount) confidence += 0.4;
  if (descriptionColumn) confidence += 0.2;

  if (!dateColumn || !descriptionColumn || !hasAmount) {
    return { mapping: null, confidence };
  }

  const dateFormat = sniffDateFormat(dateColumn.samples);

  const mapping: ColumnMapping = {
    dateColumn: dateColumn.index,
    descriptionColumn: descriptionColumn.index,
    dateFormat,
    ...(amountColumn
      ? { amountColumn: amountColumn.index }
      : { debitColumn: debitColumn!.index, creditColumn: creditColumn!.index }),
  };

  return { mapping, confidence };
}
