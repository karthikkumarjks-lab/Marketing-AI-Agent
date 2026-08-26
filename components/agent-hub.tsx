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

export default function AgentHub({ workspaceId, categories }: { workspaceId: string; categories: CategoryGroup[] }) {
  const [selected, setSelected] = useState<CategoryName | "all">("all");
  const visible = selected === "all" ? categories : categories.filter((c) => c.category === selected);

  return (
    <div>
      <div className="mb-6">
        <label className="text-xs font-medium text-ink-faint mb-1.5 block">Filter by category</label>
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value as CategoryName | "all")}
          className="rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="all">All categories ({categories.reduce((sum, c) => sum + c.agents.length, 0)} agents)</option>
          {categories.map((c) => (
            <option key={c.category} value={c.category}>
              {c.category} ({c.agents.length})
            </option>
          ))}
        </select>
      </div>

      {visible.map((group) => (
        <div key={group.category} className="mb-9">
          <div className="flex items-center gap-2 mb-3">
            <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: group.color }} />
            <h2 className="text-sm font-semibold text-ink-soft">{group.category}</h2>
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
      ))}
    </div>
  );
}
