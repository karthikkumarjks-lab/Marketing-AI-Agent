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
  const isValidLead = (l: unknown): l is LeadRecording =>
    !!l && typeof l === "object" && "email" in l && "prospectId" in l && "url" in l &&
    typeof (l as LeadRecording).email === "string" &&
    typeof (l as LeadRecording).prospectId === "string" &&
    typeof (l as LeadRecording).url === "string" && (l as LeadRecording).url.trim().length > 0;
  if (!leads.every(isValidLead)) {
    return NextResponse.json({ error: "Every lead needs email, prospectId, and url (all strings)." }, { status: 400 });
  }
  if (context !== undefined && context !== null && typeof context !== "string") {
    return NextResponse.json({ error: "context must be a string if provided." }, { status: 400 });
  }

  const results = await transcribeLeads(leads, context?.trim() || null);
  return NextResponse.json({ results });
}
