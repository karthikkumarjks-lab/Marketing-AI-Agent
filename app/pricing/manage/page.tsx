import { prisma } from "@/lib/prisma";
import { CATEGORY_ORDER, CATEGORY_COLORS } from "@/lib/agent-catalog";
import PricingManager from "@/components/pricing-manager";

export default async function PricingManagePage() {
  const agents = await prisma.agent.findMany({
    select: { key: true, name: true, category: true, sortOrder: true, priceInr: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const byCategory = CATEGORY_ORDER.map((category) => ({
    category,
    color: CATEGORY_COLORS[category],
    agents: agents.filter((a) => a.category === category),
  })).filter((c) => c.agents.length > 0);

  const pricedCount = agents.filter((a) => a.priceInr != null).length;

  return (
    <main className="max-w-3xl mx-auto px-8 py-10">
      <div className="mb-8">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Pricing — Admin</div>
        <h1 className="text-2xl font-semibold text-ink">Set a price per agent</h1>
        <p className="text-sm text-ink-soft mt-1.5 max-w-2xl leading-relaxed">
          Prices here feed the customer-facing selector at <code className="text-ink">/pricing</code>.
          Saved automatically as you edit — leave blank for an agent that isn&apos;t for sale yet
          (it won&apos;t appear as selectable on the customer page). {pricedCount} of {agents.length} priced so far.
        </p>
      </div>
      <PricingManager categories={byCategory} />
    </main>
  );
}
