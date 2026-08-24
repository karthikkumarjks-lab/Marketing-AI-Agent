import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentLLM } from "@/lib/agent-prompts";

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

  let result;
  try {
    result = await runAgentLLM(agentKey, agent.name, dna);
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
