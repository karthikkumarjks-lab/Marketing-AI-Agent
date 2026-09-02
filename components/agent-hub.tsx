"use client";

import { useState } from "react";
import Link from "next/link";
import type { CategoryName } from "@/lib/agent-catalog";
import StatusPill from "./status-pill";

interface AgentCard {
  id: string;
  key: string;
  name: string;
  mission: string;
  isWired: boolean;
  status: "active" | "idle";
}

interface CategoryGroup {
  category: CategoryName;
  color: string;
  agents: AgentCard[];
}

// Filter pills above one grid, not a forced tile-then-drill-down: click a
// pill, the grid updates in place. Defaults to the first category rather
// than "All" — 147 agents at once is still too many for a first look, but
// getting to any category (or everything, via the All pill) is one click,
// not two.
export default function AgentHub({ workspaceId, categories }: { workspaceId: string; categories: CategoryGroup[] }) {
  const [active, setActive] = useState<CategoryName | "all">(categories[0]?.category ?? "all");

  const visible = active === "all" ? categories : categories.filter((c) => c.category === active);
  const activeGroup = active === "all" ? null : categories.find((c) => c.category === active);

  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((group) => {
          const isActive = active === group.category;
          return (
            <button
              key={group.category}
              onClick={() => setActive(group.category)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                isActive ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-soft hover:border-line-strong"
              }`}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
              {group.category}
              <span className="text-[10px] opacity-70">({group.agents.length})</span>
            </button>
          );
        })}
        <button
          onClick={() => setActive("all")}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            active === "all" ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-soft hover:border-line-strong"
          }`}
        >
          All ({categories.reduce((sum, c) => sum + c.agents.length, 0)})
        </button>
      </div>

      {activeGroup && (
        <p className="text-xs text-ink-faint mb-4">
          {activeGroup.agents.length} agent{activeGroup.agents.length === 1 ? "" : "s"}
          {activeGroup.agents.filter((a) => a.status === "active").length > 0 && (
            <span className="text-accent"> · {activeGroup.agents.filter((a) => a.status === "active").length} active</span>
          )}
        </p>
      )}

      {visible.map((group) => (
        <div key={group.category} className={active === "all" ? "mb-9" : ""}>
          {active === "all" && (
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
              <h2 className="text-sm font-semibold text-ink-soft">{group.category}</h2>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.agents.map((agent) => (
              <Link
                key={agent.id}
                href={`/workspaces/${workspaceId}/agents/${agent.key}`}
                className={`block rounded-lg border p-4 transition-colors bg-surface ${
                  agent.status === "active" ? "border-accent/40 hover:border-accent" : "border-line hover:border-line-strong"
                } ${agent.status === "idle" ? "opacity-70" : ""}`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="font-medium text-sm text-ink">{agent.name}</div>
                  <StatusPill status={agent.status} />
                </div>
                <p className="text-xs text-ink-soft leading-relaxed mb-2">{agent.mission}</p>
                {!agent.isWired && <div className="text-[11px] text-warn font-medium">Coming online</div>}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
