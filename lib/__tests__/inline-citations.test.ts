import { describe, expect, it } from "vitest";
import { insertInlineCitations } from "../agent-prompts";

const chunks = [{ web: { uri: "https://imarcgroup.com/report", title: "IMARC Group" } }, { web: { uri: "https://example.com/x" } }];

describe("insertInlineCitations", () => {
  it("adds a real source line directly BELOW the paragraph it supports, not inline mid-sentence", () => {
    const para = "The market was valued at USD 3.64 billion in 2025. Next sentence in the same paragraph.";
    const content = `${para}\n\nA second, uncited paragraph.`;
    const segText = "The market was valued at USD 3.64 billion in 2025.";
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: segText.length, text: segText }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(`${para}\n*Source: [IMARC Group](https://imarcgroup.com/report)*\n\nA second, uncited paragraph.`);
  });

  it("combines multiple citations within the same paragraph into one deduped source line", () => {
    const sentence1 = "The market was valued at USD 3.64 billion in 2025.";
    const sentence2 = " It will reach USD 23.9 billion by 2034.";
    const para = sentence1 + sentence2;
    const content = para;
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: sentence1.length, text: sentence1 }, groundingChunkIndices: [0] },
      { segment: { startIndex: sentence1.length, endIndex: para.length, text: sentence2 }, groundingChunkIndices: [1] },
    ]);
    expect(result).toBe(
      `${para}\n*Source: [IMARC Group](https://imarcgroup.com/report), [example.com](https://example.com/x)*`,
    );
  });

  it("gives a chart its own source line, borrowed from the paragraph immediately above it", () => {
    const para = "The market was valued at USD 3.64 billion in 2025.";
    const chart = '```chart\n{"type":"bar","data":[{"name":"A","value":1}]}\n```';
    const content = `${para}\n\n${chart}\n\nMore prose after.`;
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: para.length, text: para }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(`${para}\n*Source: [IMARC Group](https://imarcgroup.com/report)*\n\n${chart}\n*Source: [IMARC Group](https://imarcgroup.com/report)*\n\nMore prose after.`);
  });

  it("gives a chart no source line when nothing above it was actually cited", () => {
    const para = "This paragraph states a number but was never searched.";
    const chart = '```chart\n{"type":"bar","data":[{"name":"A","value":1}]}\n```';
    const content = `${para}\n\n${chart}`;
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: 5, text: "wrong" }, groundingChunkIndices: [0] }, // fails verification
    ]);
    expect(result).toBe(content);
  });

  it("never splices into a fenced ```chart code block itself (would break the JSON)", () => {
    const chart = '```chart\n{"type":"bar","data":[{"name":"A","value":1}]}\n```';
    const content = `Some prose.\n${chart}\nMore prose.`;
    const chartInner = '{"type":"bar","data":[{"name":"A","value":1}]}';
    const startIndex = content.indexOf(chartInner);
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex, endIndex: startIndex + chartInner.length, text: chartInner }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(content); // the fenced JSON's own "text" can never verify against real prose, so nothing attaches
  });

  it("places a table's citation after the whole table, never inside a row", () => {
    const row = "| Amity | Market Share | 12% | 2024 |";
    const content = `${row}\nNext line, still part of the same block.\n\nA new paragraph.`;
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: row.length, text: row }, groundingChunkIndices: [0] },
    ]);
    // Citation lands after the whole table+following line block, not spliced into the "|" row itself.
    expect(result.startsWith(row)).toBe(true);
    expect(result).not.toMatch(/\|[^\n]*\[IMARC/); // never inside a "|" line
  });

  it("skips a segment whose offsets don't actually match the claimed text (defense against a mismatched offset scheme)", () => {
    const content = "The market was valued at USD 3.64 billion in 2025.";
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex: 0, endIndex: 10, text: "wrong text that doesn't match the slice" }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(content);
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
    const para = "The market was valued at ₹462.97 billion in FY 2023.";
    const content = para;
    const startIndex = 0;
    const endIndex = Buffer.byteLength(para, "utf-8"); // the real byte length, not para.length
    expect(endIndex).not.toBe(para.length); // sanity-check the test itself exercises the byte/char mismatch
    const result = insertInlineCitations(content, chunks, [
      { segment: { startIndex, endIndex, text: para }, groundingChunkIndices: [0] },
    ]);
    expect(result).toBe(`${para}\n*Source: [IMARC Group](https://imarcgroup.com/report)*`);
  });
});
