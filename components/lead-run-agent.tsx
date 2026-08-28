"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface AgentLite {
  key: string;
  name: string;
  category: string;
}

export default function LeadRunAgent({
  workspaceId,
  leadId,
  agents,
}: {
  workspaceId: string;
  leadId: string;
  agents: AgentLite[];
}) {
  const router = useRouter();
  const [agentKey, setAgentKey] = useState(agents[0]?.key ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = Array.from(new Set(agents.map((a) => a.category)));

  async function run() {
    if (!agentKey) return;
    setPending(true);
    setError(null);
    const res = await fetch("/api/agents/run", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, agentKey, leadId }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Run failed.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5 sticky top-4">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-3">
        Run an agent for this lead
      </div>
      <p className="text-xs text-ink-faint mb-3">
        Any wired agent can reason about this specific lead&apos;s real data — not generic advice.
      </p>
      <select
        value={agentKey}
        onChange={(e) => setAgentKey(e.target.value)}
        className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink mb-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
      >
        {categories.map((cat) => (
          <optgroup key={cat} label={cat}>
            {agents
              .filter((a) => a.category === cat)
              .map((a) => (
                <option key={a.key} value={a.key}>
                  {a.name}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <button
        onClick={run}
        disabled={pending || !agentKey}
        className="w-full rounded-md bg-accent text-white text-sm font-medium py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {pending ? "Running…" : "Run agent"}
      </button>
      {error && <p className="text-xs text-danger mt-2">{error}</p>}
      <p className="text-xs text-ink-faint mt-3">
        Output appears in &quot;Agent outputs for this lead&quot; below, and is logged on the journey.
      </p>
    </div>
  );
}
