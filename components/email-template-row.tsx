"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  subject: string;
  isAmpEnabled: boolean;
  updatedAt: string;
}

export default function EmailTemplateRow({
  workspaceId,
  template,
  stages,
}: {
  workspaceId: string;
  template: Template;
  stages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "stage" | "tag">("all");
  const [stageId, setStageId] = useState(stages[0]?.id ?? "");
  const [tag, setTag] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function duplicate() {
    setPending(true);
    const res = await fetch(`/api/workspaces/${workspaceId}/email-templates/${template.id}`);
    const full = await res.json();
    await fetch(`/api/workspaces/${workspaceId}/email-templates`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: `${full.name} (copy)`,
        subject: full.subject,
        htmlBody: full.htmlBody,
        designJson: full.designJson,
        isAmpEnabled: full.isAmpEnabled,
        ampBody: full.ampBody,
      }),
    });
    setPending(false);
    router.refresh();
  }

  async function remove() {
    if (!confirm(`Delete "${template.name}"? This can't be undone.`)) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/email-templates/${template.id}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  async function sendCampaign() {
    if (filterType === "all" && !confirm("Send this template to every lead with an email address in this workspace?")) return;
    setSending(true);
    setResult(null);
    const recipientFilter = filterType === "all" ? { type: "all" } : filterType === "stage" ? { type: "stage", stageId } : { type: "tag", tag };
    const res = await fetch(`/api/workspaces/${workspaceId}/email-templates/${template.id}/campaign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipientFilter }),
    });
    const body = await res.json();
    setSending(false);
    if (!res.ok) {
      setResult(`Failed: ${body.error ?? "unknown error"}`);
      return;
    }
    setResult(`Sent ${body.sent}/${body.targeted} · ${body.failed} failed · ${body.skippedNoEmail} skipped (no email on file)`);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">{template.name}</div>
          <div className="text-xs text-ink-faint mt-0.5">
            {template.subject}
            {template.isAmpEnabled && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-accent-soft text-accent-ink">AMP</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Link href={`/workspaces/${workspaceId}/crm/emails/${template.id}`} className="text-xs text-accent hover:underline">
            Edit
          </Link>
          <button onClick={duplicate} disabled={pending} className="text-xs text-ink-soft hover:text-ink disabled:opacity-60">
            Duplicate
          </button>
          <button onClick={() => setCampaignOpen(!campaignOpen)} className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-soft hover:bg-bg">
            {campaignOpen ? "Close" : "Send Campaign"}
          </button>
          <button onClick={remove} disabled={pending} className="text-xs text-ink-faint hover:text-danger disabled:opacity-60">
            Delete
          </button>
        </div>
      </div>

      {campaignOpen && (
        <div className="mt-3 pt-3 border-t border-line flex flex-wrap items-center gap-2">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as typeof filterType)}
            className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-ink"
          >
            <option value="all">All leads with an email</option>
            <option value="stage">Leads in a specific stage</option>
            <option value="tag">Leads with a specific tag</option>
          </select>
          {filterType === "stage" && (
            <select value={stageId} onChange={(e) => setStageId(e.target.value)} className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-ink">
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
          {filterType === "tag" && (
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tag"
              className="rounded-md border border-line bg-bg px-2 py-1 text-xs text-ink w-32"
            />
          )}
          <button
            onClick={sendCampaign}
            disabled={sending || (filterType === "tag" && !tag.trim())}
            className="rounded-md bg-accent text-white text-xs font-medium px-3 py-1 hover:opacity-90 disabled:opacity-60"
          >
            {sending ? "Sending…" : "Send now"}
          </button>
          {result && <span className="text-xs text-ink-faint">{result}</span>}
        </div>
      )}
    </div>
  );
}
