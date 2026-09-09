// Parses a comma- and/or newline-separated list of URLs pasted into a
// single text field (agent-runner.tsx's multi-URL textarea), deduping and
// capping the count.
//
// dedupeByPath: false (default) dedupes by DOMAIN only — right for
// competitor/site-crawl callers, where "example.com" and
// "example.com/pricing" are the same site entered two ways. Pass true for
// callers where multiple pages on the SAME domain are the whole point
// (landing-page-health-score) — deduping by domain there would silently
// drop every page after the first one on a given site.
export function parseMultipleUrls(raw: string, max = 4, dedupeByPath = false): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of raw.split(/[,\n]/)) {
    const trimmed = piece.trim();
    if (!trimmed) continue;
    const normalized = trimmed.replace(/^https?:\/\//, "").replace(/^www\./, "").toLowerCase();
    const key = dedupeByPath ? normalized.replace(/\/+$/, "") : normalized.split("/")[0];
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
    if (out.length >= max) break;
  }
  return out;
}
