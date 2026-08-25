// Consistency checks across the three sources of truth that must stay in
// sync as the catalog grows: agent-catalog.ts (what exists), agent-prompts.ts
// (what it says), needs-rules.ts (when it runs). TypeScript's Record<string,
// string> can't catch a missing key here — this caught a real bug once
// (lead-nurturing-strategy shipped with no prompt) that tsc/eslint missed.
import { describe, expect, it } from "vitest";
import { AGENT_CATALOG, CATEGORY_ORDER, getAgentSpec } from "../agent-catalog";
import { getSystemPrompt } from "../agent-prompts";
import { analyzeNeeds } from "../needs-rules";

describe("agent catalog consistency", () => {
  it("has no duplicate agent keys", () => {
    const keys = AGENT_CATALOG.map((a) => a.key);
    const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dupes).toEqual([]);
  });

  it("every wired agent has a system prompt", () => {
    const missing = AGENT_CATALOG.filter((a) => a.wired && !getSystemPrompt(a.key)).map((a) => a.key);
    expect(missing).toEqual([]);
  });

  it("every agent has a needs-rules entry (not silently defaulted to idle)", () => {
    const keys = AGENT_CATALOG.map((a) => a.key);
    const recs = analyzeNeeds({}, keys);
    const generic = recs
      .filter((r) => r.reason === "Not relevant to the current objective and stage.")
      .map((r) => r.agentKey);
    expect(generic).toEqual([]);
  });

  it("every agent's category is a known category", () => {
    const bad = AGENT_CATALOG.filter((a) => !CATEGORY_ORDER.includes(a.category)).map((a) => a.key);
    expect(bad).toEqual([]);
  });

  it("every agent has a non-empty mission, inputs, and outputs", () => {
    const incomplete = AGENT_CATALOG.filter(
      (a) => !a.mission.trim() || a.inputs.length === 0 || a.outputs.length === 0
    ).map((a) => a.key);
    expect(incomplete).toEqual([]);
  });

  it("getAgentSpec finds every catalog key and returns undefined for unknown keys", () => {
    for (const agent of AGENT_CATALOG) {
      expect(getAgentSpec(agent.key)?.key).toBe(agent.key);
    }
    expect(getAgentSpec("not-a-real-agent")).toBeUndefined();
  });
});
