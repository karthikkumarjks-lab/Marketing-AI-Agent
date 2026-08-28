"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const inputClass =
  "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40";

interface CustomFieldSpec {
  id: string;
  key: string;
  label: string;
  fieldType: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  isRequired: boolean;
}

export default function NewLeadForm({
  workspaceId,
  stages,
  customFields,
}: {
  workspaceId: string;
  stages: { id: string; name: string }[];
  customFields: CustomFieldSpec[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "",
    stageId: stages[0]?.id ?? "",
    dealValue: "",
  });
  const [customValues, setCustomValues] = useState<Record<string, string>>({});

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setPending(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/leads`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...form,
        dealValue: form.dealValue || null,
        customFields: customValues,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not create lead.");
      return;
    }
    setForm({ name: "", email: "", phone: "", company: "", source: "", stageId: stages[0]?.id ?? "", dealValue: "" });
    setCustomValues({});
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity"
      >
        + New Lead
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full bg-surface border border-line rounded-lg p-4 mb-4">
      <div className="grid grid-cols-3 gap-3">
        <Field label="Name *">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field label="Email">
          <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Company">
          <input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} className={inputClass} />
        </Field>
        <Field label="Source">
          <input
            value={form.source}
            onChange={(e) => setForm({ ...form, source: e.target.value })}
            placeholder="e.g. website form, referral"
            className={inputClass}
          />
        </Field>
        <Field label="Stage">
          <select value={form.stageId} onChange={(e) => setForm({ ...form, stageId: e.target.value })} className={inputClass}>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Deal value">
          <input
            type="number"
            value={form.dealValue}
            onChange={(e) => setForm({ ...form, dealValue: e.target.value })}
            className={inputClass}
          />
        </Field>
        {customFields.map((f) => (
          <Field key={f.id} label={f.label}>
            {f.fieldType === "select" ? (
              <select
                value={customValues[f.key] ?? ""}
                onChange={(e) => setCustomValues({ ...customValues, [f.key]: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                {(f.options ?? []).map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            ) : f.fieldType === "boolean" ? (
              <select
                value={customValues[f.key] ?? ""}
                onChange={(e) => setCustomValues({ ...customValues, [f.key]: e.target.value })}
                className={inputClass}
              >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : (
              <input
                type={f.fieldType === "number" ? "number" : f.fieldType === "date" ? "date" : "text"}
                value={customValues[f.key] ?? ""}
                onChange={(e) => setCustomValues({ ...customValues, [f.key]: e.target.value })}
                className={inputClass}
              />
            )}
          </Field>
        ))}
      </div>
      {error && <p className="text-sm text-danger mt-3">{error}</p>}
      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Creating…" : "Create Lead"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-line text-sm px-3 py-1.5 text-ink-soft hover:bg-bg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs text-ink-faint mb-1">{label}</span>
      {children}
    </label>
  );
}
