import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { id: workspaceId, stageId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { workspaceId: true } });
  if (!stage || stage.workspaceId !== workspaceId) return NextResponse.json({ error: "Stage not found." }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("order" in body) data.order = Number(body.order);
  if ("isWon" in body) data.isWon = !!body.isWon;
  if ("isLost" in body) data.isLost = !!body.isLost;
  const updated = await prisma.pipelineStage.update({ where: { id: stageId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; stageId: string }> }) {
  const { id: workspaceId, stageId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const stage = await prisma.pipelineStage.findUnique({ where: { id: stageId }, select: { workspaceId: true } });
  if (!stage || stage.workspaceId !== workspaceId) return NextResponse.json({ error: "Stage not found." }, { status: 404 });

  // Leads pointing at this stage fall back to unassigned rather than being
  // deleted — losing a lead because a stage was renamed away would be a
  // real data-loss bug, not a cleanup.
  await prisma.lead.updateMany({ where: { stageId }, data: { stageId: null } });
  await prisma.pipelineStage.delete({ where: { id: stageId } });
  return NextResponse.json({ ok: true });
}
