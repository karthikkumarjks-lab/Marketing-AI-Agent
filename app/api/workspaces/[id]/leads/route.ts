import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { runWorkflowsForEvent } from "@/lib/workflow-engine";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  await ensureDefaultStages(workspaceId);
  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    include: { stage: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(leads);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Lead name is required." }, { status: 400 });
  }

  const stages = await ensureDefaultStages(workspaceId);
  const stageId = body.stageId || stages[0]?.id || null;

  const lead = await prisma.lead.create({
    data: {
      workspaceId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      company: body.company || null,
      source: body.source || null,
      stageId,
      score: body.score != null && body.score !== "" ? Number(body.score) : null,
      dealValue: body.dealValue != null && body.dealValue !== "" ? Number(body.dealValue) : null,
      ownerName: body.ownerName || null,
      customFields: JSON.stringify(body.customFields || {}),
      tags: JSON.stringify(body.tags || []),
    },
  });

  await prisma.leadActivity.create({
    data: { leadId: lead.id, type: "created", channel: "system", summary: `Lead created${body.source ? ` (source: ${body.source})` : ""}` },
  });

  await runWorkflowsForEvent(workspaceId, "lead_created", lead.id);

  const withStage = await prisma.lead.findUnique({ where: { id: lead.id }, include: { stage: true } });
  return NextResponse.json(withStage);
}
