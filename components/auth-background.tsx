// A visible decorative backdrop for the login/signup/reset pages — line-art
// pictograms for the channels this platform actually runs (content, image/
// video, email, chat/WhatsApp, SMS, automation, marketing), each sitting in
// a soft accent-tinted badge so they read clearly at a glance instead of
// disappearing into the page. Generic pictograms, not any real brand's logo
// (WhatsApp's actual mark, for instance, is never used).
const ICONS = [
  // Megaphone — marketing
  <path key="megaphone" d="M3 11v6l4 1v-8l-4 1zm4-1 12-5v18L7 18" />,
  // Gear — automation
  <g key="gear">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 3v2.4M12 18.6V21M21 12h-2.4M5.4 12H3M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7M18.4 18.4l-1.7-1.7M7.3 7.3 5.6 5.6" />
  </g>,
  // Document with lines — content
  <g key="content">
    <rect x="5" y="3" width="14" height="18" rx="1.5" />
    <path d="M8 8h8M8 12h8M8 16h5" />
  </g>,
  // Image frame — image
  <g key="image">
    <rect x="3" y="5" width="18" height="14" rx="1.5" />
    <circle cx="8.5" cy="10" r="1.6" />
    <path d="m4 17 5-5 3.5 3.5L17 10l4 5" />
  </g>,
  // Play circle — video
  <g key="video">
    <circle cx="12" cy="12" r="9" />
    <path d="M10 8.5v7l6-3.5-6-3.5Z" />
  </g>,
  // Envelope — email
  <g key="email">
    <rect x="3" y="5.5" width="18" height="13" rx="1.5" />
    <path d="m3.5 6.5 8.5 7 8.5-7" />
  </g>,
  // Chat bubble — messaging (WhatsApp/general chat, generic pictogram)
  <path key="chat" d="M4 4h16v11H9l-5 4V4Z" />,
  // SMS — message with dots
  <g key="sms">
    <rect x="3" y="4" width="18" height="12" rx="2" />
    <path d="M7 20l3.5-4" />
    <circle cx="8" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="12" cy="10" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="16" cy="10" r="0.9" fill="currentColor" stroke="none" />
  </g>,
];

interface Placement {
  x: number;
  y: number;
  size: number;
  rotate: number;
  icon: number;
}

// Fixed layout (not random per render) so the page doesn't visually shift
// between server and client renders.
const PLACEMENTS: Placement[] = [
  { x: 8, y: 14, size: 64, rotate: -8, icon: 0 },
  { x: 88, y: 12, size: 58, rotate: 10, icon: 4 },
  { x: 14, y: 82, size: 54, rotate: 6, icon: 5 },
  { x: 90, y: 78, size: 62, rotate: -6, icon: 1 },
  { x: 50, y: 8, size: 48, rotate: 4, icon: 6 },
  { x: 5, y: 48, size: 50, rotate: -4, icon: 2 },
  { x: 95, y: 46, size: 46, rotate: 8, icon: 7 },
  { x: 44, y: 94, size: 56, rotate: -5, icon: 3 },
  { x: 76, y: 92, size: 40, rotate: 12, icon: 0 },
  { x: 22, y: 26, size: 38, rotate: -10, icon: 4 },
];

export default function AuthBackground({ subtle = false }: { subtle?: boolean } = {}) {
  return (
    <div
      className="pointer-events-none fixed inset-0 overflow-hidden -z-10"
      style={subtle ? { opacity: 0.4 } : undefined}
      aria-hidden="true"
    >
      {PLACEMENTS.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full flex items-center justify-center"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            transform: `translate(-50%, -50%) rotate(${p.rotate}deg)`,
            background: "var(--accent-soft)",
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: p.size * 0.52, height: p.size * 0.52 }}
          >
            {ICONS[p.icon]}
          </svg>
        </div>
      ))}
    </div>
  );
}
