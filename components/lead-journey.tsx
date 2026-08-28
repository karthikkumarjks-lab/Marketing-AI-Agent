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
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-4">
        Lead journey
      </div>

      <form onSubmit={addNote} className="flex gap-2 mb-5">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note (call summary, context, anything worth remembering)…"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <button
          type="submit"
          disabled={pending || !note.trim()}
          className="rounded-md border border-line text-sm px-3 py-1.5 text-ink-soft hover:bg-bg disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {activities.length === 0 ? (
        <p className="text-sm text-ink-faint">No activity yet.</p>
      ) : (
        <ol className="space-y-3 mb-2">
          {activities.map((a) => (
            <li key={a.id} className="flex items-start gap-3 text-sm">
              <span className="w-5 h-5 shrink-0 rounded-full bg-accent-soft text-accent-ink flex items-center justify-center text-xs">
                {TYPE_ICON[a.type] ?? "•"}
              </span>
              <div className="flex-1">
                <div className="text-ink-soft">{a.summary}</div>
                <div className="text-xs text-ink-faint mt-0.5">
                  {a.occurredAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      {agentRuns.length > 0 && (
        <div className="mt-6 pt-5 border-t border-line">
          <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-3">
            Agent outputs for this lead
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
