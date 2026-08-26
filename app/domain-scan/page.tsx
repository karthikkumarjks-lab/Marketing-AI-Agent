"use client";

import { useState } from "react";
import type { DomainScanResult } from "@/lib/domain-scan";

export default function DomainScanPage() {
  const [domain, setDomain] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DomainScanResult | null>(null);

  async function runScan(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/domain-scan", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ domain }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Scan failed.");
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Domain Scan</div>
        <h1 className="text-2xl font-semibold text-ink">Check a domain&apos;s real digital footprint</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Real, live checks — DNS, registration (WHOIS/RDAP), website reachability,
          mobile-friendliness signal, social links, chatbot widget, and phone number — read directly
          from the domain, not inferred by an LLM. Ad activity across Meta/Google/LinkedIn isn&apos;t
          automatable for free anywhere right now (see the note in results), so that shows up as
          one-click links instead.
        </p>
      </div>

      <form onSubmit={runScan} className="flex items-center gap-2 mb-8">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. example.com"
          disabled={loading}
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={loading || !domain.trim()}
          className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error && (
        <div className="bg-surface border border-line rounded-lg px-4 py-3 text-sm text-ink-soft mb-6">
          <span className="text-ink font-medium">Scan error:</span> {error}
        </div>
      )}

      {result && <ScanResults result={result} />}
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-line rounded-lg p-4 mb-4">
      <div className="text-xs font-mono uppercase tracking-wide text-ink-faint mb-2.5">{title}</div>
      {children}
    </div>
  );
}

function Pill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
        ok ? "bg-accent-soft text-accent-ink" : "bg-line/60 text-ink-faint"
      }`}
    >
      {label}
    </span>
  );
}

function ScanResults({ result }: { result: DomainScanResult }) {
  return (
    <div>
      <Section title={`Domain — ${result.domain}`}>
        <div className="flex items-center gap-2">
          <Pill ok={result.domainExists} label={result.domainExists ? "Resolves" : "Does not resolve"} />
          {result.website.reachable && <Pill ok={true} label={`Website up (${result.website.statusCode})`} />}
          {!result.website.reachable && result.domainExists && <Pill ok={false} label="Website unreachable" />}
          {result.website.https && <Pill ok={true} label="HTTPS" />}
          {result.website.loadTimeMs != null && (
            <span className="text-xs text-ink-faint tabular-nums">{result.website.loadTimeMs}ms</span>
          )}
        </div>
        {result.website.error && <p className="text-xs text-ink-faint mt-2">{result.website.error}</p>}
      </Section>

      {result.domainExists && (
        <Section title="DNS Records">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <DnsField label="A" values={result.dns.a} />
            <DnsField label="MX" values={result.dns.mx} />
            <DnsField label="NS" values={result.dns.ns} />
            <DnsField label="TXT" values={result.dns.txt.map((t) => t.join(""))} />
          </div>
        </Section>
      )}

      {result.domainExists && (
        <Section title="Registration (WHOIS / RDAP)">
          {result.whois ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <WhoisField label="Registrar" value={result.whois.registrar} />
              <WhoisField
                label="Domain age"
                value={result.whois.domainAgeYears != null ? `${result.whois.domainAgeYears} years` : null}
              />
              <WhoisField label="Registered" value={formatWhoisDate(result.whois.registeredDate)} />
              <WhoisField label="Expires" value={formatWhoisDate(result.whois.expirationDate)} />
              <WhoisField label="Last changed" value={formatWhoisDate(result.whois.lastChangedDate)} />
              <WhoisField label="Status" value={result.whois.status.length > 0 ? result.whois.status.join(", ") : null} />
            </div>
          ) : (
            <p className="text-sm text-ink-faint">
              Registration lookup returned nothing for this domain — see the note below.
            </p>
          )}
          <p className="text-[11px] text-ink-faint mt-2.5">
            Registrant name/email/address are never shown — every registry redacts that under
            GDPR/ICANN privacy rules today, same as real WHOIS.
          </p>
        </Section>
      )}

      {result.mobile && (
        <Section title="Mobile-Friendliness Signal">
          <div className="flex items-center gap-2">
            <Pill ok={result.mobile.hasViewportMeta} label={result.mobile.hasViewportMeta ? "Viewport tag present" : "No viewport tag"} />
            <Pill ok={result.mobile.likelyResponsive} label={result.mobile.likelyResponsive ? "Likely responsive" : "Not confirmed responsive"} />
          </div>
          {result.mobile.viewportContent && (
            <p className="text-xs text-ink-faint mt-2 font-mono">{result.mobile.viewportContent}</p>
          )}
        </Section>
      )}

      {result.social && (
        <Section title="Social Media Links Found on Site">
          {result.social.length === 0 ? (
            <p className="text-sm text-ink-faint">No social links found in the page source.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {result.social.map((s) => (
                <a
                  key={s.platform}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink hover:text-accent flex items-center gap-2"
                >
                  <span className="font-medium">{s.platform}</span>
                  <span className="text-ink-faint text-xs truncate">{s.url}</span>
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      {result.chatbot && (
        <Section title="Chatbot Widget">
          <Pill ok={result.chatbot.detected} label={result.chatbot.detected ? "Detected" : "Not detected"} />
          {result.chatbot.providers.length > 0 && (
            <p className="text-sm text-ink-soft mt-2">{result.chatbot.providers.join(", ")}</p>
          )}
        </Section>
      )}

      {result.phone && (
        <Section title="Inbound Phone Number">
          {result.phone.numbers.length === 0 ? (
            <p className="text-sm text-ink-faint">No phone number found on the page.</p>
          ) : (
            <div>
              <div className="flex flex-wrap gap-2">
                {result.phone.numbers.map((n) => (
                  <span key={n} className="text-sm font-mono text-ink bg-bg border border-line rounded px-2 py-1">
                    {n}
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-ink-faint mt-2">
                Source: {result.phone.source === "tel-link" ? "clickable tel: link (high confidence)" : "found in page text (lower confidence)"}
              </p>
            </div>
          )}
        </Section>
      )}

      <Section title="Ad Activity — One-Click Checks">
        <div className="flex flex-col gap-2">
          {result.adLibraryLinks.map((link) => (
            <a
              key={link.platform}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between gap-3 rounded-md border border-line px-3 py-2 hover:bg-bg transition-colors"
            >
              <div>
                <div className="text-sm font-medium text-ink">{link.platform}</div>
                <div className="text-[11px] text-ink-faint">{link.covers}</div>
              </div>
              <span className="text-accent text-sm">Open →</span>
            </a>
          ))}
        </div>
      </Section>

      {result.notes.length > 0 && (
        <div className="text-[11px] text-ink-faint leading-relaxed border-t border-line pt-3 mt-2">
          {result.notes.map((n, i) => (
            <p key={i} className="mb-1 last:mb-0">
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function formatWhoisDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" });
}

function WhoisField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[11px] font-mono text-ink-faint mb-1">{label}</div>
      <div className="text-xs text-ink-soft">{value ?? "not available"}</div>
    </div>
  );
}

function DnsField({ label, values }: { label: string; values: string[] }) {
  return (
    <div>
      <div className="text-[11px] font-mono text-ink-faint mb-1">{label}</div>
      {values.length === 0 ? (
        <div className="text-xs text-ink-faint">none</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {values.slice(0, 4).map((v, i) => (
            <div key={i} className="text-xs font-mono text-ink-soft truncate" title={v}>
              {v}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
