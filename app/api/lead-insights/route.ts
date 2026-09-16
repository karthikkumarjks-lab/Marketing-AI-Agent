import { NextRequest, NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { parseLeadSheet, analyzeUploadedLeads, buildCrmLookup, classifyOutcomeValues } from "@/lib/lead-insights";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25MB — real exports like this run into the thousands of rows/hundreds of columns

export async function POST(req: NextRequest) {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const form = await req.formData();
  const workspaceId = form.get("workspaceId");
  const file = form.get("file");
  const outcomeColumnOverride = form.get("outcomeColumn");
  const convertedValuesRaw = form.get("convertedValues");

  if (typeof workspaceId !== "string" || !workspaceId) {
    return NextResponse.json({ error: "workspaceId is required." }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: `File too large — max ${MAX_FILE_BYTES / (1024 * 1024)}MB.` }, { status: 400 });
  }

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (!workspace || workspace.userId !== userId) {
    return NextResponse.json({ error: "Workspace not found." }, { status: 404 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let sheet;
  try {
    sheet = parseLeadSheet(buffer);
  } catch {
    return NextResponse.json({ error: "Couldn't read that file — make sure it's a real .xlsx, .xls, or .csv export." }, { status: 400 });
  }
  if (sheet.rows.length === 0) {
    return NextResponse.json({ error: "No data rows found in that file." }, { status: 400 });
  }

  const outcomeColumn = typeof outcomeColumnOverride === "string" && outcomeColumnOverride ? outcomeColumnOverride : undefined;
  let convertedValuesOverride: string[] | undefined;
  if (typeof convertedValuesRaw === "string" && convertedValuesRaw) {
    try {
      const parsed = JSON.parse(convertedValuesRaw);
      if (Array.isArray(parsed)) convertedValuesOverride = parsed.filter((v): v is string => typeof v === "string");
    } catch {
      // ignore malformed override — fall back to auto-detection
    }
  }

  const crmLookup = await buildCrmLookup(workspaceId);
  const result = analyzeUploadedLeads(sheet, outcomeColumn, convertedValuesOverride, crmLookup);

  // Every distinct value actually found in the detected outcome column,
  // with how many real rows carry it and whether it was auto-classified
  // as "converted" — lets the UI show and let the user correct the
  // classification before trusting the analysis, since a free-text
  // column like "Lead Stage" can use any vocabulary a team happens to type.
  let distinctOutcomeValues: { value: string; count: number; convertedByDefault: boolean }[] = [];
  if (result.outcomeColumn) {
    const counts = new Map<string, number>();
    for (const row of sheet.rows) {
      const v = row[result.outcomeColumn]?.trim();
      if (v) counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const autoConverted = classifyOutcomeValues([...counts.keys()]);
    distinctOutcomeValues = [...counts.entries()]
      .map(([value, count]) => ({ value, count, convertedByDefault: autoConverted.has(value) }))
      .sort((a, b) => b.count - a.count);
  }

  return NextResponse.json({ ...result, headers: sheet.headers, fileTruncated: sheet.truncated, distinctOutcomeValues, fileName: file.name });
}
