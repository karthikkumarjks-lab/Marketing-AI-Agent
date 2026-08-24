// Rule-based Needs Analyzer — decides which agents should be active vs idle
// for a given client. Pure functions, no I/O, safe to call from anywhere.
// Currency- and industry-agnostic: works the same for a Bangalore dental
// clinic in INR or a Toronto SaaS company in CAD.

import { formatMoney, paidViableThreshold } from "./currency";

export type RecommendedStatus = "active" | "idle";
export type NeedTier = "mandatory" | "conditional" | "idle";

export interface NeedRecommendation {
  agentKey: string;
  status: RecommendedStatus;
  tier: NeedTier;
  reason: string;
  /** The specific DNA facts behind this call — currently one entry (the reason itself), formalized as a list per the Needs Analyzer upgrade rather than left as bare prose. */
  evidence: string[];
  /** What DNA change would flip an idle agent to active. Undefined for active agents. */
  reactivationTrigger?: string;
}

// Agents that are always active regardless of DNA specifics — the strategic
// core every engagement needs, as opposed to "conditional" agents that are
// active only because a specific DNA fact triggered them.
const MANDATORY_KEYS = new Set(["marketing-strategy", "market-research", "needs-analyzer"]);

// Idle reasons already say things like "revisit once the first customers are
// acquired" or "hold until Performance Marketing confirms spend readiness" —
// extract that clause as a structured reactivation trigger instead of making
// the UI re-parse prose.
function extractReactivationTrigger(reason: string): string {
  const match = reason.match(/(?:revisit|activate|hold until|once)\s+(.+)$/i);
  if (match) return match[0].replace(/^./, (c) => c.toUpperCase());
  return "Revisit when the Company DNA changes materially — new budget, website, channels, or objective.";
}

export interface WorkspaceDNA {
  industry?: string | null;
  objective?: string | null;
  monthlyBudget?: number | null;
  currency?: string | null;
  country?: string | null;
  websiteUrl?: string | null;
  icpNotes?: string | null;
  currentChannels?: string | null;
  marketingAssets?: string | null;
}

const has = (s: string | null | undefined) => !!s && s.trim().length > 0;

const mentions = (s: string | null | undefined, words: string[]) => {
  const t = (s ?? "").toLowerCase();
  return words.some((w) => t.includes(w));
};

const ORGANIC_WORDS = ["organic", "seo", "content", "blog", "inbound", "search rank"];
const PAID_WORDS = ["lead", "appointment", "sale", "revenue", "paid", "ads", "acquisition", "sign-up", "signup", "booking", "enquiry", "inquiry", "customer"];
const VIDEO_WORDS = ["video", "youtube", "reels", "shorts"];
const B2B_WORDS = ["b2b", "saas", "enterprise", "software", "agency", "consulting", "b2b saas"];
const MESSAGING_WORDS = ["whatsapp", "sms", "messaging", "chat", "booking", "appointment"];

export function analyzeNeeds(dna: WorkspaceDNA, agentKeys: string[]): NeedRecommendation[] {
  const website = has(dna.websiteUrl);
  const budget = dna.monthlyBudget ?? 0;
  const currency = dna.currency ?? "USD";
  const threshold = paidViableThreshold(currency);
  const money = (n: number) => formatMoney(n, currency);
  const organicObjective = mentions(dna.objective, ORGANIC_WORDS);
  const paidObjective = mentions(dna.objective, PAID_WORDS);
  const hasAssets = has(dna.marketingAssets);
  const hasChannels = has(dna.currentChannels);
  const icpThin = !has(dna.icpNotes) || (dna.icpNotes ?? "").trim().length < 40;
  const paidViable = budget >= threshold && !organicObjective;
  const paidActive = paidViable && (paidObjective || !organicObjective);

  const rules: Record<string, { status: RecommendedStatus; reason: string }> = {
    "marketing-strategy": {
      status: "active",
      reason: "Every engagement starts here — the 90-day strategy anchors all other agents.",
    },
    "market-research": {
      status: "active",
      reason: "Baseline market and competitor landscape is needed before committing budget.",
    },
    "icp-intelligence": icpThin
      ? { status: "active", reason: "ICP notes are thin or missing — sharpen the customer profile before campaigns." }
      : { status: "idle", reason: "ICP notes already look substantive; revisit after the first campaign cycle." },
    "competitive-intelligence": {
      status: "active",
      reason: "Positioning gaps are cheapest to exploit early, before spend begins.",
    },
    "needs-analyzer": {
      status: "active",
      reason: "Keeps this activation plan current as the Company DNA changes.",
    },
    "marketing-orchestrator": {
      status: "idle",
      reason: "Worth activating once the core strategy stack is producing outputs to sequence.",
    },
    "marketing-opportunity": {
      status: "idle",
      reason: "Run after the first strategy cycle, when there is baseline data to scan.",
    },
    "budget-investment": budget > 0
      ? { status: "active", reason: `A ${money(budget)}/month budget is set — allocation guidance applies immediately.` }
      : { status: "idle", reason: "No monthly budget recorded yet." },
    "seo-strategy": website
      ? { status: "active", reason: "A website exists — organic search can compound from month one." }
      : { status: "idle", reason: "No website on record; SEO has nothing to rank until one exists." },
    "technical-seo": website
      ? { status: "active", reason: "Audit the existing site's health before scaling content or paid traffic to it." }
      : { status: "idle", reason: "Requires a live website to audit." },
    "performance-marketing": organicObjective
      ? { status: "idle", reason: "Objective is organic-led — paid media stays idle for now." }
      : budget < threshold
        ? { status: "idle", reason: `${money(budget)}/month is too thin to split across paid channels profitably.` }
        : { status: "active", reason: `${money(budget)}/month can support a focused paid test — get a spend-readiness verdict first.` },
    "google-ads": organicObjective
      ? { status: "idle", reason: "Objective is organic traffic — paid search stays idle." }
      : paidActive
        ? { status: "idle", reason: "Hold until Performance Marketing Strategy confirms spend readiness and split." }
        : { status: "idle", reason: "Paid search is not viable at the current budget or objective." },
    "meta-ads": organicObjective
      ? { status: "idle", reason: "Objective is organic traffic — paid social stays idle." }
      : paidActive
        ? { status: "idle", reason: "Hold until Performance Marketing Strategy confirms spend readiness and split." }
        : { status: "idle", reason: "Paid social is not viable at the current budget or objective." },
    "content-strategy": organicObjective || !paidViable
      ? {
          status: "active",
          reason: organicObjective
            ? "Objective is organic-led — content is the primary growth engine."
            : "With limited paid budget, content is the most capital-efficient channel.",
        }
      : { status: "idle", reason: "Paid-led objective; content planning follows the campaign strategy." },
    "content-creation": { status: "idle", reason: "Activate after Content Strategy sets the editorial calendar." },
    "content-repurposing": hasAssets
      ? { status: "active", reason: "Existing marketing assets can be repurposed for cheap reach immediately." }
      : { status: "idle", reason: "No existing content assets to repurpose yet." },
    "brand-creative-strategy": hasAssets
      ? { status: "idle", reason: "Brand assets exist; revisit if positioning feels off after research." }
      : { status: "active", reason: "No brand assets listed — define voice and positioning before producing content." },
    design: { status: "idle", reason: "Activate when campaign or content production actually begins." },
    "video-marketing": mentions(dna.currentChannels, VIDEO_WORDS) || mentions(dna.marketingAssets, VIDEO_WORDS)
      ? { status: "active", reason: "Video is already in the channel mix — plan it deliberately." }
      : { status: "idle", reason: "No video presence or mandate yet." },
    "website-builder": website
      ? { status: "idle", reason: "A website already exists." }
      : { status: "active", reason: "No website mentioned — the client needs a web presence before traffic programs." },
    "landing-page": paidActive
      ? { status: "active", reason: "Paid traffic converts poorly on generic pages — dedicated landing pages are required." }
      : { status: "idle", reason: "No paid traffic planned yet." },
    cro: website && hasChannels
      ? { status: "active", reason: "Existing traffic can be converted better before buying more of it." }
      : { status: "idle", reason: "Needs meaningful traffic before conversion work pays off." },
    "lead-behaviour": hasChannels
      ? { status: "active", reason: "Leads already flow through current channels — analyze where they drop." }
      : { status: "idle", reason: "No lead flow to analyze yet." },
    "marketing-analytics": budget > 0 || hasChannels
      ? { status: "active", reason: "Spend or traffic exists — it must be measured from day one." }
      : { status: "idle", reason: "Nothing to measure until activity begins." },
    "marketing-score": {
      status: "idle",
      reason: "Activates once agent runs have predicted and actual outcomes to evaluate.",
    },
    "linkedin-ads": organicObjective
      ? { status: "idle", reason: "Objective is organic-led — paid social stays idle." }
      : mentions(dna.industry, B2B_WORDS) || mentions(dna.objective, B2B_WORDS)
        ? { status: "idle", reason: "B2B-shaped ICP noted — hold until Performance Marketing confirms spend readiness and split." }
        : { status: "idle", reason: "No B2B signal in industry/objective — LinkedIn's CPCs aren't worth it for this ICP yet." },
    "tiktok-ads": organicObjective
      ? { status: "idle", reason: "Objective is organic-led — paid social stays idle." }
      : mentions(dna.currentChannels, VIDEO_WORDS) || mentions(dna.marketingAssets, VIDEO_WORDS)
        ? { status: "idle", reason: "Video presence noted — hold until Performance Marketing confirms spend readiness and split." }
        : { status: "idle", reason: "No short-form video assets or mandate yet — creative needs to exist before this channel does." },
    "local-marketplace-seo": website
      ? { status: "active", reason: "A website exists — worth checking Google Business Profile/Maps and relevant marketplace listings alongside it." }
      : { status: "idle", reason: "No web presence yet to extend into local/marketplace listings." },
    "pr-influencer": {
      status: "idle",
      reason: "Typically a second-wave awareness channel — activate once core acquisition (SEO/paid) is validated and budget allows.",
    },
    "email-marketing": website || hasChannels
      ? { status: "active", reason: "There's a funnel or channel presence to capture and nurture email subscribers from." }
      : { status: "idle", reason: "No website or channels yet to capture email signups from." },
    "whatsapp-sms-marketing": mentions(dna.currentChannels, MESSAGING_WORDS) || mentions(dna.objective, MESSAGING_WORDS)
      ? { status: "active", reason: "Objective or channels point to fast, direct contact — a natural fit for WhatsApp/SMS." }
      : { status: "idle", reason: "No signal yet that WhatsApp/SMS fits this client's buying process." },
    "referral-loyalty": {
      status: "idle",
      reason: "Needs an existing customer base to refer or retain — revisit once the first customers are acquired.",
    },
    "crm-customer-data": hasChannels
      ? { status: "active", reason: "Channels are already generating contacts — a clean CRM structure prevents mess from compounding." }
      : { status: "idle", reason: "No channels or lead flow yet to design CRM structure around." },
    "lead-routing-sla": hasChannels
      ? { status: "active", reason: "Leads are already coming in — routing and response-time rules matter from the first one." }
      : { status: "idle", reason: "No lead flow yet to route." },
    "lead-data-quality": hasChannels
      ? { status: "active", reason: "Multiple channels can create duplicate or messy records — worth setting rules before volume grows." }
      : { status: "idle", reason: "No lead flow yet to protect the accuracy of." },
    "sales-intelligence": hasChannels
      ? { status: "active", reason: "Leads are flowing — worth checking whether the bottleneck is generation or follow-up." }
      : { status: "idle", reason: "No lead flow yet to diagnose a sales bottleneck from." },
    "revenue-pipeline": budget > 0 || hasChannels
      ? { status: "active", reason: "Spend or lead flow exists — pipeline and CAC framing should start now, not after the fact." }
      : { status: "idle", reason: "Nothing to build a revenue/pipeline framework around yet." },
    abm: mentions(dna.industry, B2B_WORDS) || mentions(dna.objective, B2B_WORDS)
      ? { status: "idle", reason: "B2B signal noted, but ABM is a second-wave motion — activate once core acquisition and ICP are validated." }
      : { status: "idle", reason: "No B2B/account-based signal in industry or objective." },
    "email-deliverability": website || hasChannels
      ? { status: "active", reason: "Email Marketing is active or likely to be — deliverability foundations should be set up alongside it, not after." }
      : { status: "idle", reason: "No funnel or channel presence yet to send email against." },
    "omnichannel-orchestration": hasChannels
      ? { status: "active", reason: "More than one channel is in play — worth deciding the escalation order rather than leaving it ad hoc." }
      : { status: "idle", reason: "Only one or no channels yet — nothing to sequence across." },
    "conversational-ai-appointment": mentions(dna.objective, MESSAGING_WORDS) || mentions(dna.industry, ["clinic", "salon", "consult", "consulting", "studio"])
      ? { status: "active", reason: "Objective or industry points to booking/consultation-driven conversion — a qualification and booking flow is worth designing now." }
      : { status: "idle", reason: "No signal this business converts through booking or a qualifying conversation." },
    "lifecycle-nurture": website || hasChannels
      ? { status: "active", reason: "There's a funnel to move people through — the lifecycle stages should be defined before individual channels improvise them." }
      : { status: "idle", reason: "No funnel or channel presence yet to build a lifecycle map around." },
    "marketing-tracking-integration": paidActive || website
      ? { status: "active", reason: "Paid spend or a website is in play — tracking gaps here silently waste budget and skew every other agent's numbers." }
      : { status: "idle", reason: "No paid spend or website yet to instrument." },
    "audience-suppression": paidActive
      ? { status: "active", reason: "Paid campaigns are likely — suppression rules prevent wasting spend on people who already converted." }
      : { status: "idle", reason: "No paid campaigns yet to build audience/suppression rules around." },
    "marketing-automation-workflow": hasChannels
      ? { status: "active", reason: "Leads are already coming in through channels — worth designing the hand-off logic before volume makes ad hoc handling unmanageable." }
      : { status: "idle", reason: "No lead flow yet to automate." },
  };

  return agentKeys.map((key) => {
    const rule = rules[key] ?? { status: "idle" as RecommendedStatus, reason: "Not relevant to the current objective and stage." };
    const tier: NeedTier = rule.status === "idle" ? "idle" : MANDATORY_KEYS.has(key) ? "mandatory" : "conditional";
    return {
      agentKey: key,
      status: rule.status,
      tier,
      reason: rule.reason,
      evidence: [rule.reason],
      reactivationTrigger: rule.status === "idle" ? extractReactivationTrigger(rule.reason) : undefined,
    };
  });
}
