import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER, CATEGORY_COLORS } from "@/lib/agent-catalog";
import AgentHub from "@/components/agent-hub";

export default async function AgentHubPage({ params }: PageProps<"/workspaces/[id]/agents">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const agents = await prisma.agent.findMany({ orderBy: { sortOrder: "asc" } });
  const needs = await prisma.needsAnalysis.findMany({ where: { workspaceId: id } });
  const needsByAgent = new Map(needs.map((n) => [n.agentId, n]));

  const categories = CATEGORY_ORDER.map((category) => ({
    category,
    color: CATEGORY_COLORS[category],
    agents: agents
      .filter((a) => a.category === category)
      .map((agent) => {
        const need = needsByAgent.get(agent.id);
        const status = (need?.overriddenStatus ?? need?.recommendedStatus ?? "idle") as "active" | "idle";
        return { id: agent.id, key: agent.key, name: agent.name, mission: agent.mission, isWired: agent.isWired, status };
      }),
  })).filter((c) => c.agents.length > 0);

  return (
    <main className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Agent Hub</div>
        <h1 className="text-2xl font-semibold text-ink">{agents.length} agents</h1>
        <p className="text-sm text-ink-soft mt-1.5">
          Every agent is visible here, even the ones not wired to real execution yet.
        </p>
      </div>

      <AgentHub workspaceId={id} categories={categories} />
    </main>
  );
}
