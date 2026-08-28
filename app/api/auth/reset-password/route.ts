import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token) return NextResponse.json({ error: "Missing reset token." }, { status: 400 });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const entry = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!entry || entry.usedAt || entry.expiresAt < new Date()) {
    return NextResponse.json({ error: "This reset link is invalid or has expired — request a new one." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction([
    prisma.user.update({ where: { id: entry.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: entry.id }, data: { usedAt: new Date() } }),
  ]);

  return NextResponse.json({ ok: true });
}
