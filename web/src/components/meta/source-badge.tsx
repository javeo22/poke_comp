interface SourceBadgeProps {
  source?: string | null;
  date?: string | null;
  stale?: boolean;
  fallback?: boolean;
  className?: string;
}

function sourceLabel(source?: string | null) {
  if (!source) return "Source unknown";
  if (source.toLowerCase() === "pikalytics") return "Pikalytics";
  if (source.toLowerCase() === "smogon") return "Smogon";
  if (source.toLowerCase() === "limitless") return "Limitless";
  if (source.toLowerCase() === "usage") return "Usage snapshot";
  return source;
}

export function SourceBadge({ source, date, stale, fallback, className }: SourceBadgeProps) {
  const tone = fallback || stale ? "text-primary border-primary/30 bg-primary/10" : "text-success border-success/30 bg-success/10";
  const label = fallback ? "Fallback data" : sourceLabel(source);
  const detail = date ? ` · ${date}` : "";

  return (
    <span
      className={`inline-flex items-center rounded-[2px] border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider ${tone} ${className ?? ""}`}
      title={`${label}${detail}`}
    >
      {label}{detail}
    </span>
  );
}
