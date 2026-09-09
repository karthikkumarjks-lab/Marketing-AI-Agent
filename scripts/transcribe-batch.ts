// Unattended, resumable batch runner for the Transcription tool — built for
// a real need: 575 recordings against a free-tier Gemini quota (20-40
// requests/day), where pasting 20 at a time into the browser every day for
// weeks isn't practical. Run this from the terminal instead:
//
//   npx tsx scripts/transcribe-batch.ts leads.txt
//
// leads.txt: one lead per line, same format as the Transcription page —
//   email, prospectId, recordingUrl        (email optional)
//   prospectId, recordingUrl
//
// Progress is written to transcribe-output.csv after every batch, and on
// every run this script re-reads that file first and skips any prospectId
// already in it — so it's always safe to just re-run the exact same
// command again once tomorrow's quota is back. When Gemini's daily quota
// is exhausted, this script detects it from the real per-lead error text,
// STOPS immediately (rather than burning through the rest of the list
// against a guaranteed-exhausted quota, or silently falling back to a
// text-only model with no audio input — see lib/transcribe.ts), and prints
// exactly what to do next.
//
// Requires the dev server running (npm run dev) — this calls the real
// /api/transcribe route, the same one the browser page uses, so it's
// bound by the exact same batch-size cap and quota behavior.

import "dotenv/config";
import fs from "fs";
import path from "path";

const BASE = process.env.TRANSCRIBE_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TRANSCRIBE_LOGIN_EMAIL || "karthikkumarjks@gmail.com";
const PASSWORD = process.env.TRANSCRIBE_LOGIN_PASSWORD || "";
const BATCH_SIZE = 20; // matches MAX_LEADS_PER_REQUEST in app/api/transcribe/route.ts

interface Lead {
  email: string | null;
  prospectId: string;
  url: string;
}

interface Result extends Lead {
  transcript: string | null;
  comments: string | null;
  error: string | null;
}

function csvCell(value: string): string {
  if (/[,\n"]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function parseLeadsFile(text: string): Lead[] {
  const leads: Lead[] = [];
  text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .forEach((line, i) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length === 3 && parts.every(Boolean)) {
        leads.push({ email: parts[0], prospectId: parts[1], url: parts[2] });
      } else if (parts.length === 2 && parts.every(Boolean)) {
        leads.push({ email: null, prospectId: parts[0], url: parts[1] });
      } else {
        console.error(`Skipping malformed line ${i + 1}: "${line}"`);
      }
    });
  return leads;
}

// Reads whatever the output CSV already has, so a re-run skips completed
// leads instead of re-transcribing (and re-billing/re-spending quota on)
// work that's already done.
function readCompletedProspectIds(outputPath: string): Set<string> {
  if (!fs.existsSync(outputPath)) return new Set();
  const lines = fs.readFileSync(outputPath, "utf-8").split("\n").slice(1); // skip header
  const ids = new Set<string>();
  for (const line of lines) {
    if (!line.trim()) continue;
    // Second column = Prospect ID (S.No is first). A plain split is
    // reliable for just this one column since prospectId never
    // legitimately contains a comma in real use — unlike the later
    // transcript/comments columns, which do need real CSV quoting on write.
    const cols = line.split(",");
    if (cols.length >= 2) {
      const id = cols[1]?.replace(/^"|"$/g, "").trim();
      if (id) ids.add(id);
    }
  }
  return ids;
}

function appendResults(outputPath: string, results: Result[], sNoStart: number) {
  const isNew = !fs.existsSync(outputPath);
  const lines: string[] = [];
  if (isNew) lines.push(["S.No", "Prospect ID", "Lead Email ID", "Recording URL", "Transcription", "Comments", "Error"].join(","));
  results.forEach((r, i) => {
    lines.push(
      [
        String(sNoStart + i),
        r.prospectId,
        r.email ?? "",
        r.url,
        r.transcript ?? "",
        r.comments ?? "",
        r.error ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  });
  fs.appendFileSync(outputPath, lines.join("\n") + "\n");
}

function isQuotaError(message: string | null): boolean {
  if (!message) return false;
  return /429|RESOURCE_EXHAUSTED|quota/i.test(message);
}

async function login(): Promise<string> {
  if (!PASSWORD) {
    throw new Error("Set TRANSCRIBE_LOGIN_PASSWORD in the environment before running this script (not hardcoded here, unlike some other one-off test scripts this session — this one's meant to be reused).");
  }
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
  const cookie = [cookieHeader1, cookieHeader2].filter(Boolean).join("; ");
  if (!cookie.includes("session")) {
    throw new Error("Login didn't produce a session cookie — check TRANSCRIBE_LOGIN_EMAIL/PASSWORD are correct.");
  }
  return cookie;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/transcribe-batch.ts <leads-file.txt> [output.csv]");
    process.exit(1);
  }
  const outputPath = process.argv[3] || path.join(path.dirname(inputPath), "transcribe-output.csv");

  const allLeads = parseLeadsFile(fs.readFileSync(inputPath, "utf-8"));
  const completed = readCompletedProspectIds(outputPath);
  const remaining = allLeads.filter((l) => !completed.has(l.prospectId));

  console.log(`${allLeads.length} leads total, ${completed.size} already done, ${remaining.length} remaining.`);
  if (remaining.length === 0) {
    console.log("Nothing left to do — every lead is already in the output file.");
    return;
  }

  const cookie = await login();
  let sNo = completed.size + 1;
  let doneThisRun = 0;

  for (let i = 0; i < remaining.length; i += BATCH_SIZE) {
    const batch = remaining.slice(i, i + BATCH_SIZE);
    console.log(`Processing leads ${i + 1}-${i + batch.length} of ${remaining.length} remaining...`);

    const res = await fetch(`${BASE}/api/transcribe`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ leads: batch }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      console.error(`Batch request failed (HTTP ${res.status}): ${body.error ?? "unknown error"} — stopping here.`);
      break;
    }
    const { results }: { results: Result[] } = await res.json();

    appendResults(outputPath, results, sNo);
    sNo += results.length;
    doneThisRun += results.length;

    const quotaHit = results.find((r) => isQuotaError(r.error));
    if (quotaHit) {
      console.log(`\nGemini's daily quota looks exhausted (real error: "${quotaHit.error}").`);
      console.log(`Stopping here rather than burning through the rest of the list against a guaranteed-exhausted quota.`);
      console.log(`Progress so far this run: ${doneThisRun} lead(s) processed, saved to ${outputPath}.`);
      console.log(`Once quota resets, just run this exact same command again — already-completed leads are skipped automatically:\n  npx tsx scripts/transcribe-batch.ts ${inputPath} ${outputPath}`);
      return;
    }
  }

  console.log(`\nDone — ${doneThisRun} lead(s) processed this run, all results saved to ${outputPath}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
