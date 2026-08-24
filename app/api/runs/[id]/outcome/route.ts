import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actualOutcome, outcomeStatus } = await req.json();
  if (!["pending", "matched", "missed"].includes(outcomeStatus)) {
    return NextResponse.json({ error: "Invalid outcomeStatus." }, { status: 400 });
  }

  const updated = await prisma.agentRun.update({
    where: { id },
    data: { actualOutcome: actualOutcome || null, outcomeStatus },
  });

  return NextResponse.json(updated);
}
