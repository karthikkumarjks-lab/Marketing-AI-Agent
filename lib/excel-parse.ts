// Parses an uploaded spreadsheet (.xlsx/.xls/.csv) into a compact markdown
// table for the agent's prompt. Capped in both directions — rows and
// columns — so one large upload can't blow the model's context window or
// balloon the request. This is real, actual data from the file, not a
// summary invented by an LLM.

import * as XLSX from "xlsx";

const MAX_ROWS = 200;
const MAX_COLS = 30;
const MAX_SHEETS = 3;

export interface ParsedExcel {
  markdown: string;
  sheetCount: number;
  truncated: boolean;
}

export function parseExcelBuffer(buffer: Buffer, filename: string): ParsedExcel {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames.slice(0, MAX_SHEETS);
  let truncated = workbook.SheetNames.length > MAX_SHEETS;
  const sections: string[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: "" });
    if (rows.length === 0) continue;

    const rowsTruncated = rows.length > MAX_ROWS + 1;
    const colsTruncated = rows[0].length > MAX_COLS;
    if (rowsTruncated || colsTruncated) truncated = true;

    const limitedRows = rows.slice(0, MAX_ROWS + 1).map((row) => row.slice(0, MAX_COLS));
    const header = limitedRows[0].map((c) => String(c ?? "").trim() || "—");
    const body = limitedRows.slice(1);

    const headerLine = `| ${header.join(" | ")} |`;
    const dividerLine = `| ${header.map(() => "---").join(" | ")} |`;
    const bodyLines = body.map((row) => {
      const cells = header.map((_, i) => String(row[i] ?? "").trim());
      return `| ${cells.join(" | ")} |`;
    });

    sections.push(
      `### Sheet: ${sheetName} (${body.length}${rowsTruncated ? "+" : ""} data rows)\n${[headerLine, dividerLine, ...bodyLines].join("\n")}`,
    );
  }

  const markdown = `## Uploaded File: ${filename}\n\n${sections.join("\n\n")}${
    truncated ? "\n\n*(Data truncated to the first sheets/rows/columns shown above for prompt size — reasoning is based only on what's shown, not the full original file.)*" : ""
  }`;

  return { markdown, sheetCount: sheetNames.length, truncated };
}
