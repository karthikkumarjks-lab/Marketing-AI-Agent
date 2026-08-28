import type { NextAuthConfig } from "next-auth";

// Edge-safe half of the NextAuth config — no providers, no Prisma import.
// Next.js middleware runs on the Edge runtime, which can't load Prisma's
// Node-only internals (it needs `node:url`'s fileURLToPath, filesystem
// access for the query engine, etc.) — even though middleware never calls
// the Credentials provider's authorize() itself, importing the FULL config
// (auth.ts) would still pull Prisma into the Edge bundle and fail the
// build. middleware.ts builds its own lightweight NextAuth instance from
// just this config to decode/verify the session cookie (pure crypto via
// AUTH_SECRET, no DB) — auth.ts (used everywhere else, which runs in the
// normal Node runtime) extends this same config with the real
// Prisma-backed Credentials provider added in.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.id as string;
      return session;
    },
  },
};
