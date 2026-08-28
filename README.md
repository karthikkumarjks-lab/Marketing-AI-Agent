# Marketing Autopilot

A dashboard where a marketer or agency operator manages multiple clients ("Workspaces") and
runs a growing team of specialist AI marketing agents against each one — one shared runtime,
not a pile of separate tools. See `docs/ARCHITECTURE_AUDIT.md` for the current architecture
state and what's still planned.

## What's here

- **Workspaces** — one per client, holding their Company DNA (industry, objective, budget in ₹,
  website, ICP notes, channels, assets).
- **Needs Analyzer** — rule-based logic that recommends which of the 25 agents should be
  active vs. idle for a given client, with a client-specific reason for each call. Every call
  can be manually overridden.
- **Agent Hub** — all 25 agents, grouped into 5 categories, visible whether or not they're
  wired to real execution yet.
- **6 agents fully wired** to real reasoning (Marketing Strategy, Market Research, Customer/ICP
  Intelligence, Needs Analyzer, SEO Strategy, Performance Marketing Strategy) — the other 19
  show their spec and a "Coming online" badge.
- **Evaluation log** — every agent run stores a predicted outcome; you can later record the
  actual outcome (Matched / Missed). This log is the point of the whole system, not an
  afterthought — see `lib/agent-catalog.ts`'s `marketing-score` agent.

## Running it locally

```bash
npm install
# Set DATABASE_URL in .env to a Postgres connection string (e.g. a free Neon project)
npm run seed   # seeds the agent catalog into the database
npm run dev
```

Open http://localhost:3000.

## Making agents actually think

Without an API key, every wired agent returns a clearly labeled demo/mock output so you can see
the UI and flow work end to end. To get real reasoning:

1. Copy `.env.local.example` to `.env.local`.
2. Get a key at https://openrouter.ai/keys (has free-tier models).
3. Set `OPENROUTER_API_KEY=your-key` in `.env.local`.
4. Restart `npm run dev`.

`.env.local` is gitignored — it never gets committed or pushed.

## Data storage

Uses hosted Postgres via Prisma (e.g. Neon's free tier) — set `DATABASE_URL` in `.env`/`.env.local`
or your deploy host's environment variables. **`.env`/`.env.local` are gitignored**; the connection
string lives only where you put it, never in the repo.

## Project structure

```
lib/agent-catalog.ts      # the 25-agent spec: name, category, mission, inputs/outputs, wired?
lib/agent-prompts.ts      # system prompts for the 6 wired agents + the OpenRouter call
lib/needs-rules.ts        # rule-based Needs Analyzer logic
lib/prisma.ts             # Prisma client (Postgres via @prisma/adapter-pg)
prisma/schema.prisma      # Workspace, Agent, AgentRun, NeedsAnalysis models
app/workspaces/           # all the UI screens
app/api/                  # workspace creation, needs overrides, agent runs, outcome scoring
```

## Adding the next batch of agents

Only 6 of 25 are wired. To wire another:

1. Set `wired: true` on it in `lib/agent-catalog.ts`, then `npm run seed`.
2. Add a system prompt for its key in `SYSTEM_PROMPTS` in `lib/agent-prompts.ts`.

That's the whole contract — the run page, run history, and evaluation log all work
automatically once an agent has a system prompt.
