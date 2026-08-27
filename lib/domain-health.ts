// Real domain-health checks — SSL certificate validity, SPF/DMARC email
// authentication, and a transparent composite health score built from these
// plus signals the rest of lib/domain-scan.ts already gathers.
//
// Deliberately NOT included: DNSBL-style blacklist checking. Verified
// directly (2026-08-26) that raw DNSBL lookups (the standard free
// mechanism, e.g. Spamhaus) get silently corrupted by this environment's
// corporate DNS resolver — a query against Spamhaus's own documented
// "always listed" test domain got redirected to what looks like a
// corporate proxy IP instead of a clean answer, which would make an
// automated check either falsely clear every domain or falsely flag every
// domain, depending on how it's coded — not a check worth shipping.
// Separately, every free blacklist/reputation API found (Spamhaus DQS,
// Google Safe Browsing) restricts free use to non-commercial purposes, and
// MXToolbox's own API docs show the free tier has ZERO network-lookup
// quota (their "free blacklist check" is the web tool, not the API). See
// buildBlacklistCheckLink() below for the honest alternative used instead —
// same one-click-external-tool pattern already used for ad-activity checks.

import { promises as dns } from "node:dns";
import * as tls from "node:tls";

const TLS_TIMEOUT_MS = 8000;

export interface SslInfo {
  valid: boolean;
  issuer: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysUntilExpiry: number | null;
  error: string | null;
}

export async function checkSsl(domain: string): Promise<SslInfo> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host: domain, port: 443, servername: domain, timeout: TLS_TIMEOUT_MS, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate();
        const authorized = socket.authorized;
        socket.end();
        if (!cert || Object.keys(cert).length === 0) {
          resolve({ valid: false, issuer: null, validFrom: null, validTo: null, daysUntilExpiry: null, error: "No certificate presented" });
          return;
        }
        const validTo = cert.valid_to ? new Date(cert.valid_to) : null;
        const daysUntilExpiry = validTo ? Math.round((validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
        const issuerField = cert.issuer?.O ?? cert.issuer?.CN ?? null;
        const issuer = Array.isArray(issuerField) ? (issuerField[0] ?? null) : issuerField;
        resolve({
          valid: authorized && (daysUntilExpiry ?? 0) > 0,
          issuer,
          validFrom: cert.valid_from ?? null,
          validTo: cert.valid_to ?? null,
          daysUntilExpiry,
          error: authorized ? null : (socket as unknown as { authorizationError?: string }).authorizationError ?? "Certificate not trusted",
        });
      },
    );
    socket.on("error", (err) => {
      resolve({ valid: false, issuer: null, validFrom: null, validTo: null, daysUntilExpiry: null, error: err.message });
    });
    socket.on("timeout", () => {
      socket.destroy();
      resolve({ valid: false, issuer: null, validFrom: null, validTo: null, daysUntilExpiry: null, error: "Connection timed out" });
    });
  });
}

export interface EmailAuthInfo {
  spf: { present: boolean; record: string | null };
  dmarc: { present: boolean; record: string | null; policy: string | null };
}

async function fetchTxtRecords(hostname: string): Promise<string[]> {
  try {
    const records = await dns.resolveTxt(hostname);
    return records.map((chunks) => chunks.join(""));
  } catch {
    return [];
  }
}

export async function checkEmailAuth(domain: string): Promise<EmailAuthInfo> {
  const [rootTxt, dmarcTxt] = await Promise.all([fetchTxtRecords(domain), fetchTxtRecords(`_dmarc.${domain}`)]);

  const spfRecord = rootTxt.find((r) => r.toLowerCase().startsWith("v=spf1")) ?? null;
  const dmarcRecord = dmarcTxt.find((r) => r.toLowerCase().startsWith("v=dmarc1")) ?? null;
  const policyMatch = dmarcRecord?.match(/p=(\w+)/i);

  return {
    spf: { present: !!spfRecord, record: spfRecord },
    dmarc: { present: !!dmarcRecord, record: dmarcRecord, policy: policyMatch ? policyMatch[1] : null },
  };
}

/**
 * A real, verifiable, one-click link to MXToolbox's own free blacklist
 * checker — not an automated result, since no genuinely free automated path
 * exists (see the file header). Same honesty pattern as the existing
 * one-click ad-activity links in lib/domain-scan.ts.
 */
export function buildBlacklistCheckLink(domain: string): string {
  return `https://mxtoolbox.com/SuperTool.aspx?action=blacklist%3a${encodeURIComponent(domain)}`;
}

export interface HealthScoreFactor {
  label: string;
  passed: boolean;
  points: number;
  maxPoints: number;
  detail: string;
}

export interface HealthScoreResult {
  score: number;
  maxScore: number;
  factors: HealthScoreFactor[];
}

/**
 * A transparent, explainable composite — every point is tied to a real,
 * disclosed check, never a mysterious single number. Weights reflect rough
 * real-world impact: a broken/insecure site (unreachable, no HTTPS) costs
 * more than a missing DMARC policy.
 */
export function computeHealthScore(input: {
  domainExists: boolean;
  websiteReachable: boolean;
  hasHttps: boolean;
  sslValid: boolean | null;
  sslDaysUntilExpiry: number | null;
  spfPresent: boolean;
  dmarcPresent: boolean;
  mobileResponsive: boolean | null;
  domainAgeYears: number | null;
}): HealthScoreResult {
  const factors: HealthScoreFactor[] = [];

  factors.push({
    label: "Domain resolves",
    passed: input.domainExists,
    points: input.domainExists ? 15 : 0,
    maxPoints: 15,
    detail: input.domainExists ? "DNS records found" : "No DNS records found — domain may not be registered or resolving",
  });

  factors.push({
    label: "Website reachable",
    passed: input.websiteReachable,
    points: input.websiteReachable ? 15 : 0,
    maxPoints: 15,
    detail: input.websiteReachable ? "Homepage responded" : "Homepage did not respond",
  });

  factors.push({
    label: "HTTPS enabled",
    passed: input.hasHttps,
    points: input.hasHttps ? 15 : 0,
    maxPoints: 15,
    detail: input.hasHttps ? "Site serves over HTTPS" : "Site does not serve over HTTPS",
  });

  const sslOk = input.sslValid === true;
  const sslExpiringSoon = input.sslDaysUntilExpiry != null && input.sslDaysUntilExpiry < 30 && input.sslDaysUntilExpiry >= 0;
  factors.push({
    label: "SSL certificate valid",
    passed: sslOk && !sslExpiringSoon,
    points: sslOk ? (sslExpiringSoon ? 8 : 15) : 0,
    maxPoints: 15,
    detail:
      input.sslValid === null
        ? "Not checked (site unreachable over HTTPS)"
        : sslOk
          ? sslExpiringSoon
            ? `Valid but expiring in ${input.sslDaysUntilExpiry} days — renew soon`
            : "Valid and trusted"
          : "Invalid, expired, or untrusted certificate",
  });

  factors.push({
    label: "SPF record present",
    passed: input.spfPresent,
    points: input.spfPresent ? 10 : 0,
    maxPoints: 10,
    detail: input.spfPresent ? "SPF record found" : "No SPF record — email sent from this domain is easier to spoof",
  });

  factors.push({
    label: "DMARC record present",
    passed: input.dmarcPresent,
    points: input.dmarcPresent ? 10 : 0,
    maxPoints: 10,
    detail: input.dmarcPresent ? "DMARC record found" : "No DMARC record — no policy for handling spoofed mail from this domain",
  });

  factors.push({
    label: "Mobile-friendly signal",
    passed: input.mobileResponsive === true,
    points: input.mobileResponsive === true ? 10 : 0,
    maxPoints: 10,
    detail:
      input.mobileResponsive === null
        ? "Not checked (site unreachable)"
        : input.mobileResponsive
          ? "Viewport tag configured for device width"
          : "No responsive viewport tag detected",
  });

  factors.push({
    label: "Established domain age",
    passed: (input.domainAgeYears ?? 0) >= 1,
    points: input.domainAgeYears == null ? 5 : Math.min(10, input.domainAgeYears >= 1 ? 10 : 5),
    maxPoints: 10,
    detail:
      input.domainAgeYears == null
        ? "Registration date unavailable — scored as neutral"
        : `${input.domainAgeYears} years since registration`,
  });

  const score = factors.reduce((sum, f) => sum + f.points, 0);
  const maxScore = factors.reduce((sum, f) => sum + f.maxPoints, 0);
  return { score, maxScore, factors };
}
