import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendPasswordResetEmail } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { email } });

  // Always return the same success response whether or not the account
  // exists — a different response would let anyone probe which emails
  // have accounts here (a real enumeration risk, not theoretical).
  if (user) {
    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });

    const base = process.env.AUTH_URL || `${req.nextUrl.protocol}//${req.nextUrl.host}`;
    const resetUrl = `${base}/reset-password?token=${rawToken}`;
    const result = await sendPasswordResetEmail(user.email, resetUrl);
    if (!result.ok) {
      // Log server-side for real debugging, but still don't leak account
      // existence or the send failure to the client.
      console.error("Password reset email failed:", result.error);
    }
  }

  return NextResponse.json({ ok: true });
}
