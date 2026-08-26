import { describe, expect, it } from "vitest";
import { checkChatbot, checkPhone, checkSocial } from "../domain-scan";

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

  it("detects a NopaperForms chatbot (real online.christuniversity.in markup)", () => {
    // Found via user report: this scanner said "not detected" on a real site
    // that clearly has a chatbot. NopaperForms (a common Indian higher-ed
    // admissions CRM) serves its chatbot from a `chatbot.` subdomain,
    // distinct from the `widgets.` subdomain it uses for ordinary lead forms.
    const html = `<script src="https://chatbot.in6.nopaperforms.com/en-gb/backend/bots/niaachtbtscpt.js/abc/def"></script>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(true);
    expect(result.providers).toContain("NopaperForms Chatbot");
  });

  it("does not false-positive on a NopaperForms LEAD FORM with no chatbot present", () => {
    // Regression guard for the needle chosen above: a site can use
    // NopaperForms purely for enquiry/lead-capture forms (the `widgets.`
    // subdomain) with no chatbot at all — must not match that case.
    const html = `<script src="https://widgets.in6.nopaperforms.com/js/widget/npfwpopup.js"></script>`;
    expect(checkChatbot(html).detected).toBe(false);
  });

  it("detects a Vachak.ai voice widget (real online.christuniversity.in markup)", () => {
    const html = `<script>(function(w,d,s,o,f,js){})(window,document,'script','vw','https://vachak.ai/widget/embed.js'); vw('init','wgt_abc');</script>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(true);
    expect(result.providers).toContain("Vachak.ai Voice Widget");
  });

  it("detects the full api.whatsapp.com/send URL, not just the wa.me short link (real amityonline.com markup)", () => {
    // Found via user report: this scanner only recognized "wa.me/" and
    // missed the equally common full-URL form of the same click-to-chat
    // button.
    const html = `<a href="https://api.whatsapp.com/send/?phone=919818795446&text=Hi">Chat</a>`;
    const result = checkChatbot(html);
    expect(result.detected).toBe(true);
    expect(result.providers).toContain("WhatsApp Click-to-Chat");
  });
});

describe("checkSocial", () => {
  it("detects a LinkedIn /school/ page for an educational institution (real amityonline.com markup)", () => {
    // Found via user report: this scanner only recognized /company/, /in/,
    // /showcase/ — missing LinkedIn's distinct URL segment for schools and
    // universities.
    const html = `<a href="https://www.linkedin.com/school/amityonline">LinkedIn</a>`;
    const result = checkSocial(html);
    expect(result.some((s) => s.platform === "LinkedIn")).toBe(true);
  });

  it("detects a bare legacy YouTube vanity URL with no /channel/, /c/, or /@ prefix (real amityonline.com markup)", () => {
    const html = `<a href="https://www.youtube.com/amityuniversityonline">YouTube</a>`;
    const result = checkSocial(html);
    expect(result.some((s) => s.platform === "YouTube")).toBe(true);
  });

  it("still detects the modern YouTube @handle format", () => {
    const html = `<a href="https://www.youtube.com/@somechannel">YouTube</a>`;
    const result = checkSocial(html);
    expect(result.some((s) => s.platform === "YouTube")).toBe(true);
  });

  it("does not mistake an embedded YouTube video link for a channel link", () => {
    // Regression guard for the bare-vanity-URL branch: a page can legitimately
    // link to a specific video (watch/embed/playlist) without that being the
    // channel's own page.
    const html = `<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Video</a>`;
    const result = checkSocial(html);
    expect(result.some((s) => s.platform === "YouTube")).toBe(false);
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
