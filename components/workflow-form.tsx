"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40";

type ActionType = "change_stage" | "add_tag" | "set_field" | "create_note" | "log_email" | "log_sms" | "webhook" | "run_agent";

interface ActionRow {
  type: ActionType;
  stageId?: string;
  tag?: string;
  key?: string;
  value?: string;
  text?: string;
  subject?: string;
  body?: string;
  url?: string;
  agentKey?: string;
}

interface ConditionRow {
  field: string;
  operator: string;
  value: string;
}

const ACTION_LABELS: Record<ActionType, string> = {
  change_stage: "Change stage",
  add_tag: "Add tag",
  set_field: "Set custom field",
  create_note: "Add a note",
  log_email: "Log an email (not sent)",
  log_sms: "Log an SMS (not sent)",
  webhook: "POST a webhook",
  run_agent: "Run an agent",
};

export default function WorkflowForm({
  workspaceId,
  stages,
  agents,
}: {
  workspaceId: string;
  stages: { id: string; name: string }[];
  agents: { key: string; name: string; category: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("lead_created");
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([{ type: "add_tag", tag: "" }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateAction(i: number, patch: Partial<ActionRow>) {
    setActions(actions.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  }

  function toApiAction(a: ActionRow) {
    switch (a.type) {
      case "change_stage":
        return { type: "change_stage", stageId: a.stageId, stageName: stages.find((s) => s.id === a.stageId)?.name };
      case "add_tag":
        return { type: "add_tag", tag: a.tag };
      case "set_field":
        return { type: "set_field", key: a.key, value: a.value };
      case "create_note":
        return { type: "create_note", text: a.text };
      case "log_email":
        return { type: "log_email", subject: a.subject, body: a.body };
      case "log_sms":
        return { type: "log_sms", body: a.body };
      case "webhook":
        return { type: "webhook", url: a.url };
      case "run_agent":
        return { type: "run_agent", agentKey: a.agentKey, agentName: agents.find((ag) => ag.key === a.agentKey)?.name };
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Rule name is required.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/workflows`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name,
        triggerType,
        conditions: conditions.filter((c) => c.field.trim()),
        actions: actions.map(toApiAction),
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not create rule.");
      return;
    }
    setName("");
    setConditions([]);
    setActions([{ type: "add_tag", tag: "" }]);
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity"
      >
        + New Workflow Rule
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-line rounded-lg p-5">
      <div className="flex gap-3 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name, e.g. Welcome new website leads"
          className={`${inputClass} flex-1`}
          autoFocus
        />
      </div>

      <div className="mb-4">
        <span className="block text-xs text-ink-faint mb-1">When</span>
        <select value={triggerType} onChange={(e) => setTriggerType(e.target.value)} className={inputClass}>
          <option value="lead_created">A lead is created</option>
          <option value="stage_changed">A lead&apos;s stage changes</option>
          <option value="field_updated">A lead&apos;s custom fields are updated</option>
          <option value="tag_added">A tag is added to a lead</option>
        </select>
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-ink-faint">If (optional conditions — all must match)</span>
          <button
            type="button"
            onClick={() => setConditions([...conditions, { field: "", operator: "equals", value: "" }])}
            className="text-xs text-accent hover:underline"
          >
            + Add condition
          </button>
        </div>
        {conditions.map((c, i) => (
          <div key={i} className="flex gap-2 mb-1.5">
            <input
              value={c.field}
              onChange={(e) => setConditions(conditions.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))}
              placeholder="field (e.g. source, score, custom.industry)"
              className={`${inputClass} flex-1`}
            />
            <select
              value={c.operator}
              onChange={(e) => setConditions(conditions.map((x, idx) => (idx === i ? { ...x, operator: e.target.value } : x)))}
              className={inputClass}
            >
              <option value="equals">equals</option>
              <option value="not_equals">not equals</option>
              <option value="contains">contains</option>
              <option value="gt">greater than</option>
              <option value="lt">less than</option>
              <option value="is_set">is set</option>
              <option value="is_not_set">is not set</option>
            </select>
            <input
              value={c.value}
              onChange={(e) => setConditions(conditions.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
              placeholder="value"
              className={`${inputClass} flex-1`}
            />
            <button type="button" onClick={() => setConditions(conditions.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-danger px-1">
              ✕
            </button>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-ink-faint">Then</span>
          <button
            type="button"
            onClick={() => setActions([...actions, { type: "add_tag", tag: "" }])}
            className="text-xs text-accent hover:underline"
          >
            + Add action
          </button>
        </div>
        {actions.map((a, i) => (
          <div key={i} className="flex gap-2 mb-1.5 items-start">
            <select value={a.type} onChange={(e) => updateAction(i, { type: e.target.value as ActionType })} className={inputClass}>
              {Object.entries(ACTION_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <div className="flex-1 flex gap-2">
              {a.type === "change_stage" && (
                <select value={a.stageId ?? ""} onChange={(e) => updateAction(i, { stageId: e.target.value })} className={`${inputClass} flex-1`}>
                  <option value="">choose a stage…</option>
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              )}
              {a.type === "add_tag" && (
                <input value={a.tag ?? ""} onChange={(e) => updateAction(i, { tag: e.target.value })} placeholder="tag" className={`${inputClass} flex-1`} />
              )}
              {a.type === "set_field" && (
                <>
                  <input value={a.key ?? ""} onChange={(e) => updateAction(i, { key: e.target.value })} placeholder="field key" className={`${inputClass} flex-1`} />
                  <input value={a.value ?? ""} onChange={(e) => updateAction(i, { value: e.target.value })} placeholder="value" className={`${inputClass} flex-1`} />
                </>
              )}
              {a.type === "create_note" && (
                <input value={a.text ?? ""} onChange={(e) => updateAction(i, { text: e.target.value })} placeholder="note text" className={`${inputClass} flex-1`} />
              )}
              {a.type === "log_email" && (
                <>
                  <input value={a.subject ?? ""} onChange={(e) => updateAction(i, { subject: e.target.value })} placeholder="subject" className={`${inputClass} flex-1`} />
                  <input value={a.body ?? ""} onChange={(e) => updateAction(i, { body: e.target.value })} placeholder="body" className={`${inputClass} flex-1`} />
                </>
              )}
              {a.type === "log_sms" && (
                <input value={a.body ?? ""} onChange={(e) => updateAction(i, { body: e.target.value })} placeholder="message" className={`${inputClass} flex-1`} />
              )}
              {a.type === "webhook" && (
                <input value={a.url ?? ""} onChange={(e) => updateAction(i, { url: e.target.value })} placeholder="https://…" className={`${inputClass} flex-1`} />
              )}
              {a.type === "run_agent" && (
                <select value={a.agentKey ?? ""} onChange={(e) => updateAction(i, { agentKey: e.target.value })} className={`${inputClass} flex-1`}>
                  <option value="">choose an agent…</option>
                  {agents.map((ag) => (
                    <option key={ag.key} value={ag.key}>
                      {ag.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <button type="button" onClick={() => setActions(actions.filter((_, idx) => idx !== i))} className="text-ink-faint hover:text-danger px-1">
              ✕
            </button>
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger mb-3">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : "Create Rule"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-md border border-line text-sm px-3 py-1.5 text-ink-soft hover:bg-bg">
          Cancel
        </button>
      </div>
    </form>
  );
}
