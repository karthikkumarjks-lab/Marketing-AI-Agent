// Shared CRM types, JSON-column parsing helpers, and default pipeline
// stages. Kept deliberately industry-neutral — see DEFAULT_STAGES below —
// since this CRM has to work for a dental clinic and a B2B SaaS company
// with the same schema (custom fields carry the industry-specific bits,
// see CustomFieldDef in prisma/schema.prisma).

export interface PipelineStageLite {
  id: string;
  name: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
}

export interface CustomFieldDefLite {
  id: string;
  key: string;
  label: string;
  fieldType: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  isRequired: boolean;
  sortOrder: number;
}

export interface LeadLite {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string | null;
  stageId: string | null;
  score: number | null;
  dealValue: number | null;
  ownerName: string | null;
  customFields: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// A generic sales funnel that maps onto any industry — a clinic reads
// "Qualified" as "screened", a SaaS team reads it as "demo booked". Created
// once per workspace on first CRM visit (see ensureDefaultStages) rather
// than at workspace-creation time, so existing workspaces pick these up
// automatically without a data migration.
export const DEFAULT_STAGES: { name: string; order: number; isWon: boolean; isLost: boolean }[] = [
  { name: "New", order: 0, isWon: false, isLost: false },
  { name: "Contacted", order: 1, isWon: false, isLost: false },
  { name: "Qualified", order: 2, isWon: false, isLost: false },
  { name: "Proposal", order: 3, isWon: false, isLost: false },
  { name: "Won", order: 4, isWon: true, isLost: false },
  { name: "Lost", order: 5, isWon: false, isLost: true },
];

export function parseCustomFields(json: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function parseTags(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

export function parseSelectOptions(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((o) => typeof o === "string") : null;
  } catch {
    return null;
  }
}

// A compact, human-readable block for injecting one specific lead's real
// data into an agent's prompt (see AgentRun.leadId / the workflow engine's
// run_agent action) — this is what lets "run the Lead Nurturing Strategy
// agent for this one lead" actually reason about that lead, not just the
// workspace's generic Company DNA.
export function buildLeadContext(lead: LeadLite, stageName: string | null): string {
  const fields = Object.entries(lead.customFields)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join("\n");
  return `\n\n# CRM Lead Context (real, stored — this run is about ONE specific lead)
- **Name:** ${lead.name}
- **Email:** ${lead.email ?? "not on record"}
- **Phone:** ${lead.phone ?? "not on record"}
- **Company:** ${lead.company ?? "not on record"}
- **Source:** ${lead.source ?? "not on record"}
- **Pipeline stage:** ${stageName ?? "not on record"}
- **Score:** ${lead.score ?? "not scored"}
- **Deal value:** ${lead.dealValue ?? "not on record"}
- **Tags:** ${lead.tags.length > 0 ? lead.tags.join(", ") : "none"}
${fields ? `- **Custom fields:**\n${fields}` : ""}

Reason specifically about this lead using the data above — do not give generic advice that ignores it.`;
}
