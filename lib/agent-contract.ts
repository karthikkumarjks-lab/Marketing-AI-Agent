// The Agent Contract: a shared, structured definition every agent conforms to.
// This replaces treating agents as "a name + a prompt" with a real schema —
// dependencies, risk, approval requirements, and evaluation criteria live
// here as DATA, not as more paragraphs inside a system prompt.
//
// Status (see docs/ARCHITECTURE_AUDIT.md): the schema below applies to every
// agent. The rich qualitative fields (expertRole, decisionFramework,
// domainKnowledge, evaluationCriteria, exampleTasks, testCases) are fully
// authored for a small set of flagship agents so far — not all 45. Extending
// coverage is tracked as follow-up work, not silently claimed as done.

export type RiskLevel = "low" | "medium" | "high";

// Wider than the old active/idle boolean. Not every state has automatic
// transition logic yet (e.g. nothing currently flips an agent to BLOCKED
// automatically) — that depends on the orchestrator, which is a later phase.
export type AgentState =
  | "idle" // not relevant right now
  | "available" // relevant, not yet run
  | "active" // currently executing
  | "monitoring" // completed, watching a metric/experiment it produced
  | "blocked" // required but a dependency/prerequisite is missing
  | "completed" // finished a bounded task with no ongoing watch
  | "failed"; // last run errored

export interface AgentDependencies {
  /** Agent keys whose output this agent typically needs before it can do good work. */
  dependsOn: string[];
  /** Agent keys this agent's output is typically handed off to next. */
  canCall: string[];
}

export interface AgentGuardrails {
  riskLevel: RiskLevel;
  /** True if a human should confirm before acting on this agent's recommendation. */
  requiresHumanApproval: boolean;
  /** Plain-language statement of what triggers the approval requirement. */
  approvalTrigger: string;
}

export interface AgentEvaluationCriteria {
  /** What "good" looks like for this agent's output, in checkable terms. */
  successCriteria: string[];
  /** Conditions under which this agent's output should be treated as unreliable. */
  failureConditions: string[];
}

export interface AgentDefinition {
  key: string;
  expertRole: string;
  responsibilities: string[];
  decisionFramework: string;
  exampleTasks: string[];
  testCases: string[];
}

// Dependency graph — who feeds whom. Populated for the relationships the
// upgrade spec called out explicitly; agents not listed here default to
// depending only on the Executive & Intelligence core (Strategy/Needs
// Analyzer), which every agent already reads via Company DNA.
export const AGENT_DEPENDENCIES: Record<string, AgentDependencies> = {
  "marketing-strategy": { dependsOn: ["market-research", "icp-intelligence"], canCall: [] },
  "seo-strategy": { dependsOn: ["market-research", "icp-intelligence"], canCall: ["content-strategy", "technical-seo"] },
  "content-strategy": { dependsOn: ["seo-strategy", "icp-intelligence"], canCall: ["content-creation", "brand-creative-strategy"] },
  "content-creation": { dependsOn: ["content-strategy", "brand-creative-strategy"], canCall: ["design"] },
  cro: { dependsOn: ["marketing-tracking-integration"], canCall: ["website-builder", "design", "landing-page"] },
  "landing-page": { dependsOn: ["performance-marketing", "icp-intelligence"], canCall: ["cro", "design"] },
  "website-builder": { dependsOn: ["icp-intelligence", "seo-strategy"], canCall: ["cro", "design"] },
  "performance-marketing": {
    dependsOn: ["marketing-tracking-integration", "budget-investment"],
    canCall: ["google-ads", "meta-ads", "linkedin-ads", "tiktok-ads", "landing-page"],
  },
  "google-ads": { dependsOn: ["performance-marketing", "landing-page"], canCall: [] },
  "meta-ads": { dependsOn: ["performance-marketing", "landing-page"], canCall: [] },
  "linkedin-ads": { dependsOn: ["performance-marketing", "icp-intelligence"], canCall: [] },
  "tiktok-ads": { dependsOn: ["performance-marketing", "video-marketing"], canCall: [] },
  "email-marketing": { dependsOn: ["lifecycle-nurture", "icp-intelligence"], canCall: ["email-deliverability"] },
  "email-deliverability": { dependsOn: ["email-marketing"], canCall: [] },
  "omnichannel-orchestration": { dependsOn: ["lifecycle-nurture"], canCall: ["email-marketing", "whatsapp-sms-marketing", "conversational-ai-appointment"] },
  "lead-behaviour": { dependsOn: ["crm-customer-data", "lead-data-quality"], canCall: ["marketing-orchestrator"] },
  "marketing-analytics": { dependsOn: ["marketing-tracking-integration"], canCall: ["marketing-score"] },
  "marketing-score": { dependsOn: ["marketing-analytics"], canCall: [] },
  "sales-intelligence": { dependsOn: ["crm-customer-data", "lead-routing-sla"], canCall: ["marketing-orchestrator"] },
  "revenue-pipeline": { dependsOn: ["crm-customer-data", "budget-investment"], canCall: [] },
  "marketing-orchestrator": { dependsOn: ["marketing-needs-analyzer"], canCall: [] },
};

export function getAgentDependencies(key: string): AgentDependencies {
  return AGENT_DEPENDENCIES[key] ?? { dependsOn: [], canCall: [] };
}

// Risk/approval policy — computed from category + whether the agent
// recommends real spend, not hand-set per agent. This is the shared
// "guardrail layer" the upgrade spec asked for instead of duplicating a
// risk paragraph inside every prompt.
const SPEND_AGENT_KEYS = new Set([
  "performance-marketing",
  "google-ads",
  "meta-ads",
  "linkedin-ads",
  "tiktok-ads",
  "budget-investment",
  "pr-influencer",
]);

const HIGH_RISK_CATEGORY = new Set(["Marketing Operations", "CRM & Lead Operations"]);

export function getAgentGuardrails(key: string, category: string): AgentGuardrails {
  if (SPEND_AGENT_KEYS.has(key)) {
    return {
      riskLevel: "high",
      requiresHumanApproval: true,
      approvalTrigger: "Any recommendation that changes real ad/media spend requires human sign-off before execution — this agent proposes, it does not commit budget.",
    };
  }
  if (HIGH_RISK_CATEGORY.has(category)) {
    return {
      riskLevel: "medium",
      requiresHumanApproval: true,
      approvalTrigger: "Touches tracking, CRM structure, or automation logic that affects real data — review before implementing.",
    };
  }
  return {
    riskLevel: "low",
    requiresHumanApproval: false,
    approvalTrigger: "Advisory output only — no direct action or spend.",
  };
}

// Flagship agent definitions — fully authored per the Agent Contract, proving
// the pattern for the highest-stakes agents first (the ones that touch real
// money or are load-bearing for every other agent's context). See the audit
// doc for the plan to extend this to the rest of the catalog.
export const AGENT_DEFINITIONS: Record<string, AgentDefinition> = {
  "marketing-strategy": {
    key: "marketing-strategy",
    expertRole: "Senior CMO-consultant setting the 90-day bet the rest of the agent team executes against.",
    responsibilities: [
      "Translate the stated business objective into a marketing objective and a North Star KPI",
      "Set the channel priority order other agents should follow",
      "Flag when the stated budget cannot responsibly fund the stated ambition",
    ],
    decisionFramework:
      "Read Company DNA (objective, budget, guardrails, maturity) before proposing a plan. Never assume CAC is the target metric — read it from the DNA's north-star/guardrail fields, and default to asking for it explicitly (as an Assumption) if absent rather than defaulting to CAC.",
    exampleTasks: [
      "Given a new workspace with no history, produce the first 90-day roadmap",
      "Given an existing workspace with a Marketing Score showing declining prediction accuracy, revise the roadmap",
    ],
    testCases: [
      "A workspace with a thin budget (below the currency's paid-viable threshold) must get a scrappy, single-channel plan — not a five-channel plan",
      "A workspace whose objective mentions 'brand awareness' must not be scored purely on CAC in the KPI section",
    ],
  },
  "performance-marketing": {
    key: "performance-marketing",
    expertRole: "Elite performance-media lead accountable for the client's actual objective, not just cheap clicks.",
    responsibilities: [
      "Give a spend-readiness verdict before any budget allocation",
      "Compare every viable paid channel against the client's stated objective (CAC vs. pipeline vs. awareness), not a default metric",
      "Say 'do not spend yet' when tracking, landing pages, or offer clarity are missing",
    ],
    decisionFramework:
      "Optimize for whatever the Company DNA's north-star/target field actually says — CAC, qualified pipeline, or awareness are different optimization targets requiring different channel mixes and different 'success' definitions. Never default to CAC just because it's the most common target.",
    exampleTasks: [
      "₹20L/month budget, objective = reduce CAC while increasing qualified leads → compare Google/Meta/SEO/CRO and recommend where the marginal rupee has the highest expected impact, including possibly recommending CRO spend over more ad spend",
    ],
    testCases: [
      "A client with no tracking configured must get a NOT READY verdict regardless of budget size",
      "A client whose objective is 'brand awareness' must not have its plan judged/optimized purely on CAC math",
    ],
  },
  "needs-analyzer": {
    key: "needs-analyzer",
    expertRole: "Gatekeeper of the agent team — decides who works, who waits, and why, with evidence.",
    responsibilities: [
      "Classify every agent into mandatory / conditional / idle, not just active/idle",
      "Attach evidence to every activation, not a generic reason",
      "State what would flip an idle agent to active (reactivation criteria)",
    ],
    decisionFramework:
      "Work from the explicit tiering: mandatory agents serve the stated objective directly regardless of other conditions; conditional agents depend on a specific DNA fact (e.g. Design only if visual content is required); everything else stays idle with a stated reactivation trigger.",
    exampleTasks: [
      "Objective = increase qualified organic leads → mandatory: Strategy, Research, SEO, Technical SEO, Content Strategy, Content Creation, CRO, Analytics; conditional: Design (if visual assets needed), Website (if technical/content changes required); idle: Google Ads, Meta, WhatsApp, PR, ABM, Video",
    ],
    testCases: [
      "Every ACTIVE verdict must reference a specific DNA fact in its evidence, never a generic 'this seems useful' reason",
    ],
  },
  "google-ads": {
    key: "google-ads",
    expertRole: "Senior Google Ads strategist who reasons in Impression Share, Quality Score, and revenue signal — not just keywords.",
    responsibilities: [
      "Build the keyword universe by commercial intent, not just volume",
      "Reason about Search Lost IS due to budget vs. due to rank as different problems with different fixes",
      "Refuse to recommend scaling spend just because impression share is available if the revenue signal is missing",
    ],
    decisionFramework:
      "Revenue/CRM signal (if available) outranks last-click conversion count. If the client is only feeding lead-form submissions into Google Ads and has no revenue/qualified-customer signal flowing back, flag that as a tracking gap (hand off to Marketing Tracking & Integration) before recommending a budget increase.",
    exampleTasks: [
      "Client optimizing for leads but Google Ads only sees form-fill conversions, not revenue → flag the missing signal before recommending scale",
    ],
    testCases: [
      "Must not recommend increasing budget when the stated conversion signal is a proxy (lead form) rather than the client's real objective (revenue/qualified customer)",
    ],
  },
  "meta-ads": {
    key: "meta-ads",
    expertRole: "Meta performance lead who judges creative and audience quality by downstream CAC, not cheap CPL.",
    responsibilities: [
      "Sequence audiences correctly: broad/Advantage+ before narrow interest testing, retargeting/lookalikes only once there's real pixel signal",
      "Watch for creative fatigue via frequency, not just CTR",
      "Refuse to judge a campaign as working purely because CPL is low",
    ],
    decisionFramework:
      "Cheap leads that don't convert downstream are a false positive, not a win. If lead quality or downstream CAC data is available (from CRM/Lead Behaviour agents), weight it over raw CPL when making a scale/pause call.",
    exampleTasks: [
      "Campaign shows CPL down 30% but CRM shows lead quality declining → recommend against scaling despite the cheap CPL",
    ],
    testCases: [
      "Must not recommend scaling spend on CPL improvement alone when lead-quality signal (if present in Runtime Snapshot) is declining",
    ],
  },
  cro: {
    key: "cro",
    expertRole: "Full-funnel conversion lead — ad through to revenue, not just the landing page.",
    responsibilities: [
      "Diagnose leak points across the entire funnel: ad → landing page → lead → qualification → sale",
      "Distinguish message-match/UX/form-friction/speed/trust issues from sales-follow-up issues",
      "Prioritize the fix with the highest likely economic impact, not the easiest one to ship",
    ],
    decisionFramework:
      "A broken/missing follow-up process after the lead is captured almost always beats a landing-page micro-optimization in expected impact — check for that first before recommending page-level changes.",
    exampleTasks: [
      "SEO agent reports rising qualified traffic but flat conversions → CRO diagnoses whether the leak is landing-page friction or post-lead follow-up before recommending a fix",
    ],
    testCases: [
      "Must not recommend a button-color or copy tweak as the top priority when a follow-up-process gap is evident in the DNA/run history",
    ],
  },
};

export function getAgentDefinition(key: string): AgentDefinition | undefined {
  return AGENT_DEFINITIONS[key];
}
