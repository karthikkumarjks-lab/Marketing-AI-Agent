import { describe, expect, it } from "vitest";
import { insertInlineCitations } from "../agent-prompts";

const chunks = [{ web: { uri: "https://imarcgroup.com/report", title: "IMARC Group" } }, { web: { uri: "https://example.com/x" } }];

describe("insertInlineCitations", () => {
  it("splices a real citation link right after a verified prose segment", () => {
    const content = "The market was valued at USD 3.64 billion in 2025. Next sentence.";
    const segText = "The market was valued at USD 3.64 billion in 2025.";
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: segText.length, text: segText }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(`${segText} ([IMARC Group](https://imarcgroup.com/report)) Next sentence.`);
  });

  it("skips a segment whose offsets don't actually match the claimed text (real defense against a mismatched offset scheme)", () => {
    const content = "The market was valued at USD 3.64 billion in 2025.";
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: 10, text: "wrong text that doesn't match the slice" }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(content); // unchanged — never splice into an unverified position
  });

  it("never inserts inside a markdown table row, even when the row genuinely ends where a citation would land", () => {
    const row = "| Amity | Market Share | 12% | 2024 |";
    const content = `${row}\nNext line.`;
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: row.length, text: row }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(content); // table cells stay short — no link spliced into a "|" row
  });

  it("never inserts inside a fenced ```chart code block (would break the JSON)", () => {
    const chart = '```chart\n{"type":"bar","data":[{"name":"A","value":1}]}\n```';
    const content = `Some prose.\n${chart}\nMore prose.`;
    const chartInner = '{"type":"bar","data":[{"name":"A","value":1}]}';
    const startIndex = content.indexOf(chartInner);
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex, endIndex: startIndex + chartInner.length, text: chartInner }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(content); // fenced JSON is never touched
  });

  it("returns content unchanged when there are no supports", () => {
    const content = "Plain text, nothing to cite.";
    expect(insertInlineCitations(content, chunks, [])).toBe(content);
  });

  it("handles a real multi-byte character correctly — Gemini's offsets are UTF-8 BYTE offsets, not JS string indices", () => {
    // Regression test for a real bug: the ₹ sign is 3 bytes in UTF-8 but 1
    // JS UTF-16 code unit, so a naive content.slice(startIndex, endIndex)
    // using Gemini's byte offsets drifted after the ₹ and silently dropped
    // every citation in a real run. This locks the fix in place.
    const segText = "The market was valued at ₹462.97 billion in FY 2023.";
    const content = `${segText} Next sentence.`;
    const startIndex = 0;
    const endIndex = Buffer.byteLength(segText, "utf-8"); // the real byte length, not segText.length
    expect(endIndex).not.toBe(segText.length); // sanity-check the test itself exercises the byte/char mismatch
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex, endIndex, text: segText }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(`${segText} ([IMARC Group](https://imarcgroup.com/report)) Next sentence.`);
  });
});
