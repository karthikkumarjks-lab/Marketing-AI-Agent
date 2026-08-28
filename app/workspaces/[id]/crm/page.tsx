import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { formatMoney } from "@/lib/currency";

export default async function CrmDashboardPage({ params }: PageProps<"/workspaces/[id]/crm">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const stages = await ensureDefaultStages(id);
  const leads = await prisma.lead.findMany({ where: { workspaceId: id }, include: { stage: true } });

  const totalLeads = leads.length;
  const wonStageIds = new Set(stages.filter((s) => s.isWon).map((s) => s.id));
  const lostStageIds = new Set(stages.filter((s) => s.isLost).map((s) => s.id));
  const won = leads.filter((l) => l.stageId && wonStageIds.has(l.stageId));
  const lost = leads.filter((l) => l.stageId && lostStageIds.has(l.stageId));
  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;
  const openPipelineValue = leads
    .filter((l) => l.stageId && !wonStageIds.has(l.stageId) && !lostStageIds.has(l.stageId))
    .reduce((sum, l) => sum + (l.dealValue ?? 0), 0);
  const wonValue = won.reduce((sum, l) => sum + (l.dealValue ?? 0), 0);

  const stageCounts = stages.map((s) => ({
    stage: s,
    count: leads.filter((l) => l.stageId === s.id).length,
    value: leads.filter((l) => l.stageId === s.id).reduce((sum, l) => sum + (l.dealValue ?? 0), 0),
  }));
  const maxCount = Math.max(1, ...stageCounts.map((s) => s.count));

  const recentActivity = await prisma.leadActivity.findMany({
    where: { lead: { workspaceId: id } },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
    take: 12,
  });

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-8">
        <StatCard label="Total leads" value={String(totalLeads)} />
        <StatCard label="Open pipeline value" value={formatMoney(openPipelineValue, workspace.currency)} />
        <StatCard label="Win rate" value={winRate != null ? `${winRate}%` : "—"} />
        <StatCard label="Won value" value={formatMoney(wonValue, workspace.currency)} />
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 mb-6">
        <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-4">
          Pipeline by stage
        </div>
        <div className="space-y-2.5">
          {stageCounts.map(({ stage, count, value }) => (
            <div key={stage.id} className="flex items-center gap-3">
              <div className="w-28 text-sm text-ink-soft truncate">{stage.name}</div>
              <div className="flex-1 h-6 bg-bg rounded overflow-hidden">
                <div
                  className={`h-full rounded ${stage.isLost ? "bg-danger" : stage.isWon ? "bg-accent" : "bg-accent/60"}`}
                  style={{ width: `${(count / maxCount) * 100}%`, minWidth: count > 0 ? "8px" : "0" }}
                />
              </div>
              <div className="w-12 text-sm text-ink tabular-nums text-right">{count}</div>
              <div className="w-24 text-xs text-ink-faint tabular-nums text-right">
                {value > 0 ? formatMoney(value, workspace.currency) : ""}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5">
        <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-4">
          Recent activity
        </div>
        {recentActivity.length === 0 ? (
          <p className="text-sm text-ink-faint">
            No activity yet — <Link href={`/workspaces/${id}/crm/leads`} className="text-accent hover:underline">add your first lead</Link>.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {recentActivity.map((a) => (
              <li key={a.id} className="flex items-start gap-3 text-sm">
                <span className="text-ink-faint text-xs tabular-nums w-16 shrink-0 pt-0.5">
                  {a.occurredAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </span>
                <span className="text-ink-soft">
                  <Link href={`/workspaces/${id}/crm/leads/${a.lead.id}`} className="text-ink font-medium hover:text-accent">
                    {a.lead.name}
                  </Link>{" "}
                  — {a.summary}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-4 py-3">
      <div className="text-2xl font-semibold text-accent tabular-nums truncate">{value}</div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}
