"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface RunLog {
  id: string;
  status: string;
  detail: string;
  createdAt: string;
}

interface RuleLite {
  id: string;
  name: string;
  isActive: boolean;
  triggerType: string;
  conditions: string;
  actions: string;
  runLogs: RunLog[];
}

const TRIGGER_LABELS: Record<string, string> = {
  lead_created: "Lead created",
  stage_changed: "Stage changed",
  field_updated: "Fields updated",
  tag_added: "Tag added",
};

const ACTION_LABELS: Record<string, string> = {
  change_stage: "Change stage",
  add_tag: "Add tag",
  set_field: "Set field",
  create_note: "Add note",
  log_email: "Log email",
  log_sms: "Log SMS",
  webhook: "Webhook",
  run_agent: "Run agent",
};

interface ParsedAction {
  type: string;
}

// ROUTING — the only tab drawn as a circuit rather than a list or table.
// Every rule renders as connected nodes (trigger → conditions → actions)
// with the indigo crm-workflow accent, because that's literally what a
// workflow rule *is*: a routing path, not a row of data.
export default function WorkflowRow({ rule, workspaceId }: { rule: RuleLite; workspaceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const actions: ParsedAction[] = (() => {
    try {
      return JSON.parse(rule.actions);
    } catch {
      return [];
    }
  })();
  const conditionCount = (() => {
    try {
      return (JSON.parse(rule.conditions) as unknown[]).length;
    } catch {
      return 0;
    }
  })();

  async function toggleActive() {
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/workflows/${rule.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${rule.name}"?`)) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/workflows/${rule.id}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  return (
    <div className={`bg-surface border rounded-lg p-4 ${rule.isActive ? "border-line" : "border-line opacity-60"}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-medium text-ink">{rule.name}</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowLogs(!showLogs)} className="text-xs text-ink-faint hover:text-crm-workflow">
            {rule.runLogs.length} run{rule.runLogs.length === 1 ? "" : "s"}
          </button>
          <button
            onClick={toggleActive}
            disabled={pending}
            className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${
              rule.isActive ? "bg-crm-workflow-soft text-crm-workflow" : "bg-line text-ink-faint"
            }`}
          >
            {rule.isActive ? "Active" : "Paused"}
          </button>
          <button onClick={remove} disabled={pending} className="text-xs text-ink-faint hover:text-danger">
            Delete
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono px-2.5 py-1 rounded border border-crm-workflow/30 bg-crm-workflow-soft text-crm-workflow whitespace-nowrap">
          {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType}
        </span>
        {conditionCount > 0 && (
          <>
            <span className="text-line-strong">╌╌▸</span>
            <span className="text-xs font-mono px-2.5 py-1 rounded border border-line-strong bg-bg text-ink-soft whitespace-nowrap">
              if {conditionCount} condition{conditionCount === 1 ? "" : "s"}
            </span>
          </>
        )}
        <span className="text-crm-workflow">━▸</span>
        {actions.map((a, i) => (
          <span
            key={i}
            className="text-xs font-mono px-2.5 py-1 rounded border border-line-strong bg-bg text-ink whitespace-nowrap"
          >
            {ACTION_LABELS[a.type] ?? a.type}
          </span>
        ))}
      </div>

      {showLogs && (
        <div className="mt-3 pt-3 border-t border-line space-y-1.5">
          {rule.runLogs.length === 0 ? (
            <p className="text-xs text-ink-faint">Hasn&apos;t fired yet.</p>
          ) : (
            rule.runLogs.map((log) => (
              <div key={log.id} className="text-xs">
                <span className={log.status === "error" ? "text-danger" : "text-ink-faint"}>
                  {new Date(log.createdAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} —{" "}
                </span>
                <span className="text-ink-soft">{log.detail}</span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
