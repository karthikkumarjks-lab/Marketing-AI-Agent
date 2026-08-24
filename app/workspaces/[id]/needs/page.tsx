import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER } from "@/lib/agent-catalog";
import NeedsRow from "@/components/needs-row";

export default async function NeedsAnalyzerPage({ params }: PageProps<"/workspaces/[id]/needs">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const needs = await prisma.needsAnalysis.findMany({
    where: { workspaceId: id },
    include: { agent: true },
  });

  const byCategory = new Map<string, typeof needs>();
  for (const n of needs) {
    const list = byCategory.get(n.agent.category) ?? [];
    list.push(n);
    byCategory.set(n.agent.category, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.agent.sortOrder - b.agent.sortOrder);
  }

  const activeCount = needs.filter((n) => (n.overriddenStatus ?? n.recommendedStatus) === "active").length;

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Needs Analyzer</div>
        <h1 className="text-2xl font-semibold text-ink">Which agents matter for {workspace.name}?</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl">
          {activeCount} of {needs.length} agents are recommended active based on the Company DNA.
          Override any call — the reasoning stays visible either way.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const rows = byCategory.get(category);
        if (!rows || rows.length === 0) return null;
        return (
          <div key={category} className="mb-8">
            <h2 className="text-sm font-semibold text-ink-soft mb-2">{category}</h2>
            <div className="bg-surface border border-line rounded-lg overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wide text-ink-faint border-b border-line">
                    <th className="py-2 px-4 font-medium">Agent</th>
                    <th className="py-2 px-4 font-medium">Status</th>
                    <th className="py-2 px-4 font-medium">Why</th>
                    <th className="py-2 px-4 font-medium text-right">Override</th>
                  </tr>
                </thead>
                <tbody className="px-4">
                  {rows.map((n) => (
                    <NeedsRow
                      key={n.id}
                      workspaceId={id}
                      agentId={n.agentId}
                      agentName={n.agent.name}
                      agentKey={n.agent.key}
                      recommendedStatus={n.recommendedStatus as "active" | "idle"}
                      overriddenStatus={n.overriddenStatus}
                      reason={n.reason}
                      isWired={n.agent.isWired}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </main>
  );
}
