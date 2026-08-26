// Real Meta (Facebook/Instagram) Ads OAuth + Marketing API client. Graph API
// version confirmed current as of 2026-08-26 (Meta versions quarterly with a
// ~2-year support window). Meta enforces HTTPS on OAuth redirect URIs with
// no documented localhost exception — confirmed directly against Meta's own
// "Login Security" docs before building this, so local testing may need an
// HTTPS tunnel (e.g. ngrok) pointed at localhost:3000 rather than a plain
// http:// redirect URI. See app/api/integrations/meta/{authorize,callback}.

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
const OAUTH_DIALOG_BASE = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;

// ads_read is enough to pull campaign/spend/performance data — deliberately
// not requesting ads_management, which allows CHANGING campaigns. This
// system only ever reads and reasons, never edits a client's live ad account.
const OAUTH_SCOPE = "ads_read";

export function getMetaAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: OAUTH_SCOPE,
    response_type: "code",
  });
  return `${OAUTH_DIALOG_BASE}?${params.toString()}`;
}

interface MetaTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

async function metaFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok) {
    const message = data?.error?.message || `Meta API request failed (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

export async function exchangeCodeForToken(
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  code: string,
): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    code,
  });
  const data = await metaFetch<MetaTokenResponse>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? null };
}

/** Short-lived tokens (1-2hr) must be exchanged for a long-lived one (~60 days) to be usable for ongoing agent runs. */
export async function exchangeForLongLivedToken(
  clientId: string,
  clientSecret: string,
  shortLivedToken: string,
): Promise<{ accessToken: string; expiresInSeconds: number | null }> {
  const params = new URLSearchParams({
    grant_type: "fb_exchange_token",
    client_id: clientId,
    client_secret: clientSecret,
    fb_exchange_token: shortLivedToken,
  });
  const data = await metaFetch<MetaTokenResponse>(`${GRAPH_BASE}/oauth/access_token?${params.toString()}`);
  return { accessToken: data.access_token, expiresInSeconds: data.expires_in ?? null };
}

export interface MetaAdAccount {
  id: string; // "act_123456789"
  name: string;
  accountStatus: number;
  currency: string;
}

interface AdAccountsResponse {
  data: { id: string; name: string; account_status: number; currency: string }[];
}

export async function fetchAdAccounts(accessToken: string): Promise<MetaAdAccount[]> {
  const params = new URLSearchParams({ access_token: accessToken, fields: "id,name,account_status,currency" });
  const data = await metaFetch<AdAccountsResponse>(`${GRAPH_BASE}/me/adaccounts?${params.toString()}`);
  return data.data.map((a) => ({ id: a.id, name: a.name, accountStatus: a.account_status, currency: a.currency }));
}

export interface MetaAdInsights {
  dateRangeLabel: string;
  spend: number;
  currency: string;
  impressions: number;
  clicks: number;
  ctr: number | null;
  cpc: number | null;
  conversions: number | null;
  costPerConversion: number | null;
  campaigns: { name: string; spend: number; impressions: number; clicks: number }[];
}

interface InsightsRow {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  actions?: { action_type: string; value: string }[];
  cost_per_action_type?: { action_type: string; value: string }[];
}

interface InsightsResponse {
  data: InsightsRow[];
}

interface CampaignInsightsRow extends InsightsRow {
  campaign_name?: string;
}

/** Real account-level + per-campaign performance for the last 30 days. Never fabricated — throws if the API call fails, rather than returning fake numbers. */
export async function fetchAdAccountInsights(accessToken: string, accountId: string): Promise<MetaAdInsights> {
  const accountFields = "spend,impressions,clicks,ctr,cpc,actions,cost_per_action_type";
  const accountParams = new URLSearchParams({
    access_token: accessToken,
    date_preset: "last_30d",
    fields: accountFields,
  });
  const accountData = await metaFetch<InsightsResponse>(`${GRAPH_BASE}/${accountId}/insights?${accountParams.toString()}`);
  const row = accountData.data[0];

  const leadAction = row?.actions?.find((a) => a.action_type === "lead" || a.action_type === "offsite_conversion.fb_pixel_lead");
  const leadCost = row?.cost_per_action_type?.find((a) => a.action_type === leadAction?.action_type);

  const campaignParams = new URLSearchParams({
    access_token: accessToken,
    date_preset: "last_30d",
    level: "campaign",
    fields: "campaign_name,spend,impressions,clicks",
    limit: "25",
  });
  const campaignData = await metaFetch<{ data: CampaignInsightsRow[] }>(
    `${GRAPH_BASE}/${accountId}/insights?${campaignParams.toString()}`,
  );

  return {
    dateRangeLabel: "Last 30 days",
    spend: row ? parseFloat(row.spend ?? "0") : 0,
    currency: "account currency (see ad account settings)",
    impressions: row ? parseInt(row.impressions ?? "0", 10) : 0,
    clicks: row ? parseInt(row.clicks ?? "0", 10) : 0,
    ctr: row?.ctr ? parseFloat(row.ctr) : null,
    cpc: row?.cpc ? parseFloat(row.cpc) : null,
    conversions: leadAction ? parseFloat(leadAction.value) : null,
    costPerConversion: leadCost ? parseFloat(leadCost.value) : null,
    campaigns: campaignData.data.map((c) => ({
      name: c.campaign_name ?? "(unnamed campaign)",
      spend: parseFloat(c.spend ?? "0"),
      impressions: parseInt(c.impressions ?? "0", 10),
      clicks: parseInt(c.clicks ?? "0", 10),
    })),
  };
}
