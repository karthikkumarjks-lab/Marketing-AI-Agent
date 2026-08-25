import { describe, expect, it } from "vitest";
import { checkChatbot, checkPhone } from "../domain-scan";

describe("checkChatbot", () => {
  it("detects a known vendor script", () => {
    const html = `<script src="https://widget.intercom.io/widget/abc123"></script>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(true);
    expect(result.providers).toContain("Intercom");
  });

  it("detects a custom AI assistant via its aria-label (real onlinejain.com markup)", () => {
    const html = `<form role="search" aria-label="Ask Sensei"><input type="search" aria-label="Ask Sensei anything"/></form>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(true);
    expect(result.providers[0]).toContain("heuristic");
  });

  it("does not false-positive on ordinary marketing copy mentioning chat/AI assistant by name", () => {
    // Regression test: an earlier, broader version of the heuristic matched
    // free-text phrases like "chatbot" or "AI assistant" anywhere on the
    // page, which fired on stripe.com, hubspot.com, and intercom.com's real
    // homepages even though none of them have that widget on the scanned
    // page — companies that sell or discuss chat products mention the words
    // constantly in prose. Only an aria-label (a UI description, not prose)
    // should count.
    const html = `<p>Our new AI assistant helps you deploy a chatbot in minutes. Try live chat today!</p>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(false);
  });

  it("reports not detected when nothing matches", () => {
    const html = `<html><body><h1>Hello</h1></body></html>`;
    expect(checkChatbot(html)).toEqual({ detected: false, providers: [] });
  });
});

describe("checkPhone", () => {
  it("extracts a tel: link as the high-confidence source", () => {
    const html = `<a href="tel:+919900017097" aria-label="Call +91 99000 17097">Call</a>`;
    const result = checkPhone(html);
    expect(result.source).toBe("tel-link");
    expect(result.numbers).toContain("+919900017097");
  });

  it("does not mistake inline SVG path data for a phone number", () => {
    // Regression test: SVG icon path coordinates ("5.6409 7.6037Zm-.959...")
    // are dense digit-and-dot runs that satisfied the old loose fallback
    // regex — found by testing against the real stripe.com homepage.
    const html = `<svg><path d="M5.6409 7.6037Zm-.959-11.35573c-.9453 0-1.5376.34559-1.9669.81586l.0245 6.11967c.3997.433.9763.7813"></path></svg>`;
    const result = checkPhone(html);
    expect(result.numbers).toEqual([]);
    expect(result.source).toBe("none");
  });

  it("falls back to page text only when no tel: link exists", () => {
    const html = `<p>Call us at 022-4567-8901 for support.</p>`;
    const result = checkPhone(html);
    expect(result.source).toBe("page-text");
    expect(result.numbers.length).toBeGreaterThan(0);
  });
});
