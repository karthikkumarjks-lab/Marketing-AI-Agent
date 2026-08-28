"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface FieldLite {
  id: string;
  key: string;
  label: string;
  fieldType: "text" | "number" | "date" | "boolean" | "select";
  options: string[] | null;
  isRequired: boolean;
}

export default function CustomFieldsManager({ workspaceId, fields }: { workspaceId: string; fields: FieldLite[] }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [fieldType, setFieldType] = useState<FieldLite["fieldType"]>("text");
  const [options, setOptions] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addField(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/workspaces/${workspaceId}/custom-fields`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        label,
        fieldType,
        options: fieldType === "select" ? options.split(",").map((o) => o.trim()).filter(Boolean) : undefined,
      }),
    });
    setPending(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || "Could not add field.");
      return;
    }
    setLabel("");
    setOptions("");
    router.refresh();
  }

  async function removeField(id: string) {
    if (!confirm("Delete this field?")) return;
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/custom-fields/${id}`, { method: "DELETE" });
    setPending(false);
    router.refresh();
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-5">
      <div className="text-xs font-mono uppercase tracking-wider text-ink-faint mb-1">Custom fields</div>
      <p className="text-xs text-ink-faint mb-4">
        Add whatever your industry actually needs on a lead — property type, seat count, insurance
        provider, anything. Works for any business, not a fixed schema.
      </p>
      <ul className="space-y-1.5 mb-4">
        {fields.length === 0 && <li className="text-sm text-ink-faint">No custom fields yet.</li>}
        {fields.map((f) => (
          <li key={f.id} className="flex items-center justify-between text-sm py-1">
            <span className="text-ink">
              {f.label} <span className="text-ink-faint text-xs">({f.fieldType})</span>
            </span>
            <button onClick={() => removeField(f.id)} disabled={pending} className="text-xs text-ink-faint hover:text-danger">
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={addField} className="space-y-2">
        <div className="flex gap-2">
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Field label, e.g. Property Type"
            className="flex-1 rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <select
            value={fieldType}
            onChange={(e) => setFieldType(e.target.value as FieldLite["fieldType"])}
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Yes/No</option>
            <option value="select">Dropdown</option>
          </select>
        </div>
        {fieldType === "select" && (
          <input
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder="Comma-separated options, e.g. Apartment, House, Commercial"
            className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <button
          type="submit"
          disabled={pending || !label.trim()}
          className="rounded-md bg-accent text-white text-sm font-medium px-3 py-1.5 hover:opacity-90 disabled:opacity-60"
        >
          Add field
        </button>
      </form>
    </div>
  );
}
