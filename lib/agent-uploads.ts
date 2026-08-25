// Which agents accept a file upload alongside the normal Company DNA
// context, and what kind. Uploads are transient — parsed (or, for images,
// base64-encoded) for that one run and never persisted to disk or the
// database, matching how the rest of this app has no file storage layer.
//
// "excel" agents get real tabular data (spreadsheet/CSV) parsed into a text
// table and appended to the prompt. "screenshot" agents get an image passed
// to the model as actual visual input — minimax/minimax-m3:free (the
// default model in lib/agent-prompts.ts) supports image input, confirmed
// against OpenRouter's live model list before this was built, so this is a
// real capability, not a text-description workaround.

export type UploadType = "excel" | "screenshot";

export const EXCEL_UPLOAD_AGENTS = new Set([
  "marketing-analytics",
  "customer-segmentation",
  "revenue-intelligence",
  "pipeline-intelligence",
  "sales-forecasting",
  "cohort-funnel-intelligence",
  "marketing-score",
  "crm-data-migration-cleanup",
  "lead-scoring-qualification",
  "churn-prediction",
  "attribution",
]);

export const SCREENSHOT_UPLOAD_AGENTS = new Set([
  "cro",
  "creative-qa",
  "digital-experience-ux",
  "website-strategy",
  "brand-identity-logo",
  "design",
  "competitor-ad-intelligence",
  "competitor-seo-intelligence",
  "landing-page",
  "landing-page-split-test",
]);

export function getUploadType(agentKey: string): UploadType | null {
  if (EXCEL_UPLOAD_AGENTS.has(agentKey)) return "excel";
  if (SCREENSHOT_UPLOAD_AGENTS.has(agentKey)) return "screenshot";
  return null;
}
