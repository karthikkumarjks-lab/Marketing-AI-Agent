import { prisma } from "./prisma";

// Real per-source performance — grades lead sources by their actual real
// win rate and deal value, not a general "which channels are usually
// good" reasoning pass. Every number is a real aggregate over this
// workspace's actual leads and their actual stage outcomes.
export interface SourceStats {
  source: string;
  totalLeads: number;
  wonCount: number;
  lostCount: number;
  openCount: number;
  winRatePct: number | null; // null when there's not yet a single closed (won or lost) lead to compute a rate from
  avgWonDealValue: number | null;
}

export interface LeadQualitySnapshot {
  totalLeads: number;
  missingSourceCount: number;
  bySource: SourceStats[];
  currency: string;
}

export async function computeLeadQualitySnapshot(workspaceId: string): Promise<LeadQualitySnapshot> {
  const [leads, stages, workspace] = await Promise.all([
    prisma.lead.findMany({ where: { workspaceId } }),
    prisma.pipelineStage.findMany({ where: { workspaceId } }),
    prisma.workspace.findUnique({ where: { id: workspaceId }, select: { currency: true } }),
  ]);
  const stageById = new Map(stages.map((s) => [s.id, s]));

  const bySourceMap = new Map<string, { total: number; won: number; lost: number; open: number; wonDealValues: number[] }>();
  let missingSourceCount = 0;

  for (const l of leads) {
    const source = l.source?.trim() || null;
    if (!source) {
      missingSourceCount++;
      continue;
    }
    const stage = l.stageId ? stageById.get(l.stageId) : null;
    const entry = bySourceMap.get(source) ?? { total: 0, won: 0, lost: 0, open: 0, wonDealValues: [] };
    entry.total++;
    if (stage?.isWon) {
      entry.won++;
      if (l.dealValue != null) entry.wonDealValues.push(l.dealValue);
    } else if (stage?.isLost) {
      entry.lost++;
    } else {
      entry.open++;
    }
    bySourceMap.set(source, entry);
  }

  const bySource: SourceStats[] = [...bySourceMap.entries()]
    .map(([source, s]) => {
      const closed = s.won + s.lost;
      return {
        source,
        totalLeads: s.total,
        wonCount: s.won,
        lostCount: s.lost,
        openCount: s.open,
        winRatePct: closed > 0 ? Math.round((s.won / closed) * 100) : null,
        avgWonDealValue: s.wonDealValues.length > 0 ? Math.round(s.wonDealValues.reduce((a, b) => a + b, 0) / s.wonDealValues.length) : null,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);

  return { totalLeads: leads.length, missingSourceCount, bySource, currency: workspace?.currency ?? "USD" };
}
