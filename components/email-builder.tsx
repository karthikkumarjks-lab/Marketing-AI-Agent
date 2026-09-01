"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Component, Editor } from "grapesjs";
import "grapesjs/dist/css/grapes.min.css";
import ImageEditorModal from "./image-editor-modal";

// A real drag-and-drop email builder — GrapesJS + its newsletter preset,
// not a hand-rolled canvas. That preset ships table-based blocks (1/2/3
// column layouts, button, image, divider, text) proven to render correctly
// across email clients, which is the actual hard problem here, not
// something a few lines of custom drag-drop code would solve better.
// Runs client-only (the page loads this via next/dynamic ssr:false) —
// GrapesJS touches the DOM directly at init time.

const AMP_BOILERPLATE = `<!doctype html>
<html ⚡4email data-css-strict>
<head>
  <meta charset="utf-8">
  <script async src="https://cdn.ampproject.org/v0.js"></script>
  <style amp4email-boilerplate>body{visibility:hidden}</style>
  <style amp-custom>
    body { font-family: -apple-system, sans-serif; color: #14181c; }
    .btn { display: inline-block; background: #2f6fed; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; }
  </style>
</head>
<body>
  <!-- AMP4EMAIL requires amp-* components in place of plain HTML for anything
       interactive (amp-selector, amp-list, amp-form, etc.) — plain <button>/
       <input> are not valid here. Start from this shell and add amp-*
       components as needed; validate at https://amp.dev/documentation/guides-and-tutorials/email/design-emails/ -->
  <h1>Interactive AMP version</h1>
  <p>This only renders in AMP-aware inboxes that support it — see the note below the editor for what that actually requires.</p>
</body>
</html>`;

// Real amp-form/amp-selector/amp-carousel markup — the actual components on
// Gmail's AMP4EMAIL allow-list, the same mechanism templates like Mailmodo's
// survey/poll/RSVP/carousel examples are built from. "Live" gamification
// (spin-to-win, scratch cards) needs bespoke per-brand AMP+CSS work beyond a
// generic snippet and isn't included here. There is no native ticking-clock
// AMP component on Gmail's allow-list — every ESP's "live countdown" is
// actually a server-generated image that's stale the moment the recipient
// re-opens the email, which needs its own hosted image-generation service
// this app doesn't have; the Countdown block below is an honest static
// urgency banner instead, and lives in the regular block panel since it
// needs no AMP at all.
const AMP_SNIPPETS = {
  survey: `<form method="post" action-xhr="https://your-form-endpoint.example/submit" target="_top">
  <p>How likely are you to recommend us to a friend?</p>
  <amp-selector layout="container" name="nps">
    <div role="button" tabindex="0" option="0">0</div>
    <div role="button" tabindex="0" option="5">5</div>
    <div role="button" tabindex="0" option="10">10</div>
  </amp-selector>
  <input type="submit" value="Submit" class="btn">
  <div submit-success><template type="amp-mustache">Thanks for the feedback!</template></div>
  <div submit-error><template type="amp-mustache">Something went wrong — try again.</template></div>
</form>`,
  rating: `<form method="post" action-xhr="https://your-form-endpoint.example/submit" target="_top">
  <p>Rate your experience</p>
  <amp-selector layout="container" name="rating">
    <div role="button" tabindex="0" option="1">★</div>
    <div role="button" tabindex="0" option="2">★★</div>
    <div role="button" tabindex="0" option="3">★★★</div>
    <div role="button" tabindex="0" option="4">★★★★</div>
    <div role="button" tabindex="0" option="5">★★★★★</div>
  </amp-selector>
  <input type="submit" value="Submit rating" class="btn">
  <div submit-success><template type="amp-mustache">Thanks!</template></div>
</form>`,
  rsvp: `<form method="post" action-xhr="https://your-form-endpoint.example/rsvp" target="_top">
  <p>Will you be attending?</p>
  <amp-selector layout="container" name="rsvp">
    <div role="button" tabindex="0" option="yes">Yes, I'll be there</div>
    <div role="button" tabindex="0" option="no">Can't make it</div>
  </amp-selector>
  <input type="submit" value="RSVP" class="btn">
  <div submit-success><template type="amp-mustache">RSVP received — see you soon!</template></div>
</form>`,
  carousel: `<amp-carousel width="400" height="300" layout="responsive" type="slides">
  <amp-img src="https://your-image-host.example/slide-1.jpg" width="400" height="300" layout="responsive" alt="Slide 1"></amp-img>
  <amp-img src="https://your-image-host.example/slide-2.jpg" width="400" height="300" layout="responsive" alt="Slide 2"></amp-img>
  <amp-img src="https://your-image-host.example/slide-3.jpg" width="400" height="300" layout="responsive" alt="Slide 3"></amp-img>
</amp-carousel>`,
} as const;

const CALENDAR_BLOCK_HTML = `<table role="presentation" style="margin:12px 0"><tr>
  <td style="padding-right:8px">
    <a href="https://calendar.google.com/calendar/render?action=TEMPLATE&text=Your+Event+Title&dates=20261215T180000Z/20261215T200000Z&details=Event+details+here&location=Location+here" style="display:inline-block;background:#2f6fed;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px">+ Add to Google Calendar</a>
  </td>
  <td>
    <a href="data:text/calendar;charset=utf8,BEGIN%3AVCALENDAR%0AVERSION%3A2.0%0ABEGIN%3AVEVENT%0ASUMMARY%3AYour%20Event%20Title%0ADTSTART%3A20261215T180000Z%0ADTEND%3A20261215T200000Z%0ADESCRIPTION%3AEvent%20details%20here%0ALOCATION%3ALocation%20here%0AEND%3AVEVENT%0AEND%3AVCALENDAR" download="event.ics" style="display:inline-block;border:1px solid #ccc;color:#333;padding:10px 18px;border-radius:6px;text-decoration:none;font-family:sans-serif;font-size:14px">Download .ics (Outlook/Apple)</a>
  </td>
</tr></table>`;

const URGENCY_BANNER_HTML = `<table role="presentation" style="width:100%;background:#fff4e5;border:1px solid #f5a623;border-radius:6px;margin:12px 0"><tr><td style="padding:12px 16px;text-align:center;font-family:sans-serif">
  <strong style="color:#c9720a">Offer ends Friday, Dec 15 at 11:59 PM</strong>
  <div style="font-size:12px;color:#8a6d3b;margin-top:4px">Edit this date directly — there's no email technology (AMP included) that reliably ticks a live clock down for every recipient; a real live countdown needs a third-party countdown-image service (e.g. Sendtric, CountdownMail) generating a fresh image per open, which this app doesn't integrate.</div>
</td></tr></table>`;

// A genuinely animated clock, distinct from the static banner above —
// real CSS @keyframes rotating the hands, not a fake claim of motion.
// Two honest limits, stated in the block itself rather than discovered
// later: (1) it's decorative perpetual motion, not synced to the
// recipient's real time or a real deadline — CSS can't read a clock; (2)
// Outlook desktop (Word rendering engine) does not run CSS animations at
// all, so it always shows the hands frozen at their start position there
// — every other major client (Apple/iOS Mail, Gmail, Yahoo, most webmail)
// does animate it. Kept as a real <style> block on export (see
// getFinalHtml's preserveKeyFrames) rather than inlined away, since an
// inlined animation is not a valid CSS declaration.
const TICKING_CLOCK_HTML = `<style>
@keyframes email-clock-hour { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
@keyframes email-clock-minute { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
</style>
<table role="presentation" style="width:100%;margin:16px 0"><tr><td style="text-align:center;font-family:sans-serif">
  <div style="width:80px;height:80px;border:4px solid #2f6fed;border-radius:50%;margin:0 auto;position:relative;background:#fff">
    <div style="position:absolute;left:50%;top:50%;width:2px;height:22px;background:#14181c;transform-origin:bottom center;margin-left:-1px;margin-top:-22px;animation:email-clock-hour 12s linear infinite"></div>
    <div style="position:absolute;left:50%;top:50%;width:2px;height:30px;background:#2f6fed;transform-origin:bottom center;margin-left:-1px;margin-top:-30px;animation:email-clock-minute 3s linear infinite"></div>
  </div>
  <div style="font-size:14px;color:#14181c;margin-top:10px;font-weight:600">Don't miss out</div>
  <div style="font-size:11px;color:#8a9089;margin-top:4px;max-width:320px;margin-left:auto;margin-right:auto">
    Decorative motion, not a synced real-time clock (no email technology can read the actual time). Animates in
    Apple/iOS Mail, Gmail, Yahoo, and most webmail — Outlook desktop shows the hands frozen since it doesn't run
    CSS animations at all.
  </div>
</td></tr></table>`;

// A plain (non-AMP) forms block. Regular HTML email can't actually submit a
// form in-inbox — Gmail/Outlook/Apple Mail all strip real <form>/<input>
// interactivity out of ordinary HTML email; only AMP4EMAIL's amp-form
// genuinely submits without leaving the inbox (see the AMP snippet library
// below). So this is styled as a form but works as a real link out to an
// external form (Google Forms, Typeform, or a landing page this app builds
// later) — the actual universal-compatibility technique, not a
// non-functional decoration pretending otherwise.
const FORM_LINK_BLOCK_HTML = `<table role="presentation" style="width:100%;background:#f5f7fb;border:1px solid #d7dce5;border-radius:6px;margin:12px 0"><tr><td style="padding:20px;text-align:center;font-family:sans-serif">
  <div style="font-weight:600;color:#14181c;margin-bottom:6px">Quick question for you</div>
  <div style="font-size:13px;color:#545c57;margin-bottom:14px">Takes less than a minute.</div>
  <a href="https://forms.google.com/your-form-here" style="display:inline-block;background:#2f6fed;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:14px;font-weight:600">Open the form</a>
  <div style="font-size:11px;color:#8a9089;margin-top:10px">Opens in your browser — regular email can't run a real embedded form without AMP (see the AMP snippets below for one that can).</div>
</td></tr></table>`;

export interface EmailTemplateData {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  designJson: string;
  isAmpEnabled: boolean;
  ampBody: string | null;
}

export default function EmailBuilder({
  workspaceId,
  template,
}: {
  workspaceId: string;
  template: EmailTemplateData | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<Editor | null>(null);

  const [name, setName] = useState(template?.name ?? "");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [ampEnabled, setAmpEnabled] = useState(template?.isAmpEnabled ?? false);
  const [ampBody, setAmpBody] = useState(template?.ampBody ?? AMP_BOILERPLATE);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<Component | null>(null);
  const [imageEditorOpen, setImageEditorOpen] = useState(false);
  const [ampSnippet, setAmpSnippet] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ default: grapesjs }, { default: presetNewsletter }] = await Promise.all([
        import("grapesjs"),
        import("grapesjs-preset-newsletter"),
      ]);
      if (cancelled || !canvasRef.current) return;

      const editor = grapesjs.init({
        container: canvasRef.current,
        height: "600px",
        width: "100%",
        fromElement: false,
        storageManager: false,
        plugins: [presetNewsletter],
      });

      // Two extra blocks the newsletter preset doesn't ship: a real
      // add-to-calendar link pair (plain HTML, works in every client, no
      // AMP needed) and an honest static urgency banner in place of a
      // "live countdown" no email technology actually delivers reliably.
      editor.BlockManager.add("calendar-block", {
        label: "Add to Calendar",
        category: "Extra",
        content: CALENDAR_BLOCK_HTML,
      });
      editor.BlockManager.add("countdown-block", {
        label: "Countdown Timer / Urgency Banner",
        category: "Extra",
        content: URGENCY_BANNER_HTML,
      });
      editor.BlockManager.add("ticking-clock-block", {
        label: "Ticking Clock (animated)",
        category: "Extra",
        content: TICKING_CLOCK_HTML,
      });
      editor.BlockManager.add("form-link-block", {
        label: "Form (links out)",
        category: "Extra",
        content: FORM_LINK_BLOCK_HTML,
      });

      editor.on("component:selected", (component: Component) => {
        setSelectedImage(component.get("type") === "image" ? component : null);
      });
      editor.on("component:deselected", () => setSelectedImage(null));

      if (template?.designJson && template.designJson !== "{}") {
        try {
          editor.loadProjectData(JSON.parse(template.designJson));
        } catch {
          // Corrupt/old project data — fall back to the empty canvas rather than crashing the page.
        }
      }

      editorRef.current = editor;
    })();
    return () => {
      cancelled = true;
      editorRef.current?.destroy();
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function getFinalHtml(): Promise<string> {
    const editor = editorRef.current;
    if (!editor) return "";
    // Email clients strip/ignore <style> blocks unreliably — inline every
    // rule onto its element instead, the same juice library the newsletter
    // preset itself already depends on for exactly this reason. Keyframes
    // and media queries can't be inlined onto an element (they're not
    // per-element rules), so those stay in a <style> block juice preserves
    // — that's what lets the Ticking Clock block's animation survive.
    const html = editor.getHtml();
    const css = editor.getCss() ?? "";
    const { default: juice } = await import("juice");
    return juice.inlineContent(html, css, { preserveKeyFrames: true, preserveMediaQueries: true, removeStyleTags: false });
  }

  async function handleSave() {
    if (!name.trim() || !subject.trim()) {
      setError("Name and subject are both required.");
      return;
    }
    const editor = editorRef.current;
    if (!editor) return;
    setPending(true);
    setError(null);
    setSaved(false);

    const body = {
      name,
      subject,
      htmlBody: await getFinalHtml(),
      designJson: JSON.stringify(editor.getProjectData()),
      isAmpEnabled: ampEnabled,
      ampBody: ampEnabled ? ampBody : null,
    };

    const url = template ? `/api/workspaces/${workspaceId}/email-templates/${template.id}` : `/api/workspaces/${workspaceId}/email-templates`;
    const res = await fetch(url, {
      method: template ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setPending(false);
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      setError(errBody.error || "Could not save template.");
      return;
    }
    setSaved(true);
    if (!template) {
      const created = await res.json();
      router.replace(`/workspaces/${workspaceId}/crm/emails/${created.id}`);
    } else {
      router.refresh();
    }
  }

  async function handleTestSend() {
    if (!template) {
      setTestStatus("Save the template first, then send a test.");
      return;
    }
    if (!testTo.trim()) {
      setTestStatus("Enter an email address to send the test to.");
      return;
    }
    setTestStatus("Sending…");
    const res = await fetch(`/api/workspaces/${workspaceId}/email-templates/${template.id}/test-send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ to: testTo }),
    });
    const body = await res.json().catch(() => ({}));
    setTestStatus(res.ok ? `Sent to ${testTo}.` : `Failed: ${body.error ?? "unknown error"}`);
  }

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Template name (internal, e.g. Welcome — new leads)"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject line"
          className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
        />
      </div>

      {selectedImage && (
        <div className="mt-2 flex items-center gap-2 bg-accent-soft border border-accent/30 rounded-md px-3 py-2 text-xs text-accent-ink">
          <span>Image selected.</span>
          <button onClick={() => setImageEditorOpen(true)} className="underline hover:no-underline font-medium">
            Crop / rotate / apply effects
          </button>
        </div>
      )}
      <div ref={canvasRef} className="border border-line rounded-lg overflow-hidden mt-2" />

      <div className="mt-4 bg-surface border border-line rounded-lg p-4">
        <label className="flex items-center gap-2 text-sm text-ink cursor-pointer">
          <input type="checkbox" checked={ampEnabled} onChange={(e) => setAmpEnabled(e.target.checked)} className="accent-accent" />
          Include an AMP for Email version
        </label>
        <p className="text-xs text-ink-faint mt-1.5 leading-relaxed max-w-2xl">
          AMP lets an email include live, interactive content (e.g. an in-inbox form) instead of just linking out.
          Two real limits worth knowing before relying on it: your sending domain has to be registered and approved
          by Google before Gmail renders the AMP version at all (regular HTML always sends too, as the required
          fallback — nothing here is AMP-only), and Resend — the account this app sends through — doesn&apos;t
          support transmitting an AMP payload yet. This editor still lets you build and export valid AMP4EMAIL
          markup for a provider that does (SendGrid, Braze, SparkPost) or to validate independently. Full
          gamification (spin-to-win, scratch cards) needs bespoke per-brand work beyond what a generic snippet can
          give you, so it isn&apos;t included below.
        </p>
        {ampEnabled && (
          <>
            <div className="flex items-center gap-2 mt-3">
              <select
                value={ampSnippet}
                onChange={(e) => {
                  const key = e.target.value as keyof typeof AMP_SNIPPETS | "";
                  if (key) setAmpBody((prev) => `${prev}\n\n${AMP_SNIPPETS[key]}`);
                  setAmpSnippet("");
                }}
                className="rounded-md border border-line bg-bg px-2 py-1.5 text-xs text-ink"
              >
                <option value="">Insert a real AMP snippet…</option>
                <option value="survey">Survey (NPS-style)</option>
                <option value="rating">Star rating</option>
                <option value="rsvp">RSVP form</option>
                <option value="carousel">Image carousel</option>
              </select>
              <span className="text-[11px] text-ink-faint">Each needs its own action-xhr endpoint filled in — placeholders are marked.</span>
            </div>
            <textarea
              value={ampBody}
              onChange={(e) => setAmpBody(e.target.value)}
              rows={10}
              spellCheck={false}
              className="mt-3 w-full rounded-md border border-line bg-bg px-3 py-2 text-xs font-mono text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </>
        )}
      </div>

      {error && <p className="text-sm text-danger mt-3">{error}</p>}
      {saved && !error && <p className="text-sm text-accent mt-3">Saved.</p>}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={pending}
          className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 transition-opacity disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save template"}
        </button>

        <div className="flex items-center gap-2 ml-auto">
          <input
            type="email"
            value={testTo}
            onChange={(e) => setTestTo(e.target.value)}
            placeholder="you@example.com"
            className="rounded-md border border-line bg-surface px-2 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent/40"
          />
          <button
            onClick={handleTestSend}
            className="rounded-md border border-line text-xs px-3 py-1.5 text-ink-soft hover:bg-bg"
          >
            Send test
          </button>
          {testStatus && <span className="text-xs text-ink-faint">{testStatus}</span>}
        </div>
      </div>

      {imageEditorOpen && selectedImage && (
        <ImageEditorModal
          src={(selectedImage.get("src") as string) || (selectedImage.getAttributes().src as string) || ""}
          onClose={() => setImageEditorOpen(false)}
          onApply={(dataUri) => {
            selectedImage.set("src", dataUri);
            selectedImage.addAttributes({ src: dataUri });
            setImageEditorOpen(false);
          }}
        />
      )}
    </div>
  );
}
