import { describe, expect, it } from "vitest";
import { parseLeadsInput } from "../../app/transcribe/page";
import { guessMimeFromUrl, parseResponse, computeFunnelBreakdown, type TranscriptionResult, type CategoryDef } from "../transcribe";

describe("guessMimeFromUrl", () => {
  it("detects common audio extensions", () => {
    expect(guessMimeFromUrl("https://example.com/call.mp3")).toBe("audio/mpeg");
    expect(guessMimeFromUrl("https://example.com/call.wav")).toBe("audio/wav");
    expect(guessMimeFromUrl("https://example.com/call.m4a")).toBe("audio/mp4");
    expect(guessMimeFromUrl("https://example.com/call.ogg")).toBe("audio/ogg");
  });

  it("strips a query string before checking the extension", () => {
    expect(guessMimeFromUrl("https://cdn.example.com/recordings/call.mp3?sig=abc123&exp=999")).toBe("audio/mpeg");
  });

  it("is case-insensitive", () => {
    expect(guessMimeFromUrl("https://example.com/call.MP3")).toBe("audio/mpeg");
  });

  it("returns null for an unrecognized or missing extension", () => {
    expect(guessMimeFromUrl("https://example.com/call")).toBeNull();
    expect(guessMimeFromUrl("https://example.com/page.html")).toBeNull();
  });
});

describe("parseLeadsInput", () => {
  it("accepts the provided two-recording sample without email values", () => {
    const sample = "PROS-1001, https://yourhost.com/recordings/call1.mp3\nPROS-1002, https://yourhost.com/recordings/call2.mp3";
    const { leads, errors } = parseLeadsInput(sample);

    expect(errors).toEqual([]);
    expect(leads).toEqual([
      { email: null, prospectId: "PROS-1001", url: "https://yourhost.com/recordings/call1.mp3" },
      { email: null, prospectId: "PROS-1002", url: "https://yourhost.com/recordings/call2.mp3" },
    ]);
  });
});

describe("parseResponse", () => {
  const categories = ["Agreed to Counselor Callback", "Explicit Rejection", "Other / Uncategorized"];

  it("splits transcript and category when both markers are present", () => {
    const raw = "===TRANSCRIPT===\nSpeaker 1: Hello, I'm interested.\n===CATEGORY===\nAgreed to Counselor Callback";
    const { transcript, category } = parseResponse(raw, categories);
    expect(transcript).toBe("Speaker 1: Hello, I'm interested.");
    expect(category).toBe("Agreed to Counselor Callback");
  });

  it("falls back to treating the whole response as the transcript when the model didn't use the markers", () => {
    const raw = "Speaker 1: Hello there, no markers here.";
    const { transcript, category } = parseResponse(raw, categories);
    expect(transcript).toBe(raw);
    expect(category).toBeNull();
  });

  it("returns only the transcript (no category) when only the transcript marker came back", () => {
    const raw = "===TRANSCRIPT===\nSpeaker 1: Hello.";
    const { transcript, category } = parseResponse(raw, categories);
    expect(transcript).toBe("Speaker 1: Hello.");
    expect(category).toBeNull();
  });

  it("does not lose content if a real transcript happens to mention the word 'category'", () => {
    const raw = "===TRANSCRIPT===\nHe asked which category this call falls under.\n===CATEGORY===\nOther / Uncategorized";
    const { transcript, category } = parseResponse(raw, categories);
    expect(transcript).toBe("He asked which category this call falls under.");
    expect(category).toBe("Other / Uncategorized");
  });

  it("cleans up stray punctuation/quotes around an otherwise-correct category name", () => {
    const raw = '===TRANSCRIPT===\nSpeaker 1: Not interested.\n===CATEGORY===\n"Explicit Rejection".';
    const { category } = parseResponse(raw, categories);
    expect(category).toBe("Explicit Rejection");
  });

  it("keeps a genuinely unrecognized category string as-is rather than silently discarding it", () => {
    const raw = "===TRANSCRIPT===\nSpeaker 1: Hmm.\n===CATEGORY===\nSomething Not In The List";
    const { category } = parseResponse(raw, categories);
    expect(category).toBe("Something Not In The List");
  });
});

describe("computeFunnelBreakdown", () => {
  const testCategories: CategoryDef[] = [
    { name: "Agreed to Callback", rootCause: "High intent" },
    { name: "Rejected", rootCause: "Not interested" },
  ];
  const lead = (category: string | null, error: string | null = null): TranscriptionResult => ({
    email: null,
    prospectId: "P",
    url: "u",
    transcript: error ? null : "t",
    category,
    error,
  });

  it("computes real counts and shares from the actual per-call categories, sorted by count", () => {
    const results = [lead("Rejected"), lead("Agreed to Callback"), lead("Agreed to Callback"), lead("Agreed to Callback")];
    const breakdown = computeFunnelBreakdown(results, testCategories);
    expect(breakdown).toEqual([
      { category: "Agreed to Callback", count: 3, sharePct: 0.75, rootCause: "High intent" },
      { category: "Rejected", count: 1, sharePct: 0.25, rootCause: "Not interested" },
    ]);
  });

  it("excludes leads with no category (errors, unparseable) from both the counts and the share denominator", () => {
    const results = [lead("Rejected"), lead(null, "Could not fetch this URL."), lead(null)];
    const breakdown = computeFunnelBreakdown(results, testCategories);
    expect(breakdown).toEqual([{ category: "Rejected", count: 1, sharePct: 1, rootCause: "Not interested" }]);
  });

  it("returns an empty breakdown rather than dividing by zero when nothing has a category yet", () => {
    expect(computeFunnelBreakdown([lead(null, "error")], testCategories)).toEqual([]);
  });
});
