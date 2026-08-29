import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// TELEMETRY — the sensor-panel instrument. Bigger tabular numbers than
// anywhere else in the CRM, a real proportional distribution bar (built
// from actual counts, never a placeholder shape), and the teal
// crm-report accent — deliberately the coolest color in the palette, since
// this is the one tab that's purely about reading signal, not acting on it.
export default async function CrmReportsPage({ params }: PageProps<"/workspaces/[id]/crm/reports">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const activities = await prisma.leadActivity.findMany({
    where: { lead: { workspaceId: id } },
    include: { lead: { select: { id: true, name: true } } },
    orderBy: { occurredAt: "desc" },
  });

  const byType = activities.reduce<Record<string, number>>((acc, a) => {
    acc[a.type] = (acc[a.type] ?? 0) + 1;
    return acc;
  }, {});

  const emails = activities.filter((a) => a.type === "email");
  const sms = activities.filter((a) => a.type === "sms");

  const distribution = [
    { label: "Email", count: byType.email ?? 0 },
    { label: "SMS", count: byType.sms ?? 0 },
    { label: "Calls", count: byType.call ?? 0 },
    { label: "Notes", count: byType.note ?? 0 },
    { label: "Agent runs", count: byType.agent_run ?? 0 },
    { label: "Workflow actions", count: byType.workflow_action ?? 0 },
  ];
  const totalSignal = distribution.reduce((sum, d) => sum + d.count, 0) || 1;

  return (
    <div>
      <div className="bg-warn-soft border border-warn/30 rounded-lg px-4 py-3 mb-6 text-sm text-ink-soft">
        <strong className="text-warn">Note:</strong> these reports reflect activity actually logged in this
        CRM — workflow actions and notes you or your team add. There is no connected email service provider
        or SMS provider yet, so this is not a live inbox/delivery report from Mailchimp, Twilio, etc. — every
        entry below marked &quot;not sent&quot; is a logged intent, not a confirmed delivery.
      </div>

      <div className="grid grid-cols-4 gap-3 mb-4">
        <StatCard label="Emails logged" value={byType.email ?? 0} />
        <StatCard label="SMS logged" value={byType.sms ?? 0} />
        <StatCard label="Calls logged" value={byType.call ?? 0} />
        <StatCard label="Agent runs" value={byType.agent_run ?? 0} />
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 mb-6">
        <div className="text-[10px] font-mono uppercase tracking-widest text-crm-report mb-4">Signal distribution</div>
        <div className="space-y-2.5">
          {distribution.map((d) => (
            <div key={d.label} className="flex items-center gap-3">
              <div className="w-28 text-xs text-ink-soft shrink-0">{d.label}</div>
              <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                <div
                  className="h-full bg-crm-report rounded-full"
                  style={{ width: `${(d.count / totalSignal) * 100}%`, minWidth: d.count > 0 ? "6px" : "0" }}
                />
              </div>
              <div className="w-8 text-xs font-mono text-ink tabular-nums text-right">{d.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ActivityPanel title="Email activity" items={emails} workspaceId={id} />
        <ActivityPanel title="SMS activity" items={sms} workspaceId={id} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-surface border border-line rounded-lg px-4 py-4">
      <div className="text-3xl font-[family-name:var(--font-display)] font-semibold text-crm-report tabular-nums">
        {value}
      </div>
      <div className="text-xs text-ink-faint mt-1">{label}</div>
    </div>
  );
}

function ActivityPanel({
  title,
  items,
  workspaceId,
}: {
  title: string;
  items: { id: string; summary: string; occurredAt: Date; lead: { id: string; name: string } }[];
  workspaceId: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="text-[10px] font-mono uppercase tracking-widest text-ink-faint mb-4">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing logged yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 20).map((a) => (
            <li key={a.id} className="text-sm">
              <Link href={`/workspaces/${workspaceId}/crm/leads/${a.lead.id}`} className="text-ink font-medium hover:text-crm-report">
                {a.lead.name}
              </Link>
              <div className="text-ink-faint text-xs mt-0.5">{a.summary}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
