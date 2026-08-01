import { normalizeMerchant, parseAmount, parseDateFlexible } from "./format";
import type { ColumnMapping, NormalizedTransaction, RawTable } from "./types";

export interface NormalizeResult {
  transactions: NormalizedTransaction[];
  skippedRows: number;
}

function resolveAmount(row: string[], mapping: ColumnMapping): number | null {
  if (mapping.amountColumn !== undefined) {
    return parseAmount(row[mapping.amountColumn] ?? "");
  }

  const debit = mapping.debitColumn !== undefined ? parseAmount(row[mapping.debitColumn] ?? "") : null;
  const credit = mapping.creditColumn !== undefined ? parseAmount(row[mapping.creditColumn] ?? "") : null;

  if (debit !== null && debit !== 0) return -Math.abs(debit);
  if (credit !== null && credit !== 0) return Math.abs(credit);
  return null;
}

/** Converts raw parsed rows into transaction candidates, skipping rows that don't have a usable date/amount/description. */
export function normalizeRows(table: RawTable, mapping: ColumnMapping): NormalizeResult {
  const transactions: NormalizedTransaction[] = [];
  let skippedRows = 0;

  for (const row of table.rows) {
    const postedAt = parseDateFlexible(row[mapping.dateColumn] ?? "", mapping.dateFormat);
    const description = (row[mapping.descriptionColumn] ?? "").trim();
    const amount = resolveAmount(row, mapping);

    if (!postedAt || amount === null || !description) {
      skippedRows += 1;
      continue;
    }

    transactions.push({
      postedAt,
      amountMinor: Math.round(amount * 100),
      description,
      merchantRaw: description,
      merchantNormalized: normalizeMerchant(description),
    });
  }

  return { transactions, skippedRows };
}
