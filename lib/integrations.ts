// Integration connector registry — the reusable shape every real OAuth
// integration would plug into later. Nothing here performs a live
// connection yet: each provider needs a developer app registered on that
// platform (only the workspace owner can do that) before any OAuth code
// would have credentials to use. This file exists so adding a real
// connection later is a credentials-and-callback-route problem, not an
// architecture problem.

export type IntegrationCategory = "Ad Platform" | "CRM" | "Analytics";

export interface IntegrationProvider {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** Env vars a real OAuth flow for this provider would need — checked, never read as secrets here. */
  clientIdEnv: string;
  clientSecretEnv: string;
  /** Where to register a developer app / OAuth client for this platform. */
  setupUrl: string;
  /** What a connected integration would unlock for the relevant agents. */
  unlocksFor: string[];
}

export const INTEGRATION_PROVIDERS: IntegrationProvider[] = [
  {
    key: "google_ads",
    name: "Google Ads",
    category: "Ad Platform",
    description: "Live campaign, spend, and conversion data for the Google Ads Agent — replaces category-knowledge reasoning with this account's actual numbers.",
    clientIdEnv: "GOOGLE_ADS_CLIENT_ID",
    clientSecretEnv: "GOOGLE_ADS_CLIENT_SECRET",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    unlocksFor: ["google-ads", "performance-marketing", "marketing-analytics"],
  },
  {
    key: "meta_ads",
    name: "Meta Ads",
    category: "Ad Platform",
    description: "Live campaign, audience, and Pixel/CAPI signal for the Meta Ads Agent.",
    clientIdEnv: "META_APP_ID",
    clientSecretEnv: "META_APP_SECRET",
    setupUrl: "https://developers.facebook.com/apps/",
    unlocksFor: ["meta-ads", "performance-marketing", "marketing-analytics"],
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    description: "Real funnel, traffic, and conversion-event data for Marketing Analytics, CRO, and Funnel Intelligence, instead of advisory-only reasoning.",
    clientIdEnv: "GA4_CLIENT_ID",
    clientSecretEnv: "GA4_CLIENT_SECRET",
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    unlocksFor: ["marketing-analytics", "cro", "funnel-intelligence", "marketing-tracking-integration"],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Live pipeline, lead, and lifecycle-stage data for every CRM & Lead Operations agent — replaces advisory schema design with this account's real structure.",
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
    setupUrl: "https://developers.hubspot.com/",
    unlocksFor: ["crm-customer-data", "lead-routing-sla", "revenue-pipeline", "sales-intelligence"],
  },
  {
    key: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Live pipeline, lead, and opportunity data for every CRM & Lead Operations agent, for clients running Salesforce instead of HubSpot.",
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
    setupUrl: "https://developer.salesforce.com/",
    unlocksFor: ["crm-customer-data", "lead-routing-sla", "revenue-pipeline", "sales-intelligence"],
  },
];

export function getIntegrationProvider(key: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.key === key);
}

/** True only if both OAuth env vars for this provider are set server-side. Never returns the values themselves. */
export function isProviderConfigured(key: string): boolean {
  const provider = getIntegrationProvider(key);
  if (!provider) return false;
  return Boolean(process.env[provider.clientIdEnv]) && Boolean(process.env[provider.clientSecretEnv]);
}
