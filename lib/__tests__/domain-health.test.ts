import { describe, expect, it } from "vitest";
import { computeHealthScore, buildBlacklistCheckLink } from "../domain-health";

describe("computeHealthScore", () => {
  it("scores a fully healthy domain near the top", () => {
    const result = computeHealthScore({
      domainExists: true,
      websiteReachable: true,
      hasHttps: true,
      sslValid: true,
      sslDaysUntilExpiry: 60,
      spfPresent: true,
      dmarcPresent: true,
      mobileResponsive: true,
      domainAgeYears: 5,
    });
    expect(result.score).toBe(result.maxScore);
  });

  it("scores a non-existent domain at or near zero", () => {
    const result = computeHealthScore({
      domainExists: false,
      websiteReachable: false,
      hasHttps: false,
      sslValid: null,
      sslDaysUntilExpiry: null,
      spfPresent: false,
      dmarcPresent: false,
      mobileResponsive: null,
      domainAgeYears: null,
    });
    // Domain age is scored neutrally (5/10) when unknown, not zero — every
    // other factor should be zero for a domain that doesn't resolve at all.
    expect(result.score).toBeLessThan(10);
  });

  it("docks partial points for an SSL cert expiring soon rather than treating it as fully invalid", () => {
    const healthy = computeHealthScore({
      domainExists: true,
      websiteReachable: true,
      hasHttps: true,
      sslValid: true,
      sslDaysUntilExpiry: 90,
      spfPresent: true,
      dmarcPresent: true,
      mobileResponsive: true,
      domainAgeYears: 5,
    });
    const expiringSoon = computeHealthScore({
      domainExists: true,
      websiteReachable: true,
      hasHttps: true,
      sslValid: true,
      sslDaysUntilExpiry: 10,
      spfPresent: true,
      dmarcPresent: true,
      mobileResponsive: true,
      domainAgeYears: 5,
    });
    expect(expiringSoon.score).toBeLessThan(healthy.score);
    expect(expiringSoon.score).toBeGreaterThan(0);
  });

  it("every factor's points never exceed its own maxPoints", () => {
    const result = computeHealthScore({
      domainExists: true,
      websiteReachable: true,
      hasHttps: true,
      sslValid: true,
      sslDaysUntilExpiry: 400,
      spfPresent: true,
      dmarcPresent: true,
      mobileResponsive: true,
      domainAgeYears: 50,
    });
    for (const factor of result.factors) {
      expect(factor.points).toBeLessThanOrEqual(factor.maxPoints);
    }
  });
});

describe("buildBlacklistCheckLink", () => {
  it("builds a real MXToolbox URL with the domain encoded", () => {
    const link = buildBlacklistCheckLink("example.com");
    expect(link).toContain("mxtoolbox.com");
    expect(link).toContain("example.com");
  });
});
