import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmailBuilderLoader from "@/components/email-builder-loader";

export default async function EditEmailTemplatePage({ params }: PageProps<"/workspaces/[id]/crm/emails/[templateId]">) {
  const { id, templateId } = await params;
  const [workspace, template] = await Promise.all([
    prisma.workspace.findUnique({ where: { id } }),
    prisma.emailTemplate.findUnique({ where: { id: templateId } }),
  ]);
  if (!workspace || !template || template.workspaceId !== id) notFound();

  return (
    <div>
      <Link href={`/workspaces/${id}/crm/emails`} className="text-xs text-ink-faint hover:text-accent">
        ← All templates
      </Link>
      <h2 className="text-lg font-semibold text-ink mt-2 mb-4">Edit email template</h2>
      <EmailBuilderLoader
        workspaceId={id}
        template={{
          id: template.id,
          name: template.name,
          subject: template.subject,
          htmlBody: template.htmlBody,
          designJson: template.designJson,
          isAmpEnabled: template.isAmpEnabled,
          ampBody: template.ampBody,
        }}
      />
    </div>
  );
}
