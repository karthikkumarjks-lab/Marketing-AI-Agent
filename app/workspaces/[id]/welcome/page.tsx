import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

// The actual first screen a brand-new client sees, right after answering
// the "Tell us about this client" form — replacing what used to be a
// straight drop into the Needs Analyzer's technical table (146 agents,
// "mandatory/conditional", override controls). Someone signing up for "a
// marketing one-stop solution" doesn't know what an agent tier is and
// shouldn't have to before seeing anything useful. This translates the
// same underlying recommendation data into a short, plain-language set of
// where-to-start cards — the full technical view is still one link away
// for anyone who wants it.
const CARD_CAP = 6;

export default async function WelcomePage({ params }: PageProps<"/workspaces/[id]/welcome">) {
  const { id } = await params;
  const workspace = await prisma.workspace.findUnique({ where: { id } });
  if (!workspace) notFound();

  const mandatory = await prisma.needsAnalysis.findMany({
    where: { workspaceId: id, tier: "mandatory" },
    include: { agent: true },
  });
  const active = mandatory
    .filter((n) => (n.overriddenStatus ?? n.recommendedStatus) === "active")
    .sort((a, b) => a.agent.sortOrder - b.agent.sortOrder);
  const shown = active.slice(0, CARD_CAP);
  const remaining = active.length - shown.length;

  return (
    <main className="max-w-3xl mx-auto px-8 py-14">
      <div className="mb-10">
        <div className="text-xs font-mono uppercase tracking-wider text-accent mb-2">Get Started</div>
        <h1 className="text-2xl font-semibold text-ink">{workspace.name} is set up.</h1>
        <p className="text-sm text-ink-soft mt-2 leading-relaxed max-w-xl">
          Here&apos;s the honest version of what this is: a team of specialist marketing agents, each focused on
          one job — SEO, ads, email, your CRM, and a lot more. You don&apos;t need to know which one to reach for.
          Based on what you just told us about {workspace.name}, here&apos;s exactly where to start.
        </p>
      </div>

      {shown.length === 0 ? (
        <div className="bg-surface border border-line rounded-lg p-6 text-sm text-ink-soft">
          We need a bit more about your business before we can point you anywhere specific —{" "}
          <Link href={`/workspaces/${id}/needs`} className="text-accent hover:underline">
            fill in a few more details
          </Link>{" "}
          and this page will fill in.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {shown.map((n) => (
            <div key={n.id} className="bg-surface border border-line rounded-lg p-5">
              <div className="font-medium text-sm text-ink mb-1.5">{n.agent.name}</div>
              <p className="text-xs text-ink-soft leading-relaxed mb-3">{n.reason}</p>
              <Link href={`/workspaces/${id}/agents/${n.agent.key}`} className="text-xs font-medium text-accent hover:underline">
                Get started →
              </Link>
            </div>
          ))}
        </div>
      )}

      {remaining > 0 && (
        <p className="text-xs text-ink-faint mt-4">+ {remaining} more essential{remaining === 1 ? "" : "s"} once you&apos;re through these.</p>
      )}

      <div className="mt-12 pt-6 border-t border-line flex items-center gap-5 text-sm">
        <Link href={`/workspaces/${id}/agents`} className="text-accent hover:underline">
          Browse everything this can do →
        </Link>
        <Link href={`/workspaces/${id}/needs`} className="text-ink-faint hover:text-ink">
          See the full technical breakdown
        </Link>
      </div>
    </main>
  );
}
