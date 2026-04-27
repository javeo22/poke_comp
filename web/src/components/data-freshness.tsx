"use client";

import { useEffect, useState } from "react";
import { fetchDataFreshness, type DataFreshnessFormat } from "@/lib/api";

interface Props {
  format: string;
  className?: string;
}

export function DataFreshness({ format, className }: Props) {
  const [data, setData] = useState<DataFreshnessFormat | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchDataFreshness()
      .then((res) => {
        if (!alive) return;
        setData(res.formats[format] ?? null);
      })
      .catch(() => {
        if (!alive) return;
        setError(true);
      });
    return () => {
      alive = false;
    };
  }, [format]);

  if (error || !data) return null;

  const days = data.days_old;
  const isStale = data.stale;
  const dotColor = isStale ? "var(--color-primary)" : "var(--color-success)";
  const labelColor = isStale ? "var(--color-primary)" : "var(--color-on-surface-variant)";
  const ageLabel =
    days === null
      ? "UNKNOWN"
      : days === 0
        ? "TODAY"
        : days === 1
          ? "1 DAY OLD"
          : `${days} DAYS OLD`;

  return (
    <div
      className={`mono-label inline-flex items-center gap-2 ${className ?? ""}`}
      style={{ color: labelColor }}
      title={`Pokemon usage snapshot: ${data.snapshot_date}${isStale ? " (stale — refresh pending)" : ""}`}
    >
      <span
        className={isStale ? "" : "pulse-dot"}
        style={
          isStale
            ? {
                width: 8,
                height: 8,
                borderRadius: 9999,
                background: dotColor,
                boxShadow: `0 0 10px ${dotColor}`,
              }
            : { background: dotColor }
        }
        aria-hidden
      />
      <span>◆ DATA · {ageLabel}</span>
    </div>
  );
}
