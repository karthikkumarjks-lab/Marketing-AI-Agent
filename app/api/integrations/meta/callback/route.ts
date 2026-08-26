import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { consumeOAuthState } from "@/lib/oauth-state";
import { exchangeCodeForToken, exchangeForLongLivedToken, fetchAdAccounts } from "@/lib/meta-ads-client";

function getRedirectUri(req: NextRequest): string {
  const base = process.env.APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${base}/api/integrations/meta/callback`;
}

function backToIntegrations(req: NextRequest, workspaceId: string, status: "connected" | "error", message?: string) {
  const url = new URL(`/workspaces/${workspaceId}/integrations`, req.nextUrl.origin);
  url.searchParams.set("meta_status", status);
  if (message) url.searchParams.set("meta_message", message);
  return NextResponse.redirect(url);
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const state = params.get("state");
  const code = params.get("code");
  const oauthError = params.get("error_description") || params.get("error");

  const stateEntry = state ? consumeOAuthState(state) : null;
  if (!stateEntry) {
    // No valid workspace to redirect back to — state missing/expired/replayed.
    return NextResponse.json({ error: "Invalid or expired OAuth state — please try connecting again." }, { status: 400 });
  }
  const { workspaceId } = stateEntry;

  if (oauthError) {
    return backToIntegrations(req, workspaceId, "error", oauthError);
  }
  if (!code) {
    return backToIntegrations(req, workspaceId, "error", "No authorization code returned by Meta.");
  }

  const clientId = process.env.META_APP_ID;
  const clientSecret = process.env.META_APP_SECRET;
  if (!clientId || !clientSecret) {
    return backToIntegrations(req, workspaceId, "error", "META_APP_ID/META_APP_SECRET not configured.");
  }

  try {
    const shortLived = await exchangeCodeForToken(clientId, clientSecret, getRedirectUri(req), code);
    const longLived = await exchangeForLongLivedToken(clientId, clientSecret, shortLived.accessToken);
    const accounts = await fetchAdAccounts(longLived.accessToken);

    const tokenExpiresAt = longLived.expiresInSeconds
      ? new Date(Date.now() + longLived.expiresInSeconds * 1000)
      : null;

    await prisma.integration.upsert({
      where: { workspaceId_provider: { workspaceId, provider: "meta_ads" } },
      create: {
        workspaceId,
        provider: "meta_ads",
        status: "connected",
        accessToken: longLived.accessToken,
        tokenExpiresAt,
        externalAccountId: accounts.length === 1 ? accounts[0].id : null,
        accountLabel: accounts.length === 1 ? accounts[0].name : `${accounts.length} ad accounts — select one`,
        connectedAt: new Date(),
      },
      update: {
        status: "connected",
        accessToken: longLived.accessToken,
        tokenExpiresAt,
        externalAccountId: accounts.length === 1 ? accounts[0].id : null,
        accountLabel: accounts.length === 1 ? accounts[0].name : `${accounts.length} ad accounts — select one`,
        connectedAt: new Date(),
      },
    });

    return backToIntegrations(req, workspaceId, "connected");
  } catch (err) {
    return backToIntegrations(req, workspaceId, "error", err instanceof Error ? err.message : "Connection failed.");
  }
}
