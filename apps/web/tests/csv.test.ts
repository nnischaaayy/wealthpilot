import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins simple rows with commas and CRLF between rows", () => {
    expect(toCsv([["a", "b"], ["c", 1]])).toBe("a,b\r\nc,1");
  });

  it("quotes fields containing a comma", () => {
    expect(toCsv([["Housing, Rent", "100"]])).toBe('"Housing, Rent",100');
  });

  it("quotes and escapes fields containing a double quote", () => {
    expect(toCsv([['Say "hi"', "x"]])).toBe('"Say ""hi""",x');
  });

  it("quotes fields containing a newline", () => {
    expect(toCsv([["line1\nline2", "x"]])).toBe('"line1\nline2",x');
  });

  it("leaves plain fields unquoted", () => {
    expect(toCsv([["Groceries", "$50.00"]])).toBe("Groceries,$50.00");
  });
});
