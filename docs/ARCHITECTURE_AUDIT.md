# Architecture Audit — AI Marketing Company Upgrade

Written 2026-08-24 in response to the "MASTER INSTRUCTION" upgrade spec. This is Steps 1-3
(Audit, Gap Report, Target Architecture) of that spec. Steps 4-12 are tracked at the bottom
as a phased plan, not implemented in one sitting — see "What's actually built vs. planned."

## Step 1 — Current Implementation Audit

**Agent metadata** (`lib/agent-catalog.ts`): a flat array of
`AgentSpec { key, name, category, mission, inputs, outputs, wired, sortOrder }`.
This is presentation metadata only — a mission one-liner and two string arrays. No decision
framework, no dependencies, no risk level, no guardrails, no test cases, no `canCallAgents`.

**Agent reasoning** (`lib/agent-prompts.ts`): `SYSTEM_PROMPTS: Record<string, string>` — one
free-text prompt per agent. `buildCompanyDNAPrompt()` builds a Company DNA block from
`CompanyDNAInput` and appends it to every prompt. `RUNTIME_CONTEXT_AGENTS` is a small allow-list
of 8 agents that additionally get a "Runtime Snapshot" (current Needs Analysis + recent
`AgentRun` history) appended — everyone else only sees the static Company DNA. There is no
Brand DNA, no campaign memory, no structured agent-to-agent handoff object.

**Needs Analyzer** (`lib/needs-rules.ts`): a pure function, hardcoded if/else per agent key,
returns `{ agentKey, status: "active" | "idle", reason: string }`. Binary state only. No
evidence object, no dependency graph, no reactivation criteria beyond what's encoded in prose.

**Data model** (`prisma/schema.prisma`): `Workspace` (Company DNA fields, flat columns),
`Agent` (catalog metadata mirrored into rows), `AgentRun` (one row per execution: input
snapshot, output markdown, predicted/actual outcome, matched/missed/pending), `NeedsAnalysis`
(one row per workspace×agent: recommended/overridden status + reason string). No Brand DNA
table. No campaign-memory or learning-memory tables beyond the `AgentRun` log itself. No
agent-state column beyond the implicit active/idle derived at read time.

**Execution** (`app/api/agents/run/route.ts`): one HTTP request = one isolated LLM call for
one agent. It builds a prompt (Company DNA + optional Runtime Snapshot), calls OpenRouter,
saves the result. **There is no orchestrator that actually sequences agents, resolves
dependencies, or passes a structured handoff from one agent's output into another agent's
input.** "Marketing Orchestrator" (agent #6) is itself just another advisory LLM prompt that
*describes* a sequence in markdown — it does not execute one.

**UI**: Agent Hub grid (name, mission, active/idle pill), Needs Analyzer table (recommended
status + one-line reason, with manual override), Agent Run page (static mission/inputs/outputs
+ Run button + rendered markdown output + predicted/actual outcome fields), Scorecard
(aggregate accuracy %). No dependency graph, no "current mission" banner, no monitoring/blocked
states, no cross-agent consensus display.

**Verdict**: the audit in the master instruction's Section 1 is accurate. This is currently
45 well-written prompt templates sharing one Company DNA block and one demo/OpenRouter call
path — not a coordinated multi-agent system with state, memory, or real orchestration.

## Step 2 — Gap Report (Current → Target)

| Area | Exists today | Missing |
|---|---|---|
| Agent contract | `{key, name, category, mission, inputs[], outputs[]}` | Expert role, responsibilities, decision framework, dependencies, `canCallAgents`, risk level, guardrails, human-approval threshold, evaluation criteria, test cases |
| Company DNA | name, industry, objective, budget, currency, country, website, ICP notes, channels, assets | AOV/ACV, LTV, gross margin, sales cycle, sales capacity, CAC/CPL/ROAS/revenue/conversion/retention targets, guardrails, seasonality, existing stack/CRM maturity, North Star KPI vs. supporting KPIs |
| Brand DNA | none | entire object — colors, typography, tone, positioning, approved/restricted claims |
| Memory | `AgentRun` log (learning memory only) | Campaign memory (current audiences/budgets/messages), structured retrieval of relevant history per agent |
| Needs Analyzer | active/idle + one-line reason | Evidence list, dependency graph, mandatory/conditional/idle tiers, reactivation criteria |
| Agent states | active/idle (2) | idle/available/active/monitoring/blocked/completed/failed (7) |
| Orchestrator | advisory-only prompt | Real task graph, dependency resolution, parallelization, structured handoffs, retry, audit trail |
| Cross-agent comms | none (each run is isolated) | Structured request/reason/evidence/context/required-output messages between agents |
| Decision context | prose recommendation | Recommendation + evidence + assumptions + expected impact + confidence + risk + alternatives + test plan, as data |
| Guardrails | none | Financial/brand/compliance/data/execution risk scoring, approval thresholds, rollback |
| Scoring | one accuracy % | Marketing Health, Objective Achievement, CRM/Infra Health, Recommendation Quality, Agent Performance, Cross-Agent Consensus |
| UI | status pill, flat list | Current Mission banner, active/monitoring/idle grouping, "activated because," dependency graph |
| Tests | none | Automated test suite per agent, evaluation scenarios, the Section-44 acceptance scenario |

This matches the master instruction's Sections 2-39 essentially one-to-one — the gap analysis
in that document is correct; this table exists mainly as the durable, code-adjacent record of it.

## Step 3 — Target Architecture (what's being built toward)

- **`lib/agent-contract.ts`** — a rich `AgentDefinition` interface (see file for the full
  shape) replacing the thin `AgentSpec`. Every agent gets: mission, expert role,
  responsibilities, domain knowledge, required/optional inputs, outputs, dependencies,
  `canCallAgents`/`canBeCalledBy`, risk level, human-approval threshold, guardrails,
  evaluation criteria, example tasks. `lib/agent-catalog.ts` becomes a thin re-export /
  presentation-layer view over this for backward compatibility with existing UI code.
- **Company DNA** — `Workspace` gains the missing economic and guardrail fields (Prisma
  migration), and `CompanyDNAInput` in `lib/agent-prompts.ts` is extended to carry them into
  every prompt, so "optimize for CAC" vs. "optimize for qualified pipeline" vs. "optimize for
  awareness" actually changes what every agent optimizes for, per master-instruction Section 3.
- **Brand DNA** — new `BrandDNA` Prisma model (one per workspace), consumed by Content,
  Design, Video, Website, Landing Page, Email, and Ads agents instead of each agent
  guessing tone/positioning independently.
- **Agent states** — `AgentRun`/`NeedsAnalysis` state field widens from active/idle to the
  7-state model. Full state-machine *transitions* (e.g. auto-flipping CRO to BLOCKED when
  tracking is broken) are a later phase — this pass adds the states and the schema support,
  not yet the automatic transition logic, which depends on the orchestrator.
- **Needs Analyzer evidence** — `analyzeNeeds()` return shape gains an `evidence: string[]`
  and `tier: "mandatory" | "conditional" | "idle"` field instead of a single reason string,
  so the UI can render "Activated because: [evidence list]" per master-instruction Section 6.
- **Orchestrator, cross-agent messaging, guardrail enforcement, dependency-graph UI, and the
  automated test suite are NOT implemented in this pass.** They depend on the contract/DNA/state
  foundation above existing first, and are large enough (a real task-graph executor, a message
  bus between agent calls, a UI dependency-graph renderer) to deserve their own focused sessions
  rather than being rushed alongside everything else in one commit.

## What's actually built vs. planned, by master-instruction step

| Step | Status |
|---|---|
| 1. Audit | ✅ Done (this document) |
| 2. Gap report | ✅ Done (this document) |
| 3. Target architecture | ✅ Done (this document) |
| 4. Agent Contract upgrade | ✅ Done this session — `lib/agent-contract.ts` |
| 5. Company DNA / Brand DNA / Memory | 🟡 Partial — Company DNA fields + Brand DNA model added; three-tier memory retrieval logic not built |
| 6. Needs Analyzer upgrade | 🟡 Partial — evidence array + tiering added; full 10-question framework from Section 6 not fully modeled |
| 7. Orchestrator upgrade | ❌ Not started |
| 8. Cross-agent communication | ❌ Not started |
| 9. Upgrade all 45 agents to full contract | ❌ Not started — only the 6 originally-wired agents plus contract *scaffolding* for the rest |
| 10. New Phase-1 infrastructure agents | Already exist from prior sessions (Tracking, Audience/Suppression, etc.) — not yet upgraded to the new contract depth |
| 11. Automated tests / eval scenarios | ❌ Not started |
| 12. Acceptance test (Section 44 scenario) | ❌ Not started |

Recommended next session: pick ONE of Orchestrator (7), Cross-agent messaging (8), or the
Section-44 acceptance test (12) as the next focused piece — not all three at once.
