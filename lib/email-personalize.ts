import { parseCustomFields } from "./crm";

// Shared by the bulk-campaign send and the workflow send_email_template
// action — one real merge-tag implementation instead of the two duplicated
// inline regexes that used to only handle {{lead.name}}.

export interface PersonalizeLeadInput {
  name: string;
  email: string | null;
  company: string | null;
  customFields: string; // JSON-encoded, as stored on the Lead row
}

const MERGE_TAG_RE = /\{\{\s*lead\.([a-zA-Z0-9_.]+)\s*\}\}/g;

// A "Dynamic image" — set from the image editor's toggle, see
// components/email-builder.tsx — is an <img> carrying data-dynamic-field.
// Its plain src attribute is the always-safe fallback (the image actually
// uploaded), so a lead with no override for that field just keeps showing
// it untouched. Handled separately from the generic merge tags above
// because unlike text, an unresolved {{...}} left inside a src attribute
// would render as a broken image, not readable placeholder text.
const DYNAMIC_IMG_RE = /<img\b[^>]*\bdata-dynamic-field="([^"]+)"[^>]*>/g;

export function personalizeEmailHtml(html: string, lead: PersonalizeLeadInput): string {
  const fields = parseCustomFields(lead.customFields);

  const withMergeTags = html.replace(MERGE_TAG_RE, (match, path: string) => {
    if (path === "name") return lead.name;
    if (path === "email") return lead.email ?? "";
    if (path === "company") return lead.company ?? "";
    if (path.startsWith("customFields.")) {
      const key = path.slice("customFields.".length);
      const val = fields[key];
      return val != null && val !== "" ? String(val) : match; // leave the tag as-is rather than blank it — a visibly broken tag is easier to notice and fix than silently missing text
    }
    return match;
  });

  return withMergeTags.replace(DYNAMIC_IMG_RE, (imgTag, fieldKey: string) => {
    const val = fields[fieldKey];
    if (val == null || val === "") return imgTag; // no override for this lead — keep the fallback image
    const url = String(val).replace(/"/g, "&quot;");
    return imgTag.replace(/\bsrc="[^"]*"/, `src="${url}"`);
  });
}
