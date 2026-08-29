"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Each tab is a different instrument on the same panel, not a different
// app — the label is the one thing making that literal. "OVERVIEW" for the
// dashboard, "MANIFEST" for the lead list, etc. — see app/globals.css for
// the matching per-tab accent tokens this same idea drives.
const TABS = [
  { slug: "", label: "Dashboard", instrument: "OVERVIEW" },
  { slug: "leads", label: "Leads", instrument: "MANIFEST" },
  { slug: "workflows", label: "Workflows", instrument: "ROUTING" },
  { slug: "reports", label: "Reports", instrument: "TELEMETRY" },
  { slug: "settings", label: "Settings", instrument: "MAINTENANCE" },
];

export default function CrmTabs({ workspaceId }: { workspaceId: string }) {
  const pathname = usePathname();
  const base = `/workspaces/${workspaceId}/crm`;

  return (
    <nav className="flex gap-1 border-b border-line">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = tab.slug ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={tab.slug}
            href={href}
            className={`group px-3 py-2 border-b-2 -mb-px transition-colors ${
              active ? "border-accent" : "border-transparent"
            }`}
          >
            <div className={`text-sm ${active ? "text-ink font-medium" : "text-ink-faint group-hover:text-ink"}`}>
              {tab.label}
            </div>
            <div
              className={`text-[9px] font-mono tracking-widest transition-opacity ${
                active ? "text-accent opacity-100" : "opacity-0 group-hover:opacity-60"
              }`}
            >
              {tab.instrument}
            </div>
          </Link>
        );
      })}
    </nav>
  );
}
