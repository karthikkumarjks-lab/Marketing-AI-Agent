import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const first = await prisma.workspace.findFirst({ orderBy: { createdAt: "asc" } });
  if (first) {
    redirect(`/workspaces/${first.id}`);
  }
  redirect("/workspaces/new");
}
