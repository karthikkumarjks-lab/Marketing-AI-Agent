import { prisma } from "./prisma";

// Real pre-flight checks against one saved email template's actual HTML and
// this workspace's actual lead list — every number here is real, parsed
// from the template that would genuinely be used to send, never invented.
// The Email Builder itself has no pre-send validation; this is that check.

const KNOWN_MERGE_TAG_RE = /^lead\.(name|email|company|customFields\.[a-zA-Z0-9_]+)$/;
const MERGE_TAG_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const LINK_RE = /<a\b[^>]*\bhref="([^"]*)"[^>]*>/gi;

export interface CampaignQaSnapshot {
  found: boolean;
  templateName: string;
  subject: string;
  isAmpEnabled: boolean;
  linkCount: number;
  brokenLinks: string[];
  unresolvedMergeTags: string[];
  hasUnsubscribeLink: boolean;
  targetedLeadCount: number;
  skippedNoEmailCount: number;
  duplicateEmailInTargetCount: number;
}

export async function computeCampaignQaSnapshot(workspaceId: string, templateId: string | null): Promise<CampaignQaSnapshot> {
  const empty: CampaignQaSnapshot = {
    found: false,
    templateName: "",
    subject: "",
    isAmpEnabled: false,
    linkCount: 0,
    brokenLinks: [],
    unresolvedMergeTags: [],
    hasUnsubscribeLink: false,
    targetedLeadCount: 0,
    skippedNoEmailCount: 0,
    duplicateEmailInTargetCount: 0,
  };
  if (!templateId) return empty;

  const template = await prisma.emailTemplate.findUnique({ where: { id: templateId } });
  if (!template || template.workspaceId !== workspaceId) return empty;

  const html = template.htmlBody;

  const brokenLinks: string[] = [];
  let linkCount = 0;
  let hasUnsubscribeLink = false;
  for (const m of html.matchAll(LINK_RE)) {
    linkCount++;
    const href = m[1].trim();
    if (!href || href === "#") brokenLinks.push(m[0].slice(0, 80));
    if (href.includes("{{") || href.includes("}}")) brokenLinks.push(m[0].slice(0, 80));
    if (/unsubscribe/i.test(m[0])) hasUnsubscribeLink = true;
  }

  const unresolvedMergeTags = new Set<string>();
  for (const m of html.matchAll(MERGE_TAG_RE)) {
    if (!KNOWN_MERGE_TAG_RE.test(m[1])) unresolvedMergeTags.add(m[1]);
  }

  const leads = await prisma.lead.findMany({ where: { workspaceId }, select: { email: true } });
  const skippedNoEmailCount = leads.filter((l) => !l.email).length;
  const withEmail = leads.filter((l) => !!l.email).map((l) => l.email!.trim().toLowerCase());
  const seen = new Set<string>();
  let duplicateEmailInTargetCount = 0;
  for (const e of withEmail) {
    if (seen.has(e)) duplicateEmailInTargetCount++;
    else seen.add(e);
  }

  return {
    found: true,
    templateName: template.name,
    subject: template.subject,
    isAmpEnabled: template.isAmpEnabled,
    linkCount,
    brokenLinks,
    unresolvedMergeTags: [...unresolvedMergeTags],
    hasUnsubscribeLink,
    targetedLeadCount: leads.length,
    skippedNoEmailCount,
    duplicateEmailInTargetCount,
  };
}
