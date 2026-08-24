import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { AGENT_CATALOG } from "../lib/agent-catalog";

const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });
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
