// Real, live technical checks against a domain — DNS, website reachability,
// mobile-friendliness signal, social links, chatbot widget, phone numbers.
// This is a genuinely different kind of thing from every other agent in
// this codebase: it performs real network I/O (DNS lookups, an HTTP fetch)
// rather than reasoning from category knowledge via an LLM. Kept separate
// from the Agent Contract pattern for that reason — see the Domain Scan
// page/route, not lib/agent-contract.ts.
//
// Deliberately NOT checked (by design, confirmed with the product owner):
// live ad activity (Meta/Google ad-library checks need API credentials this
// system doesn't have — use the Competitor Ad Intelligence agent for a
// category-level LLM guess instead) and true rendered mobile/desktop
// screenshots (would need a headless browser — this uses the viewport-tag
// heuristic instead, which is honest about being a signal, not a photo).

import { promises as dns } from "node:dns";

export interface DnsRecords {
  a: string[];
  mx: string[];
  ns: string[];
  txt: string[][];
}

export interface WebsiteCheck {
  reachable: boolean;
  url: string | null;
  statusCode: number | null;
  https: boolean;
  loadTimeMs: number | null;
  error: string | null;
}

export interface MobileSignal {
  hasViewportMeta: boolean;
  viewportContent: string | null;
  likelyResponsive: boolean;
}

export interface SocialLink {
  platform: string;
  url: string;
}

export interface ChatbotDetection {
  detected: boolean;
  providers: string[];
}

export interface PhoneFinding {
  numbers: string[];
  source: "tel-link" | "page-text" | "none";
}

export interface AdLibraryLink {
  platform: string;
  url: string;
  covers: string;
}

export interface DomainScanResult {
  domain: string;
  scannedAt: string;
  domainExists: boolean;
  dns: DnsRecords;
  website: WebsiteCheck;
  mobile: MobileSignal | null;
  social: SocialLink[];
  chatbot: ChatbotDetection | null;
  phone: PhoneFinding | null;
  adLibraryLinks: AdLibraryLink[];
  notes: string[];
}

/**
 * One-click links into each platform's own public, no-login ad transparency
 * tool — not a live check. No platform offers a free, reliable way to
 * programmatically confirm commercial ad activity today: Meta's API
 * explicitly excludes commercial ads even after identity verification,
 * Google has no official API for this at all (only paid third-party
 * scrapers), and LinkedIn's official API is gated under the EU's DSA
 * transparency regime, not self-serve. Confirmed by research 2026-08-25.
 */
function buildAdLibraryLinks(domain: string): AdLibraryLink[] {
  const q = encodeURIComponent(domain);
  return [
    {
      platform: "Meta (Facebook + Instagram)",
      url: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=${q}&search_type=keyword_unordered&media_type=all`,
      covers: "Facebook, Instagram, Audience Network, Threads",
    },
    {
      platform: "Google Ads Transparency Center",
      url: `https://adstransparency.google.com/?region=anywhere&domain=${q}`,
      covers: "Search, Discovery, YouTube, Display, App campaigns — all one tool",
    },
    {
      platform: "LinkedIn Ad Library",
      url: `https://www.linkedin.com/ad-library/search?keyword=${q}`,
      covers: "LinkedIn Ads",
    },
  ];
}

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 500_000;

function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "");
  d = d.replace(/^www\./, "");
  d = d.split("/")[0].split("?")[0].split("#")[0];
  return d;
}

async function safeResolve<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch {
    return fallback;
  }
}

async function fetchDns(domain: string): Promise<DnsRecords> {
  const [a, mx, ns, txt] = await Promise.all([
    safeResolve(() => dns.resolve4(domain), [] as string[]),
    safeResolve(
      () => dns.resolveMx(domain).then((r) => r.sort((x, y) => x.priority - y.priority).map((r) => r.exchange)),
      [] as string[],
    ),
    safeResolve(() => dns.resolveNs(domain), [] as string[]),
    safeResolve(() => dns.resolveTxt(domain), [] as string[][]),
  ]);
  return { a, mx, ns, txt };
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "user-agent": "Mozilla/5.0 (compatible; MarketingAutopilotDomainScan/1.0)" },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function checkWebsite(domain: string): Promise<{ check: WebsiteCheck; html: string | null }> {
  for (const scheme of ["https", "http"]) {
    const url = `${scheme}://${domain}`;
    const start = Date.now();
    try {
      const res = await fetchWithTimeout(url);
      const loadTimeMs = Date.now() - start;
      const reader = res.body?.getReader();
      let html = "";
      if (reader) {
        const decoder = new TextDecoder();
        let bytes = 0;
        while (bytes < MAX_HTML_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          html += decoder.decode(value, { stream: true });
        }
        reader.cancel().catch(() => {});
      }
      return {
        check: {
          reachable: res.ok,
          url,
          statusCode: res.status,
          https: scheme === "https",
          loadTimeMs,
          error: res.ok ? null : `HTTP ${res.status}`,
        },
        html: html || null,
      };
    } catch (err) {
      if (scheme === "http") {
        return {
          check: {
            reachable: false,
            url: null,
            statusCode: null,
            https: false,
            loadTimeMs: null,
            error: err instanceof Error ? err.message : "Unreachable",
          },
          html: null,
        };
      }
      // https failed, fall through to try http
    }
  }
  return {
    check: { reachable: false, url: null, statusCode: null, https: false, loadTimeMs: null, error: "Unreachable" },
    html: null,
  };
}

function checkMobile(html: string): MobileSignal {
  const match = html.match(/<meta[^>]+name=["']viewport["'][^>]*>/i);
  if (!match) return { hasViewportMeta: false, viewportContent: null, likelyResponsive: false };
  const contentMatch = match[0].match(/content=["']([^"']+)["']/i);
  const content = contentMatch ? contentMatch[1] : null;
  const likelyResponsive = !!content && /width\s*=\s*device-width/i.test(content);
  return { hasViewportMeta: true, viewportContent: content, likelyResponsive };
}

const SOCIAL_PATTERNS: { platform: string; re: RegExp }[] = [
  { platform: "Instagram", re: /https?:\/\/(www\.)?instagram\.com\/[^\s"'<>]+/i },
  { platform: "Facebook", re: /https?:\/\/(www\.)?facebook\.com\/[^\s"'<>]+/i },
  { platform: "LinkedIn", re: /https?:\/\/(www\.)?linkedin\.com\/(company|in|showcase)\/[^\s"'<>]+/i },
  { platform: "X / Twitter", re: /https?:\/\/(www\.)?(x|twitter)\.com\/[^\s"'<>]+/i },
  { platform: "YouTube", re: /https?:\/\/(www\.)?youtube\.com\/(channel|c|@)[^\s"'<>]+/i },
  { platform: "TikTok", re: /https?:\/\/(www\.)?tiktok\.com\/@[^\s"'<>]+/i },
];

function checkSocial(html: string): SocialLink[] {
  const found: SocialLink[] = [];
  for (const { platform, re } of SOCIAL_PATTERNS) {
    const match = html.match(re);
    if (match) found.push({ platform, url: match[0].replace(/["'<>]+$/, "") });
  }
  return found;
}

const CHATBOT_SIGNATURES: { provider: string; needle: string }[] = [
  { provider: "Intercom", needle: "widget.intercom.io" },
  { provider: "Drift", needle: "js.driftt.com" },
  { provider: "Tidio", needle: "code.tidio.co" },
  { provider: "Tawk.to", needle: "embed.tawk.to" },
  { provider: "HubSpot Chat", needle: "js.hs-scripts.com" },
  { provider: "Crisp", needle: "client.crisp.chat" },
  { provider: "Zendesk Chat", needle: "static.zdassets.com" },
  { provider: "LiveChat", needle: "cdn.livechatinc.com" },
  { provider: "Freshchat", needle: "wchat.freshchat.com" },
  { provider: "WhatsApp Click-to-Chat", needle: "wa.me/" },
];

function checkChatbot(html: string): ChatbotDetection {
  const lower = html.toLowerCase();
  const providers = CHATBOT_SIGNATURES.filter((s) => lower.includes(s.needle.toLowerCase())).map((s) => s.provider);
  return { detected: providers.length > 0, providers };
}

/**
 * Strips <script>/<style>/comment/<svg> content so text-based checks don't
 * match against embedded JSON, bundled JS, minified CSS, or inline SVG icon
 * path data. The last one is the real source of false positives found while
 * testing this against stripe.com — SVG `<path d="...">` curve coordinates
 * ("5.6409 7.6037Zm-.959...") are dense runs of digits and dots that a loose
 * phone-number regex will happily mistake for a phone number.
 */
function visibleTextOnly(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

function checkPhone(html: string): PhoneFinding {
  // tel: links live in markup attributes, not script/style content, so the
  // full HTML is fine here — and they're the reliable signal (an actual
  // clickable phone link), so they're checked before the noisy fallback.
  const telLinks = [...html.matchAll(/href=["']tel:([^"']+)["']/gi)].map((m) => m[1].trim());
  if (telLinks.length > 0) {
    return { numbers: [...new Set(telLinks)].slice(0, 5), source: "tel-link" };
  }
  // Loose fallback: displayed numbers in visible text only — still noisy,
  // so only used when no tel: link exists, filtered to a plausible phone
  // digit count (7-15), and capped to avoid false-positive floods.
  const visible = visibleTextOnly(html);
  const textMatches = [...visible.matchAll(/(?:\+\d{1,3}[\s.-]?)?\(?\d{2,4}\)?[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g)]
    .map((m) => m[0].trim())
    .filter((m) => {
      const digitCount = m.replace(/\D/g, "").length;
      return digitCount >= 7 && digitCount <= 15;
    });
  const deduped = [...new Set(textMatches)].slice(0, 5);
  if (deduped.length > 0) return { numbers: deduped, source: "page-text" };
  return { numbers: [], source: "none" };
}

export async function scanDomain(rawInput: string): Promise<DomainScanResult> {
  const domain = normalizeDomain(rawInput);
  const notes: string[] = [
    "Ad activity isn't checked live — no platform offers a free, reliable API for this. The links below open each platform's own public ad-transparency search, pre-filled with this domain, in one click.",
    "Mobile-friendliness is a signal (viewport tag present + configured for device width), not a rendered screenshot.",
  ];
  const adLibraryLinks = buildAdLibraryLinks(domain);

  const dnsRecords = await fetchDns(domain);
  const domainExists = dnsRecords.a.length > 0 || dnsRecords.ns.length > 0 || dnsRecords.mx.length > 0;

  if (!domainExists) {
    notes.push("DNS found no A, NS, or MX records — this domain may not be registered or may not be resolving right now.");
    return {
      domain,
      scannedAt: new Date().toISOString(),
      domainExists: false,
      dns: dnsRecords,
      website: { reachable: false, url: null, statusCode: null, https: false, loadTimeMs: null, error: "Domain does not resolve" },
      mobile: null,
      social: [],
      chatbot: null,
      phone: null,
      adLibraryLinks,
      notes,
    };
  }

  const { check: website, html } = await checkWebsite(domain);

  if (!html) {
    if (website.reachable) notes.push("Website responded but returned no readable HTML content.");
    else notes.push("Website did not respond — mobile, social, chatbot, and phone checks were skipped.");
    return {
      domain,
      scannedAt: new Date().toISOString(),
      domainExists: true,
      dns: dnsRecords,
      website,
      mobile: null,
      social: [],
      chatbot: null,
      phone: null,
      adLibraryLinks,
      notes,
    };
  }

  const chatbot = checkChatbot(html);
  if (!chatbot.detected) {
    notes.push(
      "No chatbot widget detected in the initial page HTML — but many sites load their widget via a bundled or dynamically-injected script a static fetch can't see, so this isn't proof one doesn't exist. Treat 'not detected' as inconclusive, not a confirmed no.",
    );
  }
  const phone = checkPhone(html);
  if (phone.numbers.length === 0) {
    notes.push("No phone number found on this page — it may only be on a different page, behind a click-to-call button rendered by JavaScript, or genuinely not published.");
  }

  return {
    domain,
    scannedAt: new Date().toISOString(),
    domainExists: true,
    dns: dnsRecords,
    website,
    mobile: checkMobile(html),
    social: checkSocial(html),
    chatbot,
    phone,
    adLibraryLinks,
    notes,
  };
}
