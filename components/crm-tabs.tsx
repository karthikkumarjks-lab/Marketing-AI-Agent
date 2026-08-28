"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Dashboard" },
  { slug: "leads", label: "Leads" },
  { slug: "workflows", label: "Workflows" },
  { slug: "reports", label: "Reports" },
  { slug: "settings", label: "Settings" },
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
            className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
              active
                ? "border-accent text-ink font-medium"
                : "border-transparent text-ink-faint hover:text-ink"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
