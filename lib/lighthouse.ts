// Real Lighthouse audits via Google's own PageSpeed Insights API — the
// exact same Lighthouse engine Chrome's Inspect -> Lighthouse panel runs,
// hosted by Google so this never needs to bundle a headless Chrome browser
// server-side (heavy, slow, and not viable on a serverless/Netlify deploy —
// this project's whole design avoids that class of dependency). Real
// network I/O + a real, versioned Google API response, never inferred or
// estimated — same honesty standard as every other "real data" check in
// this codebase (lib/domain-scan.ts, lib/crm-audit.ts, etc.).
//
// Requires PAGESPEED_API_KEY — confirmed via a real 429 (2026-09) that
// Google's unauthenticated per-project quota for this API is now 0;
// unlike Gemini, this key needs no billing enabled, just the "PageSpeed
// Insights API" turned on for a free Google Cloud project. See
// .env.local.example for the exact steps.

const PSI_TIMEOUT_MS = 60000; // a real Lighthouse run (Google renders the actual page) commonly takes 15-40s
const CATEGORIES = ["performance", "accessibility", "best-practices", "seo"] as const;
type Category = (typeof CATEGORIES)[number];

export interface CoreWebVital {
  label: string;
  displayValue: string | null;
  score: number | null; // 0-1, null when Lighthouse couldn't score it
}

export interface Opportunity {
  title: string;
  description: string;
  displaySavings: string | null;
}

export interface LighthouseResult {
  url: string;
  scores: Record<Category, number | null>; // 0-100
  coreWebVitals: CoreWebVital[];
  topOpportunities: Opportunity[];
  finalUrl: string | null; // where the audited page actually landed, if redirected
  error: string | null;
}

const CWV_AUDIT_IDS: { id: string; label: string }[] = [
  { id: "largest-contentful-paint", label: "Largest Contentful Paint (LCP)" },
  { id: "cumulative-layout-shift", label: "Cumulative Layout Shift (CLS)" },
  { id: "total-blocking-time", label: "Total Blocking Time (TBT)" },
  { id: "first-contentful-paint", label: "First Contentful Paint (FCP)" },
  { id: "speed-index", label: "Speed Index" },
];

const MAX_OPPORTUNITIES = 6;

interface PsiAuditRef {
  score?: number | null;
  displayValue?: string;
  title?: string;
  description?: string;
  details?: { type?: string; overallSavingsMs?: number };
}

async function fetchPageSpeedInsights(url: string, apiKey: string): Promise<LighthouseResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PSI_TIMEOUT_MS);
  const empty: Record<Category, number | null> = { performance: null, accessibility: null, "best-practices": null, seo: null };
  try {
    const params = new URLSearchParams({ url, strategy: "mobile", key: apiKey });
    for (const c of CATEGORIES) params.append("category", c.toUpperCase());
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, { signal: controller.signal });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const message = body?.error?.message || `HTTP ${res.status}`;
      return { url, scores: empty, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: message };
    }
    const json = await res.json();
    const lr = json.lighthouseResult;
    if (!lr) {
      return { url, scores: empty, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: "PageSpeed Insights returned no lighthouseResult — the page may be unreachable or blocking automated audits." };
    }

    const scores: Record<Category, number | null> = { ...empty };
    for (const c of CATEGORIES) {
      const raw = lr.categories?.[c]?.score;
      scores[c] = typeof raw === "number" ? Math.round(raw * 100) : null;
    }

    const audits: Record<string, PsiAuditRef> = lr.audits ?? {};
    const coreWebVitals: CoreWebVital[] = CWV_AUDIT_IDS.map(({ id, label }) => ({
      label,
      displayValue: audits[id]?.displayValue ?? null,
      score: typeof audits[id]?.score === "number" ? audits[id]!.score! : null,
    }));

    const topOpportunities: Opportunity[] = Object.values(audits)
      .filter((a): a is PsiAuditRef & { title: string } => a.details?.type === "opportunity" && !!a.title && (a.details?.overallSavingsMs ?? 0) > 0)
      .sort((a, b) => (b.details?.overallSavingsMs ?? 0) - (a.details?.overallSavingsMs ?? 0))
      .slice(0, MAX_OPPORTUNITIES)
      .map((a) => ({
        title: a.title,
        description: (a.description ?? "").replace(/\[.*?\]\(.*?\)/g, "").trim(), // strip markdown links Lighthouse embeds in its own descriptions
        displaySavings: a.displayValue ?? null,
      }));

    return {
      url,
      scores,
      coreWebVitals,
      topOpportunities,
      finalUrl: lr.finalUrl ?? null,
      error: null,
    };
  } catch (err) {
    const message = err instanceof Error && err.name === "AbortError" ? "Timed out waiting for the Lighthouse audit (60s) — the page may be very slow or unreachable." : err instanceof Error ? err.message : "Lighthouse audit failed.";
    return { url, scores: empty, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: message };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Checks one URL's real Lighthouse scores via PageSpeed Insights.
 */
export async function checkLighthouse(url: string): Promise<LighthouseResult> {
  const apiKey = process.env.PAGESPEED_API_KEY;
  if (!apiKey) {
    const empty: Record<Category, number | null> = { performance: null, accessibility: null, "best-practices": null, seo: null };
    return { url, scores: empty, coreWebVitals: [], topOpportunities: [], finalUrl: null, error: "No PAGESPEED_API_KEY configured — see .env.local.example for how to get a free one." };
  }
  return fetchPageSpeedInsights(url, apiKey);
}

/**
 * Sequential, not parallel — a real Lighthouse run is a genuine page
 * render on Google's end (15-40s each), and bursting several at once
 * against the same API key risks the exact throttling this codebase has
 * already hit with other providers this session.
 */
export async function checkLighthouseBatch(urls: string[]): Promise<LighthouseResult[]> {
  const results: LighthouseResult[] = [];
  for (const url of urls) {
    results.push(await checkLighthouse(url));
  }
  return results;
}
