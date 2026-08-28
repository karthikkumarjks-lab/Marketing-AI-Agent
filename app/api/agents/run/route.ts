import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  runAgentLLM,
  RUNTIME_CONTEXT_AGENTS,
  buildRuntimeSnapshot,
  LIVE_WEBSITE_AUDIT_AGENTS,
  buildWebsiteAuditContext,
  LIVE_COMPETITOR_AUDIT_AGENTS,
  buildCompetitorAuditContext,
  IMAGE_GENERATION_AGENTS,
  extractGenerationPrompt,
  META_ADS_LIVE_AGENTS,
  buildMetaAdsLiveContext,
  SECURITY_REPUTATION_AGENTS,
  buildReputationContext,
  MEETING_HISTORY_AGENTS,
  buildMeetingHistoryContext,
} from "@/lib/agent-prompts";
import { getAgentDependencies } from "@/lib/agent-contract";
import { buildHandoffContext, type DependencyRunSnapshot } from "@/lib/orchestrator";
import { getUploadType } from "@/lib/agent-uploads";
import { getTextInputSpec } from "@/lib/agent-text-input";
import { parseExcelBuffer } from "@/lib/excel-parse";
import { detectTechStack } from "@/lib/tech-stack-detect";
import { discoverSubpages } from "@/lib/sitemap-discover";
import { generateImage } from "@/lib/image-generate";
import { fetchAdAccountInsights } from "@/lib/meta-ads-client";
import { buildReputationCheckLinks, buildWebFilterCategoryLinks } from "@/lib/url-reputation";
import { buildLeadContext, parseCustomFields, parseTags } from "@/lib/crm";

const SCAN_TIMEOUT_MS = 10000;
const SCAN_USER_AGENT = "Mozilla/5.0 (compatible; MarketingAutopilotDomainScan/1.0)";

const MAX_EXCEL_BYTES = 5 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const EXCEL_EXTENSIONS = [".xlsx", ".xls", ".csv"];
const IMAGE_MIME_PREFIXES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

// Shared by LIVE_WEBSITE_AUDIT_AGENTS and LIVE_COMPETITOR_AUDIT_AGENTS — same
// real fetch + signature detection + sitemap discovery, just aimed at a
// different URL (the client's own site vs. a competitor's).
async function scanWebsite(
  url: string,
): Promise<{ tech: ReturnType<typeof detectTechStack>; sitemap: Awaited<ReturnType<typeof discoverSubpages>> } | null> {
  const domain = url.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
  let html: string | null = null;
  let headers: Headers | null = null;
  for (const scheme of ["https", "http"]) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
    try {
      const res = await fetch(`${scheme}://${domain}`, {
        signal: controller.signal,
        headers: { "user-agent": SCAN_USER_AGENT },
      });
      if (res.ok) {
        html = await res.text();
        headers = res.headers;
        break;
      }
    } catch {
      // try next scheme
    } finally {
      clearTimeout(timeout);
    }
  }
  if (!html || !headers) return null;
  const tech = detectTechStack(html, headers);
  const sitemap = await discoverSubpages(domain, html);
  return { tech, sitemap };
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let workspaceId: string | null = null;
  let agentKey: string | null = null;
  let predictedOutcome: string | null = null;
  let websiteUrlOverride: string | null = null;
  let competitorUrlOverride: string | null = null;
  let runNote: string | null = null;
  let leadId: string | null = null;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    workspaceId = (form.get("workspaceId") as string) || null;
    agentKey = (form.get("agentKey") as string) || null;
    predictedOutcome = (form.get("predictedOutcome") as string) || null;
    websiteUrlOverride = (form.get("websiteUrlOverride") as string) || null;
    competitorUrlOverride = (form.get("competitorUrlOverride") as string) || null;
    runNote = (form.get("runNote") as string) || null;
    leadId = (form.get("leadId") as string) || null;
    const uploaded = form.get("file");
    if (uploaded instanceof File && uploaded.size > 0) file = uploaded;
  } else {
    const body = await req.json();
    workspaceId = body.workspaceId ?? null;
    agentKey = body.agentKey ?? null;
    predictedOutcome = body.predictedOutcome ?? null;
    websiteUrlOverride = body.websiteUrlOverride ?? null;
    competitorUrlOverride = body.competitorUrlOverride ?? null;
    runNote = body.runNote ?? null;
    leadId = body.leadId ?? null;
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

  // Real CRM lead context: when a run is kicked off from a lead's page (the
  // Lead Journey view's "Run agent for this lead" action), inject that
  // lead's actual stored data so the agent reasons about this one real
  // person/company instead of generic workspace-level Company DNA.
  let extraContext: string | undefined;
  if (leadId) {
    const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { stage: true } });
    if (lead && lead.workspaceId === workspaceId) {
      const leadLite = {
        ...lead,
        customFields: parseCustomFields(lead.customFields),
        tags: parseTags(lead.tags),
        createdAt: lead.createdAt.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
      };
      extraContext = (extraContext ?? "") + buildLeadContext(leadLite, lead.stage?.name ?? null);
    } else {
      leadId = null; // ignore a leadId that doesn't belong to this workspace
    }
  }

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

  // Live website scan: real fetch + signature-based tech detection + real
  // subpage discovery for the one agent that needs it — never fabricated,
  // and clearly labeled as real data in the prompt (buildWebsiteAuditContext).
  // The discovered page list is captured separately (discoveredPages below)
  // so the FULL list can be appended to the output verbatim by this route
  // after the LLM call — a real site can have 100+ pages, and asking the
  // LLM to reproduce every one itself hits its output-token cap and
  // silently truncates the list (found via a real 144-page site,
  // onlinemanipal.com, 2026-08-26). The LLM's job is classification and
  // insight; completeness of the raw list is this route's job, not the
  // LLM's, since the data is already fully known before the LLM ever runs.
  let discoveredPages: string[] | null = null;
  if (LIVE_WEBSITE_AUDIT_AGENTS.has(agentKey)) {
    // A per-run override (typed directly on the agent's page) always wins
    // over whatever's stored in Company DNA — lets a client-facing agent
    // scan a different or prospective site without editing the workspace.
    const websiteUrl = websiteUrlOverride || workspace.websiteUrl;
    if (!websiteUrl) {
      extraContext = (extraContext ?? "") + buildWebsiteAuditContext(null, null, null);
    } else {
      const scan = await scanWebsite(websiteUrl);
      extraContext = (extraContext ?? "") + buildWebsiteAuditContext(websiteUrl, scan?.tech ?? null, scan?.sitemap ?? null);
      discoveredPages = scan?.sitemap?.pages ?? null;
    }
  }

  // Real one-click reputation-check links — never an automated cross-vendor
  // check (see lib/url-reputation.ts for why). Just deterministic URL
  // construction, no network call needed here.
  if (SECURITY_REPUTATION_AGENTS.has(agentKey)) {
    const url = websiteUrlOverride || workspace.websiteUrl;
    const cleanDomain = url ? url.replace(/^https?:\/\//, "").split("/")[0] : null;
    const links = cleanDomain ? buildReputationCheckLinks(cleanDomain) : [];
    const webFilterLinks = cleanDomain ? buildWebFilterCategoryLinks(cleanDomain) : [];
    extraContext = (extraContext ?? "") + buildReputationContext(url, links, webFilterLinks);
  }

  // Real past-meeting history for both meeting agents — every entry is a
  // real prior run's stored output, never invented. Scoped to this one
  // sibling agent's runs specifically (not all agents' history, unlike
  // RUNTIME_CONTEXT_AGENTS above), since that's the actual meeting record.
  if (MEETING_HISTORY_AGENTS.has(agentKey)) {
    const pastMeetings = await prisma.agentRun.findMany({
      where: { workspaceId, agent: { key: "meeting-summary-insights" } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, outputMarkdown: true },
    });
    extraContext =
      (extraContext ?? "") +
      buildMeetingHistoryContext(pastMeetings.map((m) => ({ createdAt: m.createdAt.toISOString(), outputMarkdown: m.outputMarkdown })));
  }

  // Live competitor scan: same real fetch/detect infrastructure, aimed at a
  // competitor's site — there's no Company DNA field for this, it's entered
  // fresh per run.
  if (LIVE_COMPETITOR_AUDIT_AGENTS.has(agentKey)) {
    if (!competitorUrlOverride) {
      extraContext = (extraContext ?? "") + buildCompetitorAuditContext(null, null, null);
    } else {
      const scan = await scanWebsite(competitorUrlOverride);
      extraContext = (extraContext ?? "") + buildCompetitorAuditContext(competitorUrlOverride, scan?.tech ?? null, scan?.sitemap ?? null);
    }
  }

  // Real Meta Ads data: only when this workspace has a genuine OAuth
  // connection (see app/api/integrations/meta/*) with an ad account chosen —
  // never fabricated, and the prompt is instructed to disclose plainly when
  // it's absent or the live fetch fails.
  if (META_ADS_LIVE_AGENTS.has(agentKey)) {
    const metaIntegration = await prisma.integration.findUnique({
      where: { workspaceId_provider: { workspaceId, provider: "meta_ads" } },
    });
    const connected = metaIntegration?.status === "connected" && !!metaIntegration.accessToken;
    if (!connected) {
      extraContext = (extraContext ?? "") + buildMetaAdsLiveContext(false, null);
    } else if (!metaIntegration.externalAccountId) {
      extraContext = (extraContext ?? "") + buildMetaAdsLiveContext(true, null, "no ad account selected yet — pick one on the Integrations page");
    } else {
      try {
        const insights = await fetchAdAccountInsights(metaIntegration.accessToken!, metaIntegration.externalAccountId);
        extraContext = (extraContext ?? "") + buildMetaAdsLiveContext(true, insights);
      } catch (err) {
        extraContext = (extraContext ?? "") + buildMetaAdsLiveContext(true, null, err instanceof Error ? err.message : "fetch failed");
      }
    }
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

  // Free-text run input (call transcript, closed-deal outcomes, deal specifics)
  // — transient, never persisted beyond this call. Capped to keep the prompt
  // from ballooning on an accidental paste of an entire document.
  const MAX_RUN_NOTE_CHARS = 20000;
  if (runNote && getTextInputSpec(agentKey)) {
    const trimmed = runNote.length > MAX_RUN_NOTE_CHARS ? runNote.slice(0, MAX_RUN_NOTE_CHARS) + "\n…(truncated)" : runNote;
    extraContext = (extraContext ?? "") + `\n\n## User-Provided Input\n${trimmed}`;
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

  // Real image generation: the LLM only crafts the prompt (in a fenced block
  // this extraction depends on, see the agent's system prompt) — the actual
  // image comes from a real call to a free generation model, never invented.
  if (IMAGE_GENERATION_AGENTS.has(agentKey) && !result.isDemo) {
    const prompt = extractGenerationPrompt(result.markdown);
    if (prompt) {
      const generated = await generateImage(prompt);
      result = {
        ...result,
        markdown: generated
          ? `${result.markdown}\n\n## Generated Image\n![Generated image](${generated.dataUri})`
          : `${result.markdown}\n\n## Generated Image\nImage generation failed or timed out — the prompt above is still valid to try again or use elsewhere.`,
      };
    }
  }

  // Append the FULL raw discovered-page list verbatim — deterministic, real
  // data this route already has in full, never subject to the LLM's own
  // output-token limit the way asking it to reproduce the list itself would
  // be. The LLM's own output above covers classification/insight; this is
  // the guaranteed-complete reference list underneath it.
  if (discoveredPages && discoveredPages.length > 0) {
    const rawList = discoveredPages.map((p) => `- ${p}`).join("\n");
    result = {
      ...result,
      markdown: `${result.markdown}\n\n## Full Discovered Page List (raw scan data, ${discoveredPages.length} pages)\n${rawList}`,
    };
  }

  const run = await prisma.agentRun.create({
    data: {
      workspaceId,
      agentId: agent.id,
      leadId: leadId || null,
      inputContext: JSON.stringify(dna),
      outputMarkdown: result.markdown,
      predictedOutcome: predictedOutcome || null,
      isDemo: result.isDemo,
      model: result.model,
    },
  });

  if (leadId) {
    await prisma.leadActivity.create({
      data: {
        leadId,
        type: "agent_run",
        channel: "system",
        summary: `Ran "${agent.name}"${result.isDemo ? " (demo output — no API key set)" : ""}`,
      },
    });
  }

  return NextResponse.json(run);
}
