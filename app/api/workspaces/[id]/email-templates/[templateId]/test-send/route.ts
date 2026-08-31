import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";
import { sendEmail } from "@/lib/mail";

// A single real send to one address you type in — for checking how the
// template actually renders in a real inbox before running it as a bulk
// campaign or attaching it to a workflow. Never touches real lead data.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; templateId: string }> }) {
  const { id: workspaceId, templateId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.workspaceId !== workspaceId) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const body = await req.json();
  const to = typeof body.to === "string" ? body.to.trim() : "";
  if (!to || !to.includes("@")) {
    return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
  }

  const result = await sendEmail({ to, subject: `[TEST] ${template.subject}`, html: template.htmlBody });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true });
}
