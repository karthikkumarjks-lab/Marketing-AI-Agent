import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";
import { sendEmail } from "@/lib/mail";
import { parseTags } from "@/lib/crm";
import { personalizeEmailHtml } from "@/lib/email-personalize";

// Bulk campaign send — same sendEmail() as the workflow action and test-send
// use, just looped over a real recipient list from this workspace's leads.
// Sequential with a stagger, not parallel: the carousel-image feature hit a
// real burst-rate-limit bug from firing several external requests at once,
// and there's no reason to assume an ESP behaves differently. Runs inside
// one request/response cycle — fine for a typical CRM list, but there's no
// background-job queue in this app, so a very large campaign (low
// thousands+) risks the serverless function's own execution time limit.
// That's a real, disclosed limit, not silently swallowed.
const SEND_STAGGER_MS = 400;

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
  const filter = body.recipientFilter ?? { type: "all" };

  const leads = await prisma.lead.findMany({
    where: { workspaceId },
    select: { id: true, name: true, email: true, company: true, customFields: true, stageId: true, tags: true },
  });
  const targeted = leads.filter((lead) => {
    if (filter.type === "stage") return lead.stageId === filter.stageId;
    if (filter.type === "tag") return parseTags(lead.tags).includes(filter.tag);
    return true;
  });

  let sent = 0;
  let failed = 0;
  const skippedNoEmail = targeted.filter((l) => !l.email).length;
  const recipients = targeted.filter((l) => !!l.email);

  for (let i = 0; i < recipients.length; i++) {
    const lead = recipients[i];
    if (i > 0) await new Promise((r) => setTimeout(r, SEND_STAGGER_MS));

    const personalizedHtml = personalizeEmailHtml(template.htmlBody, lead);
    const result = await sendEmail({ to: lead.email!, subject: template.subject, html: personalizedHtml });

    if (result.ok) sent++;
    else failed++;

    await prisma.leadActivity.create({
      data: {
        leadId: lead.id,
        type: "email",
        channel: "email",
        summary: result.ok ? `Campaign sent: ${template.subject}` : `Campaign send failed: ${template.subject}`,
        detail: JSON.stringify({ templateId, subject: template.subject, actuallySent: result.ok, error: result.error ?? null }),
      },
    });
  }

  return NextResponse.json({ targeted: targeted.length, sent, failed, skippedNoEmail });
}
