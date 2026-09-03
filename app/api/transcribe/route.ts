import { NextRequest, NextResponse } from "next/server";
import { transcribeLeads, type LeadRecording } from "@/lib/transcribe";
import { getSessionUserId } from "@/lib/authz";

const MAX_LEADS_PER_REQUEST = 20;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { leads, context } = await req.json();
  if (!Array.isArray(leads) || leads.length === 0) {
    return NextResponse.json({ error: "leads must be a non-empty array." }, { status: 400 });
  }
  if (leads.length > MAX_LEADS_PER_REQUEST) {
    return NextResponse.json({ error: `Too many leads at once — max ${MAX_LEADS_PER_REQUEST} per request.` }, { status: 400 });
  }
  // email is optional — not every lead has one on file — but prospectId
  // and url are always required.
  const isValidLead = (l: unknown): l is LeadRecording =>
    !!l && typeof l === "object" && "prospectId" in l && "url" in l &&
    ((l as LeadRecording).email === null || (l as { email?: unknown }).email === undefined || typeof (l as LeadRecording).email === "string") &&
    typeof (l as LeadRecording).prospectId === "string" && (l as LeadRecording).prospectId.trim().length > 0 &&
    typeof (l as LeadRecording).url === "string" && (l as LeadRecording).url.trim().length > 0;
  if (!leads.every(isValidLead)) {
    return NextResponse.json({ error: "Every lead needs at least prospectId and url (both strings) — email is optional." }, { status: 400 });
  }
  if (context !== undefined && context !== null && typeof context !== "string") {
    return NextResponse.json({ error: "context must be a string if provided." }, { status: 400 });
  }

  const normalizedLeads: LeadRecording[] = leads.map((l: LeadRecording) => ({
    email: l.email || null,
    prospectId: l.prospectId,
    url: l.url,
  }));
  const results = await transcribeLeads(normalizedLeads, context?.trim() || null);
  return NextResponse.json({ results });
}
