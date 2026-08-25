import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AgentRunner from "@/components/agent-runner";
import { getUploadType } from "@/lib/agent-uploads";
import { getTextInputSpec } from "@/lib/agent-text-input";
import { LIVE_WEBSITE_AUDIT_AGENTS } from "@/lib/agent-prompts";

export default async function AgentRunPage({
  params,
}: PageProps<"/workspaces/[id]/agents/[agentKey]">) {
  const { id, agentKey } = await params;

  const [workspace, agent] = await Promise.all([
    prisma.workspace.findUnique({ where: { id } }),
    prisma.agent.findUnique({ where: { key: agentKey } }),
  ]);
  if (!workspace || !agent) notFound();

  const runs = await prisma.agentRun.findMany({
    where: { workspaceId: id, agentId: agent.id },
    orderBy: { createdAt: "desc" },
  });

  const inputs: string[] = JSON.parse(agent.inputsSpec);
  const outputs: string[] = JSON.parse(agent.outputsSpec);

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-6">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">{agent.category}</div>
        <h1 className="text-2xl font-semibold text-ink">{agent.name}</h1>
        <p className="text-sm text-ink-soft mt-2 max-w-xl">{agent.mission}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-surface border border-line rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Reads from</div>
          <ul className="text-sm text-ink-soft list-disc pl-4 space-y-1">
            {inputs.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
        <div className="bg-surface border border-line rounded-lg p-4">
          <div className="text-xs font-semibold text-ink-faint uppercase tracking-wide mb-2">Produces</div>
          <ul className="text-sm text-ink-soft list-disc pl-4 space-y-1">
            {outputs.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      </div>

      <AgentRunner
        workspaceId={id}
        agentKey={agentKey}
        isWired={agent.isWired}
        uploadType={getUploadType(agentKey)}
        websiteUrlField={LIVE_WEBSITE_AUDIT_AGENTS.has(agentKey) ? (workspace.websiteUrl ?? "") : null}
        textInputField={getTextInputSpec(agentKey)}
        runs={runs.map((r) => ({
          id: r.id,
          outputMarkdown: r.outputMarkdown,
          predictedOutcome: r.predictedOutcome,
          actualOutcome: r.actualOutcome,
          outcomeStatus: r.outcomeStatus,
          isDemo: r.isDemo,
          model: r.model,
          createdAt: r.createdAt.toISOString(),
        }))}
      />
    </main>
  );
}
