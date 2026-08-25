import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getIntegrationProvider } from "@/lib/integrations";

// No live OAuth flow exists yet (see lib/integrations.ts). This route only
// lets a human record that they've connected an account manually elsewhere
// and label it — it does not perform, verify, or revoke any real connection.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { provider, status, accountLabel } = body as {
    provider?: string;
    status?: "not_connected" | "connected";
    accountLabel?: string;
  };

  if (!provider || !getIntegrationProvider(provider)) {
    return NextResponse.json({ error: "Unknown provider." }, { status: 400 });
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
    },
  });

  return NextResponse.json(integration);
}
