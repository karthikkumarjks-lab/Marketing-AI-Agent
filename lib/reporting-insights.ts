import { prisma } from "./prisma";

// Real performance data, not the Reports tab's raw tiles repeated — this
// synthesizes what's actually happening (real send success rates, real
// workflow reliability, real pipeline outcomes) into something an agent
// can narrate, distinct from CRM Audit (data hygiene) and Lifecycle
// (stuck leads). Every number is a real aggregate query.
export interface ActivityTypeStat {
  type: string;
  count: number;
}

export interface CampaignSendStat {
  templateName: string;
  sentCount: number;
  failedCount: number;
}

export interface WorkflowRunStat {
  ruleName: string;
  isActive: boolean;
  successCount: number;
  errorCount: number;
}

export interface ReportingSnapshot {
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  openLeads: number;
  activityByType: ActivityTypeStat[];
  campaignSends: CampaignSendStat[];
  workflowRuns: WorkflowRunStat[];
}

export async function computeReportingSnapshot(workspaceId: string): Promise<ReportingSnapshot> {
  const [leads, stages, activities, workflowRules, runLogs] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId }, select: { id: true, stageId: true } }),
    prisma.pipelineStage.findMany({ where: { workspaceId } }),
    prisma.leadActivity.findMany({ where: { lead: { workspaceId } }, select: { type: true, detail: true } }),
    prisma.workflowRule.findMany({ where: { workspaceId }, select: { id: true, name: true, isActive: true } }),
    prisma.workflowRunLog.findMany({ where: { workflow: { workspaceId } }, select: { workflowId: true, status: true } }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const wonLeads = leads.filter((l) => l.stageId && stageById.get(l.stageId)?.isWon).length;
  const lostLeads = leads.filter((l) => l.stageId && stageById.get(l.stageId)?.isLost).length;

  const activityTypeCounts = new Map<string, number>();
  const campaignBySubject = new Map<string, { sent: number; failed: number }>();
  for (const a of activities) {
    activityTypeCounts.set(a.type, (activityTypeCounts.get(a.type) ?? 0) + 1);
    if (a.type !== "email" || !a.detail) continue;
    try {
      const detail = JSON.parse(a.detail) as { subject?: string; actuallySent?: boolean };
      if (!detail.subject) continue;
      const entry = campaignBySubject.get(detail.subject) ?? { sent: 0, failed: 0 };
      if (detail.actuallySent) entry.sent++;
      else entry.failed++;
      campaignBySubject.set(detail.subject, entry);
    } catch {
      // Not a campaign-send activity — ignore.
    }
  }

  const runsByWorkflow = new Map<string, { success: number; error: number }>();
  for (const r of runLogs) {
    const entry = runsByWorkflow.get(r.workflowId) ?? { success: 0, error: 0 };
    if (r.status === "success") entry.success++;
    else entry.error++;
    runsByWorkflow.set(r.workflowId, entry);
  }

  return {
    totalLeads: leads.length,
    wonLeads,
    lostLeads,
    openLeads: leads.length - wonLeads - lostLeads,
    activityByType: [...activityTypeCounts.entries()].map(([type, count]) => ({ type, count })).sort((a, b) => b.count - a.count),
    campaignSends: [...campaignBySubject.entries()].map(([templateName, s]) => ({ templateName, sentCount: s.sent, failedCount: s.failed })),
    workflowRuns: workflowRules.map((r) => {
      const s = runsByWorkflow.get(r.id) ?? { success: 0, error: 0 };
      return { ruleName: r.name, isActive: r.isActive, successCount: s.success, errorCount: s.error };
    }),
  };
}
