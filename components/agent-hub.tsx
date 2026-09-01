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

// Two levels, not one long scroll: land on the 10 categories as tiles you
// scan in one glance, drill into exactly one to see its agents. A flat list
// of 146 cards was never a real way to find one agent — it was just every
// agent, in a row, forever.
export default function AgentHub({ workspaceId, categories }: { workspaceId: string; categories: CategoryGroup[] }) {
  const [openCategory, setOpenCategory] = useState<CategoryName | null>(null);

  if (!openCategory) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {categories.map((group) => {
          const activeCount = group.agents.filter((a) => a.status === "active").length;
          return (
            <button
              key={group.category}
              onClick={() => setOpenCategory(group.category)}
              className="text-left rounded-lg border border-line bg-surface p-5 hover:border-line-strong transition-colors"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
                <span className="font-medium text-sm text-ink">{group.category}</span>
              </div>
              <div className="text-xs text-ink-faint">
                {group.agents.length} agent{group.agents.length === 1 ? "" : "s"}
                {activeCount > 0 && <span className="text-accent"> · {activeCount} active</span>}
              </div>
            </button>
          );
        })}
      </div>
    );
  }

  const group = categories.find((c) => c.category === openCategory);
  if (!group) return null;

  return (
    <div>
      <button onClick={() => setOpenCategory(null)} className="text-xs text-ink-faint hover:text-accent mb-4">
        ← All categories
      </button>
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
        <h2 className="text-base font-semibold text-ink">{group.category}</h2>
        <span className="text-xs text-ink-faint">({group.agents.length})</span>
      </div>
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
  );
}
