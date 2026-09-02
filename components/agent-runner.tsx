"use client";

import { useState, isValidElement } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

// Agent output can embed a ```chart fenced block (JSON: {type, title, data,
// series?}) instead of only prose/tables — real numbers the agent already
// has (a crawl signal, a real CRM count) rendered as an actual chart rather
// than a wall of text. Parsed here rather than trusting the LLM to produce
// valid JSX; any block that fails to parse just falls back to a plain code
// block so a malformed one never breaks the whole page.
interface ChartSpec {
  type: "bar" | "line" | "pie";
  title?: string;
  data: Record<string, string | number>[];
  series?: string[];
}

const CHART_COLORS = ["#2f6fed", "#1a4fc4", "#e0900a", "#d1483f", "#52627a", "#8a97ab"];

function parseChartSpec(raw: string): ChartSpec | null {
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.data)) return null;
    // A chart exists to compare things — a single bar/slice/point isn't a
    // comparison and is less useful than no chart at all. The prompt now
    // tells the agent not to emit one of these, but this is the backstop:
    // an older cached run (or any model slip-up) still won't render one.
    if (parsed.data.length < 2) return null;
    if (!["bar", "line", "pie"].includes(parsed.type)) return null;
    return parsed as ChartSpec;
  } catch {
    return null;
  }
}

function AgentChart({ spec }: { spec: ChartSpec }) {
  const nameKey = "name" in (spec.data[0] ?? {}) ? "name" : Object.keys(spec.data[0] ?? {})[0];
  const series = spec.series && spec.series.length > 0 ? spec.series : Object.keys(spec.data[0] ?? {}).filter((k) => k !== nameKey);

  return (
    <div className="my-4 bg-surface border border-line rounded-lg p-4 not-prose">
      {spec.title && <div className="text-sm font-semibold text-ink mb-3">{spec.title}</div>}
      <ResponsiveContainer width="100%" height={280}>
        {spec.type === "pie" ? (
          <PieChart>
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--line)" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Pie data={spec.data} dataKey={series[0] ?? "value"} nameKey={nameKey} outerRadius={100} label={(d: { name?: string }) => d.name ?? ""}>
              {spec.data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        ) : spec.type === "line" ? (
          <LineChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--line)" }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={2} />
            ))}
          </LineChart>
        ) : (
          <BarChart data={spec.data}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--line)" />
            <XAxis dataKey={nameKey} tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--line)" }} />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12 }} />}
            {series.map((s, i) => (
              <Bar key={s} dataKey={s} fill={CHART_COLORS[i % CHART_COLORS.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

// react-markdown's default URL sanitizer strips `data:` URIs (a reasonable
// default against unknown/user-authored markdown), but the Image Generation
// Agent legitimately embeds a real generated image as a data URI — allow
// only that one safe case through, everything else still goes through the
// default sanitizer.
function urlTransform(url: string): string {
  if (url.startsWith("data:image/")) return url;
  return defaultUrlTransform(url);
}

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
  competitorUrlField,
  textInputField,
  runs,
}: {
  workspaceId: string;
  agentKey: string;
  isWired: boolean;
  uploadType: "excel" | "screenshot" | null;
  /** Non-null for agents that scan a real website — prefilled from Company DNA, but overridable per run. */
  websiteUrlField: string | null;
  /** True for agents that scan a real COMPETITOR site — no Company DNA field to prefill from, entered fresh per run. */
  competitorUrlField: boolean;
  /** Non-null for agents that need real per-run free text (a transcript, deal outcomes) with no Company DNA field. */
  textInputField: { label: string; placeholder: string } | null;
  runs: RunLite[];
}) {
  const router = useRouter();
  const [predictedOutcome, setPredictedOutcome] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(websiteUrlField ?? "");
  const [competitorUrl, setCompetitorUrl] = useState("");
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
      if (competitorUrlField && competitorUrl) form.set("competitorUrlOverride", competitorUrl);
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
      // competitorUrl is deliberately NOT cleared — clearing it caused a
      // real bug: re-running Market Research (e.g. to refresh after the
      // competitors' sites changed) silently dropped back to a single-site
      // "comparison" with no competitors, because the field the user had
      // just filled in was wiped after the first run. Kept prefilled like
      // websiteUrl already is, so a re-run compares the same sites unless
      // the user deliberately changes them.
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
          {competitorUrlField && (
            <div className="mb-3">
              <label className="text-sm font-medium text-ink mb-1 block">
                {agentKey === "market-research" ? "Competitor URL(s) to scan (optional)" : "Competitor URL to scan (optional)"}
              </label>
              <input
                type="text"
                className="w-full rounded-md border border-line bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
                placeholder={agentKey === "market-research" ? "e.g. competitor-a.com, competitor-b.com" : "e.g. competitor.com"}
                value={competitorUrl}
                onChange={(e) => setCompetitorUrl(e.target.value)}
              />
              <p className="text-[11px] text-ink-faint mt-1">
                {agentKey === "market-research"
                  ? "Real crawl (technology, pages, CTAs, forms, trust signals, load time) for up to 4 sites, comma-separated. Leave blank to compare against category knowledge only."
                  : "Real tech-stack and page scan for this run only. Leave blank to reason from category knowledge instead."}
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          urlTransform={urlTransform}
          components={{
            // A ```chart block renders as <pre><code class="language-chart">.
            // Unwrap the <pre> too (not just unstyle it) so the chart isn't
            // sitting inside an invalid div-in-pre nesting with unwanted
            // monospace/margin styling — react-markdown gives us the <pre>'s
            // single <code> child to inspect here before deciding.
            pre({ children }) {
              const onlyChild = Array.isArray(children) ? children[0] : children;
              if (isValidElement<{ className?: string }>(onlyChild) && /language-chart/.test(onlyChild.props.className || "")) {
                return <>{children}</>;
              }
              return <pre>{children}</pre>;
            },
            code({ className, children, ...props }) {
              const isChartBlock = /language-chart/.test(className || "");
              if (isChartBlock) {
                const spec = parseChartSpec(String(children).replace(/\n$/, ""));
                if (spec) return <AgentChart spec={spec} />;
              }
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {run.outputMarkdown}
        </ReactMarkdown>
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
