import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const email = typeof body.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const name = typeof body.name === "string" ? body.name.trim() : null;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const isFirstUser = (await prisma.user.count()) === 0;

  const user = await prisma.user.create({
    data: { email, passwordHash, name: name || null },
  });

  // One-time adoption: workspaces created before any account existed
  // (userId null) all become this first real account's — nothing pre-
  // existing is orphaned or silently inaccessible. Every account after the
  // first starts with zero workspaces, as expected.
  if (isFirstUser) {
    await prisma.workspace.updateMany({ where: { userId: null }, data: { userId: user.id } });
  }

  return NextResponse.json({ id: user.id, email: user.email });
}
