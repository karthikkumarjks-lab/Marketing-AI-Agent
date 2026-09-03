import { NextRequest, NextResponse } from "next/server";
import { transcribeAudioUrls } from "@/lib/transcribe";
import { getSessionUserId } from "@/lib/authz";

const MAX_URLS_PER_REQUEST = 20;

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { urls } = await req.json();
  if (!Array.isArray(urls) || urls.length === 0 || !urls.every((u) => typeof u === "string" && u.trim())) {
    return NextResponse.json({ error: "urls must be a non-empty array of URL strings." }, { status: 400 });
  }
  if (urls.length > MAX_URLS_PER_REQUEST) {
    return NextResponse.json({ error: `Too many URLs at once — max ${MAX_URLS_PER_REQUEST} per request.` }, { status: 400 });
  }

  const results = await transcribeAudioUrls(urls.map((u: string) => u.trim()));
  return NextResponse.json({ results });
}
