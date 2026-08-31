import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const templates = await prisma.emailTemplate.findMany({ where: { workspaceId }, orderBy: { updatedAt: "desc" } });
  return NextResponse.json(templates);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Template name is required." }, { status: 400 });
  }
  if (!body.subject || typeof body.subject !== "string") {
    return NextResponse.json({ error: "Subject is required." }, { status: 400 });
  }
  const template = await prisma.emailTemplate.create({
    data: {
      workspaceId,
      name: body.name,
      subject: body.subject,
      htmlBody: body.htmlBody || "",
      designJson: typeof body.designJson === "string" ? body.designJson : "{}",
      isAmpEnabled: !!body.isAmpEnabled,
      ampBody: body.isAmpEnabled ? body.ampBody || null : null,
    },
  });
  return NextResponse.json(template);
}
