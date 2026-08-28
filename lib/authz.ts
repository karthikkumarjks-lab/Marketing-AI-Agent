// Ownership checks for API routes. Page-level access is gated once in
// app/workspaces/[id]/layout.tsx (a shared layout notFound()'s before any
// nested page renders), but API routes are hit directly and each needs its
// own check — a logged-in user could otherwise still read/write another
// user's workspace by calling its API with a guessed/known id.
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Returns the current session's user id, or null if not signed in.
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

// Returns true only if this workspace exists AND belongs to this user. Used
// at the top of every /api/workspaces/[id]/** route before touching data.
export async function userOwnsWorkspace(workspaceId: string, userId: string): Promise<boolean> {
  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { userId: true } });
  return workspace?.userId === userId;
}
