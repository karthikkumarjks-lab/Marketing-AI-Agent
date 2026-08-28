import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("isActive" in body) data.isActive = !!body.isActive;
  if ("triggerType" in body) data.triggerType = body.triggerType;
  if ("triggerConfig" in body) data.triggerConfig = JSON.stringify(body.triggerConfig || {});
  if ("conditions" in body) data.conditions = JSON.stringify(body.conditions || []);
  if ("actions" in body) data.actions = JSON.stringify(body.actions || []);
  const rule = await prisma.workflowRule.update({ where: { id: workflowId }, data });
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ workflowId: string }> }) {
  const { workflowId } = await params;
  await prisma.workflowRule.delete({ where: { id: workflowId } });
  return NextResponse.json({ ok: true });
}
