import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { parseSelectOptions } from "@/lib/crm";
import { formatMoney } from "@/lib/currency";
import NewLeadForm from "@/components/new-lead-form";

export default async function LeadsPage({ params }: PageProps<"/workspaces/[id]/crm/leads">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [stages, leads, customFields] = await Promise.all([
    ensureDefaultStages(id),
    prisma.lead.findMany({ where: { workspaceId: id }, include: { stage: true }, orderBy: { createdAt: "desc" } }),
    prisma.customFieldDef.findMany({ where: { workspaceId: id, entity: "lead" }, orderBy: { sortOrder: "asc" } }),
  ]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-ink-faint">{leads.length} lead{leads.length === 1 ? "" : "s"}</div>
        <NewLeadForm
          workspaceId={id}
          stages={stages.map((s) => ({ id: s.id, name: s.name }))}
          customFields={customFields.map((f) => ({
            id: f.id,
            key: f.key,
            label: f.label,
            fieldType: f.fieldType as "text" | "number" | "date" | "boolean" | "select",
            options: parseSelectOptions(f.options),
            isRequired: f.isRequired,
          }))}
        />
      </div>

      <div className="bg-surface border border-line rounded-lg overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="text-[11px] uppercase tracking-wide text-ink-faint border-b border-line">
              <th className="py-2 px-4 font-medium">Name</th>
              <th className="py-2 px-4 font-medium">Company</th>
              <th className="py-2 px-4 font-medium">Stage</th>
              <th className="py-2 px-4 font-medium">Source</th>
              <th className="py-2 px-4 font-medium text-right">Deal value</th>
              <th className="py-2 px-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 px-4 text-center text-sm text-ink-faint">
                  No leads yet — add your first one above.
                </td>
              </tr>
            )}
            {leads.map((lead) => (
              <tr key={lead.id} className="border-b border-line last:border-0 text-sm hover:bg-bg">
                <td className="py-3 px-4">
                  <Link href={`/workspaces/${id}/crm/leads/${lead.id}`} className="text-ink font-medium hover:text-accent">
                    {lead.name}
                  </Link>
                  {lead.email && <div className="text-xs text-ink-faint">{lead.email}</div>}
                </td>
                <td className="py-3 px-4 text-ink-soft">{lead.company || "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      lead.stage?.isWon
                        ? "bg-accent-soft text-accent-ink"
                        : lead.stage?.isLost
                          ? "bg-danger-soft text-danger"
                          : "bg-line text-ink-soft"
                    }`}
                  >
                    {lead.stage?.name ?? "Unassigned"}
                  </span>
                </td>
                <td className="py-3 px-4 text-ink-soft">{lead.source || "—"}</td>
                <td className="py-3 px-4 text-ink tabular-nums text-right">
                  {lead.dealValue != null ? formatMoney(lead.dealValue, workspace.currency) : "—"}
                </td>
                <td className="py-3 px-4 text-ink-faint tabular-nums">
                  {lead.createdAt.toLocaleDateString("en-GB")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
