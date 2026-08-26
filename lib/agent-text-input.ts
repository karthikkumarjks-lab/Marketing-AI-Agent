// Agents that need real per-run free text pasted in — a call transcript, a
// list of closed-deal outcomes, specific deal details — that Company DNA has
// no field for. Distinct from EXCEL_UPLOAD_AGENTS/SCREENSHOT_UPLOAD_AGENTS
// (file uploads) and websiteUrlField (a single URL override): this is
// multi-line freeform text, sent as `runNote` and appended to the LLM's
// extraContext as a clearly labeled "User-Provided Input" section.

interface TextInputSpec {
  label: string;
  placeholder: string;
}

export const TEXT_INPUT_AGENTS: Record<string, TextInputSpec> = {
  "win-loss-analysis": {
    label: "Closed deal outcomes (optional, but needed for real analysis)",
    placeholder: "e.g. Lost to Competitor X — they were $2k/mo cheaper. Won vs. Competitor Y — faster onboarding sealed it.",
  },
  "sales-call-coaching": {
    label: "Call transcript (required for real coaching)",
    placeholder: "Paste the sales call transcript here…",
  },
  "sales-proposal-quote": {
    label: "Deal specifics (optional — leave blank for a reusable template)",
    placeholder: "e.g. Prospect: Acme Co. Scope: 3-seat annual plan. Timeline: wants to start next month.",
  },
  "image-generation": {
    label: "What image do you need? (optional — leave blank for a generic on-brand image)",
    placeholder: "e.g. A clean product shot of our reusable water bottle on a wooden table, soft natural light, minimalist background",
  },
};

export function getTextInputSpec(agentKey: string): TextInputSpec | null {
  return TEXT_INPUT_AGENTS[agentKey] ?? null;
}
