import type { Metadata } from "next";
import { Overpass, Public_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { prisma } from "@/lib/prisma";
import Sidebar from "@/components/sidebar";

// Overpass: originally drawn for US highway signage — real wayfinding
// heritage, genuinely on-theme for a "fixed heading, autonomous course"
// autopilot product, not a generic AI-default display face. Public Sans:
// the US Web Design System's typeface — civic, systematic, built for dense
// government-scale interfaces, which is exactly this app's actual job
// (a control surface, not a marketing page). IBM Plex Mono: real
// engineering pedigree for every data readout, timestamp, and category tag.
const overpass = Overpass({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const publicSans = Public_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-data" });

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
    <html lang="en" className={`h-full antialiased ${overpass.variable} ${publicSans.variable} ${plexMono.variable}`}>
      <body className="min-h-full flex bg-bg text-ink">
        <Sidebar workspaces={workspaces} agentCount={agentCount} />
        <div className="flex-1 min-w-0">{children}</div>
      </body>
    </html>
  );
}
