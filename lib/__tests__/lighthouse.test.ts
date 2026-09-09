import { afterEach, describe, expect, it, vi } from "vitest";
import { checkLighthouse } from "../lighthouse";

function fakePsiResponse(overallSavingsMsList: number[], performanceScore = 0.873) {
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
      categories: { performance: { score: performanceScore }, accessibility: { score: 1 }, "best-practices": { score: 0.5 }, seo: { score: null } },
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

  it("reports a clear error on both mobile and desktop when no API key is configured, instead of a confusing empty result", async () => {
    delete process.env.PAGESPEED_API_KEY;
    const result = await checkLighthouse("https://example.com");
    expect(result.mobile.error).toMatch(/PAGESPEED_API_KEY/);
    expect(result.desktop.error).toMatch(/PAGESPEED_API_KEY/);
    expect(result.mobile.scores.performance).toBeNull();
  });

  it("runs mobile and desktop as two separate real requests, one per strategy", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => fakePsiResponse([], url.includes("strategy=mobile") ? 0.4 : 0.9),
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkLighthouse("https://example.com");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calledUrls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(calledUrls.some((u) => u.includes("strategy=mobile"))).toBe(true);
    expect(calledUrls.some((u) => u.includes("strategy=desktop"))).toBe(true);

    // Mobile and desktop are reported independently, not blended into one number.
    expect(result.mobile.scores.performance).toBe(40);
    expect(result.desktop.scores.performance).toBe(90);
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

    for (const device of [result.mobile, result.desktop]) {
      expect(device.error).toBeNull();
      expect(device.scores.performance).toBe(87); // 0.873 -> 87
      expect(device.scores.accessibility).toBe(100);
      expect(device.scores.seo).toBeNull(); // Lighthouse skipped this category

      expect(device.topOpportunities).toHaveLength(6);
      expect(device.topOpportunities[0].displaySavings).toBe("5000 ms"); // largest savings first
      expect(device.topOpportunities.at(-1)?.displaySavings).toBe("100 ms"); // the smallest (50ms) got dropped, not this one
      expect(device.topOpportunities[0].description).not.toContain("[link]"); // markdown link stripped
    }
  });

  it("lets mobile and desktop fail independently", async () => {
    process.env.PAGESPEED_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("strategy=mobile")) return { ok: false, status: 500, json: async () => ({ error: { message: "mobile blew up" } }) };
        return { ok: true, json: async () => fakePsiResponse([]) };
      })
    );

    const result = await checkLighthouse("https://example.com");
    expect(result.mobile.error).toBe("mobile blew up");
    expect(result.desktop.error).toBeNull();
    expect(result.desktop.scores.performance).toBe(87);
  });
});
