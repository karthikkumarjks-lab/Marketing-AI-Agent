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
  lead_created: "a lead is created",
  stage_changed: "a lead's stage changes",
  field_updated: "a lead's custom fields are updated",
  tag_added: "a tag is added",
};

export default function WorkflowRow({ rule, workspaceId }: { rule: RuleLite; workspaceId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  const actionCount = (() => {
    try {
      return (JSON.parse(rule.actions) as unknown[]).length;
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
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-ink">{rule.name}</div>
          <div className="text-xs text-ink-faint mt-0.5">
            When {TRIGGER_LABELS[rule.triggerType] ?? rule.triggerType} → {actionCount} action{actionCount === 1 ? "" : "s"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="text-xs text-ink-faint hover:text-accent"
          >
            {rule.runLogs.length} run{rule.runLogs.length === 1 ? "" : "s"}
          </button>
          <button
            onClick={toggleActive}
            disabled={pending}
            className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${
              rule.isActive ? "bg-accent-soft text-accent-ink" : "bg-line text-ink-faint"
            }`}
          >
            {rule.isActive ? "Active" : "Paused"}
          </button>
          <button onClick={remove} disabled={pending} className="text-xs text-ink-faint hover:text-danger">
            Delete
          </button>
        </div>
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
