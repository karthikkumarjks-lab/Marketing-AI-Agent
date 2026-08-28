import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();
  // Middleware already redirects unauthenticated requests to /login before
  // this ever renders, but guard here too rather than assuming that always
  // holds.
  if (!session?.user?.id) redirect("/login");

  const first = await prisma.workspace.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });
  if (first) {
    redirect(`/workspaces/${first.id}`);
  }
  redirect("/workspaces/new");
}
