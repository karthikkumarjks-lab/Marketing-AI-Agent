import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("order" in body) data.order = Number(body.order);
  if ("isWon" in body) data.isWon = !!body.isWon;
  if ("isLost" in body) data.isLost = !!body.isLost;
  const stage = await prisma.pipelineStage.update({ where: { id: stageId }, data });
  return NextResponse.json(stage);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ stageId: string }> }) {
  const { stageId } = await params;
  // Leads pointing at this stage fall back to unassigned rather than being
  // deleted — losing a lead because a stage was renamed away would be a
  // real data-loss bug, not a cleanup.
  await prisma.lead.updateMany({ where: { stageId }, data: { stageId: null } });
  await prisma.pipelineStage.delete({ where: { id: stageId } });
  return NextResponse.json({ ok: true });
}
