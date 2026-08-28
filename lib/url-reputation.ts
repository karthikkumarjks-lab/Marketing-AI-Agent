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

/**
 * A genuinely different mechanism from the malware/phishing reputation
 * checks above: corporate web-filtering/content-control products (Bitdefender
 * GravityZone, Fortinet FortiGuard, Palo Alto Networks, Cisco Talos, ESET)
 * classify sites into CONTENT CATEGORIES (e.g. "Astrology", "Gambling",
 * "Dating") and organizations block categories per their own policy — this
 * has nothing to do with malware or phishing. Two very different situations
 * this produces links for: (1) a site owner whose site is being
 * miscategorized broadly across many organizations that use a given
 * vendor's product — the vendor links below let them request a review; (2)
 * someone hitting a block at their OWN workplace — that's an internal
 * policy decision only their own IT/security team can fix, no external
 * tool can see or change it (see the hard rule in the agent prompt).
 * All URLs verified live (2026-08-26): Palo Alto's lookup/change-request
 * tool and ESET's dedicated miscategorization form both confirmed working
 * with real query support; Cisco Talos's Reputation Center tool is real
 * but its lookup page blocks automated requests, so this links to the tool
 * itself rather than an unverified pre-filled deep link. FortiGuard was
 * checked and its entire site was returning server errors at verification
 * time — excluded rather than including a link confirmed broken.
 */
export function buildWebFilterCategoryLinks(domain: string): ReputationCheckLink[] {
  const q = encodeURIComponent(domain);
  return [
    {
      platform: "Palo Alto Networks URL Filtering",
      url: `https://urlfiltering.paloaltonetworks.com/query/?url=${q}`,
      covers: "Shows the category PAN-DB assigns this URL, with a request-change option if it's wrong",
    },
    {
      platform: "ESET Miscategorization Report",
      url: "https://int.form.eset.com/miscat/",
      covers: "ESET's dedicated form for reporting a wrongly-categorized site — enter the URL and the correct category",
    },
    {
      platform: "Cisco Talos Reputation Center",
      url: "https://talosintelligence.com/reputation_center",
      covers: "Look up this domain's category/reputation there directly (their lookup page blocks automated pre-filled links)",
    },
    {
      platform: "Bitdefender (business/GravityZone customers)",
      url: "https://www.bitdefender.com/business/support/en/77209-343057-submitting-sample-files-and-websites-for-analysis.html",
      covers: "Bitdefender's own guidance on submitting a site for category review — if the block is at YOUR OWN workplace, contact your own IT/security team first, since that's an internal policy decision only they can see or change",
    },
  ];
}
