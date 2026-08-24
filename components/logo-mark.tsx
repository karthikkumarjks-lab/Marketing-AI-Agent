// A compass-needle mark: fixed heading, autonomous course — the idea behind
// "Autopilot." Two-tone needle (solid front / faint back) inside a ring,
// themed via CSS variables so it matches light/dark automatically.

export default function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="17" stroke="var(--accent)" strokeWidth="3" />
      <path d="M33.19 14.81 L21.88 26.12 L26.12 21.88 Z" fill="var(--accent)" />
      <path d="M14.81 33.19 L21.88 26.12 L26.12 21.88 Z" fill="var(--accent)" fillOpacity="0.32" />
      <circle cx="24" cy="24" r="2.1" fill="var(--surface)" />
    </svg>
  );
}
