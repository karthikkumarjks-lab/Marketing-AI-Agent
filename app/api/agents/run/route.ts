import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentLLM, RUNTIME_CONTEXT_AGENTS, buildRuntimeSnapshot } from "@/lib/agent-prompts";

export async function POST(req: NextRequest) {
  const { workspaceId, agentKey, predictedOutcome } = await req.json();
  if (!workspaceId || !agentKey) {
    return NextResponse.json({ error: "workspaceId and agentKey are required." }, { status: 400 });
  }

  const [workspace, agent] = await Promise.all([
    prisma.workspace.findUnique({ where: { id: workspaceId } }),
    prisma.agent.findUnique({ where: { key: agentKey } }),
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
    monthlyBudgetInr: workspace.monthlyBudgetInr,
    websiteUrl: workspace.websiteUrl,
    icpNotes: workspace.icpNotes,
    currentChannels: workspace.currentChannels,
    marketingAssets: workspace.marketingAssets,
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

  let result;
  try {
    result = await runAgentLLM(agentKey, agent.name, dna, extraContext);
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
