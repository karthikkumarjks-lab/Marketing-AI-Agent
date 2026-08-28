import { NextRequest, NextResponse } from "next/server";
import { getMetaAuthorizeUrl } from "@/lib/meta-ads-client";
import { createOAuthState } from "@/lib/oauth-state";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

function getRedirectUri(req: NextRequest): string {
  const base = process.env.APP_BASE_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
  return `${base}/api/integrations/meta/callback`;
}

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const clientId = process.env.META_APP_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "META_APP_ID is not set in .env.local — register a Meta app first." },
      { status: 400 },
    );
  }

  const state = createOAuthState(workspaceId, "meta_ads");
  const authorizeUrl = getMetaAuthorizeUrl(clientId, getRedirectUri(req), state);
  return NextResponse.redirect(authorizeUrl);
}
