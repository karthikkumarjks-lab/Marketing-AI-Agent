import { describe, expect, it } from "vitest";
import { extractConversionSignals, scoreConversionReadiness } from "../conversion-signals";

describe("extractConversionSignals", () => {
  it("extracts title, meta, H1, CTAs, forms, and trust signals from real-shaped markup", () => {
    const html = `
      <html><head>
        <title>Online MBA — Example University</title>
        <meta name="description" content="Get an accredited online MBA.">
      </head><body>
        <h1>Advance Your Career With an Online MBA</h1>
        <a href="/apply">Apply Now</a>
        <a href="/brochure">Download Brochure</a>
        <a href="/about">About Us</a>
        <form id="enquiry"><input name="phone"/></form>
        <p>UGC-accredited program, ranked among the top NIRF institutions. Read student testimonials.</p>
      </body></html>`;
    const s = extractConversionSignals(html);
    expect(s.title).toBe("Online MBA — Example University");
    expect(s.metaDescription).toBe("Get an accredited online MBA.");
    expect(s.h1).toBe("Advance Your Career With an Online MBA");
    expect(s.ctaCount).toBe(2); // "Apply Now" and "Download Brochure" — not "About Us"
    expect(s.formCount).toBe(1);
    expect(s.trustSignalHits).toEqual(expect.arrayContaining(["ugc", "ranked", "nirf", "testimonial"]));
  });

  it("returns honest zeros/nulls on a bare page with no conversion signals", () => {
    const s = extractConversionSignals("<html><body><p>Coming soon.</p></body></html>");
    expect(s.title).toBeNull();
    expect(s.ctaCount).toBe(0);
    expect(s.formCount).toBe(0);
    expect(s.trustSignalHits).toEqual([]);
  });
});

describe("scoreConversionReadiness", () => {
  it("scores a fully-equipped page near the top and explains every point", () => {
    const s = extractConversionSignals(`
      <html><body>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <title>Test</title>
        <a href="tel:+911234567890">Call</a>
        <script src="https://widget.intercom.io/widget/abc"></script>
        <a href="/enroll">Enroll Now</a>
        <a href="/apply">Apply</a>
        <a href="/talk">Talk to an advisor</a>
        <form><input/></form>
        <p>Accredited, ranked, trusted by thousands. See our reviews and awards.</p>
      </body></html>`);
    const { score, breakdown } = scoreConversionReadiness(s, 1200);
    expect(score).toBeGreaterThan(80);
    // Every point awarded must trace to a real, named signal — the whole
    // point of this score is that it's arguable, not a black box.
    for (const b of breakdown) expect(b.points).toBeLessThanOrEqual(b.max);
  });

  it("scores an empty page at zero", () => {
    const s = extractConversionSignals("<html><body></body></html>");
    const { score } = scoreConversionReadiness(s, null);
    expect(score).toBe(0);
  });
});
