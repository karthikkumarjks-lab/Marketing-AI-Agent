import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import CurrencySelect from "@/components/currency-select";

export default async function WorkspaceLayout({
  children,
  params,
}: LayoutProps<"/workspaces/[id]">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({
    where: { id },
    select: { id: true, name: true, currency: true },
  });
  if (!workspace) notFound();

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center justify-between border-b border-line bg-surface px-8 py-2.5">
        <span className="text-xs text-ink-faint truncate">{workspace.name}</span>
        <CurrencySelect workspaceId={workspace.id} currentCurrency={workspace.currency} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
