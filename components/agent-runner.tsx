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
  uploadType,
  websiteUrlField,
  textInputField,
  runs,
}: {
  workspaceId: string;
  agentKey: string;
  isWired: boolean;
  uploadType: "excel" | "screenshot" | null;
  /** Non-null for agents that scan a real website — prefilled from Company DNA, but overridable per run. */
  websiteUrlField: string | null;
  /** Non-null for agents that need real per-run free text (a transcript, deal outcomes) with no Company DNA field. */
  textInputField: { label: string; placeholder: string } | null;
  runs: RunLite[];
}) {
  const router = useRouter();
  const [predictedOutcome, setPredictedOutcome] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(websiteUrlField ?? "");
  const [runNote, setRunNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun() {
    setRunning(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("workspaceId", workspaceId);
      form.set("agentKey", agentKey);
      if (predictedOutcome) form.set("predictedOutcome", predictedOutcome);
      if (websiteUrlField !== null && websiteUrl) form.set("websiteUrlOverride", websiteUrl);
      if (textInputField && runNote) form.set("runNote", runNote);
      if (file) form.set("file", file);

      const res = await fetch("/api/agents/run", { method: "POST", body: form });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Run failed.");
      }
      setPredictedOutcome("");
      setFile(null);
      setRunNote("");
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
          {websiteUrlField !== null && (
            <div className="mb-3">
              <label className="text-sm font-medium text-ink mb-1 block">Website URL to scan</label>
              <input
                type="text"
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder="e.g. example.com"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
              <p className="text-[11px] text-ink-faint mt-1">
                {websiteUrlField
                  ? "Prefilled from this workspace's Company DNA — change it to scan a different site for this run only."
                  : "No website is on record for this workspace yet — enter one here to scan it for this run only."}
              </p>
            </div>
          )}
          {textInputField && (
            <div className="mb-3">
              <label className="text-sm font-medium text-ink mb-1 block">{textInputField.label}</label>
              <textarea
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40 min-h-24"
                placeholder={textInputField.placeholder}
                value={runNote}
                onChange={(e) => setRunNote(e.target.value)}
              />
              <p className="text-[11px] text-ink-faint mt-1">Used for this run only, not saved.</p>
            </div>
          )}
          {uploadType && (
            <div className="mb-3">
              <label className="text-sm font-medium text-ink mb-1 block">
                {uploadType === "excel" ? "Upload data (.xlsx, .xls, .csv — optional)" : "Upload a screenshot (optional)"}
              </label>
              <input
                type="file"
                accept={uploadType === "excel" ? ".xlsx,.xls,.csv" : "image/png,image/jpeg,image/webp,image/gif"}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border-0 file:bg-accent-soft file:text-accent-ink file:px-3 file:py-1.5 file:text-sm file:font-medium file:cursor-pointer"
              />
              {file && (
                <div className="text-xs text-ink-faint mt-1">
                  {file.name} ({(file.size / 1024).toFixed(0)}KB){" "}
                  <button type="button" onClick={() => setFile(null)} className="text-accent hover:underline ml-1">
                    remove
                  </button>
                </div>
              )}
              <p className="text-[11px] text-ink-faint mt-1">
                {uploadType === "excel"
                  ? "Used for this run only, not saved. Data is read directly from the file — real numbers, not summarized."
                  : "Used for this run only, not saved. The model reads the image directly."}
              </p>
            </div>
          )}
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
