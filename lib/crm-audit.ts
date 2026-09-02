import { prisma } from "./prisma";
import { parseCustomFields, parseTags } from "./crm";

// A real audit of this workspace's actual CRM data — every other
// "CRM & Lead Operations" agent designs schema/rules in the abstract and
// says so plainly ("no live CRM connection"); this one is the one exception,
// same live-data pattern as the website scan agent. Every number here comes
// from a real Prisma query against this workspace's real leads, never
// estimated or invented — that's what buildCrmAuditContext hands the LLM,
// whose job is to prioritize and explain these real findings, not guess at
// data it doesn't have.
const STALE_DAYS = 30;

export interface CrmAuditSnapshot {
  totalLeads: number;
  missingEmail: number;
  missingPhone: number;
  missingBoth: number;
  noStageAssigned: number;
  stageDistribution: { stageName: string; count: number; isWon: boolean; isLost: boolean }[];
  hasWonStage: boolean;
  hasLostStage: boolean;
  duplicateEmailGroups: { email: string; leadNames: string[] }[];
  neverContactedCount: number;
  staleCount: number;
  staleDays: number;
  customFieldCompleteness: { label: string; key: string; filledPct: number }[];
  noTagsCount: number;
  missingDealValueCount: number;
  workflowRuleCount: number;
  inactiveWorkflowRuleCount: number;
  malformedWorkflowRuleCount: number;
}

export async function computeCrmAuditSnapshot(workspaceId: string): Promise<CrmAuditSnapshot> {
  const [leads, stages, customFieldDefs, workflowRules, activityCounts, lastActivityByLead] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId } }),
    prisma.pipelineStage.findMany({ where: { workspaceId } }),
    prisma.customFieldDef.findMany({ where: { workspaceId, entity: "lead" } }),
    prisma.workflowRule.findMany({ where: { workspaceId } }),
    prisma.leadActivity.groupBy({ by: ["leadId"], where: { lead: { workspaceId } }, _count: { id: true } }),
    prisma.leadActivity.groupBy({ by: ["leadId"], where: { lead: { workspaceId } }, _max: { occurredAt: true } }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const activityCountByLead = new Map(activityCounts.map((a) => [a.leadId, a._count.id]));
  const lastActivityMap = new Map(lastActivityByLead.map((a) => [a.leadId, a._max.occurredAt]));

  const missingEmail = leads.filter((l) => !l.email).length;
  const missingPhone = leads.filter((l) => !l.phone).length;
  const missingBoth = leads.filter((l) => !l.email && !l.phone).length;
  const noStageAssigned = leads.filter((l) => !l.stageId).length;

  const stageCounts = new Map<string, number>();
  for (const l of leads) {
    if (l.stageId) stageCounts.set(l.stageId, (stageCounts.get(l.stageId) ?? 0) + 1);
  }
  const stageDistribution = stages
    .map((s) => ({ stageName: s.name, count: stageCounts.get(s.id) ?? 0, isWon: s.isWon, isLost: s.isLost }))
    .sort((a, b) => a.stageName.localeCompare(b.stageName));

  const emailGroups = new Map<string, string[]>();
  for (const l of leads) {
    if (!l.email) continue;
    const key = l.email.trim().toLowerCase();
    const group = emailGroups.get(key) ?? [];
    group.push(l.name);
    emailGroups.set(key, group);
  }
  const duplicateEmailGroups = [...emailGroups.entries()]
    .filter(([, names]) => names.length > 1)
    .map(([email, leadNames]) => ({ email, leadNames }));

  const staleCutoff = new Date(Date.now() - STALE_DAYS * 86400000);
  let neverContactedCount = 0;
  let staleCount = 0;
  for (const l of leads) {
    const stage = l.stageId ? stageById.get(l.stageId) : null;
    if (stage?.isWon || stage?.isLost) continue; // closed leads aren't "going stale"
    const count = activityCountByLead.get(l.id) ?? 0;
    if (count === 0) {
      neverContactedCount++;
      continue;
    }
    const last = lastActivityMap.get(l.id);
    if (last && last < staleCutoff) staleCount++;
  }

  const customFieldCompleteness = customFieldDefs.map((def) => {
    const filled = leads.filter((l) => {
      const fields = parseCustomFields(l.customFields);
      const val = fields[def.key];
      return val != null && val !== "";
    }).length;
    return { label: def.label, key: def.key, filledPct: leads.length > 0 ? Math.round((filled / leads.length) * 100) : 0 };
  });

  const noTagsCount = leads.filter((l) => parseTags(l.tags).length === 0).length;
  const missingDealValueCount = leads.filter((l) => l.dealValue == null).length;

  let malformedWorkflowRuleCount = 0;
  for (const r of workflowRules) {
    try {
      JSON.parse(r.conditions);
      JSON.parse(r.actions);
    } catch {
      malformedWorkflowRuleCount++;
    }
  }

  return {
    totalLeads: leads.length,
    missingEmail,
    missingPhone,
    missingBoth,
    noStageAssigned,
    stageDistribution,
    hasWonStage: stages.some((s) => s.isWon),
    hasLostStage: stages.some((s) => s.isLost),
    duplicateEmailGroups,
    neverContactedCount,
    staleCount,
    staleDays: STALE_DAYS,
    customFieldCompleteness,
    noTagsCount,
    missingDealValueCount,
    workflowRuleCount: workflowRules.length,
    inactiveWorkflowRuleCount: workflowRules.filter((r) => !r.isActive).length,
    malformedWorkflowRuleCount,
  };
}
