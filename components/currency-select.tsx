"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CURRENCIES } from "@/lib/currency";

export default function CurrencySelect({
  workspaceId,
  currentCurrency,
}: {
  workspaceId: string;
  currentCurrency: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentCurrency);
  const [pending, startTransition] = useTransition();

  async function handleChange(next: string) {
    setValue(next);
    await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ currency: next }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <label className="flex items-center gap-2 text-xs text-ink-faint">
      <span className="hidden sm:inline">Currency</span>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-md border border-line bg-surface px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        title="Changes this client's currency for every agent going forward"
      >
        {CURRENCIES.map((c) => (
          <option key={c.code} value={c.code}>
            {c.symbol} {c.code}
          </option>
        ))}
      </select>
    </label>
  );
}
