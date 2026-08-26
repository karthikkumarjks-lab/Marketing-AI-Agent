"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { IntegrationProvider } from "@/lib/integrations";
import type { MetaAdAccount } from "@/lib/meta-ads-client";

export default function MetaIntegrationCard({
  workspaceId,
  provider,
  configured,
  status,
  tokenExpiresAt,
  externalAccountId,
  adAccounts,
  adAccountsError,
}: {
  workspaceId: string;
  provider: IntegrationProvider;
  configured: boolean;
  status: "not_connected" | "connected";
  tokenExpiresAt: string | null;
  externalAccountId: string | null;
  adAccounts: MetaAdAccount[] | null;
  adAccountsError: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedAccount, setSelectedAccount] = useState(externalAccountId ?? "");

  async function disconnect() {
    await fetch(`/api/workspaces/${workspaceId}/integrations`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: provider.key, status: "not_connected" }),
    });
    startTransition(() => router.refresh());
  }

  async function selectAccount(accountId: string) {
    setSelectedAccount(accountId);
    await fetch(`/api/workspaces/${workspaceId}/integrations`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: provider.key, externalAccountId: accountId }),
    });
    startTransition(() => router.refresh());
  }

  return (
    <div className="bg-surface border border-line rounded-lg p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-ink">{provider.name}</div>
          <div className="text-[11px] text-ink-faint mt-0.5">{provider.category} · real OAuth connection</div>
        </div>
        <span
          className={`text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
            status === "connected" ? "bg-accent-soft text-accent-ink" : "bg-line/60 text-ink-faint"
          }`}
        >
          {status === "connected" ? "Connected" : "Not connected"}
        </span>
      </div>

      <p className="text-xs text-ink-soft leading-relaxed">{provider.description}</p>

      {!configured && (
        <p className="text-[11px] text-ink-faint leading-relaxed">
          No Meta app registered yet. Create one at{" "}
          <a href={provider.setupUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {provider.setupUrl}
          </a>{" "}
          and set <code className="text-ink-soft">META_APP_ID</code> / <code className="text-ink-soft">META_APP_SECRET</code>{" "}
          in <code className="text-ink-soft">.env.local</code>. Meta requires an HTTPS redirect URI with no documented
          localhost exception — for local testing, point an HTTPS tunnel (e.g. ngrok) at this app and set{" "}
          <code className="text-ink-soft">APP_BASE_URL</code> to that tunnel URL.
        </p>
      )}

      {status === "connected" ? (
        <div className="flex flex-col gap-2">
          {tokenExpiresAt && (
            <p className="text-[11px] text-ink-faint">
              Access expires {new Date(tokenExpiresAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })} — reconnect after that to keep live data flowing.
            </p>
          )}
          {adAccountsError && (
            <p className="text-[11px] text-danger">Could not load ad accounts: {adAccountsError}</p>
          )}
          {adAccounts && adAccounts.length > 0 && (
            <div>
              <label className="text-[11px] text-ink-faint mb-1 block">Ad account to pull data from</label>
              <select
                value={selectedAccount}
                onChange={(e) => selectAccount(e.target.value)}
                disabled={pending}
                className="w-full rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/40 disabled:opacity-60"
              >
                <option value="" disabled>
                  Select an account…
                </option>
                {adAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </div>
          )}
          <button
            onClick={disconnect}
            disabled={pending}
            className="text-xs px-3 py-1 rounded-md border border-line text-ink-soft hover:bg-bg disabled:opacity-60 self-start"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <a
          href={`/api/integrations/meta/authorize?workspaceId=${workspaceId}`}
          className={`text-xs px-3 py-1.5 rounded-md text-center font-medium ${
            configured ? "bg-accent text-white hover:opacity-90" : "bg-line text-ink-faint pointer-events-none"
          }`}
        >
          Connect with Meta
        </a>
      )}

      <div className="text-[11px] text-ink-faint">Unlocks live data for: {provider.unlocksFor.join(", ")}</div>
    </div>
  );
}
