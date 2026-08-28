import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultStages } from "@/lib/crm-server";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const stages = await ensureDefaultStages(workspaceId);
  return NextResponse.json(stages);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: workspaceId } = await params;
  const body = await req.json();
  if (!body.name || typeof body.name !== "string") {
    return NextResponse.json({ error: "Stage name is required." }, { status: 400 });
  }
  const count = await prisma.pipelineStage.count({ where: { workspaceId } });
  const stage = await prisma.pipelineStage.create({
    data: {
      workspaceId,
      name: body.name,
      order: count,
      isWon: !!body.isWon,
      isLost: !!body.isLost,
    },
  });
  return NextResponse.json(stage);
}
