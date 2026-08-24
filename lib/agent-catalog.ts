// The full 25-agent catalog: presentation + seed metadata.
// This is the single source of truth for what agents exist, what category
// they belong to, and what they're supposed to do. `lib/agent-prompts.ts`
// only has system prompts for the agents marked `wired: true` here.

export const CATEGORY_ORDER = [
  "Executive & Intelligence",
  "Acquisition",
  "Content & Creative",
  "Digital Experience",
  "Intelligence & Measurement",
] as const;

export type CategoryName = (typeof CATEGORY_ORDER)[number];

export const CATEGORY_COLORS: Record<CategoryName, string> = {
  "Executive & Intelligence": "#4C5FD5",
  Acquisition: "#1F8A5C",
  "Content & Creative": "#B5541C",
  "Digital Experience": "#0E7C86",
  "Intelligence & Measurement": "#8A3FA0",
};

export interface AgentSpec {
  key: string;
  name: string;
  category: CategoryName;
  mission: string;
  inputs: string[];
  outputs: string[];
  wired: boolean;
  sortOrder: number;
}

export const AGENT_CATALOG: AgentSpec[] = [
  // Executive & Intelligence
  {
    key: "marketing-strategy",
    name: "Marketing Strategy Agent",
    category: "Executive & Intelligence",
    mission: "Synthesizes Company DNA into a concrete 90-day marketing strategy with channel priorities, budget allocation, and KPI targets.",
    inputs: ["Business model & industry", "Objective", "Monthly budget (INR)", "Current channels & assets"],
    outputs: ["90-day roadmap", "Channel priorities", "Budget allocation", "KPI targets"],
    wired: true,
    sortOrder: 1,
  },
  {
    key: "market-research",
    name: "Market Research Agent",
    category: "Executive & Intelligence",
    mission: "Researches industry structure, demand drivers, and competitor landscape for the client's market and geography.",
    inputs: ["Industry", "Geography", "Objective"],
    outputs: ["Market overview", "Competitor landscape table", "Whitespace opportunities"],
    wired: true,
    sortOrder: 2,
  },
  {
    key: "icp-intelligence",
    name: "Customer / ICP Intelligence Agent",
    category: "Executive & Intelligence",
    mission: "Determines the ideal customer profile, personas, pain points, and buying triggers.",
    inputs: ["Industry", "Existing ICP notes", "Objective"],
    outputs: ["ICP definition", "2-3 personas", "Buying trigger map", "Messaging hooks"],
    wired: true,
    sortOrder: 3,
  },
  {
    key: "competitive-intelligence",
    name: "Competitive Intelligence Agent",
    category: "Executive & Intelligence",
    mission: "Analyzes competitors across website, SEO, ads, content, pricing, and positioning to find exploitable gaps.",
    inputs: ["Competitor URLs / names", "Industry", "Objective"],
    outputs: ["Competitor teardown", "Positioning gaps", "Where we're losing and why"],
    wired: true,
    sortOrder: 4,
  },
  {
    key: "needs-analyzer",
    name: "Marketing Needs Analyzer",
    category: "Executive & Intelligence",
    mission: "Decides which of the 25 agents should be active vs. idle for this client right now, and explains why.",
    inputs: ["Full Company DNA", "Agent catalog"],
    outputs: ["Activation plan (all 25 agents)", "First three agents to run", "What would change the verdict"],
    wired: true,
    sortOrder: 5,
  },
  {
    key: "marketing-orchestrator",
    name: "Marketing Orchestrator",
    category: "Executive & Intelligence",
    mission: "Sequences active agents, resolves dependencies and conflicts, and coordinates hand-offs between them.",
    inputs: ["Active agent set", "Agent outputs so far"],
    outputs: ["Execution sequence", "Dependency graph", "Hand-off notes"],
    wired: true,
    sortOrder: 6,
  },
  {
    key: "marketing-opportunity",
    name: "Marketing Opportunity Agent",
    category: "Executive & Intelligence",
    mission: "Continuously scans for what's missing — no CRM, no tracking, weak SEO, poor follow-up — and ranks the highest-impact gaps.",
    inputs: ["Current channels", "Marketing assets", "Agent run history"],
    outputs: ["Ranked opportunity list", "Effort/impact estimate per gap"],
    wired: true,
    sortOrder: 7,
  },
  {
    key: "budget-investment",
    name: "Budget & Investment Agent",
    category: "Executive & Intelligence",
    mission: "Decides how total marketing budget should split across brand, digital, content, tech, and experiments — before Performance Marketing allocates the digital slice.",
    inputs: ["Total monthly budget (INR)", "Objective", "Strategy output"],
    outputs: ["Top-level budget split", "Rationale per bucket"],
    wired: true,
    sortOrder: 8,
  },
  // Acquisition
  {
    key: "seo-strategy",
    name: "SEO Strategy Agent",
    category: "Acquisition",
    mission: "Builds keyword strategy, topic clusters, and content gap analysis for organic growth.",
    inputs: ["Website URL", "Industry", "Objective"],
    outputs: ["Keyword universe table", "Topic clusters", "Content gap opportunities", "90-day priorities"],
    wired: true,
    sortOrder: 9,
  },
  {
    key: "technical-seo",
    name: "Technical SEO Agent",
    category: "Acquisition",
    mission: "Audits crawlability, indexation, schema, internal linking, and Core Web Vitals.",
    inputs: ["Website URL"],
    outputs: ["Technical issue list", "Fix priority order"],
    wired: true,
    sortOrder: 10,
  },
  {
    key: "performance-marketing",
    name: "Performance Marketing Strategy Agent",
    category: "Acquisition",
    mission: "Recommends channel budget allocation across Google/Meta/SEO — and gives a spend-readiness verdict first, including 'don't spend yet' when fundamentals are missing.",
    inputs: ["Monthly budget (INR)", "Website & tracking status", "Objective"],
    outputs: ["Spend-readiness verdict", "Budget allocation table", "Testing plan", "Kill criteria"],
    wired: true,
    sortOrder: 11,
  },
  {
    key: "google-ads",
    name: "Google Ads Agent",
    category: "Acquisition",
    mission: "Keyword research, campaign structure, bidding, and Quality Score optimization for search campaigns.",
    inputs: ["Approved paid budget", "Keyword priorities", "Landing page status"],
    outputs: ["Campaign structure", "Match type & negative keyword plan", "Bid strategy"],
    wired: true,
    sortOrder: 12,
  },
  {
    key: "meta-ads",
    name: "Meta Ads Agent",
    category: "Acquisition",
    mission: "Audience strategy, funnel design, and creative strategy for Meta campaigns.",
    inputs: ["Approved paid budget", "ICP/personas", "Creative assets"],
    outputs: ["Audience strategy", "Funnel structure", "Creative brief"],
    wired: true,
    sortOrder: 13,
  },
  // Content & Creative
  {
    key: "content-strategy",
    name: "Content Strategy Agent",
    category: "Content & Creative",
    mission: "Decides what content to create, for whom, at which funnel stage, and in what format.",
    inputs: ["ICP/personas", "SEO topic clusters", "Objective"],
    outputs: ["Content pillars", "Editorial calendar shape", "Format & channel map"],
    wired: true,
    sortOrder: 14,
  },
  {
    key: "content-creation",
    name: "Content Creation Agent",
    category: "Content & Creative",
    mission: "Writes blog, landing page, ad, and email copy from strategy, ICP, SEO, and brand inputs.",
    inputs: ["Content strategy", "Brand voice", "SEO targets"],
    outputs: ["Draft copy by asset type"],
    wired: true,
    sortOrder: 15,
  },
  {
    key: "content-repurposing",
    name: "Content Repurposing Agent",
    category: "Content & Creative",
    mission: "Converts one core content asset into LinkedIn, Instagram, email, and short-form variants.",
    inputs: ["Source asset", "Target channels"],
    outputs: ["Per-channel repurposed variants"],
    wired: true,
    sortOrder: 16,
  },
  {
    key: "brand-creative-strategy",
    name: "Brand & Creative Strategy Agent",
    category: "Content & Creative",
    mission: "Defines positioning, brand personality, messaging, and creative direction.",
    inputs: ["Business model", "ICP", "Competitor positioning"],
    outputs: ["Brand voice guide", "Positioning statement", "Creative direction notes"],
    wired: true,
    sortOrder: 17,
  },
  {
    key: "design",
    name: "Design Agent",
    category: "Content & Creative",
    mission: "Produces ad, social, landing page, and email creative briefs that follow Brand DNA.",
    inputs: ["Brand guide", "Campaign brief"],
    outputs: ["Creative asset briefs"],
    wired: true,
    sortOrder: 18,
  },
  {
    key: "video-marketing",
    name: "Video Marketing Agent",
    category: "Content & Creative",
    mission: "Develops video concepts, hooks, and scripts for reels, shorts, and YouTube.",
    inputs: ["Content strategy", "Brand voice", "Target channel"],
    outputs: ["Video concepts & scripts"],
    wired: true,
    sortOrder: 19,
  },
  // Digital Experience
  {
    key: "website-builder",
    name: "Website Builder Agent",
    category: "Digital Experience",
    mission: "Plans website architecture, UX, and page structure when no site or a weak site exists.",
    inputs: ["Business model", "ICP", "SEO structure"],
    outputs: ["Site map", "Page-by-page content brief"],
    wired: true,
    sortOrder: 20,
  },
  {
    key: "landing-page",
    name: "Landing Page Agent",
    category: "Digital Experience",
    mission: "Builds campaign- and SEO-specific landing pages optimized for conversion.",
    inputs: ["Campaign objective", "ICP", "Offer"],
    outputs: ["Landing page brief & copy structure"],
    wired: true,
    sortOrder: 21,
  },
  {
    key: "cro",
    name: "CRO Agent",
    category: "Digital Experience",
    mission: "Diagnoses funnel leakage — visitor to lead to sale — and recommends conversion fixes.",
    inputs: ["Funnel data", "Website URL", "Current conversion rate"],
    outputs: ["Funnel leak diagnosis", "Prioritized fix list"],
    wired: true,
    sortOrder: 22,
  },
  // Intelligence & Measurement
  {
    key: "lead-behaviour",
    name: "Lead Behaviour & Conversion Intelligence Agent",
    category: "Intelligence & Measurement",
    mission: "Analyzes individual lead behavior across channels to produce conversion probability and next-best-action.",
    inputs: ["Lead activity data", "CRM stage", "Channel source"],
    outputs: ["Conversion probability", "Primary barrier", "Next-best-action"],
    wired: true,
    sortOrder: 23,
  },
  {
    key: "marketing-analytics",
    name: "Marketing Analytics & Experimentation Agent",
    category: "Intelligence & Measurement",
    mission: "Tracks funnel, channel, and campaign performance, and designs A/B tests with control/treatment and success thresholds.",
    inputs: ["Run history", "Channel spend & results"],
    outputs: ["Performance dashboard summary", "Experiment plan"],
    wired: true,
    sortOrder: 24,
  },
  {
    key: "marketing-score",
    name: "Marketing Score & AI Evaluation Agent",
    category: "Intelligence & Measurement",
    mission: "Scores prediction accuracy and business impact across all agents using the predicted-vs-actual outcome log — the system's evaluation loop.",
    inputs: ["All agent_runs with predicted + actual outcomes"],
    outputs: ["Per-agent accuracy score", "Overall marketing health score", "Trend over time"],
    wired: true,
    sortOrder: 25,
  },
];

export function getAgentSpec(key: string): AgentSpec | undefined {
  return AGENT_CATALOG.find((a) => a.key === key);
}
