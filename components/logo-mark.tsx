// Agent Swarm mark: one hub node with five satellite nodes connected to it —
// literally what this product is, a coordinated team of specialist agents
// on one shared runtime, not an abstract navigation/dial metaphor. Themed
// via CSS variables so it matches light/dark automatically.

// Fixed coordinates (not computed at render time) — same hydration-mismatch
// lesson as the previous compass mark: precomputed values never differ
// between server and client renders the way live trig would.
const SATELLITES = [
  { x: 24, y: 8, r: 3.2 },
  { x: 39, y: 16.5, r: 3.2 },
  { x: 39, y: 31.5, r: 2.6 },
  { x: 24, y: 40, r: 2.6 },
  { x: 9, y: 31.5, r: 3.2 },
  { x: 9, y: 16.5, r: 2.6 },
];

export default function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {SATELLITES.map((s, i) => (
        <line key={`line-${i}`} x1="24" y1="24" x2={s.x} y2={s.y} stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.45" />
      ))}
      {SATELLITES.map((s, i) => (
        <circle key={`sat-${i}`} cx={s.x} cy={s.y} r={s.r} fill="var(--accent)" opacity="0.6" />
      ))}
      <circle cx="24" cy="24" r="7" fill="var(--accent)" />
    </svg>
  );
}
