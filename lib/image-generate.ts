// Real image generation via Pollinations.ai's legacy image endpoint — no API
// key, no signup, no account-level rate limit. Verified live (2026-08-26):
// image.pollinations.ai/prompt/{text} returns a real image with zero
// credentials. This is a different Pollinations surface from their newer
// gen.pollinations.ai platform, which requires paid "Pollen credits" —
// this file only ever calls the free legacy endpoint.

const POLLINATIONS_BASE = "https://image.pollinations.ai/prompt/";
const GENERATE_TIMEOUT_MS = 30000;

export interface GeneratedImage {
  dataUri: string;
}

export async function generateImage(
  prompt: string,
  opts: { width?: number; height?: number; seed?: number } = {},
): Promise<GeneratedImage | null> {
  const width = opts.width ?? 1024;
  const height = opts.height ?? 1024;
  const seed = opts.seed ?? Math.floor(Math.random() * 1_000_000);
  const url = `${POLLINATIONS_BASE}${encodeURIComponent(prompt)}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await res.arrayBuffer());
    return { dataUri: `data:${contentType};base64,${buffer.toString("base64")}` };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
