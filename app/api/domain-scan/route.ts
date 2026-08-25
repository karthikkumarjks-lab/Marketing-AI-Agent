import { NextRequest, NextResponse } from "next/server";
import { scanDomain } from "@/lib/domain-scan";

export async function POST(req: NextRequest) {
  const { domain } = await req.json();
  if (!domain || typeof domain !== "string" || !domain.trim()) {
    return NextResponse.json({ error: "domain is required." }, { status: 400 });
  }

  try {
    const result = await scanDomain(domain);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scan failed." },
      { status: 502 },
    );
  }
}
