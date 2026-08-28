import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actualOutcome, outcomeStatus } = await req.json();
  if (!["pending", "matched", "missed"].includes(outcomeStatus)) {
    return NextResponse.json({ error: "Invalid outcomeStatus." }, { status: 400 });
  }

  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const run = await prisma.agentRun.findUnique({ where: { id }, select: { workspace: { select: { userId: true } } } });
  if (!run || run.workspace.userId !== userId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const updated = await prisma.agentRun.update({
    where: { id },
    data: { actualOutcome: actualOutcome || null, outcomeStatus },
  });

  return NextResponse.json(updated);
}
