"use client";

import { useState } from "react";

interface TranscriptionResult {
  email: string | null;
  prospectId: string;
  url: string;
  transcript: string | null;
  comments: string | null;
  error: string | null;
}

interface ParsedLead {
  email: string | null;
  prospectId: string;
  url: string;
}

interface ParseError {
  line: number;
  raw: string;
  reason: string;
}

// Accepts two shapes per line, since not every lead has an email on file:
//   "email, prospectId, recordingUrl"   (3 fields)
//   "prospectId, recordingUrl"          (2 fields — email omitted)
function parseLeadsInput(text: string): { leads: ParsedLead[]; errors: ParseError[] } {
  const leads: ParsedLead[] = [];
  const errors: ParseError[] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length === 3 && parts.every(Boolean)) {
        const [email, prospectId, url] = parts;
        leads.push({ email, prospectId, url });
        return;
      }
      if (parts.length === 2 && parts.every(Boolean)) {
        const [prospectId, url] = parts;
        leads.push({ email: null, prospectId, url });
        return;
      }
      errors.push({ line: i + 1, raw: line, reason: 'expected "email, prospectId, recordingUrl" or, if no email, "prospectId, recordingUrl"' });
    });
  return { leads, errors };
}

// Excel/Sheets clipboard convention: tab-separated columns, newline-separated
// rows — a cell containing a tab, newline, or double-quote must itself be
// wrapped in double quotes (with internal quotes doubled), same rule as CSV,
// or a multi-line transcript would paste as several broken rows instead of
// one cell.
function tsvCell(value: string): string {
  if (/[\t\n"]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function buildTsv(results: TranscriptionResult[]): string {
  const header = ["S.No", "Lead Email ID", "Prospect ID", "Recording URL", "Transcription", "Comments"];
  const rows = results.map((r, i) => [
    String(i + 1),
    r.email ?? "",
    r.prospectId,
    r.url,
    r.transcript ?? (r.error ? `ERROR: ${r.error}` : ""),
    r.comments ?? "",
  ]);
  return [header, ...rows].map((row) => row.map(tsvCell).join("\t")).join("\n");
}

export default function TranscribePage() {
  const [context, setContext] = useState("");
  const [leadsText, setLeadsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TranscriptionResult[] | null>(null);
  const [copied, setCopied] = useState(false);

  const { leads, errors: parseErrors } = parseLeadsInput(leadsText);

  async function runTranscribe(e: React.FormEvent) {
    e.preventDefault();
    if (leads.length === 0 || parseErrors.length > 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ leads, context: context.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Transcription failed.");
      setResults(json.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyTable() {
    if (!results) return;
    await navigator.clipboard.writeText(buildTsv(results));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Transcription</div>
        <h1 className="text-2xl font-semibold text-ink">Transcribe recordings into a lead report</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          One lead per line: <code className="font-mono text-xs bg-bg border border-line rounded px-1 py-0.5">email, prospectId, recordingUrl</code> — or,
          if a lead has no email on file, just <code className="font-mono text-xs bg-bg border border-line rounded px-1 py-0.5">prospectId, recordingUrl</code>.
          Each recording is fetched and transcribed for real (Hindi/English/mixed, always output in
          English). Add qualification context below and every call also gets a Comments verdict
          in the same pass — up to 20 leads per run, one at a time, so a slow or failing recording
          never silently drops the rest.
        </p>
      </div>

      <form onSubmit={runTranscribe} className="mb-8">
        <label className="text-sm font-medium text-ink mb-1 block">
          Qualification context (optional — describe what counts as qualified and what to note)
        </label>
        <textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder={
            "e.g. We're checking if these leads are qualified. If the lead says they're interested, or gives a time slot for a call, note that and say the bot should assign a sales agent. If they're not interested or vague, note that too."
          }
          disabled={loading}
          rows={3}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60 mb-4"
        />

        <label className="text-sm font-medium text-ink mb-1 block">Leads — one per line</label>
        <textarea
          value={leadsText}
          onChange={(e) => setLeadsText(e.target.value)}
          placeholder={"lead1@example.com, PROS-1001, https://example.com/call-1.mp3\nPROS-1002, https://example.com/call-2.wav (no email? just leave it out)"}
          disabled={loading}
          rows={8}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />

        {parseErrors.length > 0 && (
          <div className="mt-2 text-xs text-danger">
            {parseErrors.map((e) => (
              <div key={e.line}>
                Line {e.line}: {e.reason} — got &quot;{e.raw}&quot;
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-ink-faint">{leads.length} lead{leads.length === 1 ? "" : "s"}</span>
          <button
            type="submit"
            disabled={loading || leads.length === 0 || parseErrors.length > 0}
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "Transcribing… (this can take a while for several files)" : "Transcribe"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-surface border border-line rounded-lg px-4 py-3 text-sm text-ink-soft mb-6">
          <span className="text-ink font-medium">Error:</span> {error}
        </div>
      )}

      {results && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-ink-soft">Report ({results.length} row{results.length === 1 ? "" : "s"})</h2>
            <button
              onClick={copyTable}
              className="text-xs rounded border border-line-strong px-3 py-1.5 hover:bg-bg whitespace-nowrap"
            >
              {copied ? "Copied — paste into Excel/Sheets" : "Copy table"}
            </button>
          </div>
          <div className="overflow-x-auto bg-surface border border-line rounded-lg">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs">S.No</th>
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs">Lead Email ID</th>
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs">Prospect ID</th>
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs">Recording URL</th>
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs min-w-64">Transcription</th>
                  <th className="px-3 py-2 font-medium text-ink-faint text-xs min-w-56">Comments</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={`${r.prospectId}-${i}`} className="border-b border-line last:border-0 align-top">
                    <td className="px-3 py-2 text-ink-faint tabular-nums">{i + 1}</td>
                    <td className="px-3 py-2 text-ink">{r.email ?? <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-2 text-ink font-mono text-xs">{r.prospectId}</td>
                    <td className="px-3 py-2 text-ink-faint text-xs max-w-40 truncate" title={r.url}>
                      {r.url}
                    </td>
                    <td className="px-3 py-2 text-ink-soft whitespace-pre-wrap">
                      {r.transcript ?? (r.error && <span className="text-danger">{r.error}</span>)}
                    </td>
                    <td className="px-3 py-2 text-ink-soft whitespace-pre-wrap">{r.comments ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </main>
  );
}
