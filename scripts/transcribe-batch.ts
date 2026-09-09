// Unattended, resumable batch runner for the Transcription tool — built for
// a real need: hundreds of recordings against a free-tier Gemini quota
// (20-40 requests/day), where pasting 20 at a time into the browser every
// day for weeks isn't practical. Run this from the terminal instead:
//
//   npx tsx scripts/transcribe-batch.ts leads.txt
//
// leads.txt: one lead per line, same format as the Transcription page —
//   email, prospectId, recordingUrl        (email optional)
//   prospectId, recordingUrl               (the normal case in real use)
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
// After every run, this also (re)writes a real two-sheet .xlsx report
// (transcribe-output.xlsx, same base name) — Sheet1 per-call detail, Sheet2
// the aggregate funnel breakdown — built from ALL completed leads so far
// (this run's plus every prior run's), using the exact same
// buildTranscriptionWorkbook() the browser's Transcription page uses, so
// the two never drift into different formats.
//
// Requires the dev server running (npm run dev) — this calls the real
// /api/transcribe route, the same one the browser page uses, so it's
// bound by the exact same batch-size cap and quota behavior.

import "dotenv/config";
import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import { buildTranscriptionWorkbook, DEFAULT_CATEGORIES, type TranscriptionResult } from "../lib/transcribe";

const BASE = process.env.TRANSCRIBE_BASE_URL || "http://localhost:3000";
const EMAIL = process.env.TRANSCRIBE_LOGIN_EMAIL || "karthikkumarjks@gmail.com";
const PASSWORD = process.env.TRANSCRIBE_LOGIN_PASSWORD || "";
const BATCH_SIZE = 20; // matches MAX_LEADS_PER_REQUEST in app/api/transcribe/route.ts

interface Lead {
  email: string | null;
  prospectId: string;
  url: string;
}

const CSV_HEADER = ["S.No", "Prospect ID", "Lead Email ID", "Recording URL", "Transcription", "Category", "Error"];

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

// Real CSV parsing (via the same xlsx library used elsewhere in this
// project) rather than a naive line-by-line split — a hand-rolled split on
// "\n" would misparse the moment any transcript cell contains an embedded
// newline (near-certain for a real multi-speaker transcript), silently
// breaking both the resume/skip logic below and any later re-read of this
// file. xlsx's CSV reader handles RFC 4180 quoting (embedded commas,
// quotes, and newlines inside a quoted cell) correctly.
function readCompletedResults(outputPath: string): TranscriptionResult[] {
  if (!fs.existsSync(outputPath)) return [];
  const wb = XLSX.read(fs.readFileSync(outputPath), { type: "buffer" });
  const rows: string[][] = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  return rows.slice(1) // skip header
    .filter((r) => r[1]) // real prospectId present
    .map((r) => ({
      prospectId: String(r[1]),
      email: r[2] ? String(r[2]) : null,
      url: String(r[3] ?? ""),
      transcript: r[4] ? String(r[4]) : null,
      category: r[5] ? String(r[5]) : null,
      error: r[6] ? String(r[6]) : null,
    }));
}

function appendResults(outputPath: string, results: TranscriptionResult[], sNoStart: number) {
  const isNew = !fs.existsSync(outputPath);
  const lines: string[] = [];
  if (isNew) lines.push(CSV_HEADER.join(","));
  results.forEach((r, i) => {
    lines.push(
      [
        String(sNoStart + i),
        r.prospectId,
        r.email ?? "",
        r.url,
        r.transcript ?? "",
        r.category ?? "",
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

function writeWorkbook(outputPath: string, results: TranscriptionResult[]) {
  const xlsxPath = outputPath.replace(/\.csv$/i, "") + ".xlsx";
  const wb = buildTranscriptionWorkbook(results, DEFAULT_CATEGORIES);
  XLSX.writeFile(wb, xlsxPath);
  return xlsxPath;
}

async function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.error("Usage: npx tsx scripts/transcribe-batch.ts <leads-file.txt> [output.csv]");
    process.exit(1);
  }
  const outputPath = process.argv[3] || path.join(path.dirname(inputPath), "transcribe-output.csv");

  const allLeads = parseLeadsFile(fs.readFileSync(inputPath, "utf-8"));
  const alreadyDone = readCompletedResults(outputPath);
  const completedIds = new Set(alreadyDone.map((r) => r.prospectId));
  const remaining = allLeads.filter((l) => !completedIds.has(l.prospectId));

  console.log(`${allLeads.length} leads total, ${alreadyDone.length} already done, ${remaining.length} remaining.`);
  if (remaining.length === 0) {
    console.log("Nothing left to do — every lead is already in the output file.");
    writeWorkbook(outputPath, alreadyDone);
    return;
  }

  const cookie = await login();
  let sNo = alreadyDone.length + 1;
  let doneThisRun = 0;
  const allResultsSoFar = [...alreadyDone];

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
    const { results }: { results: TranscriptionResult[] } = await res.json();

    appendResults(outputPath, results, sNo);
    sNo += results.length;
    doneThisRun += results.length;
    allResultsSoFar.push(...results);

    const quotaHit = results.find((r) => isQuotaError(r.error));
    if (quotaHit) {
      const xlsxPath = writeWorkbook(outputPath, allResultsSoFar);
      console.log(`\nGemini's daily quota looks exhausted (real error: "${quotaHit.error}").`);
      console.log(`Stopping here rather than burning through the rest of the list against a guaranteed-exhausted quota.`);
      console.log(`Progress so far this run: ${doneThisRun} lead(s) processed, saved to ${outputPath} and ${xlsxPath}.`);
      console.log(`Once quota resets, just run this exact same command again — already-completed leads are skipped automatically:\n  npx tsx scripts/transcribe-batch.ts ${inputPath} ${outputPath}`);
      return;
    }
  }

  const xlsxPath = writeWorkbook(outputPath, allResultsSoFar);
  console.log(`\nDone — ${doneThisRun} lead(s) processed this run, all ${allResultsSoFar.length} results saved to ${outputPath} and ${xlsxPath}.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
