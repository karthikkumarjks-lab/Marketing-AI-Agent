import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseExcelBuffer } from "../excel-parse";

function bufferFromRows(rows: unknown[][], sheetName = "Sheet1"): Buffer {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

describe("parseExcelBuffer", () => {
  it("converts a simple sheet into a markdown table with real data", () => {
    const buffer = bufferFromRows([
      ["Channel", "Spend", "Leads"],
      ["Google Ads", "50000", "120"],
      ["Meta Ads", "30000", "80"],
    ]);
    const result = parseExcelBuffer(buffer, "campaign.xlsx");
    expect(result.markdown).toContain("Channel");
    expect(result.markdown).toContain("Google Ads");
    expect(result.markdown).toContain("50000");
    expect(result.truncated).toBe(false);
  });

  it("flags truncation when a sheet exceeds the row cap", () => {
    const header = ["Id", "Value"];
    const rows = [header, ...Array.from({ length: 250 }, (_, i) => [String(i), String(i * 2)])];
    const buffer = bufferFromRows(rows);
    const result = parseExcelBuffer(buffer, "big.xlsx");
    expect(result.truncated).toBe(true);
    expect(result.markdown).toContain("truncated");
  });

  it("handles multiple sheets up to the sheet cap", () => {
    const sheet1 = XLSX.utils.aoa_to_sheet([["A"], ["1"]]);
    const sheet2 = XLSX.utils.aoa_to_sheet([["B"], ["2"]]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet1, "First");
    XLSX.utils.book_append_sheet(workbook, sheet2, "Second");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;

    const result = parseExcelBuffer(buffer, "multi.xlsx");
    expect(result.sheetCount).toBe(2);
    expect(result.markdown).toContain("First");
    expect(result.markdown).toContain("Second");
  });

  it("does not throw on an empty sheet", () => {
    const buffer = bufferFromRows([[]]);
    expect(() => parseExcelBuffer(buffer, "empty.xlsx")).not.toThrow();
  });
});
