"use client";

import dynamic from "next/dynamic";
import type { EmailTemplateData } from "./email-builder";

// GrapesJS touches the DOM at init time — ssr:false is only legal from a
// Client Component in the App Router, hence this thin wrapper around the
// dynamic import rather than doing it directly in the (server) page.
const EmailBuilder = dynamic(() => import("./email-builder"), {
  ssr: false,
  loading: () => <div className="h-[600px] border border-line rounded-lg flex items-center justify-center text-sm text-ink-faint">Loading editor…</div>,
});

export default function EmailBuilderLoader({ workspaceId, template }: { workspaceId: string; template: EmailTemplateData | null }) {
  return <EmailBuilder workspaceId={workspaceId} template={template} />;
}
