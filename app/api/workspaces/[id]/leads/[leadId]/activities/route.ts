import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

// Manual timeline entries (a note, a logged call, etc.) — for anything a
// workflow rule doesn't already generate automatically. "email"/"sms"
// entered here are just as much a manual log as "call"/"note" — there's no
// live send behind any of them without a connected provider (see the
// workflow engine's log_email/log_sms for the same disclosure).
const VALID_TYPES = ["note", "call", "email", "sms"] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; leadId: string }> }) {
  const { id: workspaceId, leadId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, select: { workspaceId: true } });
  if (!lead || lead.workspaceId !== workspaceId) return NextResponse.json({ error: "Lead not found." }, { status: 404 });

  const body = await req.json();
  const type = VALID_TYPES.includes(body.type) ? body.type : "note";
  if (!body.summary || typeof body.summary !== "string") {
    return NextResponse.json({ error: "summary is required." }, { status: 400 });
  }
  const activity = await prisma.leadActivity.create({
    data: {
      leadId,
      type,
      channel: type === "note" ? "system" : type,
      summary: body.summary,
      detail: body.detail ? JSON.stringify(body.detail) : null,
    },
  });
  return NextResponse.json(activity);
}
