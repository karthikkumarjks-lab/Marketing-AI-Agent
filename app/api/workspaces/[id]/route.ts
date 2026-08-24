import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeNeeds } from "@/lib/needs-rules";
import { CURRENCIES } from "@/lib/currency";

const EDITABLE_FIELDS = [
  "name",
  "industry",
  "objective",
  "monthlyBudget",
  "currency",
  "country",
  "websiteUrl",
  "icpNotes",
  "currentChannels",
  "marketingAssets",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.currency != null && !CURRENCIES.some((c) => c.code === body.currency)) {
    return NextResponse.json({ error: "Unsupported currency." }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  for (const field of EDITABLE_FIELDS) {
    if (field in body) {
      data[field] = field === "monthlyBudget" ? (body[field] ? Number(body[field]) : null) : body[field] || null;
    }
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
        data: { recommendedStatus: r.status, reason: r.reason },
      }),
    ),
  );

  return NextResponse.json(workspace);
}
