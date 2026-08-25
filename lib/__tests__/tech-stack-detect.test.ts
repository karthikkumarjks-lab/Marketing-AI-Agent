import { describe, expect, it } from "vitest";
import { detectTechStack } from "../tech-stack-detect";

describe("detectTechStack", () => {
  it("detects a body-based signature (WordPress)", () => {
    const html = `<link rel="stylesheet" href="/wp-content/themes/mytheme/style.css">`;
    const matches = detectTechStack(html, new Headers());
    expect(matches).toContainEqual({ category: "CMS", name: "WordPress" });
  });

  it("detects multiple independent categories on the same page", () => {
    const html = `
      <script src="https://www.googletagmanager.com/gtm.js?id=GTM-XXXX"></script>
      <script src="https://static.hotjar.com/c/hotjar.js"></script>
      <div class="/_next/static/chunk.js"></div>
    `;
    const matches = detectTechStack(html, new Headers());
    const names = matches.map((m) => m.name);
    expect(names).toContain("Google Tag Manager");
    expect(names).toContain("Hotjar");
    expect(names).toContain("Next.js");
  });

  it("detects a header-based signature (Cloudflare)", () => {
    const headers = new Headers({ server: "cloudflare" });
    const matches = detectTechStack("<html></html>", headers);
    expect(matches).toContainEqual({ category: "CDN / Hosting", name: "Cloudflare" });
  });

  it("detects a header-presence signature (Vercel) regardless of value", () => {
    const headers = new Headers({ "x-vercel-id": "abc123" });
    const matches = detectTechStack("<html></html>", headers);
    expect(matches).toContainEqual({ category: "CDN / Hosting", name: "Vercel" });
  });

  it("returns an empty array when nothing matches", () => {
    const matches = detectTechStack("<html><body>Hello</body></html>", new Headers());
    expect(matches).toEqual([]);
  });
});
