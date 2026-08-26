import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIntegrationProvider } from "@/lib/integrations";

// For most providers, no live OAuth flow exists yet (see lib/integrations.ts)
// — this route lets a human record that they've connected an account
// manually elsewhere and label it. Meta Ads is the one exception: it has a
// real OAuth flow (see app/api/integrations/meta/*), so this route also
// handles disconnecting it for real (clearing the stored token) and setting
// which ad account to use when the account has more than one.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { provider, status, accountLabel, externalAccountId } = body as {
    provider?: string;
    status?: "not_connected" | "connected";
    accountLabel?: string;
    externalAccountId?: string;
  };

  if (!provider || !getIntegrationProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
  }

  // Account-selection-only update: don't touch status/token, just record
  // which ad account this workspace should pull live data from.
  if (status === undefined && externalAccountId) {
    const integration = await prisma.integration.update({
      where: { workspaceId_provider: { workspaceId: id, provider } },
      data: { externalAccountId },
    });
    return NextResponse.json(integration);
  }

  if (status !== "connected" && status !== "not_connected") {
    return NextResponse.json({ error: "status must be 'connected' or 'not_connected'." }, { status: 400 });
  }

  const integration = await prisma.integration.upsert({
    where: { workspaceId_provider: { workspaceId: id, provider } },
    create: {
      workspaceId: id,
      provider,
      status,
      accountLabel: accountLabel || null,
      connectedAt: status === "connected" ? new Date() : null,
    },
    update: {
      status,
      accountLabel: status === "connected" ? accountLabel || null : null,
      connectedAt: status === "connected" ? new Date() : null,
      // Disconnecting clears any real token this provider might hold —
      // a "not connected" state should mean genuinely no stored credential.
      accessToken: status === "not_connected" ? null : undefined,
      tokenExpiresAt: status === "not_connected" ? null : undefined,
      externalAccountId: status === "not_connected" ? null : undefined,
    },
  });

  return NextResponse.json(integration);
}
