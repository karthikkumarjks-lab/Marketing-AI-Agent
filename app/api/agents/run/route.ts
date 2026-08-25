import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentLLM, RUNTIME_CONTEXT_AGENTS, buildRuntimeSnapshot } from "@/lib/agent-prompts";
import { getAgentDependencies } from "@/lib/agent-contract";
import { buildHandoffContext, type DependencyRunSnapshot } from "@/lib/orchestrator";

export async function POST(req: NextRequest) {
  const { workspaceId, agentKey, predictedOutcome } = await req.json();
  if (!workspaceId || !agentKey) {
    return NextResponse.json({ error: "workspaceId and agentKey are required." }, { status: 400 });
  }

  const [workspace, agent, brandDna] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.agent.findUnique({ where: { key: agentKey } }),
    prisma.brandDNA.findUnique({ where: { workspaceId } }),
  ]);
  if (!workspace) return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  if (!agent) return NextResponse.json({ error: "Agent not found." }, { status: 404 });
  if (!agent.isWired) {
    return NextResponse.json({ error: "This agent is not wired to execution yet." }, { status: 400 });
  }

  const dna = {
    name: workspace.name,
    industry: workspace.industry,
    objective: workspace.objective,
    monthlyBudget: workspace.monthlyBudget,
    currency: workspace.currency,
    country: workspace.country,
    websiteUrl: workspace.websiteUrl,
    icpNotes: workspace.icpNotes,
    currentChannels: workspace.currentChannels,
    marketingAssets: workspace.marketingAssets,
    aov: workspace.aov,
    ltv: workspace.ltv,
    grossMarginPct: workspace.grossMarginPct,
    salesCycleDays: workspace.salesCycleDays,
    salesCapacity: workspace.salesCapacity,
    cacTarget: workspace.cacTarget,
    cplTarget: workspace.cplTarget,
    roasTarget: workspace.roasTarget,
    revenueTarget: workspace.revenueTarget,
    conversionTarget: workspace.conversionTarget,
    retentionTarget: workspace.retentionTarget,
    northStarKpi: workspace.northStarKpi,
    guardrails: workspace.guardrails,
    seasonality: workspace.seasonality,
    existingStack: workspace.existingStack,
    maturityStage: workspace.maturityStage,
  };

  let extraContext: string | undefined;
  if (RUNTIME_CONTEXT_AGENTS.has(agentKey)) {
    const [needs, runs] = await Promise.all([
      prisma.needsAnalysis.findMany({ where: { workspaceId }, include: { agent: true } }),
      prisma.agentRun.findMany({
        where: { workspaceId },
        include: { agent: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    ]);
    extraContext = buildRuntimeSnapshot(
      needs.map((n) => ({
        agentName: n.agent.name,
        status: (n.overriddenStatus ?? n.recommendedStatus) as "active" | "idle",
        reason: n.reason,
      })),
      runs.map((r) => ({
        agentName: r.agent.name,
        predictedOutcome: r.predictedOutcome,
        actualOutcome: r.actualOutcome,
        outcomeStatus: r.outcomeStatus,
        createdAt: r.createdAt.toISOString(),
      })),
    );
  }

  // Orchestration hand-off: if this agent declares dependencies, pull each
  // dependency's most recent real run in this workspace and pass it in as
  // structured context — actual prior output, not a summary this agent
  // invents itself. Silently skipped when a dependency hasn't run yet
  // (computeRunPlan is what tells the UI an agent is "blocked" beforehand;
  // this route still allows running out of order rather than hard-failing).
  const { dependsOn } = getAgentDependencies(agentKey);
  if (dependsOn.length > 0) {
    const depAgents = await prisma.agent.findMany({ where: { key: { in: dependsOn } } });
    const depRuns = await Promise.all(
      depAgents.map((depAgent) =>
        prisma.agentRun.findFirst({
          where: { workspaceId, agentId: depAgent.id },
          orderBy: { createdAt: "desc" },
        }),
      ),
    );
    const handoffDeps: DependencyRunSnapshot[] = depAgents
      .map((depAgent, i) => {
        const run = depRuns[i];
        return run ? { agentName: depAgent.name, outputMarkdown: run.outputMarkdown } : null;
      })
      .filter((d): d is DependencyRunSnapshot => d !== null);
    const handoff = buildHandoffContext(handoffDeps);
    if (handoff) extraContext = (extraContext ?? "") + handoff;
  }

  let result;
  try {
    result = await runAgentLLM(agentKey, agent.name, dna, extraContext, brandDna);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Agent run failed." },
      { status: 502 },
    );
  }

  const run = await prisma.agentRun.create({
    data: {
      workspaceId,
      agentId: agent.id,
      inputContext: JSON.stringify(dna),
      outputMarkdown: result.markdown,
      predictedOutcome: predictedOutcome || null,
      isDemo: result.isDemo,
      model: result.model,
    },
  });

  return NextResponse.json(run);
}
