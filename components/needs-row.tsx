"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import StatusPill from "./status-pill";

const TIER_LABELS: Record<string, string> = {
  mandatory: "Mandatory",
  conditional: "Conditional",
  idle: "Idle",
};
const TIER_STYLES: Record<string, string> = {
  mandatory: "bg-accent-soft text-accent-ink",
  conditional: "bg-line text-ink-soft",
  idle: "bg-line text-ink-faint",
};

interface Props {
  workspaceId: string;
  agentId: string;
  agentName: string;
  agentKey: string;
  recommendedStatus: "active" | "idle";
  overriddenStatus: string | null;
  reason: string;
  tier: string;
  reactivationTrigger: string | null;
  isWired: boolean;
}

export default function NeedsRow({
  workspaceId,
  agentId,
  agentName,
  agentKey,
  recommendedStatus,
  overriddenStatus,
  reason,
  tier,
  reactivationTrigger,
  isWired,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const effective = (overriddenStatus ?? recommendedStatus) as "active" | "idle";

  async function setOverride(status: "active" | "idle" | null) {
    await fetch("/api/needs/override", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workspaceId, agentId, status }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <tr className="border-b border-line last:border-0">
      <td className="py-3 px-4">
        <Link
          href={`/workspaces/${workspaceId}/agents/${agentKey}`}
          className="font-medium text-ink text-sm hover:text-accent"
        >
          {agentName}
        </Link>
        {!isWired && <div className="text-[11px] text-ink-faint mt-0.5">Coming online</div>}
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusPill status={effective} />
          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${TIER_STYLES[tier] ?? TIER_STYLES.idle}`}>
            {TIER_LABELS[tier] ?? "Idle"}
          </span>
          {overriddenStatus && overriddenStatus !== recommendedStatus && (
            <span className="text-[11px] text-warn">manual</span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-ink-soft max-w-md">
        <div>{reason}</div>
        {effective === "idle" && reactivationTrigger && (
          <div className="text-[11px] text-ink-faint mt-1">↳ {reactivationTrigger}</div>
        )}
      </td>
      <td className="py-3 px-4 text-right">
        <div className="inline-flex gap-1">
          {effective !== "active" && (
            <button
              disabled={pending}
              onClick={() => setOverride("active")}
              className="text-xs rounded border border-line-strong px-2 py-1 hover:bg-accent-soft hover:border-accent disabled:opacity-50"
            >
              Activate
            </button>
          )}
          {effective !== "idle" && (
            <button
              disabled={pending}
              onClick={() => setOverride("idle")}
              className="text-xs rounded border border-line-strong px-2 py-1 hover:bg-line disabled:opacity-50"
            >
              Idle
            </button>
          )}
          {overriddenStatus && (
            <button
              disabled={pending}
              onClick={() => setOverride(null)}
              className="text-xs text-ink-faint px-2 py-1 hover:text-ink disabled:opacity-50"
              title="Reset to recommendation"
            >
              Reset
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
