import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { AGENT_CATALOG } from "../lib/agent-catalog";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — point it at your Postgres connection string before seeding.");
}
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const agent of AGENT_CATALOG) {
    await prisma.agent.upsert({
      where: { key: agent.key },
      create: {
        key: agent.key,
        name: agent.name,
        category: agent.category,
        mission: agent.mission,
        inputsSpec: JSON.stringify(agent.inputs),
        outputsSpec: JSON.stringify(agent.outputs),
        isWired: agent.wired,
        sortOrder: agent.sortOrder,
      },
      update: {
        name: agent.name,
        category: agent.category,
        mission: agent.mission,
        inputsSpec: JSON.stringify(agent.inputs),
        outputsSpec: JSON.stringify(agent.outputs),
        isWired: agent.wired,
        sortOrder: agent.sortOrder,
      },
    });
  }
  // Remove any Agent row that's no longer in the catalog — e.g. an agent
  // that was decommissioned (folded into a plain non-LLM tool, merged into
  // another agent). Cascades to that agent's own AgentRun/NeedsAnalysis
  // rows (both onDelete: Cascade in schema.prisma), which is the right
  // outcome for something that's no longer a real agent at all, not an
  // orphaned row silently left behind on every future re-seed.
  const catalogKeys = AGENT_CATALOG.map((a) => a.key);
  const { count: removedCount } = await prisma.agent.deleteMany({ where: { key: { notIn: catalogKeys } } });
  if (removedCount > 0) console.log(`Removed ${removedCount} decommissioned agent(s) no longer in the catalog.`);

  console.log(`Seeded ${AGENT_CATALOG.length} agents.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
