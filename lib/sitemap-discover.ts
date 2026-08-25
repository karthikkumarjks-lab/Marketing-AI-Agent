// Discovers real subpages for a domain: tries sitemap.xml first (the
// standard, publicly available file most sites publish), falls back to
// extracting internal links from the homepage HTML if no sitemap exists or
// it fails to parse. Real URLs read from the site, not guessed.

export interface SitemapResult {
  pages: string[];
  source: "sitemap" | "homepage-links" | "none";
  isSitemapIndex: boolean;
  truncated: boolean;
}

const MAX_PAGES = 50;
const FETCH_TIMEOUT_MS = 8000;

async function fetchText(url: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; MarketingAutopilotDomainScan/1.0)" },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function extractInternalLinks(html: string, domain: string): string[] {
  const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((m) => m[1]);
  const internal = new Set<string>();
  for (const href of hrefs) {
    if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
    let resolved: URL;
    try {
      resolved = new URL(href, `https://${domain}`);
    } catch {
      continue;
    }
    if (resolved.hostname.replace(/^www\./, "") !== domain.replace(/^www\./, "")) continue;
    internal.add(resolved.origin + resolved.pathname);
  }
  return [...internal];
}

function extractLocs(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
}

export async function discoverSubpages(domain: string, homepageHtml: string | null): Promise<SitemapResult> {
  for (const scheme of ["https", "http"]) {
    const xml = await fetchText(`${scheme}://${domain}/sitemap.xml`);
    if (!xml) continue;
    const locs = extractLocs(xml);
    if (locs.length === 0) continue;

    const isSitemapIndex = locs.every((l) => l.toLowerCase().endsWith(".xml"));
    if (!isSitemapIndex) {
      return { pages: locs.slice(0, MAX_PAGES), source: "sitemap", isSitemapIndex: false, truncated: locs.length > MAX_PAGES };
    }

    // One level of index-following: a sitemap index lists other sitemaps,
    // not actual pages — fetch the one most likely to hold real page URLs
    // (prefer a name containing "page", else the first entry) so the
    // result is genuine page URLs, not a list of index files. Capped at
    // one hop deliberately — if that sub-sitemap is itself an index (rare),
    // report it as one rather than recursing indefinitely.
    const preferred = locs.find((l) => /page/i.test(l)) ?? locs[0];
    const subXml = await fetchText(preferred);
    if (subXml) {
      const subLocs = extractLocs(subXml);
      if (subLocs.length > 0) {
        const subIsIndex = subLocs.every((l) => l.toLowerCase().endsWith(".xml"));
        return {
          pages: subLocs.slice(0, MAX_PAGES),
          source: "sitemap",
          isSitemapIndex: subIsIndex,
          truncated: subLocs.length > MAX_PAGES,
        };
      }
    }
    // Sub-sitemap fetch failed or was empty — fall back to reporting the
    // index itself rather than losing the finding entirely.
    return { pages: locs.slice(0, MAX_PAGES), source: "sitemap", isSitemapIndex: true, truncated: locs.length > MAX_PAGES };
  }

  if (homepageHtml) {
    const links = extractInternalLinks(homepageHtml, domain);
    return {
      pages: links.slice(0, MAX_PAGES),
      source: links.length > 0 ? "homepage-links" : "none",
      isSitemapIndex: false,
      truncated: links.length > MAX_PAGES,
    };
  }

  return { pages: [], source: "none", isSitemapIndex: false, truncated: false };
}
