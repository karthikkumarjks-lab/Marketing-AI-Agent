import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { INTEGRATION_PROVIDERS, isProviderConfigured } from "@/lib/integrations";
import IntegrationCard from "@/components/integration-card";

export default async function IntegrationsPage({ params }: PageProps<"/workspaces/[id]/integrations">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const records = await prisma.integration.findMany({ where: { workspaceId: id } });
  const byProvider = new Map(records.map((r) => [r.provider, r]));

  return (
    <main className="max-w-5xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Integrations</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} — connectors</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          None of these have a live OAuth connection yet — every agent still reasons from category
          knowledge and whatever you tell it in Company DNA, honestly disclosed in its own output.
          This page is the scaffolding: register a developer app per platform, set its credentials
          in <code className="text-ink">.env.local</code>, and a real connection becomes a
          credentials-and-callback-route problem instead of an architecture problem.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {INTEGRATION_PROVIDERS.map((provider) => {
          const record = byProvider.get(provider.key);
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
