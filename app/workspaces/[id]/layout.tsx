import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { analyzeNeeds } from "@/lib/needs-rules";
import CurrencySelect from "@/components/currency-select";

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/workspaces/[id]">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  // Backfill: agents added to the catalog after this workspace was created
  // won't have a NeedsAnalysis row yet. Compute and insert only the missing
  // ones here so every page under this workspace stays in sync automatically
  // as the agent catalog grows.
  const [allAgents, existingRows] = await Promise.all([
    prisma.agent.findMany({ select: { id: true, key: true } }),
    prisma.needsAnalysis.findMany({ where: { workspaceId: id }, select: { agentId: true } }),
  ]);
  const existingIds = new Set(existingRows.map((n) => n.agentId));
  const missingAgents = allAgents.filter((a) => !existingIds.has(a.id));
  if (missingAgents.length > 0) {
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
      missingAgents.map((a) => a.key),
    );
    const keyToId = new Map(missingAgents.map((a) => [a.key, a.id]));
    await prisma.needsAnalysis.createMany({
      data: recommendations.map((r) => ({
        workspaceId: id,
        agentId: keyToId.get(r.agentKey)!,
        recommendedStatus: r.status,
        tier: r.tier,
        reason: r.reason,
        evidence: JSON.stringify(r.evidence),
        reactivationTrigger: r.reactivationTrigger ?? null,
      })),
    });
  }

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between border-b border-line bg-surface px-8 py-2.5">
        <span className="text-xs text-ink-faint truncate">{workspace.name}</span>
        <CurrencySelect workspaceId={workspace.id} currentCurrency={workspace.currency} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
