import { prisma } from "./prisma";

// Real predicted-vs-actual outcome track record — AgentRun already tracks
// predictedOutcome/actualOutcome/outcomeStatus (matched/missed/pending) for
// every run in this workspace, and nothing reads it in aggregate before
// this. Grounds "what to run next" in real track record instead of DNA
// reasoning alone, distinct from next-best-action's per-lead advisory
// focus — this is agent-level: which agents' predictions have actually
// tracked well here.
export interface RecentPrediction {
  predictedOutcome: string;
  actualOutcome: string | null;
  outcomeStatus: string;
}

export interface AgentOutcomeStat {
  agentName: string;
  totalRuns: number;
  matchedCount: number;
  missedCount: number;
  pendingCount: number;
  recentPredictions: RecentPrediction[];
}

export interface OptimizationSnapshot {
  totalRunsWithPrediction: number;
  byAgent: AgentOutcomeStat[];
}

const MAX_RECENT_PER_AGENT = 3;

export async function computeOptimizationSnapshot(workspaceId: string): Promise<OptimizationSnapshot> {
  const runs = await prisma.agentRun.findMany({
    where: { workspaceId, predictedOutcome: { not: null } },
    orderBy: { createdAt: "desc" },
    include: { agent: { select: { name: true } } },
  });

  const byAgentMap = new Map<string, { matched: number; missed: number; pending: number; recent: RecentPrediction[] }>();
  for (const r of runs) {
    const entry = byAgentMap.get(r.agent.name) ?? { matched: 0, missed: 0, pending: 0, recent: [] };
    if (r.outcomeStatus === "matched") entry.matched++;
    else if (r.outcomeStatus === "missed") entry.missed++;
    else entry.pending++;
    if (entry.recent.length < MAX_RECENT_PER_AGENT) {
      entry.recent.push({ predictedOutcome: r.predictedOutcome!, actualOutcome: r.actualOutcome, outcomeStatus: r.outcomeStatus });
    }
    byAgentMap.set(r.agent.name, entry);
  }

  const byAgent: AgentOutcomeStat[] = [...byAgentMap.entries()]
    .map(([agentName, s]) => ({
      agentName,
      totalRuns: s.matched + s.missed + s.pending,
      matchedCount: s.matched,
      missedCount: s.missed,
      pendingCount: s.pending,
      recentPredictions: s.recent,
    }))
    .sort((a, b) => b.totalRuns - a.totalRuns);

  return { totalRunsWithPrediction: runs.length, byAgent };
}
