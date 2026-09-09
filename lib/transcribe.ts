// Real audio transcription + lead-funnel categorization from a URL —
// fetches the actual audio file server-side and sends it to Gemini's
// multimodal API, which transcribes, translates any Hindi/mixed-language
// speech into English (per explicit requirement), and classifies the call
// into ONE of a fixed set of outcome categories — all in the SAME request.
// Kept separate from the Agent Contract/agent-catalog pattern the same way
// Domain Scan is: this is a raw utility (URL + lead info in, a report row
// out), not marketing reasoning about a client's business — nothing here
// needs Company DNA.
//
// The category schema and its default root-cause descriptions mirror a
// real, already-validated funnel breakdown the client built and used in
// Google Colab for this exact business (an AI voice bot cold-calling leads
// for an online degree program) — replicated here rather than reinvented,
// per an explicit reference file. The qualification-context field can
// still override this with a different schema for a different batch/
// business, but this is the proven default.
//
// Category and transcript are deliberately produced by ONE Gemini call,
// not two: a client running a batch of leads is bound by the shared
// 20-requests/day free-tier quota either way, and splitting this into a
// transcribe call + a separate classify call would silently halve how many
// recordings a batch can actually process before running out. The
// aggregate funnel breakdown (counts, %, root cause) is then computed
// client-side from the per-call categories already collected — zero
// additional API calls.
//
// Gemini-only: OpenRouter's free-tier text model has no audio input at
// all, so there's no meaningful fallback the way runAgentLLM has for text
// agents — a failure here is reported as a real, honest per-lead error
// rather than silently producing garbage from a text-only model.

import * as XLSX from "xlsx";

const FETCH_TIMEOUT_MS = 30000;
// Gemini's inline_data (base64-in-request) path tops out around 20MB per
// request once base64 overhead (~4/3 inflation) is included. Capping the
// raw file well under that rather than hitting a confusing API-side 400 —
// a longer recording needs Gemini's separate File API (upload once, get a
// URI back), which is real future work if this cap turns out to bite in
// practice, not built here to keep this a same-day feature.
const MAX_AUDIO_BYTES = 15_000_000;

const EXTENSION_MIME: Record<string, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  mp4: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  oga: "audio/ogg",
  flac: "audio/flac",
  webm: "audio/webm",
  opus: "audio/opus",
};

export function guessMimeFromUrl(url: string): string | null {
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return ext ? (EXTENSION_MIME[ext] ?? null) : null;
}

export interface LeadRecording {
  // Not every lead has an email on file — prospectId + url alone is a
  // valid lead, per explicit requirement.
  email: string | null;
  prospectId: string;
  url: string;
}

export interface TranscriptionResult {
  email: string | null;
  prospectId: string;
  url: string;
  transcript: string | null;
  category: string | null;
  error: string | null;
}

// The default funnel-outcome schema — matches a real, already-validated
// breakdown from this exact client's own prior analysis (an AI voice bot
// cold-calling leads for an online degree program). "Other / Uncategorized"
// is a deliberate addition beyond that original set: forcing every real
// call into one of a handful of rigid buckets produces false confidence on
// genuine edge cases — an honest overflow bucket beats a forced, wrong fit.
export interface CategoryDef {
  name: string;
  rootCause: string;
}
export const DEFAULT_CATEGORIES: CategoryDef[] = [
  { name: "Agreed to Counselor Callback", rootCause: "High-intent leads who agreed to a follow-up call" },
  { name: "Explicit Rejection", rootCause: 'Explicitly stated "not interested" or "no longer exploring"' },
  { name: "Ineligible (12th Incomplete)", rootCause: "Broad ad targeting capturing non-eligible students" },
  { name: "Ambiguous / Lost Interest Mid-Call", rootCause: "Script friction, rigid looping, or lack of engagement" },
  { name: "Call Disconnect / Unresponsive", rootCause: "Short call duration, line drops, or automated hang-up" },
  { name: "Misdirected Intent (Job / Tender)", rootCause: "Confused lead seeking employment/business rather than the program" },
  { name: "Other / Uncategorized", rootCause: "Doesn't clearly fit another category — needs manual review" },
];

const DEFAULT_QUALIFICATION_CONTEXT = `Classify this call into EXACTLY ONE of these categories (use the exact name, nothing else):
${DEFAULT_CATEGORIES.map((c) => `- "${c.name}"`).join("\n")}

Use "Agreed to Counselor Callback" only when the lead clearly agreed to a follow-up call or gave a time slot. Use "Explicit Rejection" only when they clearly said they're not interested or asked not to be contacted. Use "Ineligible (12th Incomplete)" when the call reveals the lead doesn't meet a stated eligibility requirement. Use "Call Disconnect / Unresponsive" when the call is very short, drops, or gets no real response. Use "Misdirected Intent (Job / Tender)" when the lead is clearly asking about something unrelated (a job, a business tender) rather than the actual offer. Use "Ambiguous / Lost Interest Mid-Call" for a real conversation that doesn't clearly land in any of the above. Use "Other / Uncategorized" only when none of the above genuinely fits.`;

// Distinctive, unlikely-to-occur-in-real-speech delimiters so the response
// can be split reliably — real transcripts are ordinary sentences and would
// essentially never contain a line that's exactly one of these markers.
const TRANSCRIPT_MARKER = "===TRANSCRIPT===";
const CATEGORY_MARKER = "===CATEGORY===";

function buildPrompt(context: string | null, categoryNames: string[]): string {
  const base = `Transcribe this audio recording completely and accurately, word for word.

The recording may be in Hindi, English, or a mix of both (common in Indian business calls) — regardless of the spoken language(s), output the FULL transcript in English only: transcribe English speech as-is, and translate any Hindi (or other language) speech into natural, accurate English rather than transliterating it. Do not skip or summarize any portion.

If there are multiple speakers, label them generically as "Speaker 1", "Speaker 2", etc. based on voice changes — do not guess real names unless a speaker states their own name in the recording.

If the audio is silent, unintelligible, or too degraded to transcribe in parts, say so plainly for that portion rather than inventing plausible-sounding text — never fabricate any part of a transcript.`;

  const effectiveContext = context || DEFAULT_QUALIFICATION_CONTEXT;

  return `${base}

After the transcript, classify this call using ONLY the following instructions — do not invent your own categories or criteria, apply exactly what's described below:

"""
${effectiveContext}
"""

The category must be grounded only in what was actually said in THIS call — never assume or carry over anything from a different call. Output the category name EXACTLY as given (verbatim), one of: ${categoryNames.map((n) => `"${n}"`).join(", ")}.

Output format — exactly this, with the literal marker lines and nothing else around them:
${TRANSCRIPT_MARKER}
<the full transcript>
${CATEGORY_MARKER}
<the exact category name, nothing else>`;
}

export function parseResponse(text: string, validCategoryNames?: string[]): { transcript: string; category: string | null } {
  const transcriptIdx = text.indexOf(TRANSCRIPT_MARKER);
  const categoryIdx = text.indexOf(CATEGORY_MARKER);

  if (transcriptIdx === -1) {
    // Markers didn't come back as asked (a real, if rare, model deviation)
    // — fall back to treating the whole response as the transcript rather
    // than losing the content or guessing at a split.
    return { transcript: text.trim(), category: null };
  }

  if (categoryIdx === -1 || categoryIdx < transcriptIdx) {
    return { transcript: text.slice(transcriptIdx + TRANSCRIPT_MARKER.length).trim(), category: null };
  }

  const transcript = text.slice(transcriptIdx + TRANSCRIPT_MARKER.length, categoryIdx).trim();
  let category = text.slice(categoryIdx + CATEGORY_MARKER.length).trim();
  // Guard against a near-miss (extra punctuation/quotes the model added
  // around an otherwise-correct name) — match against the known set rather
  // than accepting anything verbatim, so a garbled category never silently
  // creates a bogus new bucket in the aggregate breakdown.
  if (validCategoryNames && !validCategoryNames.includes(category)) {
    const stripped = category.replace(/^["'.\s]+|["'.\s]+$/g, "");
    category = validCategoryNames.includes(stripped) ? stripped : (validCategoryNames.find((n) => stripped.startsWith(n)) ?? null) ?? category;
  }

  return { transcript, category: category || null };
}

async function fetchAudio(url: string): Promise<{ base64: string; mimeType: string } | { error: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return { error: `Could not fetch this URL (HTTP ${res.status}).` };

    const contentType = res.headers.get("content-type")?.split(";")[0].trim();
    const mimeType = contentType && contentType.startsWith("audio/") ? contentType : guessMimeFromUrl(url);
    if (!mimeType) {
      return { error: `Could not tell this is an audio file (no audio content-type and no recognized file extension) — got content-type "${contentType ?? "none"}".` };
    }

    const contentLength = res.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_AUDIO_BYTES) {
      return { error: `File is larger than ${(MAX_AUDIO_BYTES / 1_000_000).toFixed(0)}MB (${(Number(contentLength) / 1_000_000).toFixed(1)}MB) — too large for this tool right now.` };
    }

    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_AUDIO_BYTES) {
      return { error: `File is larger than ${(MAX_AUDIO_BYTES / 1_000_000).toFixed(0)}MB (${(buf.byteLength / 1_000_000).toFixed(1)}MB) — too large for this tool right now.` };
    }

    return { base64: buf.toString("base64"), mimeType };
  } catch (err) {
    return { error: err instanceof Error && err.name === "AbortError" ? "Timed out fetching this URL." : err instanceof Error ? err.message : "Could not fetch this URL." };
  } finally {
    clearTimeout(timeout);
  }
}

async function callGeminiAudio(apiKey: string, model: string, prompt: string, base64: string, mimeType: string): Promise<string> {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 8000 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

/**
 * Transcribes and categorizes one lead's recording. Real fetch, real
 * Gemini multimodal call — same two-key failover as the rest of this app
 * (see GEMINI_API_KEY_2's doc comment in .env.local.example), since Gemini
 * is the only provider here that can actually take audio input at all.
 */
export async function transcribeLead(
  lead: LeadRecording,
  context: string | null,
  categories: CategoryDef[] = DEFAULT_CATEGORIES,
): Promise<TranscriptionResult> {
  const base = { email: lead.email, prospectId: lead.prospectId, url: lead.url };
  const fetched = await fetchAudio(lead.url);
  if ("error" in fetched) return { ...base, transcript: null, category: null, error: fetched.error };

  const geminiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => !!k);
  if (geminiKeys.length === 0) {
    return { ...base, transcript: null, category: null, error: "No GEMINI_API_KEY configured — transcription needs a real audio-capable model, and none is set up." };
  }

  const categoryNames = categories.map((c) => c.name);
  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = buildPrompt(context, categoryNames);
  let lastError: unknown;
  for (const key of geminiKeys) {
    try {
      const raw = await callGeminiAudio(key, model, prompt, fetched.base64, fetched.mimeType);
      const { transcript, category } = parseResponse(raw, categoryNames);
      return { ...base, transcript, category, error: null };
    } catch (err) {
      lastError = err;
    }
  }
  return { ...base, transcript: null, category: null, error: lastError instanceof Error ? lastError.message : "Transcription failed." };
}

/**
 * Sequential, not parallel — found necessary the hard way on this same
 * Gemini free tier for image generation (a burst of parallel calls got
 * silently throttled and dropped results); audio calls are heavier still,
 * and the daily quota is small enough (20/day, shared across everything
 * this app calls Gemini for) that a client submitting many leads at once
 * should see each one fail honestly on its own turn rather than have a
 * whole batch collapse from a burst.
 */
export async function transcribeLeads(
  leads: LeadRecording[],
  context: string | null,
  categories: CategoryDef[] = DEFAULT_CATEGORIES,
): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];
  for (const lead of leads) {
    results.push(await transcribeLead(lead, context, categories));
  }
  return results;
}

export interface FunnelBreakdownRow {
  category: string;
  count: number;
  sharePct: number;
  rootCause: string;
}

/**
 * Computed client-side from the per-call categories already collected —
 * zero additional API calls. Mirrors the real reference format: a named
 * category, its count and share of TOTAL leads WITH a real category
 * assigned (errors/uncategorized-parse-failures are excluded from the
 * denominator, same as the reference file's "Total Analyzed Leads" being
 * less than the full batch).
 */
export function computeFunnelBreakdown(results: TranscriptionResult[], categories: CategoryDef[] = DEFAULT_CATEGORIES): FunnelBreakdownRow[] {
  const rootCauseByName = new Map(categories.map((c) => [c.name, c.rootCause]));
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of results) {
    if (!r.category) continue;
    counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
    total++;
  }
  if (total === 0) return [];
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      count,
      sharePct: count / total,
      rootCause: rootCauseByName.get(category) ?? "",
    }));
}

/**
 * Builds the real, two-sheet workbook — shared by the browser page (which
 * calls XLSX.writeFile to trigger a download) and scripts/transcribe-batch.ts
 * (which calls XLSX.writeFile to write straight to disk), so both produce
 * byte-for-byte the same report format rather than two hand-maintained
 * copies drifting apart. Sheet1 is per-call detail, Sheet2 is the aggregate
 * funnel breakdown — see computeFunnelBreakdown's doc comment for what it
 * excludes and why.
 */
export function buildTranscriptionWorkbook(results: TranscriptionResult[], categories: CategoryDef[] = DEFAULT_CATEGORIES) {
  const wb = XLSX.utils.book_new();

  const sheet1Rows: (string | number)[][] = [
    ["S.No", "Prospect Id", "Recording URL", "Transcript", "Category"],
    ...results.map((r, i) => [
      i + 1,
      r.prospectId,
      r.url,
      r.transcript ?? (r.error ? `ERROR: ${r.error}` : ""),
      r.category ?? "",
    ]),
  ];
  const sheet1 = XLSX.utils.aoa_to_sheet(sheet1Rows);
  sheet1["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 50 }, { wch: 80 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, sheet1, "Sheet1");

  const breakdown = computeFunnelBreakdown(results, categories);
  const sheet2Rows: (string | number)[][] = [
    ["Overall Lead Funnel Breakdown", "", "", ""],
    ["", "", "", ""],
    ["Breakdown Category", "Lead Count", "Share (%)", "Primary Root Cause"],
    ...breakdown.map((b) => [b.category, b.count, b.sharePct, b.rootCause]),
    ["Total Analyzed Leads", breakdown.reduce((sum, b) => sum + b.count, 0), 1, ""],
  ];
  const sheet2 = XLSX.utils.aoa_to_sheet(sheet2Rows);
  // Format the Share (%) column (column C, rows 4..n) as a real percentage
  // display rather than a raw decimal — matches how the reference file
  // presents this column.
  for (let r = 4; r <= 3 + breakdown.length + 1; r++) {
    const cell = sheet2[`C${r}`];
    if (cell && typeof cell.v === "number") cell.z = "0.00%";
  }
  sheet2["!cols"] = [{ wch: 32 }, { wch: 12 }, { wch: 12 }, { wch: 55 }];
  XLSX.utils.book_append_sheet(wb, sheet2, "Sheet2");

  return wb;
}
