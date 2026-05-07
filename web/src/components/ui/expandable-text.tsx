"use client";

import { useState } from "react";

interface ExpandableTextProps {
  text: string | null | undefined;
  empty?: string;
  className?: string;
  collapsedClassName?: string;
}

export function ExpandableText({
  text,
  empty = "\u2014",
  className = "",
  collapsedClassName = "line-clamp-2",
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const value = text?.trim();

  if (!value) {
    return <span className={className}>{empty}</span>;
  }

  return (
    <button
      type="button"
      onClick={() => setExpanded((v) => !v)}
      className={`block w-full text-left ${className}`}
      aria-expanded={expanded}
    >
      <span className={expanded ? "" : collapsedClassName}>{value}</span>
      {value.length > 90 && (
        <span className="mt-1 block font-display text-[0.55rem] uppercase tracking-wider text-primary">
          {expanded ? "Show less" : "Show more"}
        </span>
      )}
    </button>
  );
}
