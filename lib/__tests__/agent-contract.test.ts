import { describe, expect, it } from "vitest";
import { AGENT_CATALOG } from "../agent-catalog";
import {
  AGENT_DEFINITIONS,
  getAgentDependencies,
  getAgentDefinition,
  getAgentGuardrails,
} from "../agent-contract";

describe("agent guardrails", () => {
  it("flags every spend-recommending agent as high risk and requiring human approval", () => {
    for (const key of ["performance-marketing", "google-ads", "meta-ads", "linkedin-ads", "tiktok-ads", "budget-investment", "pr-influencer"]) {
      const g = getAgentGuardrails(key, "Acquisition");
      expect(g.riskLevel).toBe("high");
      expect(g.requiresHumanApproval).toBe(true);
    }
  });

  it("flags Marketing Operations and CRM & Lead Operations agents as medium risk unless they're a spend agent", () => {
    const g = getAgentGuardrails("crm-customer-data", "CRM & Lead Operations");
    expect(g.riskLevel).toBe("medium");
    expect(g.requiresHumanApproval).toBe(true);
  });

  it("defaults every other agent to low risk, advisory-only", () => {
    const g = getAgentGuardrails("content-strategy", "Content & Creative");
    expect(g.riskLevel).toBe("low");
    expect(g.requiresHumanApproval).toBe(false);
  });
});

describe("agent dependencies", () => {
  it("returns empty dependency arrays for agents with no declared relationship, instead of throwing", () => {
    const deps = getAgentDependencies("not-a-real-agent");
    expect(deps).toEqual({ dependsOn: [], canCall: [] });
  });

  it("every agent key referenced inside a dependency entry exists in the catalog", () => {
    const catalogKeys = new Set(AGENT_CATALOG.map((a) => a.key));
    const missing: string[] = [];
    for (const [key, deps] of Object.entries(getAgentDependenciesTable())) {
      for (const ref of [key, ...deps.dependsOn, ...deps.canCall]) {
        if (!catalogKeys.has(ref)) missing.push(`${key} -> ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });
});

describe("agent definitions", () => {
  it("every authored definition's key matches its map key and has non-empty content", () => {
    for (const [mapKey, def] of Object.entries(AGENT_DEFINITIONS)) {
      expect(def.key).toBe(mapKey);
      expect(def.expertRole.trim().length).toBeGreaterThan(0);
      expect(def.responsibilities.length).toBeGreaterThan(0);
      expect(def.decisionFramework.trim().length).toBeGreaterThan(0);
      expect(def.exampleTasks.length).toBeGreaterThan(0);
      expect(def.testCases.length).toBeGreaterThan(0);
    }
  });

  it("getAgentDefinition returns undefined for an agent with no authored contract yet", () => {
    expect(getAgentDefinition("not-a-real-agent")).toBeUndefined();
  });
});

// AGENT_DEPENDENCIES itself isn't exported as a lookup-by-everything table in
// a form convenient for this test, so rebuild the same view via the public
// getAgentDependencies() for every catalog key.
function getAgentDependenciesTable() {
  const table: Record<string, { dependsOn: string[]; canCall: string[] }> = {};
  for (const agent of AGENT_CATALOG) {
    const deps = getAgentDependencies(agent.key);
    if (deps.dependsOn.length || deps.canCall.length) table[agent.key] = deps;
  }
  return table;
}
