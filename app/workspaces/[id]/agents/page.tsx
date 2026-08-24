import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER, CATEGORY_COLORS, type CategoryName } from "@/lib/agent-catalog";
import StatusPill from "@/components/status-pill";

export default async function AgentHubPage({ params }: PageProps<"/workspaces/[id]/agents">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const agents = await prisma.agent.findMany({ orderBy: { sortOrder: "asc" } });
  const needs = await prisma.needsAnalysis.findMany({ where: { workspaceId: id } });
  const needsByAgent = new Map(needs.map((n) => [n.agentId, n]));

  const byCategory = new Map<CategoryName, typeof agents>();
  for (const a of agents) {
    const cat = a.category as CategoryName;
    const list = byCategory.get(cat) ?? [];
    list.push(a);
    byCategory.set(cat, list);
  }

  return (
    <main className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Agent Hub</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} — 25 agents</h1>
        <p className="text-sm text-ink-soft mt-1.5">
          Every agent is visible here, even the ones not wired to real execution yet.
        </p>
      </div>

      {CATEGORY_ORDER.map((category) => {
        const list = byCategory.get(category);
        if (!list) return null;
        return (
          <div key={category} className="mb-9">
            <div className="flex items-center gap-2 mb-3">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[category] }}
              />
              <h2 className="text-sm font-semibold text-ink-soft">{category}</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {list.map((agent) => {
                const need = needsByAgent.get(agent.id);
                const status = (need?.overriddenStatus ?? need?.recommendedStatus ?? "idle") as
                  | "active"
                  | "idle";
                return (
                  <Link
                    key={agent.id}
                    href={`/workspaces/${id}/agents/${agent.key}`}
                    className={`block rounded-lg border p-4 transition-colors bg-surface ${
                      status === "active" ? "border-accent/40 hover:border-accent" : "border-line hover:border-line-strong"
                    } ${status === "idle" ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="font-medium text-sm text-ink">{agent.name}</div>
                      <StatusPill status={status} />
                    </div>
                    <p className="text-xs text-ink-soft leading-relaxed mb-2">{agent.mission}</p>
                    {!agent.isWired && (
                      <div className="text-[11px] text-warn font-medium">Coming online</div>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </main>
  );
}
