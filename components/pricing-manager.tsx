"use client";

import { useState } from "react";
import type { CategoryName } from "@/lib/agent-catalog";

interface AgentPriceRow {
  key: string;
  name: string;
  category: string;
  sortOrder: number;
  priceInr: number | null;
}

interface CategoryGroup {
  category: CategoryName;
  color: string;
  agents: AgentPriceRow[];
}

export default function PricingManager({ categories }: { categories: CategoryGroup[] }) {
  return (
    <div className="flex flex-col gap-8">
      {categories.map((group) => (
        <section key={group.category}>
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-line">
            <span
              className="text-[11px] font-mono font-semibold text-white px-2 py-0.5 rounded-md"
              style={{ background: group.color }}
            >
              {group.category}
            </span>
            <span className="text-xs text-ink-faint">{group.agents.length} agents</span>
          </div>
          <div className="flex flex-col gap-1">
            {group.agents.map((agent) => (
              <PriceRow key={agent.key} agent={agent} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PriceRow({ agent }: { agent: AgentPriceRow }) {
  const [value, setValue] = useState(agent.priceInr?.toString() ?? "");
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save() {
    const priceInr = value.trim() === "" ? null : Number(value);
    if (priceInr !== null && (Number.isNaN(priceInr) || priceInr < 0)) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      const res = await fetch("/api/agents/price", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: agent.key, priceInr }),
      });
      if (!res.ok) throw new Error();
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <span className="text-sm text-ink truncate">{agent.name}</span>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-ink-faint">₹</span>
        <input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          placeholder="not for sale"
          className="w-28 rounded-md border border-line bg-surface px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <span className="text-[11px] w-12 text-ink-faint">
          {status === "saving" && "saving…"}
          {status === "saved" && <span className="text-accent">saved</span>}
          {status === "error" && <span className="text-danger">error</span>}
        </span>
      </div>
    </div>
  );
}
