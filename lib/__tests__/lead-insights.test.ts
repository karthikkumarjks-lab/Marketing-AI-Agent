import { describe, expect, it } from "vitest";
import { matchColumn, detectOutcomeColumn, classifyOutcomeValues, analyzeUploadedLeads, type ParsedLeadSheet } from "../lead-insights";

describe("matchColumn", () => {
  it("matches the real LeadSquared-style header variants", () => {
    const headers = ["First Name", "Email", "Mobile", "MUJ Lead Source", "Company"];
    expect(matchColumn(headers, "email")).toBe("Email");
    expect(matchColumn(headers, "phone")).toBe("Mobile");
    expect(matchColumn(headers, "source")).toBe("MUJ Lead Source");
    expect(matchColumn(headers, "name")).toBe("First Name");
    expect(matchColumn(headers, "company")).toBe("Company");
  });

  it("returns null when nothing plausible is present", () => {
    expect(matchColumn(["Roll Number", "Marks"], "email")).toBeNull();
  });
});

describe("detectOutcomeColumn", () => {
  it("picks a real fee-paid column over a weaker free-text stage column when both exist", () => {
    const headers = ["Lead Stage", "MUJ Application Fee Paid", "Email"];
    expect(detectOutcomeColumn(headers)).toBe("MUJ Application Fee Paid");
  });

  it("falls back to Lead Stage when nothing stronger is present", () => {
    expect(detectOutcomeColumn(["Email", "Lead Stage"])).toBe("Lead Stage");
  });

  it("returns null when no known outcome column exists at all", () => {
    expect(detectOutcomeColumn(["Email", "Phone", "City"])).toBeNull();
  });
});

describe("classifyOutcomeValues", () => {
  it("classifies real free-text lead-stage values by keyword, never guessing an unfamiliar vocabulary", () => {
    const converted = classifyOutcomeValues(["New", "Contacted", "Application Submitted", "Enrolled", "Junk", "Not Interested", "Payment Pending"]);
    expect(converted.has("Application Submitted")).toBe(true);
    expect(converted.has("Enrolled")).toBe(true);
    expect(converted.has("New")).toBe(false);
    expect(converted.has("Junk")).toBe(false);
    expect(converted.has("Payment Pending")).toBe(false); // "pending" overrides the loose "paid" hint — not actually converted yet
  });
});

function sheet(headers: string[], rows: Record<string, string>[]): ParsedLeadSheet {
  return { headers, rows, truncated: false };
}

describe("analyzeUploadedLeads (file-native, no DB / no CRM required)", () => {
  const headers = ["Email", "Mobile", "MUJ Lead Source", "Application Status"];

  // 6 "Referral" rows (5 converted) and 6 "Cold Call" rows (1 converted) —
  // enough per-source sample (>=5) to trust a real rate, with a clear gap.
  function realisticRows(): Record<string, string>[] {
    const referral = Array.from({ length: 6 }, (_, i) => ({
      Email: `ref${i}@x.com`,
      Mobile: i < 4 ? "9000000000" : "",
      "MUJ Lead Source": "Referral",
      "Application Status": i < 5 ? "Application Fee Paid" : "Not Submitted",
    }));
    const coldCall = Array.from({ length: 6 }, (_, i) => ({
      Email: `cold${i}@x.com`,
      Mobile: "",
      "MUJ Lead Source": "Cold Call",
      "Application Status": i < 1 ? "Application Fee Paid" : "Not Submitted",
    }));
    return [...referral, ...coldCall];
  }

  it("auto-detects the outcome column and splits converted vs not from real values in the file", () => {
    const result = analyzeUploadedLeads(sheet(headers, realisticRows()));
    expect(result.outcomeColumn).toBe("Application Status");
    expect(result.alreadyConvertedCount).toBe(6); // 5 referral + 1 cold call
    expect(result.baselineConversionRatePct).toBe(50); // 6 of 12
  });

  it("flags a not-yet-converted lead from a high-converting source as high-potential with a real cited rate", () => {
    const result = analyzeUploadedLeads(sheet(headers, realisticRows()));
    const flaggedEmails = result.topHighPotential.map((r) => r.email);
    expect(flaggedEmails).toContain("ref5@x.com"); // the one un-converted Referral row
    const row = result.topHighPotential.find((r) => r.email === "ref5@x.com")!;
    expect(row.reasons[0]).toContain("83%"); // 5 of 6 referrals converted
  });

  it("flags a not-yet-converted lead from a low-converting source as needs-more-data, not high-potential", () => {
    const result = analyzeUploadedLeads(sheet(headers, realisticRows()));
    expect(result.topHighPotential.map((r) => r.email)).not.toContain("cold1@x.com");
    expect(result.needsMoreDataCount).toBeGreaterThan(0);
  });

  it("computes a real data-completeness gap between converted and all rows", () => {
    const result = analyzeUploadedLeads(sheet(headers, realisticRows()));
    const phoneGap = result.dataGaps.find((g) => g.field === "phone");
    // 4/12 rows overall have a phone (33%); 4 of the 6 converted rows have one (67%)
    expect(phoneGap?.uploadedFillRatePct).toBe(33);
    expect(phoneGap?.convertedFillRatePct).toBe(67);
  });

  it("never fabricates a score when the upload is too small to compute a real pattern", () => {
    const tiny = sheet(headers, [{ Email: "a@x.com", Mobile: "", "MUJ Lead Source": "Referral", "Application Status": "Not Submitted" }]);
    const result = analyzeUploadedLeads(tiny);
    expect(result.hasEnoughData).toBe(false);
    expect(result.unscoredCount).toBe(1);
    expect(result.highPotentialCount).toBe(0);
  });

  it("reports every row as unscored, not silently empty, when no outcome column exists at all", () => {
    const result = analyzeUploadedLeads(sheet(["Email", "Mobile"], [{ Email: "a@x.com", Mobile: "1" }]));
    expect(result.outcomeColumn).toBeNull();
    expect(result.unscoredCount).toBe(1);
  });
});
