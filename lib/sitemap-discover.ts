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

// Raised from 50 after a real site (onlinemanipal.com, 2026-08-26) turned
// out to have 144 real program/landing pages once sitemap discovery was
// fixed (see below) — 50 was truncating a genuinely common case for a
// multi-program education client, not a rare edge case.
const MAX_PAGES = 150;
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

/**
 * robots.txt's declared `Sitemap:` line is the standard, most authoritative
 * way to find a site's real sitemap URL — more reliable than guessing
 * `/sitemap.xml`. Found necessary via a real site (onlinemanipal.com,
 * 2026-08-26) whose bare-domain `/sitemap.xml` returned a 200 OK HTML page
 * (served by a caching layer, not a real sitemap) while the real sitemap
 * only worked at the `www.` host — its own robots.txt correctly named that
 * exact URL (`Sitemap: https://www.onlinemanipal.com/sitemap_index.xml`).
 */
async function getDeclaredSitemapUrls(domain: string): Promise<string[]> {
  for (const host of [domain, `www.${domain}`]) {
    for (const scheme of ["https", "http"]) {
      const robots = await fetchText(`${scheme}://${host}/robots.txt`);
      if (!robots) continue;
      const urls = [...robots.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]);
      if (urls.length > 0) return urls;
    }
  }
  return [];
}

async function fetchFirstValidSitemap(candidateUrls: string[]): Promise<{ xml: string; url: string } | null> {
  for (const url of candidateUrls) {
    const xml = await fetchText(url);
    if (xml && extractLocs(xml).length > 0) return { xml, url };
  }
  return null;
}

export async function discoverSubpages(domain: string, homepageHtml: string | null): Promise<SitemapResult> {
  // Try robots.txt's declared sitemap(s) first, then fall back to guessing
  // the conventional /sitemap.xml path on both the bare domain and its
  // www. variant — a bare-domain guess alone missed real sitemaps that only
  // resolve correctly under www. (or vice versa) on some hosting setups.
  const declared = await getDeclaredSitemapUrls(domain);
  const guessed = ["https", "http"].flatMap((scheme) => [
    `${scheme}://${domain}/sitemap.xml`,
    `${scheme}://www.${domain}/sitemap.xml`,
  ]);
  const found = await fetchFirstValidSitemap([...declared, ...guessed]);

  if (found) {
    const locs = extractLocs(found.xml);

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
