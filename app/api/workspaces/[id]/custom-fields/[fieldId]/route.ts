import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUserId, userOwnsWorkspace } from "@/lib/authz";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; fieldId: string }> }) {
  const { id: workspaceId, fieldId } = await params;
  const userId = await getSessionUserId();
  if (!userId || !(await userOwnsWorkspace(workspaceId, userId))) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const field = await prisma.customFieldDef.findUnique({ where: { id: fieldId }, select: { workspaceId: true } });
  if (!field || field.workspaceId !== workspaceId) return NextResponse.json({ error: "Field not found." }, { status: 404 });

  // Deleting the definition intentionally leaves the stored value on any
  // lead's customFields JSON untouched — it just stops showing up as an
  // editable field. No data-loss surprise on a field a user recreates later
  // under the same key.
  await prisma.customFieldDef.delete({ where: { id: fieldId } });
  return NextResponse.json({ ok: true });
}
