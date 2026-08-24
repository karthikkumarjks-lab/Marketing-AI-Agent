import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import StatusPill from "@/components/status-pill";

export default async function ScorecardPage({ params }: PageProps<"/workspaces/[id]/scorecard">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const runs = await prisma.agentRun.findMany({
    where: { workspaceId: id },
    include: { agent: true },
    orderBy: { createdAt: "desc" },
  });

  const total = runs.length;
  const matched = runs.filter((r) => r.outcomeStatus === "matched").length;
  const missed = runs.filter((r) => r.outcomeStatus === "missed").length;
  const pending = total - matched - missed;
  const scored = matched + missed;
  const accuracy = scored > 0 ? Math.round((matched / scored) * 100) : null;
  const activeAgents = new Set(runs.map((r) => r.agentId)).size;

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Scorecard</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} — evaluation log</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl">
          Every run is logged with a predicted outcome. Closing the loop with the actual outcome on the
          agent&apos;s run page is what makes this number mean something over time.
        </p>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="Total runs" value={String(total)} />
        <StatCard label="Agents used" value={String(activeAgents)} />
        <StatCard label="Pending scoring" value={String(pending)} />
        <StatCard label="Prediction accuracy" value={accuracy != null ? `${accuracy}%` : "—"} />
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint border-b border-line">
              <th className="py-2 px-4 font-medium">Agent</th>
              <th className="py-2 px-4 font-medium">When</th>
              <th className="py-2 px-4 font-medium">Predicted</th>
              <th className="py-2 px-4 font-medium">Actual</th>
              <th className="py-2 px-4 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {runs.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 px-4 text-center text-sm text-ink-faint">
                  No runs yet — head to the Agent Hub and run one.
                </td>
              </tr>
            )}
            {runs.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 text-sm">
                <td className="py-3 px-4">
                  <Link
                    href={`/workspaces/${id}/agents/${r.agent.key}`}
                    className="text-ink hover:text-accent font-medium"
                  >
                    {r.agent.name}
                  </Link>
                </td>
                <td className="py-3 px-4 text-ink-faint tabular-nums">
                  {r.createdAt.toLocaleDateString("en-IN")}
                </td>
                <td className="py-3 px-4 text-ink-soft max-w-xs truncate">{r.predictedOutcome || "—"}</td>
                <td className="py-3 px-4 text-ink-soft max-w-xs truncate">{r.actualOutcome || "—"}</td>
                <td className="py-3 px-4">
                  <StatusPill status={r.outcomeStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
