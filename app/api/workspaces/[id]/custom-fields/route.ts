import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const fields = await prisma.customFieldDef.findMany({
    where: { workspaceId, entity: "lead" },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json(fields);
}

const VALID_TYPES = ["text", "number", "date", "boolean", "select"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const body = await req.json();
  if (!body.label || typeof body.label !== "string") {
    return NextResponse.json({ error: "Field label is required." }, { status: 400 });
  }
  if (!VALID_TYPES.includes(body.fieldType)) {
    return NextResponse.json({ error: "Invalid field type." }, { status: 400 });
  }
  const key = String(body.label)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (!key) return NextResponse.json({ error: "Could not derive a field key from that label." }, { status: 400 });

  const count = await prisma.customFieldDef.count({ where: { workspaceId, entity: "lead" } });
  try {
    const field = await prisma.customFieldDef.create({
      data: {
        workspaceId,
        entity: "lead",
        key,
        label: body.label,
        fieldType: body.fieldType,
        options: body.fieldType === "select" && Array.isArray(body.options) ? JSON.stringify(body.options) : null,
        isRequired: !!body.isRequired,
        sortOrder: count,
      },
    });
    return NextResponse.json(field);
  } catch {
    return NextResponse.json({ error: `A field with key "${key}" already exists.` }, { status: 409 });
  }
}
