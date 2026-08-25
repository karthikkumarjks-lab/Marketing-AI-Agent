"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationProvider } from "@/lib/integrations";

export default function IntegrationCard({
  workspaceId,
  provider,
  configured,
  status,
  accountLabel,
}: {
  workspaceId: string;
  provider: IntegrationProvider;
  configured: boolean;
  status: "not_connected" | "connected";
  accountLabel: string | null;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(accountLabel ?? "");
  const [pending, startTransition] = useTransition();

  async function setStatus(next: "not_connected" | "connected") {
    await fetch(`/api/workspaces/${workspaceId}/integrations`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: provider.key, status: next, accountLabel: label }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">{provider.name}</div>
          <div className="text-[11px] text-ink-faint mt-0.5">{provider.category}</div>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
            status === "connected" ? "bg-accent-soft text-accent-ink" : "bg-line/60 text-ink-faint"
          }`}
        >
          {status === "connected" ? "Connected (self-reported)" : "Not connected"}
        </span>
      </div>

      <p className="text-xs text-ink-soft leading-relaxed">{provider.description}</p>

      {!configured && (
        <p className="text-[11px] text-ink-faint leading-relaxed">
          No OAuth app registered yet. Register one at{" "}
          <a href={provider.setupUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {provider.setupUrl}
          </a>{" "}
          and set <code className="text-ink-soft">{provider.clientIdEnv}</code> /{" "}
          <code className="text-ink-soft">{provider.clientSecretEnv}</code> in <code className="text-ink-soft">.env.local</code>{" "}
          — real OAuth wiring is still a follow-up, this just unblocks it.
        </p>
      )}

      <div className="flex items-center gap-2">
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Account label (e.g. account ID/name)"
          disabled={pending}
          className="flex-1 rounded-md border border-line bg-canvas px-2 py-1 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
        />
        {status === "connected" ? (
          <button
            onClick={() => setStatus("not_connected")}
            disabled={pending}
            className="text-xs px-3 py-1 rounded-md border border-line text-ink-soft hover:bg-canvas disabled:opacity-60"
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={() => setStatus("connected")}
            disabled={pending}
            className="text-xs px-3 py-1 rounded-md bg-accent text-white hover:opacity-90 disabled:opacity-60"
            title="Records that you connected this account manually — there is no live OAuth flow yet"
          >
            Mark connected
          </button>
        )}
      </div>

      <div className="text-[11px] text-ink-faint">
        Unlocks live data for: {provider.unlocksFor.join(", ")}
      </div>
    </div>
  );
}
