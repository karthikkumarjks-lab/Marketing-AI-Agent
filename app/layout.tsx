import type { Metadata } from "next";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";

export const metadata: Metadata = {
  title: "Marketing Autopilot",
  description: "A shared runtime running a growing team of specialist AI marketing agents per client.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [workspaces, agentCount] = await Promise.all([
    prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true },
    }),
    prisma.agent.count(),
  ]);

  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex bg-bg text-ink">
        <Sidebar workspaces={workspaces} agentCount={agentCount} />
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
