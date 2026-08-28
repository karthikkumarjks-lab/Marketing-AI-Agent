"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LeadStageSelect({
  workspaceId,
  leadId,
  stages,
  currentStageId,
}: {
  workspaceId: string;
  leadId: string;
  stages: { id: string; name: string; isWon: boolean; isLost: boolean }[];
  currentStageId: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(currentStageId ?? "");
  const [pending, setPending] = useState(false);

  async function handleChange(next: string) {
    setValue(next);
    setPending(true);
    await fetch(`/api/workspaces/${workspaceId}/leads/${leadId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ stageId: next }),
    });
    setPending(false);
    router.refresh();
  }

  const current = stages.find((s) => s.id === value);

  return (
    <select
      value={value}
      disabled={pending}
      onChange={(e) => handleChange(e.target.value)}
      className={`rounded-full text-xs font-medium px-3 py-1 border-0 focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60 ${
        current?.isWon
          ? "bg-accent-soft text-accent-ink"
          : current?.isLost
            ? "bg-danger-soft text-danger"
            : "bg-line text-ink-soft"
      }`}
    >
      {stages.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
