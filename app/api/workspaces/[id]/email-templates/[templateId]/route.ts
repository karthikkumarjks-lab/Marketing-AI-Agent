import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

async function loadOwnedTemplate(workspaceId: string, templateId: string) {
  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.workspaceId !== workspaceId) return null;
  return template;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id: workspaceId, templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const template = await loadOwnedTemplate(workspaceId, templateId);
  if (!template) return NextResponse.json({ error: "Template not found." }, { status: 404 });
  return NextResponse.json(template);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id: workspaceId, templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const existing = await loadOwnedTemplate(workspaceId, templateId);
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  const body = await req.json();
  const data: Record<string, unknown> = {};
  if ("name" in body) data.name = body.name;
  if ("subject" in body) data.subject = body.subject;
  if ("htmlBody" in body) data.htmlBody = body.htmlBody;
  if ("designJson" in body) data.designJson = typeof body.designJson === "string" ? body.designJson : "{}";
  if ("isAmpEnabled" in body) data.isAmpEnabled = !!body.isAmpEnabled;
  if ("ampBody" in body) data.ampBody = body.isAmpEnabled ? body.ampBody || null : null;

  const updated = await prisma.emailTemplate.update({ where: { id: templateId }, data });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id: workspaceId, templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const existing = await loadOwnedTemplate(workspaceId, templateId);
  if (!existing) return NextResponse.json({ error: "Template not found." }, { status: 404 });

  await prisma.emailTemplate.delete({ where: { id: templateId } });
  return NextResponse.json({ ok: true });
}
