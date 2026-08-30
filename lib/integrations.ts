// Integration connector registry — the reusable shape every real OAuth
// integration would plug into later. Nothing here performs a live
// connection yet: each provider needs a developer app registered on that
// platform (only the workspace owner can do that) before any OAuth code
// would have credentials to use. This file exists so adding a real
// connection later is a credentials-and-callback-route problem, not an
// architecture problem.

export type IntegrationCategory = "Ad Platform" | "CRM" | "Analytics" | "Messaging";

export interface IntegrationProvider {
  key: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  /** "oauth" needs a developer app (client id + secret); "api_key" just needs one or more secret keys — no OAuth app to register. */
  authType: "oauth" | "api_key";
  /** Env vars this provider needs configured server-side before a live connection is possible — checked, never read as secrets here. One var for a simple API key, two for an OAuth client id/secret pair, three+ for something like Twilio (account SID + auth token + sender number). */
  requiredEnvVars: string[];
  /** Where to register a developer app / get an API key for this platform. */
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
    authType: "oauth",
    requiredEnvVars: ["GOOGLE_ADS_CLIENT_ID", "GOOGLE_ADS_CLIENT_SECRET"],
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    unlocksFor: ["google-ads", "performance-marketing", "marketing-analytics"],
  },
  {
    key: "meta_ads",
    name: "Meta Ads",
    category: "Ad Platform",
    description: "Live campaign, audience, and Pixel/CAPI signal for the Meta Ads Agent.",
    authType: "oauth",
    requiredEnvVars: ["META_APP_ID", "META_APP_SECRET"],
    setupUrl: "https://developers.facebook.com/apps/",
    unlocksFor: ["meta-ads", "performance-marketing", "marketing-analytics"],
  },
  {
    key: "linkedin_ads",
    name: "LinkedIn Ads",
    category: "Ad Platform",
    description: "Live campaign, audience, and lead-gen form data for the LinkedIn Ads Agent — the standard paid channel for B2B clients running an ABM motion.",
    authType: "oauth",
    requiredEnvVars: ["LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET"],
    setupUrl: "https://www.linkedin.com/developers/apps",
    unlocksFor: ["linkedin-ads", "performance-marketing", "marketing-analytics"],
  },
  {
    key: "ga4",
    name: "Google Analytics 4",
    category: "Analytics",
    description: "Real funnel, traffic, and conversion-event data for Marketing Analytics, CRO, and Funnel Intelligence, instead of advisory-only reasoning.",
    authType: "oauth",
    requiredEnvVars: ["GA4_CLIENT_ID", "GA4_CLIENT_SECRET"],
    setupUrl: "https://console.cloud.google.com/apis/credentials",
    unlocksFor: ["marketing-analytics", "cro", "funnel-intelligence", "marketing-tracking-integration"],
  },
  {
    key: "hubspot",
    name: "HubSpot",
    category: "CRM",
    description: "Live pipeline, lead, and lifecycle-stage data for every CRM & Lead Operations agent — replaces advisory schema design with this account's real structure.",
    authType: "oauth",
    requiredEnvVars: ["HUBSPOT_CLIENT_ID", "HUBSPOT_CLIENT_SECRET"],
    setupUrl: "https://developers.hubspot.com/",
    unlocksFor: ["crm-customer-data", "lead-routing-sla", "revenue-pipeline", "sales-intelligence"],
  },
  {
    key: "salesforce",
    name: "Salesforce",
    category: "CRM",
    description: "Live pipeline, lead, and opportunity data for every CRM & Lead Operations agent, for clients running Salesforce instead of HubSpot.",
    authType: "oauth",
    requiredEnvVars: ["SALESFORCE_CLIENT_ID", "SALESFORCE_CLIENT_SECRET"],
    setupUrl: "https://developer.salesforce.com/",
    unlocksFor: ["crm-customer-data", "lead-routing-sla", "revenue-pipeline", "sales-intelligence"],
  },
  {
    key: "email",
    name: "Email (Resend)",
    category: "Messaging",
    description: "Real transactional/marketing send capability for the Email Marketing Agent, via the same Resend account this app already uses for password-reset email — no new account needed if that's already set up.",
    authType: "api_key",
    requiredEnvVars: ["RESEND_API_KEY"], // RESEND_FROM is optional — lib/mail.ts falls back to onboarding@resend.dev
    setupUrl: "https://resend.com/api-keys",
    unlocksFor: ["email-marketing", "email-deliverability", "lifecycle-nurture"],
  },
  {
    key: "sms",
    name: "SMS (Twilio)",
    category: "Messaging",
    description: "Real SMS send capability for the SMS Marketing Agent — appointment reminders, time-sensitive updates, and conversational sales via a real Twilio phone number.",
    authType: "api_key",
    requiredEnvVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM"],
    setupUrl: "https://console.twilio.com/",
    unlocksFor: ["sms-marketing", "whatsapp-sms-marketing", "omnichannel-orchestration"],
  },
  {
    key: "whatsapp",
    name: "WhatsApp (Twilio)",
    category: "Messaging",
    description: "Real WhatsApp Business send capability for the WhatsApp Marketing Agent — same Twilio account as SMS, using Twilio's WhatsApp Business API sender instead of a plain SMS number.",
    authType: "api_key",
    requiredEnvVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM"],
    setupUrl: "https://console.twilio.com/us1/develop/sms/senders/whatsapp-senders",
    unlocksFor: ["whatsapp-marketing", "whatsapp-sms-marketing", "omnichannel-orchestration"],
  },
  {
    key: "voicebot",
    name: "Voicebot (Twilio Voice)",
    category: "Messaging",
    description: "Real outbound/inbound voice call capability for the Voicebot Agent — appointment reminders and IVR qualification via Twilio Voice + a TwiML call flow, the same account as SMS/WhatsApp.",
    authType: "api_key",
    requiredEnvVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VOICE_FROM"],
    setupUrl: "https://console.twilio.com/us1/develop/voice/manage/numbers",
    unlocksFor: ["voicebot", "conversational-ai-appointment"],
  },
];

export function getIntegrationProvider(key: string): IntegrationProvider | undefined {
  return INTEGRATION_PROVIDERS.find((p) => p.key === key);
}

/** True only if every env var this provider needs is set server-side. Never returns the values themselves. */
export function isProviderConfigured(key: string): boolean {
  const provider = getIntegrationProvider(key);
  if (!provider) return false;
  return provider.requiredEnvVars.every((v) => Boolean(process.env[v]));
}
