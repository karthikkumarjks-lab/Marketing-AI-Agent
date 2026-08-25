// Orchestration: sequencing active agents by their declared dependency graph
// (AGENT_DEPENDENCIES in agent-contract.ts), and formatting a dependency
// agent's actual latest output as hand-off context for the agent that
// depends on it. This is the piece tracked elsewhere as deferred — "real
// orchestrator (task-graph execution), cross-agent structured message
// passing" — implemented as a real, testable feature: a topological run
// order plus real hand-off content, not a stub that just claims to do this.

import { getAgentDependencies } from "./agent-contract";

export type RunPlanStatus = "done" | "ready" | "blocked";

export interface RunPlanEntry {
  agentKey: string;
  status: RunPlanStatus;
  /** Active dependency agent keys that haven't produced a run yet. Empty when status isn't "blocked". */
  blockedOn: string[];
}

/**
 * Topological order over the active-agent subgraph, using only dependency
 * edges where both ends are active (a dependency on an idle agent doesn't
 * block sequencing — that agent isn't going to run anyway). Any cycle
 * (shouldn't occur with a well-formed dependency graph, but not assumed)
 * is broken by appending the remaining agents in their original order
 * rather than throwing.
 */
export function computeRunOrder(activeAgentKeys: string[]): string[] {
  const activeSet = new Set(activeAgentKeys);
  const deps = new Map<string, string[]>();
  const indegree = new Map<string, number>();
  for (const key of activeAgentKeys) {
    const relevant = getAgentDependencies(key).dependsOn.filter((d) => activeSet.has(d) && d !== key);
    deps.set(key, relevant);
    indegree.set(key, relevant.length);
  }

  const remaining = new Set(activeAgentKeys);
  const queue = activeAgentKeys.filter((k) => indegree.get(k) === 0);
  const order: string[] = [];

  while (queue.length > 0) {
    const key = queue.shift()!;
    if (!remaining.has(key)) continue;
    order.push(key);
    remaining.delete(key);
    for (const other of activeAgentKeys) {
      if (!remaining.has(other)) continue;
      const otherDeps = deps.get(other)!;
      if (otherDeps.includes(key)) {
        const next = indegree.get(other)! - 1;
        indegree.set(other, next);
        if (next === 0) queue.push(other);
      }
    }
  }

  // Cycle fallback: anything left couldn't be resolved by indegree alone.
  for (const key of activeAgentKeys) {
    if (remaining.has(key)) order.push(key);
  }
  return order;
}

/**
 * For each active agent (in run order), whether it's ready to run now,
 * blocked on an active dependency that hasn't produced a run yet, or
 * already has a run ("done" here means "has run at least once", not
 * "finished forever" — rerunning a done agent is always allowed).
 */
export function computeRunPlan(activeAgentKeys: string[], ranAgentKeys: Set<string>): RunPlanEntry[] {
  const activeSet = new Set(activeAgentKeys);
  const order = computeRunOrder(activeAgentKeys);
  return order.map((key) => {
    const relevant = getAgentDependencies(key).dependsOn.filter((d) => activeSet.has(d) && d !== key);
    const blockedOn = relevant.filter((d) => !ranAgentKeys.has(d));
    const status: RunPlanStatus = ranAgentKeys.has(key) ? "done" : blockedOn.length > 0 ? "blocked" : "ready";
    return { agentKey: key, status, blockedOn };
  });
}

export interface DependencyRunSnapshot {
  agentName: string;
  outputMarkdown: string;
}

const MAX_HANDOFF_CHARS_PER_AGENT = 2500;

/**
 * Formats a dependency agent's most recent real output as hand-off context
 * for the dependent agent's own prompt. This is actual prior output from
 * this workspace, not a summary invented by the dependent agent itself.
 */
export function buildHandoffContext(deps: DependencyRunSnapshot[]): string {
  if (deps.length === 0) return "";
  const sections = deps.map((d) => {
    const truncated =
      d.outputMarkdown.length > MAX_HANDOFF_CHARS_PER_AGENT
        ? d.outputMarkdown.slice(0, MAX_HANDOFF_CHARS_PER_AGENT) + "\n\n...(truncated)"
        : d.outputMarkdown;
    return `### From ${d.agentName}\n${truncated}`;
  });
  return `\n\n# Hand-off From Dependency Agents\nThis is the most recent real output from agents this one depends on in this workspace — treat it as actual prior work to build on, not a hypothetical.\n\n${sections.join("\n\n")}`;
}
