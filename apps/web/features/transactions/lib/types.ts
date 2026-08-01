export interface RawTable {
  headers: string[];
  rows: string[][];
}

export type DateFormat = "iso" | "day-first" | "month-first";

export interface ColumnMapping {
  dateColumn: number;
  descriptionColumn: number;
  dateFormat: DateFormat;
  /** Signed single-amount column. Mutually exclusive with debit/credit columns. */
  amountColumn?: number;
  debitColumn?: number;
  creditColumn?: number;
}

export interface DetectionResult {
  mapping: ColumnMapping | null;
  /** 0-1 — below CONFIDENCE_THRESHOLD triggers the manual mapping wizard. */
  confidence: number;
}

export interface NormalizedTransaction {
  postedAt: Date;
  amountMinor: number;
  description: string;
  merchantRaw: string;
  merchantNormalized: string;
}
