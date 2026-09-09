import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLighthouse } from "../lighthouse";

function fakePsiResponse(overallSavingsMsList: number[]) {
  const audits: Record<string, unknown> = {};
  overallSavingsMsList.forEach((ms, i) => {
    audits[`opportunity-${i}`] = {
      title: `Opportunity ${i}`,
      description: "Some [link](https://example.com) text.",
      displayValue: `${ms} ms`,
      details: { type: "opportunity", overallSavingsMs: ms },
    };
  });
  return {
    lighthouseResult: {
      finalUrl: "https://example.com/",
      categories: { performance: { score: 0.873 }, accessibility: { score: 1 }, "best-practices": { score: 0.5 }, seo: { score: null } },
      audits,
    },
  };
}

describe("checkLighthouse", () => {
  const originalKey = process.env.PAGESPEED_API_KEY;
  afterEach(() => {
    process.env.PAGESPEED_API_KEY = originalKey;
    vi.unstubAllGlobals();
  });

  it("reports a clear error when no API key is configured, instead of a confusing empty result", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const result = await checkLighthouse("https://example.com");
    expect(result.error).toMatch(/PAGESPEED_API_KEY/);
    expect(result.scores.performance).toBeNull();
  });

  it("rounds scores to 0-100 and keeps top 6 opportunities sorted by savings, stripping markdown links", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const savings = [100, 5000, 200, 3000, 50, 1000, 400]; // 7 opportunities, only top 6 should survive
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => fakePsiResponse(savings),
      })
    );

    const result = await checkLighthouse("https://example.com");

    expect(result.error).toBeNull();
    expect(result.scores.performance).toBe(87); // 0.873 -> 87
    expect(result.scores.accessibility).toBe(100);
    expect(result.scores.seo).toBeNull(); // Lighthouse skipped this category

    expect(result.topOpportunities).toHaveLength(6);
    expect(result.topOpportunities[0].displaySavings).toBe("5000 ms"); // largest savings first
    expect(result.topOpportunities.at(-1)?.displaySavings).toBe("100 ms"); // the smallest (50ms) got dropped, not this one
    expect(result.topOpportunities[0].description).not.toContain("[link]"); // markdown link stripped
  });
});
