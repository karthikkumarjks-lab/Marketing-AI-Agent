"use client";

import { useEffect, useRef, useState } from "react";
import Cropper from "cropperjs";

// A real crop + rotate/flip + filter editor for images already placed on the
// canvas — cropperjs for the crop/transform handles (a lean, actively
// maintained, dependency-free library), native Canvas 2D `filter` for
// effects (grayscale/sepia/invert/blur/brightness — all real browser
// primitives, no library needed for that half). Deliberately NOT
// grapesjs-tui-image-editor: that plugin pulls in fabric.js 4.x plus a
// `request`-based legacy HTTP stack with 3 unpatched critical CVEs
// (checked via `npm audit` before deciding against it) for functionality
// this combination already covers.
const FILTERS = [
  { key: "none", label: "None", css: "" },
  { key: "grayscale", label: "Grayscale", css: "grayscale(1)" },
  { key: "sepia", label: "Sepia", css: "sepia(0.8)" },
  { key: "invert", label: "Invert", css: "invert(1)" },
  { key: "blur", label: "Blur", css: "blur(2px)" },
  { key: "bright", label: "Brighten", css: "brightness(1.3)" },
  { key: "dark", label: "Darken", css: "brightness(0.7)" },
  { key: "contrast", label: "High contrast", css: "contrast(1.5)" },
] as const;

export default function ImageEditorModal({
  src,
  onApply,
  onClose,
}: {
  src: string;
  onApply: (dataUri: string) => void;
  onClose: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  const [filter, setFilter] = useState<string>("none");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!imgRef.current) return;
    const cropper = new Cropper(imgRef.current, { container: imgRef.current.parentElement ?? undefined });
    cropperRef.current = cropper;
    return () => cropper.destroy();
  }, []);

  useEffect(() => {
    const css = FILTERS.find((f) => f.key === filter)?.css ?? "";
    const image = cropperRef.current?.getCropperImage();
    if (image) image.style.filter = css;
  }, [filter]);

  function rotate(deg: number) {
    cropperRef.current?.getCropperImage()?.$rotate(`${deg}deg`);
  }

  function flip(axis: "h" | "v") {
    const image = cropperRef.current?.getCropperImage();
    if (axis === "h") image?.$scale(-1, 1);
    else image?.$scale(1, -1);
  }

  async function apply() {
    const selection = cropperRef.current?.getCropperSelection();
    if (!selection) return;
    setBusy(true);
    try {
      const croppedCanvas = await selection.$toCanvas();
      const css = FILTERS.find((f) => f.key === filter)?.css ?? "";

      // Bake the CSS filter into the actual pixel data — a live style.filter
      // on the source <img> only affects the on-screen preview, not what
      // $toCanvas() reads, so it has to be re-applied here to end up in the
      // exported image.
      const out = document.createElement("canvas");
      out.width = croppedCanvas.width;
      out.height = croppedCanvas.height;
      const ctx = out.getContext("2d");
      if (!ctx) return;
      ctx.filter = css;
      ctx.drawImage(croppedCanvas, 0, 0);

      onApply(out.toDataURL("image/png"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-6">
      <div className="bg-surface rounded-lg border border-line w-full max-w-3xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-line">
          <span className="text-sm font-medium text-ink">Edit image</span>
          <button onClick={onClose} className="text-ink-faint hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-auto p-4">
          <div className="h-[360px] bg-bg rounded-md overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img ref={imgRef} src={src} alt="" style={{ display: "block", maxWidth: "100%" }} crossOrigin="anonymous" />
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <button onClick={() => rotate(-90)} className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-soft hover:bg-bg">
              ↺ Rotate left
            </button>
            <button onClick={() => rotate(90)} className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-soft hover:bg-bg">
              ↻ Rotate right
            </button>
            <button onClick={() => flip("h")} className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-soft hover:bg-bg">
              ⇋ Flip horizontal
            </button>
            <button onClick={() => flip("v")} className="text-xs px-2.5 py-1 rounded-md border border-line text-ink-soft hover:bg-bg">
              ⇅ Flip vertical
            </button>
          </div>

          <div className="mt-3">
            <span className="text-xs text-ink-faint block mb-1.5">Effects</span>
            <div className="flex flex-wrap gap-1.5">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={`text-xs px-2.5 py-1 rounded-md border ${
                    filter === f.key ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-soft hover:bg-bg"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-t border-line">
          <button
            onClick={apply}
            disabled={busy}
            className="rounded-md bg-accent text-white text-sm font-medium px-4 py-2 hover:opacity-90 disabled:opacity-60"
          >
            {busy ? "Applying…" : "Apply"}
          </button>
          <button onClick={onClose} className="rounded-md border border-line text-sm px-4 py-2 text-ink-soft hover:bg-bg">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
