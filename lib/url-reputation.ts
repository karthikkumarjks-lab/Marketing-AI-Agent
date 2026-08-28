// Real, one-click links to security vendors' own free public reputation
// checkers — not an automated cross-vendor check. Verified before building:
// VirusTotal's free public API explicitly prohibits commercial use ("must
// not be used in commercial products or services... noncompliance will
// result in immediate permanent ban") and every other free reputation
// API found (Google Safe Browsing, Spamhaus, MXToolbox) carries the same
// non-commercial restriction or has zero free API quota. Since this app is
// meant to eventually be sold, automating against any of these would be a
// real ToS risk, not just a theoretical one — so this uses the same
// honest one-click-link pattern already established for ad-activity and
// blacklist checks in lib/domain-scan.ts, all URL formats verified live
// (2026-08-26) before shipping.

export interface ReputationCheckLink {
  platform: string;
  url: string;
  covers: string;
}

export function buildReputationCheckLinks(domain: string): ReputationCheckLink[] {
  const q = encodeURIComponent(domain);
  return [
    {
      platform: "Google Safe Browsing",
      url: `https://transparencyreport.google.com/safe-browsing/search?url=${q}`,
      covers: "Chrome, Firefox, Safari warning pages — the most common source of a visitor-facing block",
    },
    {
      platform: "Norton Safe Web",
      url: `https://safeweb.norton.com/report/show?url=${q}`,
      covers: "Norton/Symantec's own reputation database and browser extension warnings",
    },
    {
      platform: "VirusTotal",
      url: `https://www.virustotal.com/gui/domain/${q}`,
      covers: "Aggregated verdicts from 70+ antivirus engines and URL/domain blocklists in one view",
    },
    {
      platform: "McAfee Site Lookup",
      url: "https://sitelookup.mcafee.com/",
      covers: "McAfee WebAdvisor's reputation database — enter the URL manually (their lookup page blocks pre-filled automated links)",
    },
  ];
}
