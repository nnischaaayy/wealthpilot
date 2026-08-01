import { describe, expect, it } from "vitest";
import { parseAmount, parseDateFlexible, sniffDateFormat, normalizeMerchant } from "@/features/transactions/lib/format";
import { detectColumns, CONFIDENCE_THRESHOLD } from "@/features/transactions/lib/detect";
import { normalizeRows } from "@/features/transactions/lib/normalize";
import { categorizeTransaction } from "@/features/transactions/lib/categorize";
import type { RawTable } from "@/features/transactions/lib/types";

describe("parseAmount", () => {
  it("parses plain numbers", () => {
    expect(parseAmount("45")).toBe(45);
  });
  it("strips currency symbols and thousands separators", () => {
    expect(parseAmount("$1,234.56")).toBe(1234.56);
  });
  it("treats parentheses as negative", () => {
    expect(parseAmount("(500.00)")).toBe(-500);
  });
  it("handles a leading minus", () => {
    expect(parseAmount("-12.3")).toBe(-12.3);
  });
  it("returns null for non-numeric input", () => {
    expect(parseAmount("N/A")).toBeNull();
  });
});

describe("date parsing", () => {
  it("sniffs day-first when a component exceeds 12", () => {
    expect(sniffDateFormat(["25/12/2025", "01/01/2025"])).toBe("day-first");
  });
  it("sniffs month-first when the second component exceeds 12", () => {
    expect(sniffDateFormat(["12/25/2025", "01/01/2025"])).toBe("month-first");
  });
  it("defaults to day-first when genuinely ambiguous", () => {
    expect(sniffDateFormat(["01/02/2025"])).toBe("day-first");
  });
  it("parses ISO dates regardless of assumed format", () => {
    const date = parseDateFlexible("2025-03-14", "month-first");
    expect(date?.toISOString().slice(0, 10)).toBe("2025-03-14");
  });
  it("parses day-first numeric dates", () => {
    const date = parseDateFlexible("25/12/2025", "day-first");
    expect(date?.getUTCMonth()).toBe(11); // December
    expect(date?.getUTCDate()).toBe(25);
  });
  it("parses month-name dates unambiguously", () => {
    const date = parseDateFlexible("14 Mar 2025", "day-first");
    expect(date?.getUTCMonth()).toBe(2); // March
    expect(date?.getUTCDate()).toBe(14);
  });
});

describe("normalizeMerchant", () => {
  it("strips UPI prefixes and long reference numbers", () => {
    expect(normalizeMerchant("UPI/402615789213/SWIGGY BANGALORE")).toBe("SWIGGY BANGALORE");
  });
});

describe("detectColumns", () => {
  it("detects a signed-amount statement with high confidence", () => {
    const table: RawTable = {
      headers: ["Date", "Narration", "Amount"],
      rows: [
        ["01/03/2025", "SWIGGY BANGALORE", "-450.00"],
        ["02/03/2025", "SALARY CREDIT", "50000.00"],
        ["03/03/2025", "AMAZON PURCHASE", "-1200.50"],
      ],
    };
    const result = detectColumns(table);
    expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(result.mapping?.amountColumn).toBe(2);
    expect(result.mapping?.descriptionColumn).toBe(1);
    expect(result.mapping?.dateColumn).toBe(0);
  });

  it("detects a debit/credit statement with high confidence", () => {
    const table: RawTable = {
      headers: ["Value Date", "Particulars", "Debit", "Credit"],
      rows: [
        ["01-03-2025", "AMAZON PURCHASE", "1200.50", ""],
        ["02-03-2025", "SALARY CREDIT", "", "50000.00"],
        ["03-03-2025", "SWIGGY BANGALORE", "450.00", ""],
      ],
    };
    const result = detectColumns(table);
    expect(result.confidence).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLD);
    expect(result.mapping?.debitColumn).toBe(2);
    expect(result.mapping?.creditColumn).toBe(3);
  });

  it("returns low confidence for an unrecognizable table", () => {
    const table: RawTable = {
      headers: ["Col A", "Col B"],
      rows: [["x", "y"]],
    };
    const result = detectColumns(table);
    expect(result.confidence).toBeLessThan(CONFIDENCE_THRESHOLD);
  });
});

describe("normalizeRows", () => {
  it("produces signed amountMinor from a debit/credit mapping and skips blank rows", () => {
    const table: RawTable = {
      headers: ["Date", "Narration", "Debit", "Credit"],
      rows: [
        ["01/03/2025", "AMAZON PURCHASE", "1200.50", ""],
        ["02/03/2025", "SALARY CREDIT", "", "50000.00"],
        ["", "", "", ""],
      ],
    };
    const { transactions, skippedRows } = normalizeRows(table, {
      dateColumn: 0,
      descriptionColumn: 1,
      debitColumn: 2,
      creditColumn: 3,
      dateFormat: "day-first",
    });

    expect(skippedRows).toBe(1);
    expect(transactions).toHaveLength(2);
    expect(transactions[0].amountMinor).toBe(-120050);
    expect(transactions[1].amountMinor).toBe(5000000);
  });
});

describe("categorizeTransaction", () => {
  it("matches a built-in keyword rule", () => {
    expect(categorizeTransaction("AMAZON PURCHASE", "AMAZON PURCHASE", [])).toBe("shopping");
  });

  it("prefers a workspace rule over a built-in rule", () => {
    const category = categorizeTransaction("AMAZON PURCHASE", "AMAZON PURCHASE", [
      { matcherPattern: "AMAZON", category: "subscriptions", priority: 0 },
    ]);
    expect(category).toBe("subscriptions");
  });

  it("falls back to uncategorized when nothing matches", () => {
    expect(categorizeTransaction("UNKNOWN MERCHANT XYZ", "UNKNOWN MERCHANT XYZ", [])).toBe("uncategorized");
  });
});
