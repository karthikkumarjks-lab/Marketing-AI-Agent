import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ fieldId: string }> }) {
  const { fieldId } = await params;
  // Deleting the definition intentionally leaves the stored value on any
  // lead's customFields JSON untouched — it just stops showing up as an
  // editable field. No data-loss surprise on a field a user recreates later
  // under the same key.
  await prisma.customFieldDef.delete({ where: { id: fieldId } });
  return NextResponse.json({ ok: true });
}
