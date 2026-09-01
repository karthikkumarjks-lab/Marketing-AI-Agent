import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";

// A REAL self-hosted live countdown — no third-party service needed. The
// trick email marketers use is just this: return an image that's computed
// fresh on every request, with caching disabled, so the number the
// recipient sees is accurate to the second they opened the email, not the
// moment the campaign was sent. `next/og`'s ImageResponse (bundled with
// Next.js itself — zero new dependency) renders the digits server-side on
// every hit. Deliberately public/unauthenticated: the recipient's email
// client fetches this with no session cookie, the same way it fetches any
// other embedded image.
export const runtime = "edge";

function two(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetParam = searchParams.get("target");
  const label = searchParams.get("label") || "Offer ends in";
  const endedLabel = searchParams.get("endedLabel") || "Offer has ended";

  const target = targetParam ? new Date(targetParam) : null;
  const validTarget = target && !isNaN(target.getTime());
  const remainingMs = validTarget ? target!.getTime() - Date.now() : 0;
  const ended = !validTarget || remainingMs <= 0;

  const totalSeconds = Math.floor(Math.max(0, remainingMs) / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const image = new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "18px 28px",
            borderRadius: "10px",
            border: "1px solid #d7dce5",
            background: ended ? "#fdf2f2" : "#f5f7fb",
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 600, color: ended ? "#c0392b" : "#14181c", display: "flex" }}>
            {ended ? endedLabel : label}
          </div>
          {!ended && (
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              {[
                { v: days, l: "DAYS" },
                { v: hours, l: "HRS" },
                { v: minutes, l: "MIN" },
                { v: seconds, l: "SEC" },
              ].map((unit) => (
                <div key={unit.l} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    style={{
                      display: "flex",
                      background: "#2f6fed",
                      color: "#fff",
                      fontSize: 26,
                      fontWeight: 700,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      minWidth: "42px",
                      justifyContent: "center",
                    }}
                  >
                    {two(unit.v)}
                  </div>
                  <div style={{ display: "flex", fontSize: 10, color: "#8a9089", marginTop: "4px", letterSpacing: "1px" }}>{unit.l}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    ),
    {
      width: 420,
      height: 130,
      headers: {
        // The whole mechanism depends on this — without it, an email
        // client or an in-between CDN could legitimately cache the first
        // render and keep serving that same stale countdown forever.
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      },
    },
  );
  return image;
}
