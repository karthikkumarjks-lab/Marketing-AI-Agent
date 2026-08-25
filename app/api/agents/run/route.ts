import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runAgentLLM, RUNTIME_CONTEXT_AGENTS, buildRuntimeSnapshot } from "@/lib/agent-prompts";
import { getAgentDependencies } from "@/lib/agent-contract";
import { buildHandoffContext, type DependencyRunSnapshot } from "@/lib/orchestrator";
import { getUploadType } from "@/lib/agent-uploads";
import { parseExcelBuffer } from "@/lib/excel-parse";

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let workspaceId: string | null = null;
  let agentKey: string | null = null;
  let predictedOutcome: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    workspaceId = (form.get("workspaceId") as string) || null;
    agentKey = (form.get("agentKey") as string) || null;
    predictedOutcome = (form.get("predictedOutcome") as string) || null;
    const uploaded = form.get("file");
    if (uploaded instanceof File && uploaded.size > 0) file = uploaded;
  } else {
    const body = await req.json();
    workspaceId = body.workspaceId ?? null;
    agentKey = body.agentKey ?? null;
    predictedOutcome = body.predictedOutcome ?? null;
  }

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

  // File upload — transient, never written to disk or the database. Parsed
  // (Excel) or base64-encoded (screenshot) for this one call only.
  let imageDataUri: string | undefined;
  if (file) {
    const uploadType = getUploadType(agentKey);
    if (!uploadType) {
      return NextResponse.json({ error: "This agent doesn't accept a file upload." }, { status: 400 });
    }

    if (uploadType === "excel") {
      if (file.size > MAX_EXCEL_BYTES) {
        return NextResponse.json({ error: "File too large — spreadsheet upload is capped at 5MB." }, { status: 400 });
      }
      const hasValidExtension = EXCEL_EXTENSIONS.some((ext) => file!.name.toLowerCase().endsWith(ext));
      if (!hasValidExtension) {
        return NextResponse.json({ error: "Expected a .xlsx, .xls, or .csv file." }, { status: 400 });
      }
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = parseExcelBuffer(buffer, file.name);
        extraContext = (extraContext ?? "") + `\n\n${parsed.markdown}`;
      } catch {
        return NextResponse.json({ error: "Could not read that spreadsheet — check it isn't corrupted or password-protected." }, { status: 400 });
      }
    } else if (uploadType === "screenshot") {
      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json({ error: "File too large — screenshot upload is capped at 8MB." }, { status: 400 });
      }
      if (!IMAGE_MIME_PREFIXES.includes(file.type)) {
        return NextResponse.json({ error: "Expected a PNG, JPEG, WebP, or GIF image." }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      imageDataUri = `data:${file.type};base64,${buffer.toString("base64")}`;
    }
  }

  let result;
  try {
    result = await runAgentLLM(agentKey, agent.name, dna, extraContext, brandDna, imageDataUri);
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
