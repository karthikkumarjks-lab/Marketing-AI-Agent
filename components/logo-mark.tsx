// Paper Airplane mark: "autopilot" is literally an aviation term — a craft
// flying itself — so a paper plane is a direct, honest symbol for the name,
// not an abstract stand-in. Two-tone wings (bright leading / faint trailing)
// plus a short motion trail read as forward, autonomous motion at a glance.
// Flat, solid var(--accent) — no gradient, no dark-canvas dependency, so it
// reads correctly on this app's actual light-first surface everywhere else.
export default function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <g stroke="var(--accent)" strokeWidth="1.6" strokeLinecap="round" opacity="0.4">
        <line x1="14" y1="34" x2="6" y2="32" />
        <line x1="17" y1="38" x2="10" y2="39" />
      </g>
      <path d="M44 4 22 26 4 18Z" fill="var(--accent)" opacity="0.5" />
      <path d="M44 4 30 44 22 26Z" fill="var(--accent)" />
    </svg>
  );
}
