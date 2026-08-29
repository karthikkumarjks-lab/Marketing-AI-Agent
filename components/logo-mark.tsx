// A compass-needle mark: fixed heading, autonomous course. The ring now
// carries 12 evenly-spaced tick marks — still reads as a compass rose, but
// also reads as a segmented dial/gauge, so the same mark fits the CRM's
// pipeline-stage idea (a lead progressing through stages) as naturally as
// it fits marketing automation's "autonomous course" idea. One mark, two
// legitimate readings — not two different logos bolted together.
// Two-tone needle (solid front / faint back) inside the ring, themed via
// CSS variables so it matches light/dark automatically.

// Precomputed (not computed via Math.cos/sin at render time) — trig results
// can differ in their last decimal place between server and client JS
// engines, which caused a real hydration mismatch when this was computed
// live. Same coordinates used in the static app/icon.svg favicon.
const TICKS = [
  { x1: 24.0, y1: 7.0, x2: 24.0, y2: 9.6 },
  { x1: 32.5, y1: 9.28, x2: 31.2, y2: 11.53 },
  { x1: 38.72, y1: 15.5, x2: 36.47, y2: 16.8 },
  { x1: 41.0, y1: 24.0, x2: 38.4, y2: 24.0 },
  { x1: 38.72, y1: 32.5, x2: 36.47, y2: 31.2 },
  { x1: 32.5, y1: 38.72, x2: 31.2, y2: 36.47 },
  { x1: 24.0, y1: 41.0, x2: 24.0, y2: 38.4 },
  { x1: 15.5, y1: 38.72, x2: 16.8, y2: 36.47 },
  { x1: 9.28, y1: 32.5, x2: 11.53, y2: 31.2 },
  { x1: 7.0, y1: 24.0, x2: 9.6, y2: 24.0 },
  { x1: 9.28, y1: 15.5, x2: 11.53, y2: 16.8 },
  { x1: 15.5, y1: 9.28, x2: 16.8, y2: 11.53 },
];

export default function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="17" stroke="var(--accent)" strokeWidth="3" />
      {TICKS.map((t, i) => (
        <line
          key={i}
          x1={t.x1}
          y1={t.y1}
          x2={t.x2}
          y2={t.y2}
          stroke="var(--accent)"
          strokeWidth="1.4"
          strokeLinecap="round"
          opacity="0.4"
        />
      ))}
      <path d="M33.19 14.81 L21.88 26.12 L26.12 21.88 Z" fill="var(--accent)" />
      <path d="M14.81 33.19 L21.88 26.12 L26.12 21.88 Z" fill="var(--accent)" fillOpacity="0.32" />
      <circle cx="24" cy="24" r="2.1" fill="var(--surface)" />
    </svg>
  );
}
