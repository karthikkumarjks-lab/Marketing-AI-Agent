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
const LAUNCH_WORDS = ["launch", "new product", "new feature", "gtm", "go-to-market", "relaunch"];
const APP_WORDS = ["app", "saas", "software", "platform", "mobile"];
const BOOKING_INDUSTRY_WORDS = ["clinic", "salon", "consult", "consulting", "studio", "spa", "dental"];

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
    "seo-blog-intelligence": website && !organicObjective && paidActive
      ? { status: "idle", reason: "Paid-led objective for now — organic content compounds slower; revisit once SEO Strategy sets topic clusters." }
      : website
        ? { status: "active", reason: "A website exists and organic growth matters here — the blog pipeline can start producing qualified-traffic content." }
        : { status: "idle", reason: "No website yet — nothing to publish a blog on until Website Builder runs." },
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

    // Front Office
    "receptionist-concierge": {
      status: "active",
      reason: "Always available as the entry point for interpreting a new request.",
    },
    "client-onboarding": icpThin || budget === 0
      ? { status: "active", reason: "Core Company DNA is still thin — onboarding should close the gaps before other agents run on incomplete data." }
      : { status: "idle", reason: "Company DNA already looks reasonably complete; revisit if a new gap shows up." },

    "meeting-summary-insights": {
      status: "active",
      reason: "Useful the moment there's a real meeting transcript to process, regardless of how complete Company DNA is yet.",
    },
    "meeting-qa": {
      status: "active",
      reason: "Always available to answer questions about stored meeting history — genuinely useful only once meetings exist, but not gated on any DNA field.",
    },

    // Executive & Intelligence
    "business-intelligence": {
      status: "active",
      reason: "Understanding the business itself comes before any marketing recommendation.",
    },
    "offer-positioning-intelligence": {
      status: "active",
      reason: "Offer and positioning strength should be checked early, before any channel gets blamed for weak conversion.",
    },
    "product-marketing-gtm": mentions(dna.objective, LAUNCH_WORDS)
      ? { status: "active", reason: "Objective signals a product/feature launch — GTM sequencing matters now." }
      : { status: "idle", reason: "No launch signal in the objective yet." },
    forecasting: budget > 0
      ? { status: "active", reason: `A ${money(budget)}/month budget is set — worth projecting what it should produce.` }
      : { status: "idle", reason: "No budget set yet to forecast against." },
    "customer-journey-intelligence": hasChannels
      ? { status: "active", reason: "Channels exist — worth mapping where the actual journey breaks." }
      : { status: "idle", reason: "No channels yet to map a journey across." },
    "search-intent-intelligence": website || organicObjective
      ? { status: "active", reason: "A website or organic objective is in play — intent analysis should inform the channel mix." }
      : { status: "idle", reason: "No website or organic objective yet to analyze search intent for." },
    "competitor-seo-intelligence": organicObjective
      ? { status: "active", reason: "Objective is organic-led — worth knowing what competitors already rank for." }
      : { status: "idle", reason: "Objective isn't organic-led yet — revisit once SEO becomes a priority." },
    "competitor-ad-intelligence": paidActive
      ? { status: "active", reason: "Paid campaigns are in play — worth benchmarking against likely competitor angles first." }
      : { status: "idle", reason: "No paid campaigns planned yet to benchmark against competitors." },

    // CRM & Lead Operations
    "lead-enrichment": hasChannels
      ? { status: "active", reason: "Leads are already coming in — enrichment makes them usable for scoring and routing." }
      : { status: "idle", reason: "No lead flow yet to enrich." },
    "lead-scoring-qualification": hasChannels
      ? { status: "active", reason: "Leads are flowing — a scoring model prevents every lead being treated the same." }
      : { status: "idle", reason: "No lead flow yet to score." },
    "sales-follow-up": hasChannels
      ? { status: "active", reason: "Leads are coming in — follow-up cadence matters from the first one." }
      : { status: "idle", reason: "No lead flow yet to design follow-up for." },
    "appointment-intelligence": mentions(dna.objective, MESSAGING_WORDS) || mentions(dna.industry, BOOKING_INDUSTRY_WORDS)
      ? { status: "active", reason: "Objective or industry points to booking-driven conversion — show-rate matters here." }
      : { status: "idle", reason: "No signal this business converts via booked appointments." },
    "revenue-attribution": hasChannels || budget > 0
      ? { status: "active", reason: "Spend or lead flow exists — revenue credit rules should be defined before disputes over what's working start." }
      : { status: "idle", reason: "Nothing to attribute revenue to yet." },
    "sales-forecasting": hasChannels
      ? { status: "active", reason: "Leads are flowing — worth projecting pipeline-to-close outcomes." }
      : { status: "idle", reason: "No lead flow yet to forecast pipeline from." },

    // Acquisition
    "youtube-ads": paidActive && (mentions(dna.currentChannels, VIDEO_WORDS) || mentions(dna.marketingAssets, VIDEO_WORDS))
      ? { status: "idle", reason: "Video presence noted — hold until Performance Marketing confirms spend readiness and split." }
      : { status: "idle", reason: "No video assets or paid budget confirmed yet for YouTube specifically." },
    retargeting: website && hasChannels
      ? { status: "active", reason: "A website and traffic exist — remarketing to warm visitors is cheap relative to cold acquisition." }
      : { status: "idle", reason: "No website or traffic yet to retarget." },
    "paid-audience-intelligence": paidViable
      ? { status: "active", reason: "Budget can support a paid test — audience research should happen before campaigns launch, not during." }
      : { status: "idle", reason: "Budget doesn't yet support paid testing." },
    "paid-media-optimization": {
      status: "idle",
      reason: "Needs multiple paid channels already running with real data — revisit once Performance Marketing's channels have run history.",
    },

    // Content & Creative
    "brand-identity-logo": !hasAssets
      ? { status: "active", reason: "No brand assets listed — visual identity should exist before content production begins." }
      : { status: "idle", reason: "Brand assets already exist; revisit only if a rebrand is underway." },
    "creative-director": {
      status: "idle",
      reason: "Activate once a specific campaign brief exists for it to define a concept against.",
    },
    "creative-qa": {
      status: "idle",
      reason: "A review pass — activate once assets exist to review.",
    },
    "social-media": hasChannels
      ? { status: "active", reason: "Channels are active — organic social posting should be planned deliberately, not ad hoc." }
      : { status: "idle", reason: "No channels yet to plan a social calendar around." },

    // Free real image generation is useful from day one regardless of
    // channel/content maturity — unlike content-creation (needs a calendar
    // first) this is a standalone utility, not a step in a sequence.
    "image-generation": {
      status: "active",
      reason: "Real visuals are useful from day one for any channel — social posts, ads, or a placeholder before real photography exists.",
    },

    // Digital Experience
    "funnel-intelligence": website && hasChannels
      ? { status: "active", reason: "Traffic and a website exist — the funnel should be measured before CRO tries to fix it blind." }
      : { status: "idle", reason: "Needs a website and traffic before there's a funnel to measure." },
    "web-personalization": {
      status: "idle",
      reason: "Needs meaningful traffic volume before personalization rules pay off — revisit once Funnel Intelligence shows real numbers.",
    },
    "conversion-experiment": {
      status: "idle",
      reason: "Needs CRO's diagnosis first — experiments test specific hypotheses CRO hasn't identified yet.",
    },

    // Retention & Lifecycle
    "rcs-marketing": {
      status: "idle",
      reason: "A niche, second-wave channel — revisit once WhatsApp/SMS is already running and RCS reach is confirmed for this market.",
    },
    voicebot: mentions(dna.objective, MESSAGING_WORDS) || mentions(dna.industry, BOOKING_INDUSTRY_WORDS)
      ? { status: "idle", reason: "Booking/appointment signal noted — hold until Conversational AI & Appointment's flow is validated first." }
      : { status: "idle", reason: "No signal this business needs automated voice handling yet." },
    "push-notification": mentions(dna.industry, APP_WORDS) || mentions(dna.objective, APP_WORDS)
      ? { status: "active", reason: "App/SaaS signal noted — push is a natural re-engagement channel here." }
      : { status: "idle", reason: "No app/PWA signal yet — push has nothing to run on." },
    "in-app-notification": mentions(dna.industry, APP_WORDS) || mentions(dna.objective, APP_WORDS)
      ? { status: "active", reason: "App/SaaS signal noted — usage-triggered messaging fits this business model." }
      : { status: "idle", reason: "Not a SaaS/app business model based on what's known." },
    "retention-intelligence": hasChannels
      ? { status: "active", reason: "Channels are active long enough to start showing retention patterns worth reading." }
      : { status: "idle", reason: "No activity yet to read retention patterns from." },
    "churn-prediction": {
      status: "idle",
      reason: "Needs an existing customer base to define risk signals against — revisit once the first customers are acquired.",
    },
    "upsell-cross-sell": {
      status: "idle",
      reason: "Needs an existing customer base to expand — revisit once the first customers are acquired.",
    },
    "customer-experience-reputation": website
      ? { status: "active", reason: "A public presence exists — reputation signals start accumulating from day one." }
      : { status: "idle", reason: "No public presence yet for reputation to accumulate around." },

    // Marketing Operations
    "event-conversion-mapping": paidActive || website
      ? { status: "active", reason: "Paid spend or a website is in play — the event model should exist before Tracking & Integration implements it." }
      : { status: "idle", reason: "No paid spend or website yet to define conversion events for." },
    "utm-campaign-taxonomy": hasChannels
      ? { status: "active", reason: "Multiple channels are active — a consistent naming convention prevents fragmented reporting from day one." }
      : { status: "idle", reason: "No channels yet to standardize naming across." },
    "integration-management": hasChannels
      ? { status: "active", reason: "Channels are generating activity — worth planning the integration stack before tools get bolted on ad hoc." }
      : { status: "idle", reason: "No channel activity yet to justify new integrations." },

    // Intelligence & Measurement
    attribution: hasChannels
      ? { status: "active", reason: "Multiple touchpoints likely exist — an attribution model should be chosen deliberately, not defaulted to last-click." }
      : { status: "idle", reason: "No channel activity yet to attribute." },
    incrementality: {
      status: "idle",
      reason: "Needs baseline performance data first — revisit once Marketing Analytics has a run history to test against.",
    },
    "cohort-funnel-intelligence": {
      status: "idle",
      reason: "Needs run history across time to form cohorts — revisit once there's a few months of activity.",
    },
    "ai-learning-memory": {
      status: "idle",
      reason: "Needs agent runs with predicted and actual outcomes to learn from — revisit once the evaluation log has real entries.",
    },

    // Freelancer & Agency Growth — these support the operator's own client-acquisition
    // pipeline, not this workspace's marketing, so they default idle inside any single
    // client workspace regardless of that client's DNA.
    "prospect-discovery": {
      status: "idle",
      reason: "Supports your own client-acquisition pipeline, not this workspace's marketing — run it directly when prospecting for new clients.",
    },
    "prospect-digital-audit": {
      status: "idle",
      reason: "Supports your own client-acquisition pipeline, not this workspace's marketing — run it directly against a prospect's details.",
    },
    "prospect-opportunity-scoring": {
      status: "idle",
      reason: "Supports your own client-acquisition pipeline — run it after a Prospect Digital Audit, not from within a client workspace.",
    },
    "proposal-90-day-plan": {
      status: "idle",
      reason: "Supports your own client-acquisition pipeline — run it once a prospect is scored, not from within a client workspace.",
    },
    "client-reporting-white-label": {
      status: "idle",
      reason: "Worth activating once this workspace has enough run history to report on — revisit after the first few campaign cycles.",
    },

    // Split-out agents (2026-08-25): narrower siblings of an existing
    // combined agent. Defaults lean idle-by-default for the ones that only
    // add value once the broader/combined agent already has real output to
    // narrow down on.
    "objective-kpi": {
      status: "active",
      reason: "Sets the target system every other agent should read — worth having early, especially when North Star KPI isn't set yet.",
    },
    "marketplace-seo": {
      status: "idle",
      reason: "No signal yet that this business sells through a marketplace (app store, Amazon, Etsy) rather than its own site.",
    },
    "seo-content-strategy": organicObjective
      ? { status: "active", reason: "Objective is organic-led — keyword-to-content mapping should happen alongside the general Content Strategy work." }
      : { status: "idle", reason: "Objective isn't organic-led yet — revisit once SEO becomes a priority." },
    "influencer-creator-marketing": {
      status: "idle",
      reason: "Typically a second-wave channel, same as PR — activate once core acquisition is validated and budget allows.",
    },
    "website-strategy": website
      ? { status: "idle", reason: "A website already exists — revisit if a redesign or major restructure is being considered." }
      : { status: "active", reason: "No website yet — architecture should be planned before Website Builder writes page briefs." },
    "digital-experience-ux": website
      ? { status: "active", reason: "A website exists — usability is worth reviewing alongside CRO's conversion-focused work." }
      : { status: "idle", reason: "No website yet to review the UX of." },
    "crm-schema-custom-field": hasChannels
      ? { status: "active", reason: "Leads are flowing — field-level CRM design matters once CRM & Customer Data's structure exists to attach fields to." }
      : { status: "idle", reason: "No lead flow yet to design CRM fields around." },
    "lead-management": hasChannels
      ? { status: "active", reason: "Multiple CRM specialist agents are relevant here — worth an umbrella view of gaps between them." }
      : { status: "idle", reason: "No lead flow yet for CRM specialists to have gaps between." },
    "sales-assignment-capacity": {
      status: "idle",
      reason: "Needs a stated team beyond a solo operator to plan territory/capacity around — revisit once team size is known.",
    },
    "identity-resolution-dedup": hasChannels
      ? { status: "active", reason: "Multiple channels can create duplicate identities — worth defining matching logic before volume grows." }
      : { status: "idle", reason: "No lead flow yet to resolve identities across." },
    "next-best-action": hasChannels
      ? { status: "active", reason: "Leads are flowing — action-level prioritization matters once there's more than one thing that could happen next." }
      : { status: "idle", reason: "No lead flow yet to recommend next actions for." },
    "pipeline-intelligence": hasChannels
      ? { status: "active", reason: "Leads are flowing into a pipeline — velocity and stall points are worth watching from the start." }
      : { status: "idle", reason: "No lead flow yet to build a pipeline view from." },
    "revenue-intelligence": budget > 0 || hasChannels
      ? { status: "active", reason: "Spend or lead flow exists — revenue performance quality should be watched, not just top-line growth." }
      : { status: "idle", reason: "No revenue activity yet to analyze." },
    "whatsapp-marketing": mentions(dna.currentChannels, ["whatsapp"]) || mentions(dna.objective, ["whatsapp"])
      ? { status: "active", reason: "WhatsApp specifically is already in the mix — worth the deeper platform-specific treatment." }
      : { status: "idle", reason: "No specific WhatsApp signal yet — see the combined WhatsApp & SMS agent for the general case." },
    "sms-marketing": mentions(dna.currentChannels, ["sms"]) || mentions(dna.objective, ["sms"])
      ? { status: "active", reason: "SMS specifically is already in the mix — worth the deeper platform-specific treatment." }
      : { status: "idle", reason: "No specific SMS signal yet — see the combined WhatsApp & SMS agent for the general case." },
    "chatbot-conversational-ai": website
      ? { status: "active", reason: "A website exists — general FAQ/support chat is worth planning alongside booking-specific Conversational AI." }
      : { status: "idle", reason: "No website yet for a chatbot to live on." },
    loyalty: {
      status: "idle",
      reason: "Needs a repeat-purchase customer base to build tiers around — revisit once the first customers are acquired.",
    },
    referral: {
      status: "idle",
      reason: "Needs an existing customer base to refer from — revisit once the first customers are acquired.",
    },
    "lead-nurturing-strategy": hasChannels
      ? { status: "active", reason: "Leads are flowing — pre-conversion nurture strategy matters before Lifecycle & Nurture's post-purchase stages become relevant." }
      : { status: "idle", reason: "No lead flow yet to nurture." },
    "audience-sync-offline-conversion": paidActive
      ? { status: "active", reason: "Paid campaigns are likely — the sync/upload pipeline matters once there's real conversion data to feed back." }
      : { status: "idle", reason: "No paid campaigns yet to sync audiences or offline conversions for." },
    experimentation: {
      status: "idle",
      reason: "Needs baseline performance data across channels first — revisit once there's a run history to build a backlog against.",
    },
    "marketing-compliance-governance": hasChannels || website
      ? { status: "active", reason: "Real channels or a public site are already active — compliance groundwork should exist before volume makes gaps expensive." }
      : { status: "idle", reason: "No active channels or public presence yet to apply compliance policy to." },

    // Expert-suggested additions (2026-08-25): genuine coverage gaps found on
    // a marketing + CRM domain review, not items from Karthikeyan's own lists.
    "pricing-strategy": {
      status: "active",
      reason: "Pricing underpins every other economic decision this team makes — worth checking early, alongside Offer & Positioning.",
    },
    "marketing-calendar-campaign-planning": hasChannels
      ? { status: "active", reason: "Multiple channels are active — a shared campaign calendar prevents them colliding or leaving gaps." }
      : { status: "idle", reason: "No channels yet to build a campaign calendar around." },
    "affiliate-partner-marketing": {
      status: "idle",
      reason: "A second-wave channel — needs an established margin/AOV profile to support commission economics; revisit once core acquisition is validated.",
    },
    "sales-enablement-battlecards": mentions(dna.industry, B2B_WORDS) || mentions(dna.objective, B2B_WORDS)
      ? { status: "active", reason: "B2B-shaped sales process noted — reps benefit from battlecards and objection handling from early on." }
      : { status: "idle", reason: "No B2B/sales-process signal — likely a self-serve or e-commerce motion where this doesn't apply yet." },
    "crm-data-migration-cleanup": {
      status: "idle",
      reason: "Needs a stated existing CRM/spreadsheet situation to plan a migration from — revisit once that's known.",
    },
    "customer-segmentation": {
      status: "idle",
      reason: "Needs an existing customer base to segment — revisit once the first customers are acquired.",
    },
    "customer-health-score": mentions(dna.industry, APP_WORDS) || mentions(dna.objective, APP_WORDS)
      ? { status: "active", reason: "SaaS/subscription signal noted — an ongoing health score matters for this business model from early on." }
      : { status: "idle", reason: "Not a subscription/SaaS business model based on what's known — see Retention Intelligence instead." },

    // Market-research-driven addition (2026-08-25): a genuine gap found by
    // checking HubSpot Breeze's Prospecting Agent against this catalog —
    // nothing here covered the client's own outbound sales motion, only the
    // operator's own agency pipeline (Freelancer & Agency Growth) and ABM's
    // program-level account selection.
    "sales-prospecting-outbound": mentions(dna.industry, B2B_WORDS) || mentions(dna.objective, B2B_WORDS)
      ? { status: "active", reason: "B2B-shaped sales process noted — outbound prospecting and first-touch outreach matter alongside inbound lead handling." }
      : { status: "idle", reason: "No B2B/sales-process signal — likely a self-serve or e-commerce motion with no outbound prospecting to support." },

    // Sales-gap audit (2026-08-25): win/loss and call coaching both need real
    // closed-deal/transcript data that Company DNA can't confirm exists yet —
    // idle unconditionally, like crm-data-migration-cleanup's "needs a stated
    // precondition" pattern, rather than gated on a B2B signal alone.
    "win-loss-analysis": {
      status: "idle",
      reason: "Needs at least a handful of closed deals (won or lost, with reasons) to analyze — revisit once early deals have closed either way.",
    },
    "sales-call-coaching": {
      status: "idle",
      reason: "Needs a real sales call transcript to analyze — revisit once calls are happening and a transcript can be pasted or uploaded.",
    },
    "sales-proposal-quote": mentions(dna.industry, B2B_WORDS) || mentions(dna.objective, B2B_WORDS)
      ? { status: "active", reason: "B2B-shaped sales process noted — a reusable proposal/quote template is useful even before the first real deal specifics exist." }
      : { status: "idle", reason: "No B2B/sales-process signal — likely a self-serve or e-commerce motion with no negotiated proposals/quotes to draft." },

    // Second sales-gap audit pass (2026-08-25): renewal ownership and comp
    // plan design were both genuinely uncovered — checked Churn Prediction,
    // Customer Health Score, Upsell/Cross-sell, and Sales Assignment &
    // Capacity's actual prompts first to confirm no overlap.
    "renewal-management": mentions(dna.industry, APP_WORDS) || mentions(dna.objective, APP_WORDS)
      ? { status: "active", reason: "SaaS/subscription signal noted — the renewal motion matters for this business model from early on." }
      : { status: "idle", reason: "Not a subscription/recurring-revenue business model based on what's known — no renewal event to manage." },
    "sales-compensation-plan": {
      status: "idle",
      reason: "Needs a stated sales team beyond a solo operator to design compensation for — revisit once team size is known.",
    },

    // Third sales pass, at the user's explicit request to also build the
    // niche/enterprise candidates (Deal Desk, CPQ, Channel/Partner Sales)
    // originally flagged as lower-priority. All three need a real sales team
    // or partner motion that Company DNA has no field to confirm — idle by
    // default, same "needs a stated precondition" pattern as the agents above.
    "deal-desk-approval": {
      status: "idle",
      reason: "Needs a stated sales team beyond a solo operator — a solo owner approves their own deals by definition. Revisit once team size is known.",
    },
    "cpq-rules-design": {
      status: "idle",
      reason: "Needs a stated multi-product/service line-up with real bundling complexity — revisit once the product catalog is established.",
    },
    "channel-partner-sales": {
      status: "idle",
      reason: "Needs a stated reseller/channel partner motion — most businesses start direct-only; revisit once channel partnerships are being considered.",
    },

    // Landing page split-testing needs the same paid-traffic foundation as
    // the Landing Page Agent itself — nothing to split-test without traffic
    // hitting a page yet.
    "landing-page-split-test": paidActive
      ? { status: "active", reason: "Paid traffic is driving to landing pages — worth testing multiple full-page approaches once there's enough traffic to split." }
      : { status: "idle", reason: "No paid traffic planned yet — nothing to split-test." },

    // Needs a real website to scan — same trigger as Technical SEO.
    "website-technology-structure": website
      ? { status: "active", reason: "A website exists — worth auditing its real technology stack and structure before recommending integrations or flagging tracking gaps." }
      : { status: "idle", reason: "No website on record yet to scan." },

    // Same website-exists trigger — a reputation check is only meaningful
    // once there's a real URL to check.
    "url-reputation-blocklist-check": website
      ? { status: "active", reason: "A website exists — worth checking whether it's flagged by any security vendor before it silently costs conversions." }
      : { status: "idle", reason: "No website on record yet to check." },
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
