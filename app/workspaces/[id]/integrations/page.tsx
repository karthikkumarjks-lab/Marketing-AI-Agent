import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { INTEGRATION_PROVIDERS, isProviderConfigured } from "@/lib/integrations";
import { fetchAdAccounts, type MetaAdAccount } from "@/lib/meta-ads-client";
import IntegrationCard from "@/components/integration-card";
import MetaIntegrationCard from "@/components/meta-integration-card";

export default async function IntegrationsPage({
  params,
  searchParams,
}: PageProps<"/workspaces/[id]/integrations">) {
  const { id } = await params;
  const query = await searchParams;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const records = await prisma.integration.findMany({ where: { workspaceId: id } });
  const byProvider = new Map(records.map((r) => [r.provider, r]));

  const metaRecord = byProvider.get("meta_ads");
  let metaAdAccounts: MetaAdAccount[] | null = null;
  let metaAdAccountsError: string | null = null;
  if (metaRecord?.status === "connected" && metaRecord.accessToken) {
    try {
      metaAdAccounts = await fetchAdAccounts(metaRecord.accessToken);
    } catch (err) {
      metaAdAccountsError = err instanceof Error ? err.message : "Could not load ad accounts.";
    }
  }

  const metaStatus = typeof query.meta_status === "string" ? query.meta_status : null;
  const metaMessage = typeof query.meta_message === "string" ? query.meta_message : null;

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Integrations</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} — connectors</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Meta Ads has a real OAuth connection below. The rest are still scaffolding — every other
          agent reasons from category knowledge and whatever you tell it in Company DNA, honestly
          disclosed in its own output. Register a developer app per platform, set its credentials in{" "}
          <code className="text-ink">.env.local</code>, and a real connection becomes a
          credentials-and-callback-route problem instead of an architecture problem.
        </p>
      </div>

      {metaStatus === "connected" && (
        <div className="mb-6 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3 text-sm text-accent-ink">
          Meta Ads connected successfully.
        </div>
      )}
      {metaStatus === "error" && (
        <div className="mb-6 rounded-lg border border-danger/40 bg-danger-soft px-4 py-3 text-sm text-danger">
          Meta Ads connection failed{metaMessage ? `: ${metaMessage}` : "."}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INTEGRATION_PROVIDERS.map((provider) => {
          const record = byProvider.get(provider.key);
          if (provider.key === "meta_ads") {
            return (
              <MetaIntegrationCard
                key={provider.key}
                workspaceId={id}
                provider={provider}
                configured={isProviderConfigured(provider.key)}
                status={(record?.status as "not_connected" | "connected") ?? "not_connected"}
                tokenExpiresAt={record?.tokenExpiresAt?.toISOString() ?? null}
                externalAccountId={record?.externalAccountId ?? null}
                adAccounts={metaAdAccounts}
                adAccountsError={metaAdAccountsError}
              />
            );
          }
          return (
            <IntegrationCard
              key={provider.key}
              workspaceId={id}
              provider={provider}
              configured={isProviderConfigured(provider.key)}
              status={(record?.status as "not_connected" | "connected") ?? "not_connected"}
              accountLabel={record?.accountLabel ?? null}
            />
          );
        })}
      </div>
    </main>
  );
}
