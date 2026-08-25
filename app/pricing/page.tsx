import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER, CATEGORY_COLORS } from "@/lib/agent-catalog";
import PricingSelector from "@/components/pricing-selector";

export default async function PricingPage() {
  const agents = await prisma.agent.findMany({
    where: { priceInr: { not: null } },
    select: { key: true, name: true, category: true, mission: true, sortOrder: true, priceInr: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    color: CATEGORY_COLORS[category],
    agents: agents
      .filter((a) => a.category === category)
      .map((a) => ({ key: a.key, name: a.name, mission: a.mission, priceInr: a.priceInr as number })),
  })).filter((c) => c.agents.length > 0);

  return (
    <main className="max-w-4xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Build Your Plan</div>
        <h1 className="text-2xl font-semibold text-ink">Pick the agents you need</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Select individual agents or an entire category — the total updates as you go.
        </p>
      </div>
      {byCategory.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg py-10 px-6 text-center text-sm text-ink-faint">
          Nothing is priced yet — set prices at <code className="text-ink">/pricing/manage</code> first.
        </div>
      ) : (
        <PricingSelector categories={byCategory} />
      )}
    </main>
  );
}
