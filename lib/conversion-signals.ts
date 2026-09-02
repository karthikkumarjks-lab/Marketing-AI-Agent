// Real, on-page conversion-readiness signals extracted from a site's actual
// HTML — title/meta/H1, CTA density, form presence, trust-signal keyword
// hits, and word count. Built for the Market Research Agent's "why aren't we
// converting, and how do we compare to named competitors" ask: every field
// here comes from parsing real fetched HTML, never an LLM guess. Reuses
// domain-scan.ts's existing mobile/chatbot/phone/social detectors rather
// than re-implementing them — same signature-matching approach, just a
// different lens (marketing/CRO, not technical/security).

import { checkMobile, checkChatbot, checkPhone, checkSocial, type MobileSignal, type ChatbotDetection, type PhoneFinding, type SocialLink } from "./domain-scan";

export interface ConversionSignals {
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  ctaCount: number;
  ctaSamples: string[];
  formCount: number;
  trustSignalHits: string[];
  wordCount: number;
  mobile: MobileSignal;
  chatbot: ChatbotDetection;
  phone: PhoneFinding;
  social: SocialLink[];
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
}

// Action verbs/phrases that mark a link or button as a real conversion
// prompt, not ordinary nav ("About", "Blog"). Kept deliberately short and
// high-precision — a broader list starts matching nav/footer chrome.
const CTA_WORDS = [
  "apply now", "apply", "enroll", "enquire", "enquiry", "inquire", "inquiry", "get started",
  "sign up", "signup", "register", "book a", "book now", "request a call", "request info",
  "download brochure", "download", "talk to", "speak to", "contact us", "get a quote",
  "schedule a", "free consultation", "start your", "learn more", "join now",
];

const TRUST_KEYWORDS = [
  "testimonial", "review", "rating", "accredited", "accreditation", "naac", "ugc",
  "aicte", "nirf", "ranked", "ranking", "placement", "alumni", "certified",
  "award", "recognized", "recognised", "trusted by", "partner", "case stud",
];

export function extractConversionSignals(html: string): ConversionSignals {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const cleanTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const ctaLinks = [...html.matchAll(/<(?:a|button)\b[^>]*>([\s\S]*?)<\/(?:a|button)>/gi)]
    .map((m) => cleanTags(m[1]))
    .filter((text) => text.length > 0 && text.length < 60);
  const ctaMatches = ctaLinks.filter((text) => {
    const lower = text.toLowerCase();
    return CTA_WORDS.some((w) => lower.includes(w));
  });

  const formCount = (html.match(/<form\b/gi) ?? []).length;

  const visibleText = stripTags(html);
  const lowerVisible = visibleText.toLowerCase();
  const trustSignalHits = [...new Set(TRUST_KEYWORDS.filter((k) => lowerVisible.includes(k)))];

  const bodyText = cleanTags(visibleText);
  const wordCount = bodyText.length > 0 ? bodyText.split(/\s+/).filter(Boolean).length : 0;

  return {
    title: titleMatch ? cleanTags(titleMatch[1]) || null : null,
    metaDescription: descMatch ? descMatch[1].trim() || null : null,
    h1: h1Match ? cleanTags(h1Match[1]) || null : null,
    ctaCount: ctaMatches.length,
    ctaSamples: [...new Set(ctaMatches)].slice(0, 8),
    formCount,
    trustSignalHits,
    wordCount,
    mobile: checkMobile(html),
    chatbot: checkChatbot(html),
    phone: checkPhone(html),
    social: checkSocial(html),
  };
}

/**
 * A transparent, explainable "Conversion Readiness Score" out of 100 built
 * only from real on-page signals above — NOT a measured conversion rate
 * (nobody outside a site's own analytics can know that). Every point is
 * traceable to one real signal so the score can be argued with, not a black
 * box. Used to compare the client's site against named competitors on a
 * like-for-like, defensible basis — never presented as "their actual
 * conversion %".
 */
export function scoreConversionReadiness(s: ConversionSignals, loadTimeMs: number | null): { score: number; breakdown: { label: string; points: number; max: number }[] } {
  const breakdown = [
    { label: "Has a clear CTA on the page", points: s.ctaCount > 0 ? 15 : 0, max: 15 },
    { label: "Multiple distinct CTA prompts (not just one)", points: s.ctaCount >= 3 ? 10 : 0, max: 10 },
    { label: "Has a lead-capture form", points: s.formCount > 0 ? 15 : 0, max: 15 },
    { label: "Mobile-responsive (viewport configured)", points: s.mobile.likelyResponsive ? 15 : 0, max: 15 },
    { label: "Live chat / chatbot present", points: s.chatbot.detected ? 10 : 0, max: 10 },
    { label: "Phone number published", points: s.phone.numbers.length > 0 ? 5 : 0, max: 5 },
    { label: "At least one trust signal (accreditation, ranking, reviews, placements)", points: s.trustSignalHits.length > 0 ? 10 : 0, max: 10 },
    { label: "Multiple trust signals (3+)", points: s.trustSignalHits.length >= 3 ? 5 : 0, max: 5 },
    { label: "Has a real page title", points: s.title ? 5 : 0, max: 5 },
    { label: "Loads in under 3s", points: loadTimeMs !== null && loadTimeMs < 3000 ? 10 : 0, max: 10 },
  ];
  const score = breakdown.reduce((sum, b) => sum + b.points, 0);
  return { score, breakdown };
}
