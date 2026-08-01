import type { DateFormat } from "./types";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

/** Strips currency symbols/commas/whitespace; treats parenthesized values as negative. */
export function parseAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const negative = /^\(.*\)$/.test(trimmed) || trimmed.startsWith("-");
  const cleaned = trimmed
    .replace(/^\(|\)$/g, "")
    .replace(/^-/, "")
    .replace(/[^0-9.]/g, "");

  if (!cleaned || !/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const value = Number.parseFloat(cleaned);
  if (Number.isNaN(value)) return null;
  return negative ? -value : value;
}

interface NumericDateParts {
  a: number;
  b: number;
  c: number;
}

/** Splits a numeric D/M/Y-ish date string into its three components, if it looks like one. */
function extractNumericDateParts(raw: string): NumericDateParts | null {
  const match = raw.trim().match(/^(\d{1,4})[/\-.](\d{1,2})[/\-.](\d{1,4})$/);
  if (!match) return null;
  return { a: Number(match[1]), b: Number(match[2]), c: Number(match[3]) };
}

/**
 * Infers whether a batch of same-column date strings is day-first or
 * month-first by looking for a value where one position can't possibly be a
 * month (>12). Defaults to day-first when genuinely ambiguous — deliberately
 * biased toward the messy-data case this project is built to handle (§0.1).
 */
export function sniffDateFormat(samples: string[]): DateFormat {
  for (const raw of samples) {
    if (/^\d{4}-\d{2}-\d{2}/.test(raw.trim())) return "iso";
  }
  for (const raw of samples) {
    const parts = extractNumericDateParts(raw);
    if (!parts) continue;
    if (parts.a > 31 || parts.b > 31) continue; // year-first or malformed, ignore here
    if (parts.a > 12) return "day-first";
    if (parts.b > 12) return "month-first";
  }
  return "day-first";
}

/** True if the string parses as a numeric or month-name date, regardless of which format. */
export function looksLikeDate(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  if (extractNumericDateParts(trimmed)) return true;
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return true;
  const monthNameMatch = trimmed
    .toLowerCase()
    .match(/^(\d{1,2})?\s*([a-z]{3,9})[a-z]*[,\s]+(\d{1,2})?[,\s]*(\d{2,4})$/);
  if (monthNameMatch) {
    return MONTHS.includes(monthNameMatch[2].slice(0, 3));
  }
  return false;
}

/**
 * Parses a date string under an assumed numeric format. Month-name and ISO
 * dates are unambiguous and parsed directly regardless of `format`.
 */
export function parseDateFlexible(raw: string, format: DateFormat): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const date = new Date(trimmed);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const monthNameMatch = trimmed
    .toLowerCase()
    .match(/^(\d{1,2})?\s*([a-z]{3,9})[a-z]*[,\s]+(\d{1,2})?[,\s]*(\d{2,4})$/);
  if (monthNameMatch) {
    const monthIndex = MONTHS.indexOf(monthNameMatch[2].slice(0, 3));
    if (monthIndex === -1) return null;
    const day = Number(monthNameMatch[1] ?? monthNameMatch[3] ?? 1);
    let year = Number(monthNameMatch[4]);
    if (year < 100) year += 2000;
    const date = new Date(Date.UTC(year, monthIndex, day));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const parts = extractNumericDateParts(trimmed);
  if (!parts) return null;
  const { a, b, c } = parts;

  let day: number;
  let month: number; // 0-indexed
  let year: number;

  if (a > 31) {
    // YYYY/M/D
    year = a;
    month = b - 1;
    day = c;
  } else if (format === "month-first") {
    month = a - 1;
    day = b;
    year = c;
  } else {
    // day-first (default) or already-disambiguated day-first
    day = a;
    month = b - 1;
    year = c;
  }
  if (year < 100) year += 2000;

  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Cleans a raw description into a normalized merchant string for matching/display. */
export function normalizeMerchant(description: string): string {
  return description
    .replace(/\b(UPI|NEFT|IMPS|RTGS|ACH|POS)\b[/\-\s]*/gi, "")
    .replace(/\b\d{6,}\b/g, "") // strip long reference/transaction numbers
    .replace(/[/\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
