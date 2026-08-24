import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Marketing AI Team",
  description: "A shared runtime running 25 specialist AI marketing agents per client.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const workspaces = await prisma.workspace.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex bg-bg text-ink">
        <Sidebar workspaces={workspaces} />
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
