"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

function urlTransform(url: string): string {
  if (url.startsWith("data:image/")) return url;
  return defaultUrlTransform(url);
}

interface ActivityLite {
  id: string;
  type: string;
  channel: string | null;
  summary: string;
  occurredAt: Date;
}

interface AgentRunLite {
  id: string;
  outputMarkdown: string;
  isDemo: boolean;
  createdAt: Date;
  agent: { name: string; key: string };
}

const TYPE_ICON: Record<string, string> = {
  created: "＋",
  note: "✎",
  email: "✉",
  sms: "◐",
  call: "☎",
  stage_change: "→",
  field_update: "✎",
  agent_run: "◆",
  workflow_action: "⚙",
};

// FLIGHT LOG — the one narrative instrument on the panel. Everything else
// in the CRM is a grid or a table; this is the only place that reads
// top-to-bottom like an entry log, with a real connecting rail down the
// left edge and the warm crm-journey accent (deliberately the only warm
// color anywhere in the CRM — this is where a person actually reads what
// happened, so it gets the one un-clinical moment).
export default function LeadJourney({
  workspaceId,
  leadId,
  activities,
  agentRuns,
}: {
  workspaceId: string;
  leadId: string;
  activities: ActivityLite[];
  agentRuns: AgentRunLite[];
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [pending, setPending] = useState(false);

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/leads/${leadId}/activities`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "note", summary: note.trim() }),
    });
    setNote("");
    setPending(false);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-6">
      <div className="flex items-baseline justify-between mb-5">
        <h3 className="font-[family-name:var(--font-display)] text-base font-semibold text-ink">Flight log</h3>
        <span className="text-[10px] font-mono uppercase tracking-widest text-crm-journey">Journey</span>
      </div>

      <form onSubmit={addNote} className="flex gap-2 mb-6">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Log an entry — a call summary, context, anything worth remembering…"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-crm-journey/40 focus:border-crm-journey"
        />
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="rounded-md border border-line text-sm px-3 py-1.5 text-ink-soft hover:bg-bg disabled:opacity-50"
        >
          Log
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-ink-faint">No entries logged yet.</p>
      ) : (
        <ol className="relative">
          <div className="absolute left-[13px] top-2 bottom-2 w-px bg-line" aria-hidden="true" />
          {activities.map((a) => (
            <li key={a.id} className="relative flex items-start gap-4 pb-6 last:pb-0">
              <span className="relative z-10 w-[26px] h-[26px] shrink-0 rounded-full bg-crm-journey-soft text-crm-journey flex items-center justify-center text-xs border-2 border-surface ring-1 ring-line">
                {TYPE_ICON[a.type] ?? "•"}
              </span>
              <div className="flex-1 pt-0.5">
                <div className="text-ink-soft leading-relaxed">{a.summary}</div>
                <div className="text-[11px] font-mono text-ink-faint mt-1 tracking-wide">
                  {a.occurredAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase()} ·{" "}
                  {a.occurredAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {agentRuns.length > 0 && (
        <div className="mt-7 pt-6 border-t border-line">
          <div className="text-[10px] font-mono uppercase tracking-widest text-ink-faint mb-3">
            Agent outputs logged against this lead
          </div>
          <div className="space-y-2">
            {agentRuns.map((run) => (
              <details key={run.id} className="border border-line rounded-md">
                <summary className="cursor-pointer px-3 py-2 text-sm text-ink font-medium">
                  {run.agent.name}
                  {run.isDemo && <span className="text-xs text-warn font-normal ml-2">(demo output)</span>}
                  <span className="text-xs text-ink-faint font-normal ml-2">
                    {run.createdAt.toLocaleDateString("en-GB")}
                  </span>
                </summary>
                <div className="prose-agent px-3 pb-3">
                  <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={urlTransform}>
                    {run.outputMarkdown}
                  </ReactMarkdown>
                </div>
              </details>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
