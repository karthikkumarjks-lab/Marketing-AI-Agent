import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";
import { parseCustomFields, parseTags } from "@/lib/crm";
import { formatMoney } from "@/lib/currency";
import LeadStageSelect from "@/components/lead-stage-select";
import LeadJourney from "@/components/lead-journey";
import LeadRunAgent from "@/components/lead-run-agent";

export default async function LeadDetailPage({ params }: PageProps<"/workspaces/[id]/crm/leads/[leadId]">) {
  const { id, leadId } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const [lead, stages, customFieldDefs, activities, agentRuns, wiredAgents] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId }, include: { stage: true } }),
    ensureDefaultStages(id),
    prisma.customFieldDef.findMany({ where: { workspaceId: id, entity: "lead" }, orderBy: { sortOrder: "asc" } }),
    prisma.leadActivity.findMany({ where: { leadId }, orderBy: { occurredAt: "desc" } }),
    prisma.agentRun.findMany({ where: { leadId }, include: { agent: true }, orderBy: { createdAt: "desc" } }),
    prisma.agent.findMany({ where: { isWired: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
  ]);
  if (!lead || lead.workspaceId !== id) notFound();

  const customFields = parseCustomFields(lead.customFields);
  const tags = parseTags(lead.tags);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link href={`/workspaces/${id}/crm/leads`} className="text-xs text-ink-faint hover:text-accent">
          ← All leads
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest text-crm-journey">Flight Log</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-6">
          <div className="bg-surface border border-line rounded-lg p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-ink">{lead.name}</h2>
                <div className="text-sm text-ink-soft mt-1 space-x-3">
                  {lead.email && <span>{lead.email}</span>}
                  {lead.phone && <span>{lead.phone}</span>}
                  {lead.company && <span>{lead.company}</span>}
                </div>
              </div>
              <LeadStageSelect
                workspaceId={id}
                leadId={leadId}
                stages={stages.map((s) => ({ id: s.id, name: s.name, isWon: s.isWon, isLost: s.isLost }))}
                currentStageId={lead.stageId}
              />
            </div>

            <dl className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-line text-sm">
              <div>
                <dt className="text-xs text-ink-faint">Source</dt>
                <dd className="text-ink mt-0.5">{lead.source || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Deal value</dt>
                <dd className="text-ink mt-0.5 tabular-nums">
                  {lead.dealValue != null ? formatMoney(lead.dealValue, workspace.currency) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-faint">Score</dt>
                <dd className="text-ink mt-0.5">{lead.score ?? "—"}</dd>
              </div>
              {customFieldDefs.map((f) => (
                <div key={f.id}>
                  <dt className="text-xs text-ink-faint">{f.label}</dt>
                  <dd className="text-ink mt-0.5">{String(customFields[f.key] ?? "—")}</dd>
                </div>
              ))}
            </dl>

            {tags.length > 0 && (
              <div className="flex gap-1.5 mt-4 flex-wrap">
                {tags.map((t) => (
                  <span key={t} className="text-xs bg-accent-soft text-accent-ink rounded-full px-2 py-0.5">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          <LeadJourney workspaceId={id} leadId={leadId} activities={activities} agentRuns={agentRuns} />
        </div>

        <div>
          <LeadRunAgent workspaceId={id} leadId={leadId} agents={wiredAgents.map((a) => ({ key: a.key, name: a.name, category: a.category }))} />
        </div>
      </div>
    </div>
  );
}
