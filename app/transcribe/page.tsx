"use client";

import { useState } from "react";

interface TranscriptionResult {
  url: string;
  transcript: string | null;
  error: string | null;
}

export default function TranscribePage() {
  const [urlsText, setUrlsText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<TranscriptionResult[] | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  const urls = urlsText
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  async function runTranscribe(e: React.FormEvent) {
    e.preventDefault();
    if (urls.length === 0) return;
    setLoading(true);
    setError(null);
    setResults(null);
    try {
      const res = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ urls }),
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

  async function copyTranscript(url: string, transcript: string) {
    await navigator.clipboard.writeText(transcript);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl((cur) => (cur === url ? null : cur)), 1500);
  }

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Transcription</div>
        <h1 className="text-2xl font-semibold text-ink">Transcribe recordings from a URL</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Paste one or more direct audio file URLs (one per line) — each is fetched and transcribed
          for real. Works on Hindi, English, or mixed-language recordings; the output is always
          English, translating any non-English speech rather than transliterating it. Up to 20 URLs
          per run, processed one at a time (not in parallel) so a slow or failing one doesn&apos;t
          silently drop the rest.
        </p>
      </div>

      <form onSubmit={runTranscribe} className="mb-8">
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder={"https://example.com/call-1.mp3\nhttps://example.com/call-2.wav"}
          disabled={loading}
          rows={6}
          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-ink-faint">{urls.length} URL{urls.length === 1 ? "" : "s"}</span>
          <button
            type="submit"
            disabled={loading || urls.length === 0}
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? `Transcribing… (this can take a while for several files)` : "Transcribe"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-surface border border-line rounded-lg px-4 py-3 text-sm text-ink-soft mb-6">
          <span className="text-ink font-medium">Error:</span> {error}
        </div>
      )}

      {results && (
        <div className="flex flex-col gap-4">
          {results.map((r) => (
            <div key={r.url} className="bg-surface border border-line rounded-lg p-4">
              <div className="flex items-center justify-between gap-3 mb-2.5">
                <div className="text-xs font-mono text-ink-faint truncate" title={r.url}>
                  {r.url}
                </div>
                {r.transcript && (
                  <button
                    onClick={() => copyTranscript(r.url, r.transcript!)}
                    className="text-xs rounded border border-line-strong px-2.5 py-1 hover:bg-bg whitespace-nowrap shrink-0"
                  >
                    {copiedUrl === r.url ? "Copied" : "Copy text"}
                  </button>
                )}
              </div>
              {r.error ? (
                <p className="text-sm text-danger">{r.error}</p>
              ) : (
                <p className="text-sm text-ink-soft whitespace-pre-wrap leading-relaxed">{r.transcript}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
