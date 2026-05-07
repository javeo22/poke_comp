interface PcMarkProps {
  className?: string;
  size?: number;
}

export function PcMark({ className = "", size = 32 }: PcMarkProps) {
  return (
    <svg
      width={size}
      height={Math.round(size * 0.625)}
      viewBox="0 0 160 100"
      className={className}
      aria-hidden="true"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="M8 10 H44 C61 10 71 22 71 38 C71 54 61 66 44 66 H24 V90 H8 Z M24 24 V52 H42 C50 52 55 47 55 38 C55 29 50 24 42 24 Z"
        fill="currentColor"
        stroke="var(--color-outline-variant)"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
      <path
        d="M152 28 C148 17 138 10 124 10 C104 10 90 26 90 50 C90 74 104 90 124 90 C138 90 148 83 152 72 L138 68 C135 75 130 78 124 78 C113 78 106 68 106 50 C106 32 113 22 124 22 C130 22 135 25 138 32 Z"
        fill="currentColor"
        stroke="var(--color-outline-variant)"
        strokeWidth="3"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

export function PcEmblem({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative grid aspect-square place-items-center rounded-full bg-surface-lowest ${className}`}
    >
      <div className="absolute inset-[7%] rounded-full border-[3px] border-outline-variant" />
      <div className="absolute inset-[14%] rounded-full border border-outline-variant" />
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden="true">
        {Array.from({ length: 24 }).map((_, index) => {
          const angle = (index / 24) * Math.PI * 2;
          const x1 = 100 + Math.cos(angle) * 78;
          const y1 = 100 + Math.sin(angle) * 78;
          const radius = index % 6 === 0 ? 70 : 74;
          const x2 = 100 + Math.cos(angle) * radius;
          const y2 = 100 + Math.sin(angle) * radius;

          return (
            <line
              key={index}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--color-outline-variant)"
              strokeWidth={index % 6 === 0 ? 2 : 1}
            />
          );
        })}
      </svg>
      <PcMark size={220} className="relative z-10 text-primary" />
      <div className="absolute bottom-[8%] font-mono text-[0.55rem] uppercase tracking-[0.24em] text-on-surface">
        <span className="text-primary">◆</span> Team PokeComp <span className="text-primary">◆</span>
      </div>
    </div>
  );
}
