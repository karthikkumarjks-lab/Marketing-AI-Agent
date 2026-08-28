import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function PATCH(req: NextRequest) {
  const { workspaceId, agentId, status } = await req.json();
  if (!workspaceId || !agentId || !["active", "idle", null].includes(status)) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const updated = await prisma.needsAnalysis.update({
    where: { workspaceId_agentId: { workspaceId, agentId } },
    data: { overriddenStatus: status },
  });

  return NextResponse.json(updated);
}
