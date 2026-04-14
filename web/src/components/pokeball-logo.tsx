/**
 * Pokeball icon with crosshair/targeting lines at 45 degrees.
 * Renders in currentColor so it inherits whatever text color is applied.
 */
export function PokeballLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      className={className}
      aria-hidden="true"
    >
      {/* Outer circle */}
      <circle cx="12" cy="12" r="10" />

      {/* Horizontal divider — left segment and right segment, gapped at center button */}
      <line x1="2" y1="12" x2="9" y2="12" />
      <line x1="15" y1="12" x2="22" y2="12" />

      {/* Center button */}
      <circle cx="12" cy="12" r="3" />

      {/*
        45-degree targeting lines — four segments radiating from the button edge
        to the outer circle, skipping through the center button.
        Points at 45° on r=3: (±2.12, ∓2.12) from center (12,12)
        Points at 45° on r=10: (±7.07, ∓7.07) from center
      */}
      {/* NW outer → NW button edge */}
      <line x1="4.93" y1="4.93" x2="9.88" y2="9.88" />
      {/* NE button edge → NE outer */}
      <line x1="14.12" y1="9.88" x2="19.07" y2="4.93" />
      {/* SW button edge → SW outer */}
      <line x1="9.88" y1="14.12" x2="4.93" y2="19.07" />
      {/* SE button edge → SE outer */}
      <line x1="14.12" y1="14.12" x2="19.07" y2="19.07" />
    </svg>
  );
}
