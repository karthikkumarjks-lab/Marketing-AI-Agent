import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function WorkspaceOverviewPage({ params }: PageProps<"/workspaces/[id]">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [activeCount, totalAgents, runCount] = await Promise.all([
    prisma.needsAnalysis.count({ where: { workspaceId: id, recommendedStatus: "active" } }),
    prisma.agent.count(),
    prisma.agentRun.count({ where: { workspaceId: id } }),
  ]);

  const rows: { label: string; value: string }[] = [
    { label: "Industry", value: workspace.industry || "Not specified" },
    { label: "Objective", value: workspace.objective || "Not specified" },
    {
      label: "Monthly budget",
      value: workspace.monthlyBudgetInr != null ? `₹${workspace.monthlyBudgetInr.toLocaleString("en-IN")}` : "Not specified",
    },
    { label: "Website", value: workspace.websiteUrl || "None on record" },
    { label: "Current channels", value: workspace.currentChannels || "None provided" },
  ];

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Workspace</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name}</h1>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Agents active" value={`${activeCount} / ${totalAgents}`} />
        <StatCard label="Total runs" value={String(runCount)} />
        <StatCard
          label="Budget"
          value={workspace.monthlyBudgetInr != null ? `₹${workspace.monthlyBudgetInr.toLocaleString("en-IN")}` : "—"}
        />
      </div>

      <div className="bg-surface border border-line rounded-lg divide-y divide-line mb-8">
        {rows.map((r) => (
          <div key={r.label} className="flex px-4 py-3 text-sm">
            <div className="w-40 shrink-0 text-ink-faint">{r.label}</div>
            <div className="text-ink">{r.value}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Link
          href={`/workspaces/${id}/needs`}
          className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90"
        >
          Open Needs Analyzer
        </Link>
        <Link
          href={`/workspaces/${id}/agents`}
          className="rounded-md border border-line-strong text-sm font-medium px-4 py-2 hover:bg-surface"
        >
          Open Agent Hub
        </Link>
      </div>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-4 py-3">
      <div className="text-2xl font-semibold text-accent tabular-nums">{value}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}
