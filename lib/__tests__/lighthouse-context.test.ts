import { describe, expect, it } from "vitest";
import { buildLighthouseContext, injectLighthouseComparisonTable } from "../agent-prompts";
import type { DeviceAudit, LighthouseResult } from "../lighthouse";

function audit(perf: number, lcp: string, fcp: string): DeviceAudit {
  return {
    scores: { performance: perf, accessibility: 90, "best-practices": 95, seo: 100 },
    coreWebVitals: [
      { label: "Largest Contentful Paint (LCP)", displayValue: lcp, score: 0.5 },
      { label: "First Contentful Paint (FCP)", displayValue: fcp, score: 0.7 },
    ],
    topOpportunities: [],
    finalUrl: null,
    error: null,
  };
}

describe("buildLighthouseContext pre-computed table", () => {
  it("emits an 8-column table with LCP and FCP, sorted worst-mobile-Performance-first", () => {
    const results: LighthouseResult[] = [
      { url: "site.com/fast", mobile: audit(80, "2.1 s", "1.0 s"), desktop: audit(98, "0.8 s", "0.4 s") },
      { url: "site.com/slow", mobile: audit(31, "6.4 s", "3.2 s"), desktop: audit(75, "1.9 s", "0.9 s") },
    ];
    const ctx = buildLighthouseContext(results);

    expect(ctx).toContain("| Page URL | Device | Performance | Accessibility | Best Practices | SEO | LCP | FCP |");
    // worst mobile Performance (31) must come before the better one (80)
    expect(ctx.indexOf("site.com/slow | Mobile")).toBeLessThan(ctx.indexOf("site.com/fast | Mobile"));
    // real LCP/FCP values land in the row, not "n/a"
    expect(ctx).toContain("| site.com/slow | Mobile | 31 | 90 | 95 | 100 | 6.4 s | 3.2 s |");
    expect(ctx).toContain("| site.com/fast | Desktop | 98 | 90 | 95 | 100 | 0.8 s | 0.4 s |");
  });

  it("renders a failed device as a Failed row with n/a vitals, not invented numbers", () => {
    const failed: DeviceAudit = { scores: { performance: null, accessibility: null, "best-practices": null, seo: null }, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: "timed out" };
    const ctx = buildLighthouseContext([{ url: "site.com/x", mobile: failed, desktop: audit(90, "1.0 s", "0.5 s") }]);
    expect(ctx).toContain("| site.com/x | Mobile | Failed | Failed | Failed | Failed | n/a | n/a |");
  });
});

describe("injectLighthouseComparisonTable", () => {
  const results: LighthouseResult[] = [
    { url: "site.com/a", mobile: audit(40, "5.9 s", "1.2 s"), desktop: audit(90, "1.1 s", "0.5 s") },
  ];

  it("replaces the model's own Score Comparison section with the real 8-column table", () => {
    const md = [
      "## Executive Summary",
      "Some summary.",
      "## Score Comparison",
      "| Page URL | Performance |",
      "|---|---|",
      "| site.com/a | 40 |",
      "## Core Web Vitals Detail",
      "details here",
    ].join("\n");
    const out = injectLighthouseComparisonTable(md, results);
    expect(out).toContain("| Page URL | Device | Performance | Accessibility | Best Practices | SEO | LCP | FCP |");
    expect(out).toContain("| site.com/a | Mobile | 40 | 90 | 95 | 100 | 5.9 s | 1.2 s |");
    expect(out).not.toContain("| Page URL | Performance |"); // the model's stub table is gone
    expect(out).toContain("## Executive Summary"); // other sections untouched
    expect(out).toContain("## Core Web Vitals Detail");
  });

  it("adds a Score Comparison section near the top if the model omitted it entirely", () => {
    const md = "## Executive Summary\nSome summary.\n## Core Web Vitals Detail\ndetails";
    const out = injectLighthouseComparisonTable(md, results);
    expect(out.startsWith("## Score Comparison")).toBe(true);
    expect(out).toContain("| site.com/a | Desktop | 90 | 90 | 95 | 100 | 1.1 s | 0.5 s |");
  });

  it("leaves markdown untouched when there are no results", () => {
    const md = "## Score Comparison\nnothing";
    expect(injectLighthouseComparisonTable(md, [])).toBe(md);
  });
});
