// Real audio transcription (+ optional lead-qualification comment) from a
// URL — fetches the actual audio file server-side and sends it to Gemini's
// multimodal API, which transcribes, translates any Hindi/mixed-language
// speech into English (per explicit requirement), and — when a
// qualification context is supplied — writes a Comments verdict for that
// call in the SAME request. Kept separate from the Agent Contract/
// agent-catalog pattern the same way Domain Scan is: this is a raw
// utility (URL + lead info in, a report row out), not marketing reasoning
// about a client's business — nothing here needs Company DNA.
//
// The transcript and comment are deliberately produced by ONE Gemini call,
// not two: a client running a batch of leads is bound by the shared
// 20-requests/day free-tier quota either way, and splitting this into a
// transcribe call + a separate analyze call would silently halve how many
// recordings a batch can actually process before running out.
//
// Gemini-only: OpenRouter's free-tier text model has no audio input at
// all, so there's no meaningful fallback the way runAgentLLM has for text
// agents — a failure here is reported as a real, honest per-lead error
// rather than silently producing garbage from a text-only model.

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
  email: string;
  prospectId: string;
  url: string;
}

export interface TranscriptionResult {
  email: string;
  prospectId: string;
  url: string;
  transcript: string | null;
  comments: string | null;
  error: string | null;
}

// Distinctive, unlikely-to-occur-in-real-speech delimiters so the response
// can be split reliably — real transcripts are ordinary sentences and would
// essentially never contain a line that's exactly one of these markers.
const TRANSCRIPT_MARKER = "===TRANSCRIPT===";
const COMMENTS_MARKER = "===COMMENTS===";

function buildPrompt(context: string | null): string {
  const base = `Transcribe this audio recording completely and accurately, word for word.

The recording may be in Hindi, English, or a mix of both (common in Indian business calls) — regardless of the spoken language(s), output the FULL transcript in English only: transcribe English speech as-is, and translate any Hindi (or other language) speech into natural, accurate English rather than transliterating it. Do not skip or summarize any portion.

If there are multiple speakers, label them generically as "Speaker 1", "Speaker 2", etc. based on voice changes — do not guess real names unless a speaker states their own name in the recording.

If the audio is silent, unintelligible, or too degraded to transcribe in parts, say so plainly for that portion rather than inventing plausible-sounding text — never fabricate any part of a transcript.`;

  if (!context) {
    return `${base}\n\nOutput format — exactly this, with the literal marker line and nothing else around it:\n${TRANSCRIPT_MARKER}\n<the full transcript>`;
  }

  return `${base}

After the transcript, also write a short Comments verdict on this specific call, using ONLY the following context/criteria the client gave you — do not invent your own qualification rules, apply exactly what's described below:

"""
${context}
"""

The Comments must be grounded only in what was actually said in THIS call — never assume or carry over anything from a different call. If the call doesn't clearly meet the described criteria either way, say that plainly (e.g. "Not enough signal to call this qualified/unqualified — [why]") rather than forcing a verdict the transcript doesn't support. Keep it to 1-3 sentences: the verdict, the specific evidence from the call, and the next action per the client's context if one applies.

Output format — exactly this, with the literal marker lines and nothing else around them:
${TRANSCRIPT_MARKER}
<the full transcript>
${COMMENTS_MARKER}
<the comments verdict for this call>`;
}

export function parseResponse(text: string, hasContext: boolean): { transcript: string; comments: string | null } {
  const transcriptIdx = text.indexOf(TRANSCRIPT_MARKER);
  const commentsIdx = text.indexOf(COMMENTS_MARKER);

  if (transcriptIdx === -1) {
    // Markers didn't come back as asked (a real, if rare, model deviation)
    // — fall back to treating the whole response as the transcript rather
    // than losing the content or guessing at a split.
    return { transcript: text.trim(), comments: null };
  }

  if (hasContext && commentsIdx > transcriptIdx) {
    return {
      transcript: text.slice(transcriptIdx + TRANSCRIPT_MARKER.length, commentsIdx).trim(),
      comments: text.slice(commentsIdx + COMMENTS_MARKER.length).trim(),
    };
  }

  return { transcript: text.slice(transcriptIdx + TRANSCRIPT_MARKER.length).trim(), comments: null };
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
 * Transcribes (and, with a context, qualifies) one lead's recording. Real
 * fetch, real Gemini multimodal call — same two-key failover as the rest
 * of this app (see GEMINI_API_KEY_2's doc comment in .env.local.example),
 * since Gemini is the only provider here that can actually take audio
 * input at all.
 */
export async function transcribeLead(lead: LeadRecording, context: string | null): Promise<TranscriptionResult> {
  const base = { email: lead.email, prospectId: lead.prospectId, url: lead.url };
  const fetched = await fetchAudio(lead.url);
  if ("error" in fetched) return { ...base, transcript: null, comments: null, error: fetched.error };

  const geminiKeys = [process.env.GEMINI_API_KEY, process.env.GEMINI_API_KEY_2].filter((k): k is string => !!k);
  if (geminiKeys.length === 0) {
    return { ...base, transcript: null, comments: null, error: "No GEMINI_API_KEY configured — transcription needs a real audio-capable model, and none is set up." };
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const prompt = buildPrompt(context);
  let lastError: unknown;
  for (const key of geminiKeys) {
    try {
      const raw = await callGeminiAudio(key, model, prompt, fetched.base64, fetched.mimeType);
      const { transcript, comments } = parseResponse(raw, !!context);
      return { ...base, transcript, comments, error: null };
    } catch (err) {
      lastError = err;
    }
  }
  return { ...base, transcript: null, comments: null, error: lastError instanceof Error ? lastError.message : "Transcription failed." };
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
export async function transcribeLeads(leads: LeadRecording[], context: string | null): Promise<TranscriptionResult[]> {
  const results: TranscriptionResult[] = [];
  for (const lead of leads) {
    results.push(await transcribeLead(lead, context));
  }
  return results;
}
