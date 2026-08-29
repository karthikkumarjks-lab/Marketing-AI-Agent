import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { parseSelectOptions } from "@/lib/crm";
import { formatMoney } from "@/lib/currency";
import NewLeadForm from "@/components/new-lead-form";

// MANIFEST — the densest, most functional instrument on the panel. Every
// choice here optimizes for scanning many rows fast: tabular-nums,
// monospace identifiers, a numbered ledger column, tight row height, and a
// left-edge tick instead of a big pill for stage — a shipping manifest, not
// a marketing card grid. No decorative color beyond what a status tick
// requires.
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
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs font-mono text-ink-faint tracking-wide">
          {String(leads.length).padStart(3, "0")} ENTR{leads.length === 1 ? "Y" : "IES"}
        </div>
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
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-mono uppercase tracking-wider text-ink-faint border-b border-line-strong">
              <th className="py-2 pl-4 pr-2 font-medium w-10">#</th>
              <th className="py-2 px-2 font-medium">Name</th>
              <th className="py-2 px-2 font-medium">Company</th>
              <th className="py-2 px-2 font-medium">Stage</th>
              <th className="py-2 px-2 font-medium">Source</th>
              <th className="py-2 px-2 font-medium text-right">Value</th>
              <th className="py-2 pl-2 pr-4 font-medium text-right">Logged</th>
            </tr>
          </thead>
          <tbody>
            {leads.length === 0 && (
              <tr>
                <td colSpan={7} className="py-10 px-4 text-center text-sm text-ink-faint">
                  No entries yet — log your first lead above.
                </td>
              </tr>
            )}
            {leads.map((lead, i) => (
              <tr key={lead.id} className="border-b border-line last:border-0 text-sm hover:bg-bg group">
                <td className="py-2 pl-4 pr-2 font-mono text-[11px] text-ink-faint tabular-nums">
                  {String(leads.length - i).padStart(3, "0")}
                </td>
                <td className="py-2 px-2 relative">
                  <span
                    className={`absolute left-0 top-1 bottom-1 w-0.5 rounded-full ${
                      lead.stage?.isWon ? "bg-accent" : lead.stage?.isLost ? "bg-danger" : "bg-transparent"
                    }`}
                  />
                  <Link href={`/workspaces/${id}/crm/leads/${lead.id}`} className="text-ink font-medium hover:text-accent">
                    {lead.name}
                  </Link>
                  {lead.email && <div className="text-[11px] font-mono text-ink-faint">{lead.email}</div>}
                </td>
                <td className="py-2 px-2 text-ink-soft">{lead.company || "—"}</td>
                <td className="py-2 px-2">
                  <span
                    className={`text-xs font-mono ${
                      lead.stage?.isWon ? "text-accent-ink" : lead.stage?.isLost ? "text-danger" : "text-ink-soft"
                    }`}
                  >
                    {(lead.stage?.name ?? "unassigned").toUpperCase()}
                  </span>
                </td>
                <td className="py-2 px-2 text-ink-soft">{lead.source || "—"}</td>
                <td className="py-2 px-2 text-ink tabular-nums text-right font-mono text-[13px]">
                  {lead.dealValue != null ? formatMoney(lead.dealValue, workspace.currency) : "—"}
                </td>
                <td className="py-2 pl-2 pr-4 text-ink-faint tabular-nums text-right font-mono text-[11px]">
                  {lead.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
