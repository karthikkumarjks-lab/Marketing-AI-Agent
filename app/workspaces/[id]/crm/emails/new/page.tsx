import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import EmailBuilderLoader from "@/components/email-builder-loader";

export default async function NewEmailTemplatePage({ params }: PageProps<"/workspaces/[id]/crm/emails/new">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  return (
    <div>
      <Link href={`/workspaces/${id}/crm/emails`} className="text-xs text-ink-faint hover:text-accent">
        ← All templates
      </Link>
      <h2 className="text-lg font-semibold text-ink mt-2 mb-4">New email template</h2>
      <EmailBuilderLoader workspaceId={id} template={null} />
    </div>
  );
}
