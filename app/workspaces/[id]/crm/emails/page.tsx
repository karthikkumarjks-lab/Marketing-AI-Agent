import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmailTemplateRow from "@/components/email-template-row";

export default async function EmailsPage({ params }: PageProps<"/workspaces/[id]/crm/emails">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [templates, stages] = await Promise.all([
    prisma.emailTemplate.findMany({ where: { workspaceId: id }, orderBy: { updatedAt: "desc" } }),
    prisma.pipelineStage.findMany({ where: { workspaceId: id }, orderBy: { order: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-ink">Email templates</h2>
          <p className="text-sm text-ink-soft mt-1">
            Build once in the drag-and-drop editor, then reuse a template as a workflow action or a one-off bulk
            campaign — same template either way.
          </p>
        </div>
        <Link
          href={`/workspaces/${id}/crm/emails/new`}
          className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity whitespace-nowrap"
        >
          + New Template
        </Link>
      </div>

      {templates.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-8 text-center">
          <p className="text-sm text-ink-faint">No templates yet — build your first one.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <EmailTemplateRow
              key={t.id}
              workspaceId={id}
              template={{ id: t.id, name: t.name, subject: t.subject, isAmpEnabled: t.isAmpEnabled, updatedAt: t.updatedAt.toISOString() }}
              stages={stages.map((s) => ({ id: s.id, name: s.name }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
