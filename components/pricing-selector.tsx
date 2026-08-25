"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/currency";
import type { CategoryName } from "@/lib/agent-catalog";

interface SellableAgent {
  key: string;
  name: string;
  mission: string;
  priceInr: number;
}

interface CategoryGroup {
  category: CategoryName;
  color: string;
  agents: SellableAgent[];
}

export default function PricingSelector({ categories }: { categories: CategoryGroup[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allAgents = useMemo(() => categories.flatMap((c) => c.agents), [categories]);
  const priceByKey = useMemo(() => new Map(allAgents.map((a) => [a.key, a.priceInr])), [allAgents]);

  const subtotal = useMemo(
    () => [...selected].reduce((sum, key) => sum + (priceByKey.get(key) ?? 0), 0),
    [selected, priceByKey],
  );

  function toggle(key: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function toggleCategory(agents: SellableAgent[]) {
    const allSelected = agents.every((a) => selected.has(a.key));
    setSelected((prev) => {
      const next = new Set(prev);
      for (const a of agents) {
        if (allSelected) next.delete(a.key);
        else next.add(a.key);
      }
      return next;
    });
  }

  return (
    <div className="grid grid-cols-[1fr_260px] gap-6 items-start">
      <div className="flex flex-col gap-8">
        {categories.map((group) => {
          const allSelected = group.agents.every((a) => selected.has(a.key));
          const someSelected = !allSelected && group.agents.some((a) => selected.has(a.key));
          return (
            <section key={group.category}>
              <label className="flex items-center gap-2 mb-2 pb-2 border-b border-line cursor-pointer">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => toggleCategory(group.agents)}
                  className="accent-accent"
                />
                <span
                  className="text-[11px] font-mono font-semibold text-white px-2 py-0.5 rounded-md"
                  style={{ background: group.color }}
                >
                  {group.category}
                </span>
                <span className="text-xs text-ink-faint">{group.agents.length} agents</span>
              </label>
              <div className="flex flex-col gap-1">
                {group.agents.map((agent) => (
                  <label
                    key={agent.key}
                    className="flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-bg cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(agent.key)}
                      onChange={() => toggle(agent.key)}
                      className="accent-accent mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-ink">{agent.name}</span>
                        <span className="text-sm font-mono text-ink-soft whitespace-nowrap">
                          {formatMoney(agent.priceInr, "INR")}
                        </span>
                      </div>
                      <p className="text-[11px] text-ink-faint mt-0.5">{agent.mission}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="sticky top-6 bg-surface border border-line rounded-lg p-5">
        <div className="text-xs font-mono uppercase tracking-wide text-ink-faint mb-1">Your plan</div>
        <div className="text-2xl font-semibold text-ink tabular-nums mb-1">{formatMoney(subtotal, "INR")}</div>
        <div className="text-xs text-ink-faint mb-4">
          {selected.size} agent{selected.size === 1 ? "" : "s"} selected
        </div>
        {selected.size === 0 ? (
          <p className="text-xs text-ink-faint">Pick agents on the left to build your total.</p>
        ) : (
          <ul className="text-xs text-ink-soft flex flex-col gap-1 max-h-64 overflow-y-auto">
            {allAgents
              .filter((a) => selected.has(a.key))
              .map((a) => (
                <li key={a.key} className="flex justify-between gap-2">
                  <span className="truncate">{a.name}</span>
                  <span className="tabular-nums whitespace-nowrap">{formatMoney(a.priceInr, "INR")}</span>
                </li>
              ))}
          </ul>
        )}
      </div>
    </div>
  );
}
