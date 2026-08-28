import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";

// Builds its own lightweight NextAuth instance from the Edge-safe config
// (no Prisma) — see auth.config.ts for why this can't import the full
// auth.ts. This only decodes/verifies the session cookie, which is pure
// crypto against AUTH_SECRET, not a database call.
const { auth } = NextAuth(authConfig);

// Everything in this app requires a real login now — the whole point of
// adding accounts was that a CRM holding real lead data shouldn't be
// reachable by anyone with the URL. Only the auth machinery itself (the
// login/signup pages, NextAuth's own API routes) and static assets stay
// public; every other request without a valid session bounces to /login
// with a callbackUrl so the user lands back where they were headed.
const PUBLIC_PATHS = ["/login", "/signup", "/api/auth"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic || req.auth) return NextResponse.next();

  const loginUrl = new URL("/login", req.nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
});

// /api/auth/** is excluded from the matcher itself (not just the in-code
// PUBLIC_PATHS check above) — those routes are NextAuth's own CSRF/session/
// callback machinery and should never be wrapped by this proxy's own
// request handling at all.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|api/auth).*)"],
};
