"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldClass =
  "w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/40 focus:border-accent";
const labelClass = "text-sm font-medium text-ink mb-1 block";
const hintClass = "text-xs text-ink-faint mt-1";

export default function NewWorkspacePage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    industry: "",
    objective: "",
    monthlyBudgetInr: "",
    websiteUrl: "",
    icpNotes: "",
    currentChannels: "",
    marketingAssets: "",
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...form,
          monthlyBudgetInr: form.monthlyBudgetInr ? Number(form.monthlyBudgetInr) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }
      const data = await res.json();
      router.push(`/workspaces/${data.id}/needs`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="max-w-2xl mx-auto px-8 py-12">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">New Workspace</div>
        <h1 className="text-2xl font-semibold text-ink">Tell us about this client</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-lg">
          This is the Company DNA every agent reads from. The more specific, the better the output —
          but you can leave anything blank and fill it in later.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <label className={labelClass}>Business name *</label>
          <input
            className={fieldClass}
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            placeholder="e.g. Smile Care Dental Clinic"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Industry</label>
            <input
              className={fieldClass}
              value={form.industry}
              onChange={(e) => update("industry", e.target.value)}
              placeholder="e.g. Dental clinic, Bangalore"
            />
          </div>
          <div>
            <label className={labelClass}>Monthly budget (₹)</label>
            <input
              className={fieldClass}
              type="number"
              min={0}
              value={form.monthlyBudgetInr}
              onChange={(e) => update("monthlyBudgetInr", e.target.value)}
              placeholder="e.g. 500000"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Objective</label>
          <input
            className={fieldClass}
            value={form.objective}
            onChange={(e) => update("objective", e.target.value)}
            placeholder="e.g. 100 more appointments per month"
          />
          <p className={hintClass}>The Needs Analyzer reads this to decide which agents matter.</p>
        </div>

        <div>
          <label className={labelClass}>Website URL</label>
          <input
            className={fieldClass}
            value={form.websiteUrl}
            onChange={(e) => update("websiteUrl", e.target.value)}
            placeholder="e.g. https://smilecare.example.com (leave blank if none)"
          />
        </div>

        <div>
          <label className={labelClass}>ICP / customer notes</label>
          <textarea
            className={fieldClass}
            rows={3}
            value={form.icpNotes}
            onChange={(e) => update("icpNotes", e.target.value)}
            placeholder="Anything you already know about who buys from this business"
          />
        </div>

        <div>
          <label className={labelClass}>Current marketing channels</label>
          <input
            className={fieldClass}
            value={form.currentChannels}
            onChange={(e) => update("currentChannels", e.target.value)}
            placeholder="e.g. Instagram, WhatsApp, word of mouth"
          />
        </div>

        <div>
          <label className={labelClass}>Existing marketing assets</label>
          <input
            className={fieldClass}
            value={form.marketingAssets}
            onChange={(e) => update("marketingAssets", e.target.value)}
            placeholder="e.g. a few Instagram reels, a logo, no CRM"
          />
        </div>

        {error && (
          <div className="rounded-md bg-danger-soft text-danger text-sm px-3 py-2">{error}</div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="self-start rounded-md bg-accent text-white text-sm font-medium px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {submitting ? "Creating…" : "Create workspace & run Needs Analyzer"}
        </button>
      </form>
    </main>
  );
}
