"use client";

import { useParams } from "next/navigation";
import { useState } from "react";

interface ScoredLead {
  rowIndex: number;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  outcomeValue: string | null;
  crmNote: string | null;
  flag: string;
  reasons: string[];
  completenessPct: number;
}

interface DataGap {
  field: string;
  uploadedFillRatePct: number;
  convertedFillRatePct: number | null;
  gapPct: number | null;
}

interface DistinctOutcomeValue {
  value: string;
  count: number;
  convertedByDefault: boolean;
}

interface LeadInsightsResult {
  totalRows: number;
  outcomeColumn: string | null;
  convertedValues: string[];
  columnsMatched: { field: string; header: string | null }[];
  hasEnoughData: boolean;
  baselineConversionRatePct: number | null;
  alreadyConvertedCount: number;
  highPotentialCount: number;
  needsMoreDataCount: number;
  unscoredCount: number;
  dataGaps: DataGap[];
  topHighPotential: ScoredLead[];
  headers: string[];
  fileTruncated: boolean;
  distinctOutcomeValues: DistinctOutcomeValue[];
  fileName: string;
}

const FIELD_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  name: "Name",
  source: "Source",
  company: "Company",
  city: "City",
};

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: "accent" | "warn" | "danger" }) {
  const toneClass = tone === "accent" ? "text-accent-ink" : tone === "warn" ? "text-warn" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div className="bg-surface border border-line rounded-lg p-4">
      <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
    </div>
  );
}

export default function LeadInsightsPage() {
  const params = useParams<{ id: string }>();
  const workspaceId = params.id;

  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadInsightsResult | null>(null);
  const [correctedValues, setCorrectedValues] = useState<Set<string> | null>(null);

  async function runAnalysis(overrideOutcomeColumn?: string, overrideConvertedValues?: string[]) {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("workspaceId", workspaceId);
      form.set("file", file);
      if (overrideOutcomeColumn) form.set("outcomeColumn", overrideOutcomeColumn);
      if (overrideConvertedValues) form.set("convertedValues", JSON.stringify(overrideConvertedValues));

      const res = await fetch("/api/lead-insights", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analysis failed.");
      setResult(data);
      setCorrectedValues(new Set(data.distinctOutcomeValues.filter((v: DistinctOutcomeValue) => v.convertedByDefault).map((v: DistinctOutcomeValue) => v.value)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
  }

  function toggleOutcomeValue(value: string) {
    setCorrectedValues((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">CRM & Lead Operations</div>
        <h1 className="text-2xl font-semibold text-ink">Lead Insights</h1>
        <p className="text-sm text-ink-soft mt-2 max-w-2xl">
          Upload a real lead export — any columns, any format. This finds which not-yet-converted leads still look like real conversion candidates, using your own uploaded data's real Lead → Application patterns. Not an agent: no LLM call, every number is a real computation over the rows you upload, nothing invented.
        </p>
      </div>

      <div className="bg-surface border border-line rounded-lg p-5 mb-6">
        <label className="text-sm font-medium text-ink mb-1 block">Lead export file (.xlsx, .xls, or .csv)</label>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          disabled={loading}
          className="block w-full text-sm text-ink-soft file:mr-3 file:rounded-md file:border file:border-line file:bg-bg file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-accent-soft"
        />
        {file && <p className="text-xs text-ink-faint mt-2">Selected: {file.name} ({Math.round(file.size / 1024)} KB)</p>}
        <button
          onClick={() => runAnalysis()}
          disabled={!file || loading}
          className="mt-3 rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          {loading ? "Analyzing…" : "Analyze"}
        </button>
        {error && <p className="text-sm text-danger mt-3">{error}</p>}
      </div>

      {result && (
        <div className="space-y-6">
          {result.fileTruncated && (
            <p className="text-xs text-warn bg-accent-soft border border-line rounded-md px-3 py-2">
              This file is larger than what fits in one analysis — results are based on the first rows/columns only, not the full file.
            </p>
          )}

          {!result.outcomeColumn && (
            <div className="bg-surface border border-danger rounded-lg p-4 text-sm text-ink-soft">
              Couldn&apos;t find a real outcome column (something like &quot;Application Status&quot;, &quot;Admission Status&quot;, or &quot;Lead Stage&quot;) in this file — nothing here can be scored as converted vs. not without one. Every row is reported as unscored below.
            </div>
          )}

          {result.outcomeColumn && (
            <div className="bg-surface border border-line rounded-lg p-4">
              <div className="text-sm text-ink mb-2">
                Detected outcome column: <span className="font-semibold">{result.outcomeColumn}</span> — real values found, and which ones count as &quot;converted&quot;. Uncheck/check to correct, then re-analyze.
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                {result.distinctOutcomeValues.map((v) => (
                  <label
                    key={v.value}
                    className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 cursor-pointer ${
                      correctedValues?.has(v.value) ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-soft"
                    }`}
                  >
                    <input type="checkbox" checked={correctedValues?.has(v.value) ?? false} onChange={() => toggleOutcomeValue(v.value)} className="accent-accent" />
                    {v.value} ({v.count})
                  </label>
                ))}
              </div>
              <button
                onClick={() => runAnalysis(result.outcomeColumn!, [...(correctedValues ?? [])])}
                disabled={loading}
                className="text-xs rounded-md border border-line px-3 py-1.5 hover:bg-accent-soft disabled:opacity-40"
              >
                Re-analyze with this classification
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Total rows" value={result.totalRows.toLocaleString()} />
            <StatCard label="Already converted" value={result.alreadyConvertedCount.toLocaleString()} tone="accent" />
            <StatCard label="High potential" value={result.highPotentialCount.toLocaleString()} tone="accent" />
            <StatCard label="Needs more data" value={result.needsMoreDataCount.toLocaleString()} tone="warn" />
          </div>
          {result.baselineConversionRatePct != null && (
            <p className="text-sm text-ink-soft">
              Overall conversion rate in this file: <span className="font-semibold text-ink">{result.baselineConversionRatePct}%</span>
              {!result.hasEnoughData && " — small sample, treat this loosely."}
            </p>
          )}

          <div>
            <h2 className="text-sm font-semibold text-ink mb-2">Columns matched</h2>
            <div className="flex flex-wrap gap-2">
              {result.columnsMatched.map((c) => (
                <span key={c.field} className="text-xs rounded-full border border-line px-2.5 py-1 text-ink-soft">
                  {FIELD_LABEL[c.field] ?? c.field}: {c.header ? <span className="text-ink font-medium">{c.header}</span> : <span className="text-ink-faint">not found</span>}
                </span>
              ))}
            </div>
          </div>

          {result.dataGaps.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">Data completeness gap</h2>
              <p className="text-xs text-ink-faint mb-2">
                How complete your converted rows are on a field, vs. this whole upload — a big gap means missing data on that field is likely suppressing conversion.
              </p>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-line-strong">
                      <th className="py-1.5 pr-4">Field</th>
                      <th className="py-1.5 pr-4">Filled in this upload</th>
                      <th className="py-1.5 pr-4">Filled among converted rows</th>
                      <th className="py-1.5 pr-4">Gap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.dataGaps.map((g) => (
                      <tr key={g.field} className="border-b border-line">
                        <td className="py-1.5 pr-4">{FIELD_LABEL[g.field] ?? g.field}</td>
                        <td className="py-1.5 pr-4">{g.uploadedFillRatePct}%</td>
                        <td className="py-1.5 pr-4">{g.convertedFillRatePct != null ? `${g.convertedFillRatePct}%` : "—"}</td>
                        <td className={`py-1.5 pr-4 font-medium ${g.gapPct != null && g.gapPct > 20 ? "text-warn" : "text-ink-soft"}`}>
                          {g.gapPct != null ? `${g.gapPct > 0 ? "+" : ""}${g.gapPct}pt` : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result.topHighPotential.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-ink mb-2">
                High-potential leads not yet converted ({result.highPotentialCount.toLocaleString()} total, top {result.topHighPotential.length} shown)
              </h2>
              <div className="table-scroll">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-ink-faint border-b border-line-strong">
                      <th className="py-1.5 pr-4">Name</th>
                      <th className="py-1.5 pr-4">Email</th>
                      <th className="py-1.5 pr-4">Phone</th>
                      <th className="py-1.5 pr-4">Source</th>
                      <th className="py-1.5 pr-4">Completeness</th>
                      <th className="py-1.5 pr-4">Why</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topHighPotential.map((r) => (
                      <tr key={r.rowIndex} className="border-b border-line align-top">
                        <td className="py-1.5 pr-4 whitespace-nowrap">{r.name ?? "—"}</td>
                        <td className="py-1.5 pr-4 whitespace-nowrap">{r.email ?? "—"}</td>
                        <td className="py-1.5 pr-4 whitespace-nowrap">{r.phone ?? "—"}</td>
                        <td className="py-1.5 pr-4 whitespace-nowrap">{r.source ?? "—"}</td>
                        <td className="py-1.5 pr-4 whitespace-nowrap">{r.completenessPct}%</td>
                        <td className="py-1.5 pr-4 min-w-[280px]">
                          {r.reasons.join("; ")}
                          {r.crmNote && <div className="text-ink-faint mt-0.5">{r.crmNote}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
