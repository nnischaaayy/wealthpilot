import "server-only";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { RawTable } from "./types";

export class UnsupportedFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsupportedFileError";
  }
}

const MAX_ROWS = 5000; // matches the product's p95 statement-size target (§1.4)

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object" && "result" in value) {
    // ExcelJS formula cell — use the computed result.
    return cellToString((value as { result: unknown }).result);
  }
  if (typeof value === "object" && "text" in value) {
    // ExcelJS rich text cell.
    return String((value as { text: unknown }).text);
  }
  return String(value).trim();
}

function parseCsv(text: string): RawTable {
  const result = Papa.parse<string[]>(text, { skipEmptyLines: true });
  const [headers, ...rows] = result.data;
  if (!headers) return { headers: [], rows: [] };
  return { headers: headers.map((h) => h.trim()), rows: rows.slice(0, MAX_ROWS) };
}

async function parseXlsx(buffer: Buffer): Promise<RawTable> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's .d.ts resolves `Buffer` against a nested @types/node pulled in
  // by one of its own transitive deps, which structurally mismatches ours —
  // a type-only artifact, not a runtime issue.
  await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return { headers: [], rows: [] };

  const allRows: string[][] = [];
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    // ExcelJS row.values is 1-indexed with a leading empty slot.
    const values = (row.values as unknown[]).slice(1).map(cellToString);
    allRows.push(values);
  });

  const [headers, ...rows] = allRows;
  if (!headers) return { headers: [], rows: [] };
  return { headers, rows: rows.slice(0, MAX_ROWS) };
}

export async function parseStatementFile(fileName: string, buffer: Buffer): Promise<RawTable> {
  const ext = fileName.toLowerCase().split(".").pop();
  if (ext === "csv") return parseCsv(buffer.toString("utf-8"));
  if (ext === "xlsx" || ext === "xls") return parseXlsx(buffer);
  throw new UnsupportedFileError(`Unsupported file type: .${ext ?? "unknown"}`);
}
