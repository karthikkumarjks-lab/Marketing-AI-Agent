// Event-triggered automation. A rule list (not a visual canvas — see the
// Workflows page for why), evaluated synchronously the instant its trigger
// event happens. Every action here either does something real (update the
// lead, log a real timeline entry, POST a real webhook, run a real agent)
// or is explicitly labeled as unsent/simulated (log_email, log_sms) — there
// is no connected ESP/SMS/telephony provider yet, so nothing pretends to
// have actually sent anything external.
//
// Deliberate v1 limitation: actions performed BY this engine (change_stage,
// set_field, add_tag) do not re-trigger other workflow rules. Without that
// guardrail two rules could fire each other forever. If cross-rule chaining
// is ever needed, it should be a bounded-depth re-dispatch, not unlimited
// recursion — a deliberate future change, not an oversight.
import { prisma } from "@/lib/prisma";
import { parseCustomFields, parseTags, type LeadLite } from "@/lib/crm";
import { runAgentLLM, type CompanyDNAInput, type BrandDNAInput } from "@/lib/agent-prompts";
import { buildLeadContext } from "@/lib/crm";

export type TriggerType = "lead_created" | "stage_changed" | "field_updated" | "tag_added";

export interface WorkflowCondition {
  field: string; // "stageId" | "score" | "source" | "dealValue" | "tags" | `custom.<key>`
  operator: "equals" | "not_equals" | "contains" | "gt" | "lt" | "is_set" | "is_not_set";
  value?: string | number;
}

export type WorkflowAction =
  | { type: "change_stage"; stageId: string; stageName?: string }
  | { type: "add_tag"; tag: string }
  | { type: "set_field"; key: string; value: string }
  | { type: "create_note"; text: string }
  | { type: "log_email"; subject: string; body: string }
  | { type: "log_sms"; body: string }
  | { type: "webhook"; url: string }
  | { type: "run_agent"; agentKey: string; agentName?: string };

function getFieldValue(lead: LeadLite, field: string): unknown {
  if (field.startsWith("custom.")) return lead.customFields[field.slice(7)];
  if (field === "tags") return lead.tags;
  return (lead as unknown as Record<string, unknown>)[field];
}

function evaluateCondition(lead: LeadLite, cond: WorkflowCondition): boolean {
  const actual = getFieldValue(lead, cond.field);
  switch (cond.operator) {
    case "is_set":
      return actual != null && actual !== "";
    case "is_not_set":
      return actual == null || actual === "";
    case "contains":
      if (Array.isArray(actual)) return actual.includes(String(cond.value));
      return String(actual ?? "").toLowerCase().includes(String(cond.value ?? "").toLowerCase());
    case "equals":
      return String(actual ?? "") === String(cond.value ?? "");
    case "not_equals":
      return String(actual ?? "") !== String(cond.value ?? "");
    case "gt":
      return Number(actual) > Number(cond.value);
    case "lt":
      return Number(actual) < Number(cond.value);
    default:
      return false;
  }
}

function toLeadLite(lead: {
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
  customFields: string;
  tags: string;
  createdAt: Date;
  updatedAt: Date;
}): LeadLite {
  return {
    ...lead,
    customFields: parseCustomFields(lead.customFields),
    tags: parseTags(lead.tags),
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
  };
}

async function executeAction(
  action: WorkflowAction,
  leadRow: Awaited<ReturnType<typeof prisma.lead.findUniqueOrThrow>>,
  workspace: { id: string; name: string; industry: string | null; currency: string },
): Promise<string> {
  switch (action.type) {
    case "change_stage": {
      await prisma.lead.update({ where: { id: leadRow.id }, data: { stageId: action.stageId } });
      await prisma.leadActivity.create({
        data: { leadId: leadRow.id, type: "stage_change", channel: "system", summary: `Workflow moved stage to "${action.stageName ?? action.stageId}"` },
      });
      return `Moved to stage "${action.stageName ?? action.stageId}"`;
    }
    case "add_tag": {
      const tags = parseTags(leadRow.tags);
      if (!tags.includes(action.tag)) tags.push(action.tag);
      await prisma.lead.update({ where: { id: leadRow.id }, data: { tags: JSON.stringify(tags) } });
      await prisma.leadActivity.create({
        data: { leadId: leadRow.id, type: "field_update", channel: "system", summary: `Workflow added tag "${action.tag}"` },
      });
      return `Added tag "${action.tag}"`;
    }
    case "set_field": {
      const fields = parseCustomFields(leadRow.customFields);
      fields[action.key] = action.value;
      await prisma.lead.update({ where: { id: leadRow.id }, data: { customFields: JSON.stringify(fields) } });
      await prisma.leadActivity.create({
        data: { leadId: leadRow.id, type: "field_update", channel: "system", summary: `Workflow set "${action.key}" = "${action.value}"` },
      });
      return `Set ${action.key} = ${action.value}`;
    }
    case "create_note": {
      await prisma.leadActivity.create({
        data: { leadId: leadRow.id, type: "note", channel: "system", summary: action.text },
      });
      return `Added note`;
    }
    case "log_email": {
      // NOT actually sent — no connected ESP. Recorded so Email Reports has
      // real data to show and the intent is visible on the lead's timeline.
      await prisma.leadActivity.create({
        data: {
          leadId: leadRow.id,
          type: "email",
          channel: "email",
          summary: `[Not sent — no ESP connected] ${action.subject}`,
          detail: JSON.stringify({ subject: action.subject, body: action.body, actuallySent: false }),
        },
      });
      return `Logged email (not sent — no ESP connected)`;
    }
    case "log_sms": {
      await prisma.leadActivity.create({
        data: {
          leadId: leadRow.id,
          type: "sms",
          channel: "sms",
          summary: `[Not sent — no SMS provider connected] ${action.body.slice(0, 60)}`,
          detail: JSON.stringify({ body: action.body, actuallySent: false }),
        },
      });
      return `Logged SMS (not sent — no SMS provider connected)`;
    }
    case "webhook": {
      try {
        const res = await fetch(action.url, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lead: toLeadLite(leadRow), workspaceId: workspace.id }),
          signal: AbortSignal.timeout(8000),
        });
        await prisma.leadActivity.create({
          data: { leadId: leadRow.id, type: "workflow_action", channel: "system", summary: `Webhook POSTed to ${action.url} (${res.status})` },
        });
        return `Webhook sent (HTTP ${res.status})`;
      } catch (err) {
        await prisma.leadActivity.create({
          data: { leadId: leadRow.id, type: "workflow_action", channel: "system", summary: `Webhook to ${action.url} FAILED` },
        });
        throw err;
      }
    }
    case "run_agent": {
      const agent = await prisma.agent.findUnique({ where: { key: action.agentKey } });
      if (!agent || !agent.isWired) throw new Error(`Agent "${action.agentKey}" is not available.`);
      const dna: CompanyDNAInput = {
        name: workspace.name,
        industry: workspace.industry,
        objective: null,
        monthlyBudget: null,
        currency: workspace.currency,
        country: null,
        websiteUrl: null,
        icpNotes: null,
        currentChannels: null,
        marketingAssets: null,
        aov: null,
        ltv: null,
        grossMarginPct: null,
        salesCycleDays: null,
        salesCapacity: null,
        cacTarget: null,
        cplTarget: null,
        roasTarget: null,
        revenueTarget: null,
        conversionTarget: null,
        retentionTarget: null,
        northStarKpi: null,
        guardrails: null,
        seasonality: null,
        existingStack: null,
        maturityStage: null,
      };
      const stage = leadRow.stageId ? await prisma.pipelineStage.findUnique({ where: { id: leadRow.stageId } }) : null;
      const brandDna = await prisma.brandDNA.findUnique({ where: { workspaceId: workspace.id } });
      const leadContext = buildLeadContext(toLeadLite(leadRow), stage?.name ?? null);
      const result = await runAgentLLM(action.agentKey, agent.name, dna, leadContext, brandDna as BrandDNAInput | null);
      await prisma.agentRun.create({
        data: {
          workspaceId: workspace.id,
          agentId: agent.id,
          leadId: leadRow.id,
          inputContext: JSON.stringify(dna),
          outputMarkdown: result.markdown,
          isDemo: result.isDemo,
          model: result.model,
        },
      });
      await prisma.leadActivity.create({
        data: { leadId: leadRow.id, type: "agent_run", channel: "system", summary: `Workflow ran "${agent.name}"${result.isDemo ? " (demo output — no API key set)" : ""}` },
      });
      return `Ran agent "${agent.name}"`;
    }
  }
}

// Called after a real lead create/update in the leads API routes. Fetches
// only ACTIVE rules matching this trigger type for the lead's workspace,
// evaluates each rule's conditions against the lead's CURRENT (post-change)
// state, and executes actions for every rule that matches. Every rule gets
// its own WorkflowRunLog row regardless of success/failure — errors in one
// rule never block the others.
export async function runWorkflowsForEvent(workspaceId: string, triggerType: TriggerType, leadId: string) {
  const [rules, leadRow, workspace] = await Promise.all([
    prisma.workflowRule.findMany({ where: { workspaceId, isActive: true, triggerType } }),
    prisma.lead.findUniqueOrThrow({ where: { id: leadId } }),
    prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { id: true, name: true, industry: true, currency: true } }),
  ]);
  if (rules.length === 0) return;

  const lead = toLeadLite(leadRow);

  for (const rule of rules) {
    let conditions: WorkflowCondition[] = [];
    try {
      conditions = JSON.parse(rule.conditions);
    } catch {
      // malformed conditions — treat as "no conditions" rather than crashing the loop
    }
    const matches = conditions.every((c) => evaluateCondition(lead, c));
    if (!matches) continue;

    let actions: WorkflowAction[] = [];
    try {
      actions = JSON.parse(rule.actions);
    } catch {
      await prisma.workflowRunLog.create({
        data: { workflowId: rule.id, leadId, status: "error", detail: "Malformed actions JSON — rule skipped." },
      });
      continue;
    }

    const results: string[] = [];
    let hadError = false;
    for (const action of actions) {
      try {
        results.push(await executeAction(action, leadRow, workspace));
      } catch (err) {
        hadError = true;
        results.push(`FAILED: ${action.type} — ${err instanceof Error ? err.message : "unknown error"}`);
      }
    }
    await prisma.workflowRunLog.create({
      data: {
        workflowId: rule.id,
        leadId,
        status: hadError ? "error" : "success",
        detail: results.join("; "),
      },
    });
  }
}
