import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const { key, priceInr } = await req.json();
  if (!key || typeof key !== "string") {
    return NextResponse.json({ error: "key is required." }, { status: 400 });
  }
  if (priceInr !== null && (typeof priceInr !== "number" || priceInr < 0 || !Number.isFinite(priceInr))) {
    return NextResponse.json({ error: "priceInr must be a non-negative number or null." }, { status: 400 });
  }

  const agent = await prisma.agent.update({
    where: { key },
    data: { priceInr },
  });

  return NextResponse.json(agent);
}
