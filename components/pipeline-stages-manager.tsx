"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface StageLite {
  id: string;
  name: string;
  isWon: boolean;
  isLost: boolean;
}

export default function PipelineStagesManager({ workspaceId, stages }: { workspaceId: string; stages: StageLite[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"open" | "won" | "lost">("open");
  const [pending, setPending] = useState(false);

  async function addStage(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/pipeline-stages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, isWon: kind === "won", isLost: kind === "lost" }),
    });
    setName("");
    setPending(false);
    router.refresh();
  }

  async function removeStage(id: string) {
    if (!confirm("Delete this stage? Leads in it become unassigned.")) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/pipeline-stages/${id}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-1">Pipeline stages</div>
      <p className="text-xs text-ink-faint mb-4">
        Rename the default funnel to match how your business actually sells — e.g. a clinic might use
        &quot;Screened&quot; where a SaaS team uses &quot;Demo booked&quot;.
      </p>
      <ul className="space-y-1.5 mb-4">
        {stages.map((s) => (
          <li key={s.id} className="flex items-center justify-between text-sm py-1">
            <span className="flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.isWon ? "bg-accent-soft text-accent-ink" : s.isLost ? "bg-danger-soft text-danger" : "bg-line text-ink-soft"
                }`}
              >
                {s.name}
              </span>
            </span>
            <button onClick={() => removeStage(s.id)} disabled={pending} className="text-xs text-ink-faint hover:text-danger">
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={addStage} className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New stage name"
          className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as "open" | "won" | "lost")}
          className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="open">Open</option>
          <option value="won">Won</option>
          <option value="lost">Lost</option>
        </select>
        <button
          type="submit"
          disabled={pending || !name.trim()}
          className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 disabled:opacity-60"
        >
          Add
        </button>
      </form>
    </div>
  );
}
