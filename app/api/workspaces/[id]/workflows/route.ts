import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TRIGGERS = ["lead_created", "stage_changed", "field_updated", "tag_added"];

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const rules = await prisma.workflowRule.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    include: { runLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Rule name is required." }, { status: 400 });
  }
  if (!VALID_TRIGGERS.includes(body.triggerType)) {
    return NextResponse.json({ error: "Invalid trigger type." }, { status: 400 });
  }
  if (!Array.isArray(body.actions) || body.actions.length === 0) {
    return NextResponse.json({ error: "At least one action is required." }, { status: 400 });
  }
  const rule = await prisma.workflowRule.create({
    data: {
      workspaceId,
      name: body.name,
      isActive: body.isActive !== false,
      triggerType: body.triggerType,
      triggerConfig: JSON.stringify(body.triggerConfig || {}),
      conditions: JSON.stringify(body.conditions || []),
      actions: JSON.stringify(body.actions),
    },
  });
  return NextResponse.json(rule);
}
