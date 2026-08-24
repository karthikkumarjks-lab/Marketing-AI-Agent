"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RunLite {
  id: string;
  outputMarkdown: string;
  predictedOutcome: string | null;
  actualOutcome: string | null;
  outcomeStatus: "pending" | "matched" | "missed";
  isDemo: boolean;
  model: string | null;
  createdAt: string;
}

export default function AgentRunner({
  workspaceId,
  agentKey,
  isWired,
  runs,
}: {
  workspaceId: string;
  agentKey: string;
  isWired: boolean;
  runs: RunLite[];
}) {
  const router = useRouter();
  const [predictedOutcome, setPredictedOutcome] = useState("");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/agents/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workspaceId, agentKey, predictedOutcome: predictedOutcome || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Run failed.");
      }
      setPredictedOutcome("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Run failed.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div>
      {isWired ? (
        <div className="bg-surface border border-line rounded-lg p-5 mb-8">
          <label className="text-sm font-medium text-ink mb-1 block">
            Predicted outcome (optional, for the evaluation log)
          </label>
          <input
            className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="e.g. Should lift organic leads ~20% within 60 days"
            value={predictedOutcome}
            onChange={(e) => setPredictedOutcome(e.target.value)}
          />
          <button
            onClick={handleRun}
            disabled={running}
            className="rounded-md bg-accent text-white text-sm font-medium px-5 py-2.5 hover:opacity-90 disabled:opacity-50"
          >
            {running ? "Running…" : "Run agent"}
          </button>
          {error && <div className="mt-3 text-sm text-danger">{error}</div>}
        </div>
      ) : (
        <div className="bg-warn-soft border border-warn/30 rounded-lg p-5 mb-8 text-sm text-warn">
          This agent is not wired to execution yet — it will run once implemented in a future update.
        </div>
      )}

      <h2 className="text-sm font-semibold text-ink-soft mb-3">
        Run history {runs.length > 0 && `(${runs.length})`}
      </h2>
      {runs.length === 0 ? (
        <p className="text-sm text-ink-faint">No runs yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {runs.map((run) => (
            <RunCard key={run.id} run={run} />
          ))}
        </div>
      )}
    </div>
  );
}

function RunCard({ run }: { run: RunLite }) {
  const router = useRouter();
  const [actualOutcome, setActualOutcome] = useState(run.actualOutcome ?? "");
  const [saving, setSaving] = useState(false);

  async function saveOutcome(outcomeStatus: "matched" | "missed") {
    setSaving(true);
    await fetch(`/api/runs/${run.id}/outcome`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ actualOutcome, outcomeStatus }),
    });
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-ink-faint">
          {new Date(run.createdAt).toLocaleString("en-GB")} · {run.model}
          {run.isDemo && <span className="text-warn ml-2">demo output</span>}
        </div>
        <OutcomeBadge status={run.outcomeStatus} />
      </div>

      <div className="prose-agent">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{run.outputMarkdown}</ReactMarkdown>
      </div>

      {run.predictedOutcome && (
        <div className="mt-3 text-sm">
          <span className="text-ink-faint">Predicted: </span>
          <span className="text-ink-soft">{run.predictedOutcome}</span>
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-line">
        <label className="text-xs font-medium text-ink-faint mb-1 block">
          Close the loop: what actually happened?
        </label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-line bg-bg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            placeholder="e.g. Leads up 15% in 45 days"
            value={actualOutcome}
            onChange={(e) => setActualOutcome(e.target.value)}
          />
          <button
            disabled={saving}
            onClick={() => saveOutcome("matched")}
            className="text-xs rounded border border-line-strong px-3 py-1.5 hover:bg-accent-soft hover:border-accent disabled:opacity-50"
          >
            Matched
          </button>
          <button
            disabled={saving}
            onClick={() => saveOutcome("missed")}
            className="text-xs rounded border border-line-strong px-3 py-1.5 hover:bg-danger-soft hover:border-danger disabled:opacity-50"
          >
            Missed
          </button>
        </div>
      </div>
    </div>
  );
}

function OutcomeBadge({ status }: { status: "pending" | "matched" | "missed" }) {
  const styles = {
    pending: "bg-line text-ink-faint",
    matched: "bg-accent-soft text-accent-ink",
    missed: "bg-danger-soft text-danger",
  };
  const labels = { pending: "Pending", matched: "Matched", missed: "Missed" };
  return (
    <span className={`text-xs rounded-full px-2.5 py-0.5 font-medium ${styles[status]}`}>{labels[status]}</span>
  );
}
