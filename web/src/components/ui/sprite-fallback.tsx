/**
 * Magenta-tinted Pokeball silhouette for missing sprite_url.
 * Pure SVG so it never 404s; sized to fill its parent box.
 */
export function SpriteFallback({
  size = 96,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Sprite unavailable"
      className={className}
    >
      <defs>
        <linearGradient id="sf-magenta" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FF2D7A" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#7E22CE" stopOpacity="0.45" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="28" fill="url(#sf-magenta)" opacity="0.25" />
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="none"
        stroke="url(#sf-magenta)"
        strokeWidth="2"
      />
      <line
        x1="4"
        y1="32"
        x2="60"
        y2="32"
        stroke="url(#sf-magenta)"
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r="6" fill="#0a0510" />
      <circle
        cx="32"
        cy="32"
        r="6"
        fill="none"
        stroke="url(#sf-magenta)"
        strokeWidth="2"
      />
      <circle cx="32" cy="32" r="2" fill="#FFD23F" opacity="0.7" />
    </svg>
  );
}
