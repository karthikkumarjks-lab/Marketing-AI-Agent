import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeNeeds } from "@/lib/needs-rules";
import { CURRENCIES } from "@/lib/currency";

const STRING_FIELDS = [
  "name",
  "industry",
  "objective",
  "currency",
  "country",
  "websiteUrl",
  "icpNotes",
  "currentChannels",
  "marketingAssets",
  "salesCapacity",
  "conversionTarget",
  "retentionTarget",
  "northStarKpi",
  "guardrails",
  "seasonality",
  "existingStack",
  "maturityStage",
] as const;

const INT_FIELDS = [
  "monthlyBudget",
  "aov",
  "ltv",
  "grossMarginPct",
  "salesCycleDays",
  "cacTarget",
  "cplTarget",
  "revenueTarget",
] as const;

const FLOAT_FIELDS = ["roasTarget"] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.currency != null && !CURRENCIES.some((c) => c.code === body.currency)) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const field of STRING_FIELDS) {
    if (field in body) data[field] = body[field] || null;
  }
  for (const field of INT_FIELDS) {
    if (field in body) data[field] = body[field] !== "" && body[field] != null ? Number(body[field]) : null;
  }
  for (const field of FLOAT_FIELDS) {
    if (field in body) data[field] = body[field] !== "" && body[field] != null ? Number(body[field]) : null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  }

  const workspace = await prisma.workspace.update({ where: { id }, data });

  // Re-run the Needs Analyzer so reasons reflect the updated currency/budget/etc.
  // instead of showing stale figures. Manual overrides are untouched.
  const agents = await prisma.agent.findMany({ select: { id: true, key: true } });
  const recommendations = analyzeNeeds(
    {
      industry: workspace.industry,
      objective: workspace.objective,
      monthlyBudget: workspace.monthlyBudget,
      currency: workspace.currency,
      country: workspace.country,
      websiteUrl: workspace.websiteUrl,
      icpNotes: workspace.icpNotes,
      currentChannels: workspace.currentChannels,
      marketingAssets: workspace.marketingAssets,
    },
    agents.map((a) => a.key),
  );
  const keyToId = new Map(agents.map((a) => [a.key, a.id]));
  await Promise.all(
    recommendations.map((r) =>
      prisma.needsAnalysis.updateMany({
        where: { workspaceId: id, agentId: keyToId.get(r.agentKey)! },
        data: {
          recommendedStatus: r.status,
          tier: r.tier,
          reason: r.reason,
          evidence: JSON.stringify(r.evidence),
          reactivationTrigger: r.reactivationTrigger ?? null,
        },
      }),
    ),
  );

  return NextResponse.json(workspace);
}
