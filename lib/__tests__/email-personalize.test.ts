import { describe, expect, it } from "vitest";
import { personalizeEmailHtml } from "../email-personalize";

const baseLead = { name: "Priya Nair", email: "priya@example.com", company: "Acme Co", customFields: "{}" };

describe("personalizeEmailHtml", () => {
  it("substitutes {{lead.name}}, {{lead.email}}, {{lead.company}}", () => {
    const html = "<p>Hi {{lead.name}}, from {{lead.company}} ({{lead.email}})</p>";
    expect(personalizeEmailHtml(html, baseLead)).toBe("<p>Hi Priya Nair, from Acme Co (priya@example.com)</p>");
  });

  it("substitutes a set customFields merge tag", () => {
    const lead = { ...baseLead, customFields: JSON.stringify({ industry: "Real estate" }) };
    expect(personalizeEmailHtml("<p>{{lead.customFields.industry}}</p>", lead)).toBe("<p>Real estate</p>");
  });

  it("leaves an unset customFields merge tag as-is rather than blanking it", () => {
    const html = "<p>{{lead.customFields.missingKey}}</p>";
    expect(personalizeEmailHtml(html, baseLead)).toBe(html);
  });

  it("swaps a dynamic image's src when the lead has a value for that field", () => {
    const lead = { ...baseLead, customFields: JSON.stringify({ bannerImageUrl: "https://example.com/priya-banner.jpg" }) };
    const html = '<img src="https://example.com/default.jpg" data-dynamic-field="bannerImageUrl" alt="Banner">';
    expect(personalizeEmailHtml(html, lead)).toBe(
      '<img src="https://example.com/priya-banner.jpg" data-dynamic-field="bannerImageUrl" alt="Banner">',
    );
  });

  it("keeps the fallback image untouched when the lead has no value for that field", () => {
    const html = '<img src="https://example.com/default.jpg" data-dynamic-field="bannerImageUrl" alt="Banner">';
    expect(personalizeEmailHtml(html, baseLead)).toBe(html);
  });
});
