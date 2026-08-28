import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  const { id: workspaceId, workflowId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const rule = await prisma.workflowRule.findUnique({ where: { id: workflowId }, select: { workspaceId: true } });
  if (!rule || rule.workspaceId !== workspaceId) return NextResponse.json({ error: "Rule not found." }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("isActive" in body) data.isActive = !!body.isActive;
  if ("triggerType" in body) data.triggerType = body.triggerType;
  if ("triggerConfig" in body) data.triggerConfig = JSON.stringify(body.triggerConfig || {});
  if ("conditions" in body) data.conditions = JSON.stringify(body.conditions || []);
  if ("actions" in body) data.actions = JSON.stringify(body.actions || []);
  const updated = await prisma.workflowRule.update({ where: { id: workflowId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; workflowId: string }> }) {
  const { id: workspaceId, workflowId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const rule = await prisma.workflowRule.findUnique({ where: { id: workflowId }, select: { workspaceId: true } });
  if (!rule || rule.workspaceId !== workspaceId) return NextResponse.json({ error: "Rule not found." }, { status: 404 });

  await prisma.workflowRule.delete({ where: { id: workflowId } });
  return NextResponse.json({ ok: true });
}
