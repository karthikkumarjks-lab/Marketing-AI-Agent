import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

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

  return (
    <div>
      <div className="bg-warn-soft border border-warn/30 rounded-lg px-4 py-3 mb-6 text-sm text-ink-soft">
        <strong className="text-warn">Note:</strong> these reports reflect activity actually logged in this
        CRM — workflow actions and notes you or your team add. There is no connected email service provider
        or SMS provider yet, so this is not a live inbox/delivery report from Mailchimp, Twilio, etc. — every
        entry below marked &quot;not sent&quot; is a logged intent, not a confirmed delivery.
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        <StatCard label="Emails logged" value={String(byType.email ?? 0)} />
        <StatCard label="SMS logged" value={String(byType.sms ?? 0)} />
        <StatCard label="Calls logged" value={String(byType.call ?? 0)} />
        <StatCard label="Agent runs" value={String(byType.agent_run ?? 0)} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        <ActivityPanel title="Email activity" items={emails} workspaceId={id} />
        <ActivityPanel title="SMS activity" items={sms} workspaceId={id} />
      </div>
    </div>
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
      <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-4">{title}</div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-faint">Nothing logged yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {items.slice(0, 20).map((a) => (
            <li key={a.id} className="text-sm">
              <Link href={`/workspaces/${workspaceId}/crm/leads/${a.lead.id}`} className="text-ink font-medium hover:text-accent">
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
