import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CrmTabs from "@/components/crm-tabs";

export default async function CrmLayout({ children, params }: LayoutProps<"/workspaces/[id]/crm">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!workspace) notFound();

  return (
    <main className="max-w-6xl mx-auto px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">CRM</div>
        <h1 className="text-2xl font-semibold text-ink">
          <Link href={`/workspaces/${id}`} className="hover:text-accent">
            {workspace.name}
          </Link>
          <span className="text-ink-faint font-normal"> · AI-led CRM</span>
        </h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl">
          Real leads, a real pipeline, and workflows that can call on any of your agents — built for
          this business specifically (custom fields carry whatever your industry needs), not a
          one-size-fits-all import from Zoho or HubSpot.
        </p>
      </div>
      <CrmTabs workspaceId={id} />
      <div className="mt-6">{children}</div>
    </main>
  );
}
