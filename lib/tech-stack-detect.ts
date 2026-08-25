// Real, signature-based technology detection from a fetched page's HTML and
// response headers — the same honest approach used for chatbot detection in
// lib/domain-scan.ts, extended to cover CMS/framework/analytics/forms.
// Not a Wappalyzer replacement (their fingerprint database runs into the
// thousands and their API costs $250+/month with no free tier — checked
// before building this, not assumed) — a much smaller, free, real set of
// signatures covering the categories a marketing agent actually needs.

export interface TechMatch {
  category: string;
  name: string;
}

interface Signature {
  category: string;
  name: string;
  bodyNeedle?: string;
  headerName?: string;
  headerNeedle?: string;
}

const SIGNATURES: Signature[] = [
  { category: "CMS", name: "WordPress", bodyNeedle: "wp-content" },
  { category: "CMS", name: "Shopify", bodyNeedle: "cdn.shopify.com" },
  { category: "CMS", name: "Wix", bodyNeedle: "static.wixstatic.com" },
  { category: "CMS", name: "Webflow", bodyNeedle: "assets.website-files.com" },
  { category: "CMS", name: "Squarespace", bodyNeedle: "static1.squarespace.com" },
  { category: "CMS", name: "HubSpot CMS", bodyNeedle: "hs-scripts.com" },
  { category: "Framework", name: "Next.js", bodyNeedle: "/_next/static" },
  { category: "Framework", name: "Gatsby", bodyNeedle: "gatsby-announcer" },
  { category: "Framework", name: "Nuxt / Vue", bodyNeedle: "__nuxt" },
  { category: "Analytics", name: "Google Tag Manager", bodyNeedle: "googletagmanager.com/gtm.js" },
  { category: "Analytics", name: "Google Analytics (gtag)", bodyNeedle: "googletagmanager.com/gtag/js" },
  { category: "Analytics", name: "Meta Pixel", bodyNeedle: "connect.facebook.net" },
  { category: "Analytics", name: "Hotjar", bodyNeedle: "static.hotjar.com" },
  { category: "Analytics", name: "Microsoft Clarity", bodyNeedle: "clarity.ms" },
  { category: "Forms / Email", name: "HubSpot Forms", bodyNeedle: "js.hsforms.net" },
  { category: "Forms / Email", name: "Mailchimp", bodyNeedle: "list-manage.com" },
  { category: "Forms / Email", name: "Klaviyo", bodyNeedle: "static.klaviyo.com" },
  { category: "CDN / Hosting", name: "Cloudflare", headerName: "server", headerNeedle: "cloudflare" },
  { category: "CDN / Hosting", name: "Vercel", headerName: "x-vercel-id" },
  { category: "CDN / Hosting", name: "Netlify", headerName: "x-nf-request-id" },
];

export function detectTechStack(html: string, headers: Headers): TechMatch[] {
  const lowerHtml = html.toLowerCase();
  const matches: TechMatch[] = [];
  for (const sig of SIGNATURES) {
    if (sig.bodyNeedle && lowerHtml.includes(sig.bodyNeedle.toLowerCase())) {
      matches.push({ category: sig.category, name: sig.name });
      continue;
    }
    if (sig.headerName) {
      const value = headers.get(sig.headerName);
      if (value && (!sig.headerNeedle || value.toLowerCase().includes(sig.headerNeedle.toLowerCase()))) {
        matches.push({ category: sig.category, name: sig.name });
      }
    }
  }
  return matches;
}
