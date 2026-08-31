import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import WorkflowForm from "@/components/workflow-form";
import WorkflowRow from "@/components/workflow-row";

export default async function WorkflowsPage({ params }: PageProps<"/workspaces/[id]/crm/workflows">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [rules, stages, agents, emailTemplates] = await Promise.all([
    prisma.workflowRule.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
      include: { runLogs: { orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    ensureDefaultStages(id),
    prisma.agent.findMany({ where: { isWired: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
    prisma.emailTemplate.findMany({ where: { workspaceId: id }, orderBy: { updatedAt: "desc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <div className="bg-warn-soft border border-warn/30 rounded-lg px-4 py-3 mb-5 text-sm text-ink-soft">
        <strong className="text-warn">Note:</strong> rules fire the instant their trigger event happens (lead
        created, stage changed, etc.) — there is no scheduler yet, so a delayed/time-based trigger
        (&quot;3 days after no reply&quot;) isn&apos;t supported. &quot;Log an email/SMS&quot; only records the
        intended message on the lead&apos;s timeline, nothing sends. &quot;Send an email&quot; is real — it
        actually delivers a template built in the Emails tab, via this workspace&apos;s connected email account.
        Other real, working actions: change stage, add tag, set a custom field, add a note, POST a webhook, or
        run any wired agent for that lead.
      </div>

      <WorkflowForm
        workspaceId={id}
        stages={stages.map((s) => ({ id: s.id, name: s.name }))}
        agents={agents.map((a) => ({ key: a.key, name: a.name, category: a.category }))}
        emailTemplates={emailTemplates}
      />

      <div className="mt-6 space-y-3">
        {rules.length === 0 && (
          <p className="text-sm text-ink-faint text-center py-8">No workflow rules yet — create one above.</p>
        )}
        {rules.map((rule) => (
          <WorkflowRow
            key={rule.id}
            rule={{
              id: rule.id,
              name: rule.name,
              isActive: rule.isActive,
              triggerType: rule.triggerType,
              conditions: rule.conditions,
              actions: rule.actions,
              runLogs: rule.runLogs.map((l) => ({ id: l.id, status: l.status, detail: l.detail, createdAt: l.createdAt.toISOString() })),
            }}
            workspaceId={id}
          />
        ))}
      </div>
    </div>
  );
}
