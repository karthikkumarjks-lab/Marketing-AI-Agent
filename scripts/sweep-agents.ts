import "dotenv/config";
import fs from "fs";
import { AGENT_CATALOG } from "../lib/agent-catalog";

const BASE = "http://localhost:3000";
const WORKSPACE_ID = "cmtd9a4rs0000n0vd8ab4rng2"; // Bloom Realty Group
const EMAIL = "karthikkumarjks@gmail.com";
const PASSWORD = "Compass-6906!";

// Real sample content for the 7 agents that need a runNote to be
// meaningfully tested, plus real URLs for the two live-scan agents.
const SAMPLE_NOTES: Record<string, string> = {
  "win-loss-analysis":
    "Lost to Century21 Premier — they had a faster response time on the initial inquiry. Won vs RE/MAX Elite — our virtual tour walkthrough sealed it for a remote buyer.",
  "sales-call-coaching":
    "AGENT: Hi, thanks for calling Bloom Realty, this is Sam. CLIENT: Hi, I'm looking at the 3-bed listing on Maple St. AGENT: Great choice. Are you pre-approved for financing? CLIENT: Not yet, still figuring out budget. AGENT: No problem, I can connect you with our lender partner. Want to schedule a viewing this weekend? CLIENT: Sure, Saturday works.",
  "sales-proposal-quote":
    "Prospect: The Hendersons. Scope: 3-bed house, Austin TX, $450k budget. Timeline: want to close within 60 days.",
  "image-generation":
    "A bright, welcoming suburban house exterior with a for-sale sign, golden-hour lighting, professional real estate photography style.",
  "meeting-summary-insights":
    "AGENT: Thanks for joining, Priya. Let's talk through what you're looking for. PRIYA: We want a 3-bedroom house in Austin, budget around $450k, ideally move in within 2 months. AGENT: Got it, I'll send over 3 listings by Friday that match. Also, can we get your pre-approval letter from the lender? PRIYA: Yes, I'll get that to you by Wednesday. AGENT: Perfect, let's reconnect next Monday to review the listings together.",
  "meeting-qa": "What did Priya say her budget and timeline were?",
};

const COMPETITOR_URL = "https://www.remax.com";
const WEBSITE_URL = "https://www.century21.com";

interface SweepResult {
  key: string;
  category: string;
  status: number;
  ok: boolean;
  isDemo: boolean | null;
  outputLen: number;
  elapsedMs: number;
  error: string | null;
}

async function login(): Promise<string> {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  const setCookie1 = csrfRes.headers.get("set-cookie") ?? "";
  const { csrfToken } = await csrfRes.json();
  const cookieHeader1 = setCookie1.split(",").map((c) => c.split(";")[0]).join("; ");

  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookieHeader1 },
    body: new URLSearchParams({ email: EMAIL, password: PASSWORD, csrfToken, callbackUrl: "/" }),
    redirect: "manual",
  });
  const setCookie2 = res.headers.get("set-cookie") ?? "";
  const cookieHeader2 = setCookie2.split(",").map((c) => c.split(";")[0]).join("; ");
  return [cookieHeader1, cookieHeader2].filter(Boolean).join("; ");
}

async function runAgent(cookie: string, key: string, category: string): Promise<SweepResult> {
  const body: Record<string, unknown> = { workspaceId: WORKSPACE_ID, agentKey: key };
  if (key in SAMPLE_NOTES) body.runNote = SAMPLE_NOTES[key];
  if (key === "competitive-intelligence") body.competitorUrlOverride = COMPETITOR_URL;

  const start = Date.now();
  try {
    const res = await fetch(`${BASE}/api/agents/run`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    });
    const elapsedMs = Date.now() - start;
    const json = await res.json().catch(() => null);
    return {
      key,
      category,
      status: res.status,
      ok: res.ok,
      isDemo: json?.isDemo ?? null,
      outputLen: json?.outputMarkdown?.length ?? 0,
      elapsedMs,
      error: res.ok ? null : json?.error ?? "unknown error",
    };
  } catch (e) {
    return {
      key,
      category,
      status: 0,
      ok: false,
      isDemo: null,
      outputLen: 0,
      elapsedMs: Date.now() - start,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

async function main() {
  console.log("Logging in...");
  const cookie = await login();

  console.log("Setting real website URL on test workspace...");
  await fetch(`${BASE}/api/workspaces/${WORKSPACE_ID}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ websiteUrl: WEBSITE_URL }),
  });

  // meeting-summary-insights must run before meeting-qa so meeting-qa has
  // real history to answer from — reorder just those two to the front.
  const order = [...AGENT_CATALOG].sort((a, b) => {
    const rank = (k: string) => (k === "meeting-summary-insights" ? 0 : k === "meeting-qa" ? 1 : 2);
    return rank(a.key) - rank(b.key);
  });

  const results: SweepResult[] = [];
  for (const agent of order) {
    const r = await runAgent(cookie, agent.key, agent.category);
    results.push(r);
    const flag = !r.ok ? "FAIL" : r.isDemo ? "DEMO" : r.outputLen < 50 ? "THIN" : "OK";
    console.log(`[${flag}] ${agent.key} (${agent.category}) status=${r.status} len=${r.outputLen} ${r.elapsedMs}ms${r.error ? " — " + r.error : ""}`);
    await new Promise((res) => setTimeout(res, 1200));
  }

  fs.writeFileSync("sweep-results.json", JSON.stringify(results, null, 2));

  const byCategory: Record<string, { ok: number; demo: number; thin: number; fail: number }> = {};
  for (const r of results) {
    byCategory[r.category] ??= { ok: 0, demo: 0, thin: 0, fail: 0 };
    if (!r.ok) byCategory[r.category].fail++;
    else if (r.isDemo) byCategory[r.category].demo++;
    else if (r.outputLen < 50) byCategory[r.category].thin++;
    else byCategory[r.category].ok++;
  }
  console.log("\n=== SUMMARY BY CATEGORY ===");
  console.log(JSON.stringify(byCategory, null, 2));
  console.log(`\nTotal: ${results.length}, OK: ${results.filter((r) => r.ok && !r.isDemo && r.outputLen >= 50).length}, FAIL: ${results.filter((r) => !r.ok).length}, DEMO: ${results.filter((r) => r.isDemo).length}, THIN: ${results.filter((r) => r.ok && !r.isDemo && r.outputLen < 50).length}`);
}

main();
