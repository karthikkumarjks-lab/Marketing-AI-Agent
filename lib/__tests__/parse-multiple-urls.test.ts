import { describe, expect, it } from "vitest";
import { parseMultipleUrls } from "../parse-multiple-urls";

describe("parseMultipleUrls", () => {
  it("splits on commas and newlines, trims, and caps at max", () => {
    const out = parseMultipleUrls("a.com, b.com\nc.com,   d.com  ", 3);
    expect(out).toEqual(["a.com", "b.com", "c.com"]);
  });

  it("dedupes by domain by default, dropping a second page on the same site", () => {
    // This is the right behavior for competitor/site-crawl callers: entering
    // the same competitor twice (once bare, once with a path) shouldn't
    // count as two competitors.
    const out = parseMultipleUrls("example.com, example.com/pricing, other.com", 4);
    expect(out).toEqual(["example.com", "other.com"]);
  });

  it("dedupes by full path when dedupeByPath is true, keeping multiple pages on the same domain", () => {
    // This is the landing-page-health-score case: 3 different pages on the
    // same domain must all survive, not collapse to 1 (a real bug this
    // fixes — domain-only dedup silently dropped every page after the
    // first when a client pasted several landing pages on one site).
    const out = parseMultipleUrls("example.com/lp-1\nexample.com/lp-2\nexample.com/lp-3", 10, true);
    expect(out).toEqual(["example.com/lp-1", "example.com/lp-2", "example.com/lp-3"]);
  });

  it("still dedupes an exact repeat when dedupeByPath is true", () => {
    const out = parseMultipleUrls("example.com/lp-1\nexample.com/lp-1\nexample.com/lp-1/", 10, true);
    expect(out).toEqual(["example.com/lp-1"]);
  });
});
