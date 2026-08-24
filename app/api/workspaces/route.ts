import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { analyzeNeeds } from "@/lib/needs-rules";
import { CURRENCIES, DEFAULT_CURRENCY } from "@/lib/currency";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    name,
    industry,
    objective,
    monthlyBudget,
    currency,
    country,
    websiteUrl,
    icpNotes,
    currentChannels,
    marketingAssets,
  } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  }

  const resolvedCurrency = CURRENCIES.some((c) => c.code === currency) ? currency : DEFAULT_CURRENCY;

  const workspace = await prisma.workspace.create({
    data: {
      name: name.trim(),
      industry: industry || null,
      objective: objective || null,
      monthlyBudget: monthlyBudget ? Number(monthlyBudget) : null,
      currency: resolvedCurrency,
      country: country || null,
      websiteUrl: websiteUrl || null,
      icpNotes: icpNotes || null,
      currentChannels: currentChannels || null,
      marketingAssets: marketingAssets || null,
    },
  });

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
  await prisma.needsAnalysis.createMany({
    data: recommendations.map((r) => ({
      workspaceId: workspace.id,
      agentId: keyToId.get(r.agentKey)!,
      recommendedStatus: r.status,
      reason: r.reason,
    })),
  });

  return NextResponse.json({ id: workspace.id });
}
