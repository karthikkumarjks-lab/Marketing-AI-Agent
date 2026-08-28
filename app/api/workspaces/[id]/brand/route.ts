import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

const BRAND_FIELDS = [
  "primaryColor",
  "secondaryColor",
  "accentColor",
  "typography",
  "visualStyle",
  "brandPersonality",
  "toneOfVoice",
  "positioning",
  "approvedClaims",
  "restrictedClaims",
  "dos",
  "donts",
] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(id, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = await req.json();

  const data: Record<string, unknown> = {};
  for (const field of BRAND_FIELDS) {
    if (field in body) data[field] = body[field] || null;
  }
  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No editable fields provided." }, { status: 400 });
  }

  const brand = await prisma.brandDNA.upsert({
    where: { workspaceId: id },
    create: { workspaceId: id, ...data },
    update: data,
  });

  return NextResponse.json(brand);
}
