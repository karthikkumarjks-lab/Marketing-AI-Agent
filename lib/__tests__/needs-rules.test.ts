import { describe, expect, it } from "vitest";
import { analyzeNeeds, type WorkspaceDNA } from "../needs-rules";

function need(dna: WorkspaceDNA, keys: string[], key: string) {
  const rec = analyzeNeeds(dna, keys).find((r) => r.agentKey === key);
  if (!rec) throw new Error(`no recommendation for ${key}`);
  return rec;
}

describe("analyzeNeeds", () => {
  it("keeps the strategic core mandatory regardless of DNA", () => {
    const keys = ["marketing-strategy", "market-research", "needs-analyzer"];
    for (const rec of analyzeNeeds({}, keys)) {
      expect(rec.status).toBe("active");
      expect(rec.tier).toBe("mandatory");
    }
  });

  it("a blank workspace gets no paid channels active", () => {
    const keys = ["google-ads", "meta-ads", "performance-marketing"];
    for (const rec of analyzeNeeds({}, keys)) {
      expect(rec.status).toBe("idle");
    }
  });

  it("an organic-led objective keeps paid channels idle even with budget", () => {
    const dna: WorkspaceDNA = { objective: "grow organic SEO traffic", monthlyBudget: 500000, currency: "INR" };
    expect(need(dna, ["performance-marketing"], "performance-marketing").status).toBe("idle");
    expect(need(dna, ["content-strategy"], "content-strategy").status).toBe("active");
  });

  it("a viable paid budget with a paid-shaped objective activates performance marketing", () => {
    const dna: WorkspaceDNA = { objective: "increase qualified sign-ups", monthlyBudget: 500000, currency: "INR" };
    expect(need(dna, ["performance-marketing"], "performance-marketing").status).toBe("active");
  });

  it("a SaaS/app signal activates customer-health-score and push/in-app notifications", () => {
    const dna: WorkspaceDNA = { industry: "B2B SaaS platform" };
    const keys = ["customer-health-score", "push-notification", "in-app-notification"];
    for (const rec of analyzeNeeds(dna, keys)) {
      expect(rec.status).toBe("active");
    }
  });

  it("no active channels leaves customer-health-score idle with a reactivation trigger", () => {
    const rec = need({ industry: "boutique retail store" }, ["customer-health-score"], "customer-health-score");
    expect(rec.status).toBe("idle");
    expect(rec.reactivationTrigger).toBeTruthy();
  });

  it("every idle recommendation carries a reactivationTrigger and every active one does not", () => {
    const keys = ["google-ads", "marketing-strategy", "customer-health-score", "referral-loyalty"];
    for (const rec of analyzeNeeds({}, keys)) {
      if (rec.status === "idle") expect(rec.reactivationTrigger).toBeTruthy();
      else expect(rec.reactivationTrigger).toBeUndefined();
    }
  });

  it("an unrecognized agent key is not silently treated as a real recommendation", () => {
    const rec = need({}, ["totally-unknown-agent"], "totally-unknown-agent");
    expect(rec.reason).toBe("Not relevant to the current objective and stage.");
  });
});
