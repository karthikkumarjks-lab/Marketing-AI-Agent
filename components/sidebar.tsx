"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoMark from "./logo-mark";

interface WorkspaceLite {
  id: string;
  name: string;
}

function NavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-3 py-1.5 text-sm transition-colors ${
        active
          ? "bg-accent-soft text-accent-ink font-medium"
          : "text-ink-soft hover:bg-surface hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

export default function Sidebar({
  workspaces,
  agentCount,
}: {
  workspaces: WorkspaceLite[];
  agentCount: number;
}) {
  const pathname = usePathname();
  const match = pathname.match(/^\/workspaces\/([^/]+)/);
  const matchedId = match?.[1];
  const activeWorkspaceId = matchedId && matchedId !== "new" ? matchedId : undefined;

  return (
    <aside className="w-64 shrink-0 border-r border-line bg-surface flex flex-col h-screen sticky top-0">
      <div className="px-4 py-5 border-b border-line">
        <div className="flex items-center gap-2">
          <LogoMark size={20} />
          <div className="text-xs font-mono uppercase tracking-wider text-accent">Marketing Autopilot</div>
        </div>
        <div className="text-[11px] text-ink-faint mt-0.5 ml-[26px]">{agentCount} agents · 1 shared runtime</div>
      </div>

      <nav className="px-3 py-3 border-b border-line flex flex-col gap-0.5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint px-3 mb-1">Tools</div>
        <NavLink href="/domain-scan" label="Domain Scan" active={pathname === "/domain-scan"} />
        {/* Pricing/selling tabs hidden per request (2026-08-26) — not ready
            to show this yet. Data and pages are untouched; re-add these two
            links (routes: /pricing, /pricing/manage) when it's needed again. */}
        {activeWorkspaceId && (
          <>
            <NavLink
              href={`/workspaces/${activeWorkspaceId}/needs`}
              label="Needs Analyzer"
              active={pathname.endsWith("/needs")}
            />
            <NavLink
              href={`/workspaces/${activeWorkspaceId}/agents`}
              label="Agent Hub"
              active={pathname.includes("/agents")}
            />
            <NavLink
              href={`/workspaces/${activeWorkspaceId}/orchestrator`}
              label="Orchestrator"
              active={pathname.endsWith("/orchestrator")}
            />
            <NavLink
              href={`/workspaces/${activeWorkspaceId}/scorecard`}
              label="Scorecard"
              active={pathname.endsWith("/scorecard")}
            />
            <NavLink
              href={`/workspaces/${activeWorkspaceId}/integrations`}
              label="Integrations"
              active={pathname.endsWith("/integrations")}
            />
          </>
        )}
      </nav>

      <div className="px-3 py-3 flex-1 overflow-y-auto">
        <div className="text-[11px] font-mono uppercase tracking-wider text-ink-faint px-3 mb-1.5">
          Workspaces
        </div>
        <div className="flex flex-col gap-0.5">
          {workspaces.map((w) => (
            <NavLink
              key={w.id}
              href={`/workspaces/${w.id}`}
              label={w.name}
              active={activeWorkspaceId === w.id}
            />
          ))}
        </div>
      </div>

      <div className="p-3 border-t border-line">
        <Link
          href="/workspaces/new"
          className="block w-full text-center rounded-md bg-accent text-white text-sm font-medium py-2 hover:opacity-90 transition-opacity"
        >
          + New Workspace
        </Link>
      </div>
    </aside>
  );
}
