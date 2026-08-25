import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeRunPlan } from "@/lib/orchestrator";

export default async function OrchestratorPage({ params }: PageProps<"/workspaces/[id]/orchestrator">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [needs, runs] = await Promise.all([
    prisma.needsAnalysis.findMany({ where: { workspaceId: id }, include: { agent: true } }),
    prisma.agentRun.findMany({ where: { workspaceId: id }, select: { agent: { select: { key: true } } } }),
  ]);

  const activeAgents = needs.filter((n) => (n.overriddenStatus ?? n.recommendedStatus) === "active");
  const activeKeys = activeAgents.map((n) => n.agent.key);
  const nameByKey = new Map(activeAgents.map((n) => [n.agent.key, n.agent.name]));
  const ranKeys = new Set(runs.map((r) => r.agent.key));

  const plan = computeRunPlan(activeKeys, ranKeys);
  const readyCount = plan.filter((p) => p.status === "ready").length;
  const blockedCount = plan.filter((p) => p.status === "blocked").length;
  const doneCount = plan.filter((p) => p.status === "done").length;

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Orchestrator</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} — suggested run order</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Active agents, sequenced by the dependency graph — an agent that depends on another active agent
          is blocked until that dependency has at least one run. Running a blocked agent anyway still works;
          it just runs without that dependency&apos;s real output as hand-off context. This resolves
          sequencing only, not genuine strategic conflicts between agents — that judgment still belongs to
          the Marketing Orchestrator agent itself.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-8">
        <StatCard label="Ready to run" value={String(readyCount)} />
        <StatCard label="Blocked on a dependency" value={String(blockedCount)} />
        <StatCard label="Already run" value={String(doneCount)} />
      </div>

      {plan.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg py-8 px-4 text-center text-sm text-ink-faint">
          No active agents yet — check the Needs Analyzer.
        </div>
      ) : (
        <ol className="flex flex-col gap-2">
          {plan.map((entry, i) => (
            <li
              key={entry.agentKey}
              className="bg-surface border border-line rounded-lg px-4 py-3 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-xs text-ink-faint tabular-nums w-5 shrink-0">{i + 1}</span>
                <div className="min-w-0">
                  <Link
                    href={`/workspaces/${id}/agents/${entry.agentKey}`}
                    className="text-sm font-medium text-ink hover:text-accent truncate"
                  >
                    {nameByKey.get(entry.agentKey) ?? entry.agentKey}
                  </Link>
                  {entry.status === "blocked" && (
                    <div className="text-[11px] text-ink-faint mt-0.5">
                      Waiting on: {entry.blockedOn.map((k) => nameByKey.get(k) ?? k).join(", ")}
                    </div>
                  )}
                </div>
              </div>
              <StatusBadge status={entry.status} />
            </li>
          ))}
        </ol>
      )}
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

function StatusBadge({ status }: { status: "done" | "ready" | "blocked" }) {
  const label = status === "done" ? "Done" : status === "ready" ? "Ready" : "Blocked";
  const classes =
    status === "done"
      ? "bg-line/60 text-ink-faint"
      : status === "ready"
        ? "bg-accent-soft text-accent-ink"
        : "bg-line/60 text-ink-soft";
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${classes}`}>{label}</span>;
}
