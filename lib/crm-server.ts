// Server-only CRM helpers (touch Prisma) — kept separate from lib/crm.ts so
// that file's pure types/parsers stay safe to import from client components.
import { prisma } from "@/lib/prisma";
import { DEFAULT_STAGES } from "@/lib/crm";

// Creates the default pipeline stages the first time a workspace's CRM is
// visited. Idempotent — safe to call on every page load. Not done at
// workspace-creation time so existing workspaces (created before the CRM
// existed) pick this up automatically, same backfill pattern already used
// for NeedsAnalysis rows in app/workspaces/[id]/layout.tsx.
export async function ensureDefaultStages(workspaceId: string) {
  const existing = await prisma.pipelineStage.findMany({
    where: { workspaceId },
    orderBy: { order: "asc" },
  });
  if (existing.length > 0) return existing;
  await prisma.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({ ...s, workspaceId })),
  });
  return prisma.pipelineStage.findMany({ where: { workspaceId }, orderBy: { order: "asc" } });
}
