"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const fieldClass =
  "w-full rounded-md border border-line bg-bg px-2.5 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-accent/40";
const labelClass = "text-xs font-medium text-ink-faint mb-1 block";

interface CompanyDnaValues {
  aov: number | null;
  ltv: number | null;
  grossMarginPct: number | null;
  salesCycleDays: number | null;
  salesCapacity: string | null;
  cacTarget: number | null;
  cplTarget: number | null;
  roasTarget: number | null;
  revenueTarget: number | null;
  conversionTarget: string | null;
  retentionTarget: string | null;
  northStarKpi: string | null;
  guardrails: string | null;
  seasonality: string | null;
  existingStack: string | null;
  maturityStage: string | null;
}

interface BrandDnaValues {
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  typography: string | null;
  visualStyle: string | null;
  brandPersonality: string | null;
  toneOfVoice: string | null;
  positioning: string | null;
  approvedClaims: string | null;
  restrictedClaims: string | null;
  dos: string | null;
  donts: string | null;
}

function toStr(v: number | string | null): string {
  return v == null ? "" : String(v);
}

export default function DnaSettings({
  workspaceId,
  companyDna,
  brandDna,
}: {
  workspaceId: string;
  companyDna: CompanyDnaValues;
  brandDna: BrandDnaValues;
}) {
  const router = useRouter();
  const [company, setCompany] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(companyDna).map(([k, v]) => [k, toStr(v)])),
  );
  const [brand, setBrand] = useState<Record<string, string>>(
    Object.fromEntries(Object.entries(brandDna).map(([k, v]) => [k, toStr(v)])),
  );
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);

  async function saveCompany(e: React.FormEvent) {
    e.preventDefault();
    setSavingCompany(true);
    await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(company),
    });
    setSavingCompany(false);
    router.refresh();
  }

  async function saveBrand(e: React.FormEvent) {
    e.preventDefault();
    setSavingBrand(true);
    await fetch(`/api/workspaces/${workspaceId}/brand`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(brand),
    });
    setSavingBrand(false);
    router.refresh();
  }

  function field(
    state: Record<string, string>,
    setState: (s: Record<string, string>) => void,
    key: string,
    label: string,
    placeholder?: string,
  ) {
    return (
      <div>
        <label className={labelClass}>{label}</label>
        <input
          className={fieldClass}
          value={state[key] ?? ""}
          placeholder={placeholder}
          onChange={(e) => setState({ ...state, [key]: e.target.value })}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 mb-8">
      <details className="bg-surface border border-line rounded-lg group">
        <summary className="px-4 py-3 text-sm font-semibold text-ink cursor-pointer select-none">
          Company DNA — economics, targets &amp; guardrails
          <span className="text-ink-faint font-normal ml-2 text-xs">
            (what the whole agent team optimizes for — never assumed to be CAC by default)
          </span>
        </summary>
        <form onSubmit={saveCompany} className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {field(company, setCompany, "northStarKpi", "North Star KPI", "e.g. Qualified pipeline, not CAC")}
            {field(company, setCompany, "aov", "AOV / ACV")}
            {field(company, setCompany, "ltv", "LTV")}
            {field(company, setCompany, "grossMarginPct", "Gross margin %")}
            {field(company, setCompany, "salesCycleDays", "Sales cycle (days)")}
            {field(company, setCompany, "salesCapacity", "Sales capacity", "e.g. 1 owner, no sales team")}
            {field(company, setCompany, "cacTarget", "CAC target")}
            {field(company, setCompany, "cplTarget", "CPL target")}
            {field(company, setCompany, "roasTarget", "ROAS target", "e.g. 3.5")}
            {field(company, setCompany, "revenueTarget", "Revenue target")}
            {field(company, setCompany, "conversionTarget", "Conversion target", "e.g. 5% visit-to-lead")}
            {field(company, setCompany, "retentionTarget", "Retention target")}
            {field(company, setCompany, "seasonality", "Seasonality")}
            {field(company, setCompany, "existingStack", "Existing CRM/stack")}
            {field(company, setCompany, "maturityStage", "Maturity stage", "e.g. pre-launch, scaling")}
          </div>
          <div className="mb-3">
            <label className={labelClass}>Guardrails (hard limits)</label>
            <textarea
              className={fieldClass}
              rows={2}
              value={company.guardrails ?? ""}
              placeholder="e.g. never exceed CAC of ₹5,000; never pause Google Ads without approval"
              onChange={(e) => setCompany({ ...company, guardrails: e.target.value })}
            />
          </div>
          <button
            type="submit"
            disabled={savingCompany}
            className="rounded-md bg-accent text-white text-xs font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {savingCompany ? "Saving…" : "Save Company DNA"}
          </button>
        </form>
      </details>

      <details className="bg-surface border border-line rounded-lg group">
        <summary className="px-4 py-3 text-sm font-semibold text-ink cursor-pointer select-none">
          Brand DNA
          <span className="text-ink-faint font-normal ml-2 text-xs">
            (read by Content, Design, Video, Website, Landing Page, Email, and Ads agents)
          </span>
        </summary>
        <form onSubmit={saveBrand} className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {field(brand, setBrand, "primaryColor", "Primary color", "#123456 or 'deep teal'")}
            {field(brand, setBrand, "secondaryColor", "Secondary color")}
            {field(brand, setBrand, "accentColor", "Accent color")}
            {field(brand, setBrand, "typography", "Typography")}
            {field(brand, setBrand, "visualStyle", "Visual style")}
            {field(brand, setBrand, "brandPersonality", "Brand personality")}
            {field(brand, setBrand, "toneOfVoice", "Tone of voice")}
            {field(brand, setBrand, "positioning", "Positioning")}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            {field(brand, setBrand, "approvedClaims", "Approved claims")}
            {field(brand, setBrand, "restrictedClaims", "Restricted claims")}
            {field(brand, setBrand, "dos", "Do's")}
            {field(brand, setBrand, "donts", "Don'ts")}
          </div>
          <button
            type="submit"
            disabled={savingBrand}
            className="rounded-md bg-accent text-white text-xs font-medium px-4 py-2 hover:opacity-90 disabled:opacity-50"
          >
            {savingBrand ? "Saving…" : "Save Brand DNA"}
          </button>
        </form>
      </details>
    </div>
  );
}
