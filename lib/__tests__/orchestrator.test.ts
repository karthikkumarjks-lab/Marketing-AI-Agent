import { describe, expect, it } from "vitest";
import { buildHandoffContext, computeRunOrder, computeRunPlan } from "../orchestrator";

describe("computeRunOrder", () => {
  it("puts a dependency before the agent that depends on it", () => {
    const order = computeRunOrder(["landing-page", "performance-marketing", "icp-intelligence"]);
    expect(order.indexOf("performance-marketing")).toBeLessThan(order.indexOf("landing-page"));
  });

  it("ignores dependency edges where the dependency itself isn't active", () => {
    // landing-page depends on performance-marketing and icp-intelligence;
    // neither is in the active set here, so landing-page should just be
    // schedulable immediately rather than treated as blocked forever.
    const order = computeRunOrder(["landing-page"]);
    expect(order).toEqual(["landing-page"]);
  });

  it("returns every input key exactly once", () => {
    const keys = ["cro", "landing-page", "performance-marketing", "google-ads", "meta-ads"];
    const order = computeRunOrder(keys);
    expect(order.length).toBe(keys.length);
    expect(new Set(order)).toEqual(new Set(keys));
  });

  it("handles an empty active set without throwing", () => {
    expect(computeRunOrder([])).toEqual([]);
  });
});

describe("computeRunPlan", () => {
  it("marks an agent with no active dependencies as ready", () => {
    const plan = computeRunPlan(["performance-marketing"], new Set());
    expect(plan[0]).toMatchObject({ agentKey: "performance-marketing", status: "ready", blockedOn: [] });
  });

  it("marks an agent blocked when its active dependency hasn't run yet", () => {
    const plan = computeRunPlan(["performance-marketing", "landing-page"], new Set());
    const landingPage = plan.find((p) => p.agentKey === "landing-page")!;
    expect(landingPage.status).toBe("blocked");
    expect(landingPage.blockedOn).toContain("performance-marketing");
  });

  it("unblocks an agent once its dependency has a run", () => {
    const plan = computeRunPlan(
      ["performance-marketing", "landing-page"],
      new Set(["performance-marketing"]),
    );
    const landingPage = plan.find((p) => p.agentKey === "landing-page")!;
    expect(landingPage.status).toBe("ready");
    expect(landingPage.blockedOn).toEqual([]);
  });

  it("marks an already-run agent as done even if it could run again", () => {
    const plan = computeRunPlan(["performance-marketing"], new Set(["performance-marketing"]));
    expect(plan[0].status).toBe("done");
  });
});

describe("buildHandoffContext", () => {
  it("returns an empty string when there are no dependency runs", () => {
    expect(buildHandoffContext([])).toBe("");
  });

  it("includes the dependency agent's real output, not a placeholder", () => {
    const ctx = buildHandoffContext([{ agentName: "Performance Marketing Strategy Agent", outputMarkdown: "## Spend Verdict\nNOT READY — no tracking." }]);
    expect(ctx).toContain("Performance Marketing Strategy Agent");
    expect(ctx).toContain("NOT READY — no tracking.");
  });

  it("truncates an overly long dependency output rather than sending it unbounded", () => {
    const huge = "x".repeat(10000);
    const ctx = buildHandoffContext([{ agentName: "Some Agent", outputMarkdown: huge }]);
    expect(ctx.length).toBeLessThan(huge.length);
    expect(ctx).toContain("(truncated)");
  });
});
