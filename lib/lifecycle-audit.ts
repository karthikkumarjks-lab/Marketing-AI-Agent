import { prisma } from "./prisma";

// A distinct real signal from CRM Audit's "stale" check — that flags leads
// with no logged ACTIVITY; this flags leads with no logged STAGE CHANGE.
// A lead can have plenty of notes/calls logged and still be genuinely stuck
// — sales keeps "working" it without ever actually advancing the deal.
// Real data: each open (not won/lost) lead's time since its last real
// stage_change LeadActivity, falling back to when the lead was created if
// it has never changed stage at all.
const STUCK_THRESHOLD_DAYS = 21;

export interface StuckLead {
  leadName: string;
  stageName: string;
  daysInStage: number;
}

export interface StageOpenSummary {
  stageName: string;
  openCount: number;
  avgDaysInStage: number;
}

export interface LifecycleSnapshot {
  totalOpenLeads: number;
  stuckThresholdDays: number;
  stuckLeads: StuckLead[];
  byStage: StageOpenSummary[];
}

export async function computeLifecycleSnapshot(workspaceId: string): Promise<LifecycleSnapshot> {
  const [leads, stages, stageChanges] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId } }),
    prisma.pipelineStage.findMany({ where: { workspaceId } }),
    prisma.leadActivity.findMany({
      where: { lead: { workspaceId }, type: "stage_change" },
      orderBy: { occurredAt: "desc" },
      select: { leadId: true, occurredAt: true },
    }),
  ]);

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const lastStageChangeByLead = new Map<string, Date>();
  for (const c of stageChanges) {
    if (!lastStageChangeByLead.has(c.leadId)) lastStageChangeByLead.set(c.leadId, c.occurredAt);
  }

  const now = Date.now();
  const daysSince = (d: Date) => Math.floor((now - d.getTime()) / 86400000);

  const openLeads = leads.filter((l) => {
    const stage = l.stageId ? stageById.get(l.stageId) : null;
    return !stage?.isWon && !stage?.isLost;
  });

  const stuckLeads: StuckLead[] = [];
  const stageStats = new Map<string, { count: number; totalDays: number }>();

  for (const l of openLeads) {
    const stage = l.stageId ? stageById.get(l.stageId) : null;
    const stageName = stage?.name ?? "No stage assigned";
    const baseline = lastStageChangeByLead.get(l.id) ?? l.createdAt;
    const days = daysSince(baseline);

    const stat = stageStats.get(stageName) ?? { count: 0, totalDays: 0 };
    stat.count++;
    stat.totalDays += days;
    stageStats.set(stageName, stat);

    if (days >= STUCK_THRESHOLD_DAYS) {
      stuckLeads.push({ leadName: l.name, stageName, daysInStage: days });
    }
  }
  stuckLeads.sort((a, b) => b.daysInStage - a.daysInStage);

  const byStage: StageOpenSummary[] = [...stageStats.entries()]
    .map(([stageName, s]) => ({ stageName, openCount: s.count, avgDaysInStage: Math.round(s.totalDays / s.count) }))
    .sort((a, b) => b.avgDaysInStage - a.avgDaysInStage);

  return { totalOpenLeads: openLeads.length, stuckThresholdDays: STUCK_THRESHOLD_DAYS, stuckLeads, byStage };
}
