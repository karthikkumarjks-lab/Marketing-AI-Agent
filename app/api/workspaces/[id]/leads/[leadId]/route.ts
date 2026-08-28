import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseTags } from "@/lib/crm";
import { runWorkflowsForEvent } from "@/lib/workflow-engine";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; leadId: string }> }) {
  const { leadId } = await params;
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: {
      stage: true,
      activities: { orderBy: { occurredAt: "desc" } },
      agentRuns: { include: { agent: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  return NextResponse.json(lead);
}

const DIRECT_FIELDS = ["name", "email", "phone", "company", "source", "ownerName"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; leadId: string }> }) {
  const { id: workspaceId, leadId } = await params;
  const body = await req.json();

  const existing = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!existing) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  for (const field of DIRECT_FIELDS) {
    if (field in body) data[field] = body[field] || null;
  }
  if ("score" in body) data.score = body.score != null && body.score !== "" ? Number(body.score) : null;
  if ("dealValue" in body) data.dealValue = body.dealValue != null && body.dealValue !== "" ? Number(body.dealValue) : null;

  let stageChanged = false;
  if ("stageId" in body && body.stageId !== existing.stageId) {
    data.stageId = body.stageId;
    stageChanged = true;
  }

  let customFieldsChanged = false;
  if ("customFields" in body) {
    data.customFields = JSON.stringify(body.customFields || {});
    customFieldsChanged = true;
  }

  let tagAdded = false;
  if ("tags" in body) {
    const newTags: string[] = Array.isArray(body.tags) ? body.tags : [];
    const oldTags = parseTags(existing.tags);
    tagAdded = newTags.some((t) => !oldTags.includes(t));
    data.tags = JSON.stringify(newTags);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  }

  const updated = await prisma.lead.update({ where: { id: leadId }, data, include: { stage: true } });

  if (stageChanged) {
    const newStage = await prisma.pipelineStage.findUnique({ where: { id: updated.stageId! } });
    await prisma.leadActivity.create({
      data: { leadId, type: "stage_change", channel: "system", summary: `Stage changed to "${newStage?.name ?? "unknown"}"` },
    });
  }
  if (customFieldsChanged && !stageChanged) {
    await prisma.leadActivity.create({
      data: { leadId, type: "field_update", channel: "system", summary: "Custom fields updated" },
    });
  }

  // Fire triggers in a sensible order — a stage change is the more specific
  // event when both happened in the same PATCH.
  if (stageChanged) await runWorkflowsForEvent(workspaceId, "stage_changed", leadId);
  else if (customFieldsChanged) await runWorkflowsForEvent(workspaceId, "field_updated", leadId);
  if (tagAdded) await runWorkflowsForEvent(workspaceId, "tag_added", leadId);

  const withStage = await prisma.lead.findUnique({ where: { id: leadId }, include: { stage: true } });
  return NextResponse.json(withStage);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; leadId: string }> }) {
  const { leadId } = await params;
  await prisma.lead.delete({ where: { id: leadId } });
  return NextResponse.json({ ok: true });
}
