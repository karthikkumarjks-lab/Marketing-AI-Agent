import { describe, expect, it } from "vitest";
import { buildLighthouseContext, buildLighthouseComparisonTable, injectLighthouseComparisonTable } from "../agent-prompts";
import type { DeviceAudit, LighthouseResult } from "../lighthouse";

function audit(perf: number, lcp: string, fcp: string, lcpScore = 0.5, fcpScore = 0.7): DeviceAudit {
  return {
    scores: { performance: perf, accessibility: 90, "best-practices": 95, seo: 100 },
    coreWebVitals: [
      { label: "Largest Contentful Paint (LCP)", displayValue: lcp, score: lcpScore },
      { label: "First Contentful Paint (FCP)", displayValue: fcp, score: fcpScore },
    ],
    topOpportunities: [],
    finalUrl: null,
    error: null,
  };
}

const HEADER = "| Page URL | Device | Performance | LCP | FCP | Accessibility | Best Practices | SEO |";

describe("buildLighthouseComparisonTable", () => {
  it("puts LCP and FCP right after Performance, with score annotations, sorted worst-mobile-first", () => {
    const results: LighthouseResult[] = [
      { url: "site.com/fast", mobile: audit(80, "2.1 s", "1.0 s"), desktop: audit(98, "0.8 s", "0.4 s") },
      { url: "site.com/slow", mobile: audit(31, "6.4 s", "3.2 s", 0.14, 0.99), desktop: audit(75, "1.9 s", "0.9 s") },
    ];
    const table = buildLighthouseComparisonTable(results);

    expect(table.split("\n")[0]).toBe(HEADER);
    // worst mobile Performance (31) row comes first
    expect(table.indexOf("site.com/slow | Mobile")).toBeLessThan(table.indexOf("site.com/fast | Mobile"));
    expect(table).toContain("| site.com/slow | Mobile | 31 | 6.4 s (score 14/100) | 3.2 s (score 99/100) | 90 | 95 | 100 |");
  });

  it("renders a failed device as a Failed row across all metric columns", () => {
    const failed: DeviceAudit = { scores: { performance: null, accessibility: null, "best-practices": null, seo: null }, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: "timed out" };
    const table = buildLighthouseComparisonTable([{ url: "site.com/x", mobile: failed, desktop: audit(90, "1.0 s", "0.5 s") }]);
    expect(table).toContain("| site.com/x | Mobile | Failed | Failed | Failed | Failed | Failed | Failed |");
  });

  it("is the same table buildLighthouseContext embeds for the model to read", () => {
    const results: LighthouseResult[] = [{ url: "s.com", mobile: audit(50, "3 s", "1 s"), desktop: audit(90, "1 s", "0.5 s") }];
    expect(buildLighthouseContext(results)).toContain(buildLighthouseComparisonTable(results));
  });
});

describe("injectLighthouseComparisonTable", () => {
  const results: LighthouseResult[] = [
    { url: "site.com/a", mobile: audit(40, "5.9 s", "1.2 s", 0.14, 0.99), desktop: audit(90, "1.1 s", "0.5 s") },
  ];
  const realRow = "| site.com/a | Mobile | 40 | 5.9 s (score 14/100) | 1.2 s (score 99/100) | 90 | 95 | 100 |";

  it("replaces the model's own Score Comparison table with the real one", () => {
    const md = [
      "## Executive Summary", "Some summary.",
      "## Score Comparison",
      "| Page URL | Performance |", "|---|---|", "| site.com/a | 40 |",
      "## Core Web Vitals Detail", "details here",
    ].join("\n");
    const out = injectLighthouseComparisonTable(md, results);
    expect(out).toContain(HEADER);
    expect(out).toContain(realRow);
    expect(out).not.toContain("| Page URL | Performance |");
    expect(out).toContain("## Executive Summary");
    expect(out).toContain("## Core Web Vitals Detail");
  });

  it("replaces the one-line placeholder the prompt tells the model to emit", () => {
    const md = "## Executive Summary\nx\n## Score Comparison\n_(table inserted from the real audit data below)_\n## Core Web Vitals Detail\nLCP is 5.9s on mobile.";
    const out = injectLighthouseComparisonTable(md, results);
    expect(out).toContain(realRow);
    expect(out).not.toContain("_(table inserted");
    expect(out).toContain("LCP is 5.9s on mobile.");
  });

  it("matches a numbered / bold / lower-case heading variant too", () => {
    for (const heading of ["### 2. Score Comparison", "**Score comparison**", "## SCORE COMPARISON (mobile + desktop)"]) {
      const md = `## Executive Summary\nx\n${heading}\nold junk here\n## Core Web Vitals Detail\ny`;
      const out = injectLighthouseComparisonTable(md, results);
      expect(out).toContain(realRow);
      expect(out).not.toContain("old junk here");
      expect(out).toContain("## Core Web Vitals Detail");
    }
  });

  it("adds a Score Comparison section near the top if the model omitted it entirely", () => {
    const md = "## Executive Summary\nSome summary.\n## Core Web Vitals Detail\ndetails";
    const out = injectLighthouseComparisonTable(md, results);
    expect(out.startsWith("## Score Comparison")).toBe(true);
    expect(out).toContain("| site.com/a | Desktop | 90 | 1.1 s (score 50/100) | 0.5 s (score 70/100) | 90 | 95 | 100 |");
  });

  it("leaves markdown untouched when there are no results", () => {
    const md = "## Score Comparison\nnothing";
    expect(injectLighthouseComparisonTable(md, [])).toBe(md);
  });
});
