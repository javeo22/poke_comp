import Link from "next/link";
import type { ReactNode } from "react";
import type { TeamBenchmarkResponse } from "@/lib/api";
import { SourceBadge } from "@/components/meta/source-badge";

interface TeamBenchmarkPanelProps {
  data: TeamBenchmarkResponse | null;
  loading?: boolean;
  error?: string | null;
  compact?: boolean;
  onRetry?: () => void;
}

export function TeamBenchmarkPanel({
  data,
  loading = false,
  error = null,
  compact = false,
  onRetry,
}: TeamBenchmarkPanelProps) {
  if (loading) {
    return (
      <div className="rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-5 font-body text-sm text-on-surface-muted">
        Running benchmark against current usage threats...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-[2px] border-2 border-primary bg-primary/10 p-5">
        <p className="font-display text-sm font-semibold text-primary">Could not benchmark this team</p>
        <p className="mt-1 font-body text-sm text-on-surface-muted">{error}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary mt-4 h-9 px-5 font-display text-xs uppercase tracking-wider"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="rounded-[2px] border-2 border-dashed border-outline-variant bg-surface-low p-5 font-body text-sm text-on-surface-muted">
        Select a saved team to benchmark it against the live meta.
      </div>
    );
  }

  const limit = compact ? 3 : 6;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <BenchmarkMeta label="Threats" value={String(data.threat_count)} />
          <BenchmarkMeta label="Format" value={data.format} />
          <BenchmarkMeta label="Gaps" value={String(data.coverage_gaps.length)} />
          <BenchmarkMeta label="Snapshot" value={data.meta_snapshot_date ?? "latest"} />
        </div>
        <SourceBadge source="usage" date={data.meta_snapshot_date} />
      </div>

      <div className={`grid grid-cols-1 gap-4 ${compact ? "xl:grid-cols-2" : "lg:grid-cols-2"}`}>
        <BenchmarkSection title="Defensive danger">
          {data.defensive_dangers.length > 0 ? (
            data.defensive_dangers.slice(0, limit).map((row) => (
              <BenchmarkRow
                key={`${row.pokemon_id}-${row.move}-${row.target_name}`}
                title={`${row.pokemon_name} -> ${row.target_name}`}
                detail={`${row.move ?? "Best move"}: ${row.damage_text}`}
                badge={row.severity}
                tone={row.severity === "ohko" || row.severity === "danger" ? "bad" : "neutral"}
                href={`/calc?attacker=${row.pokemon_id}`}
              />
            ))
          ) : (
            <EmptyLine text="No damaging usage moves could be benchmarked." />
          )}
        </BenchmarkSection>

        <BenchmarkSection title="Offensive answers">
          {data.offensive_answers.length > 0 ? (
            data.offensive_answers.slice(0, limit).map((row) => (
              <BenchmarkRow
                key={`${row.pokemon_id}-${row.answer_pokemon}-${row.move}`}
                title={`${row.answer_pokemon} -> ${row.pokemon_name}`}
                detail={`${row.move ?? "Best saved move"}: ${row.damage_text}`}
                badge={row.reliability}
                tone={row.reliability === "ko" || row.reliability === "strong" ? "good" : "neutral"}
                href={`/calc?defender=${row.pokemon_id}`}
              />
            ))
          ) : (
            <EmptyLine text="No saved attacking moves could be benchmarked." />
          )}
        </BenchmarkSection>

        <BenchmarkSection title="Speed issues">
          {data.speed_issues.length > 0 ? (
            data.speed_issues.slice(0, limit).map((row) => (
              <BenchmarkRow
                key={`${row.pokemon_id}-speed`}
                title={row.pokemon_name}
                detail={`${row.threat_speed} Spe vs ${row.fastest_team_member ?? "team"} at ${row.fastest_team_speed}. ${row.note}`}
                badge="outspeeds"
                tone="bad"
                href={`/pokemon/${row.pokemon_id}`}
              />
            ))
          ) : (
            <EmptyLine text="No top threat outspeeds your fastest saved build before modifiers." />
          )}
        </BenchmarkSection>

        <BenchmarkSection title="Coverage gaps">
          {data.coverage_gaps.length > 0 ? (
            data.coverage_gaps.slice(0, limit).map((row) => (
              <BenchmarkRow
                key={`${row.pokemon_id}-coverage`}
                title={row.pokemon_name}
                detail={`${row.best_answer ?? "No answer"} tops out at ${row.best_damage_percent.toFixed(1)}%. ${row.note}`}
                badge="gap"
                tone="bad"
                href={`/pokemon/${row.pokemon_id}`}
              />
            ))
          ) : (
            <EmptyLine text="Every benchmarked threat has a saved move above the chip threshold." />
          )}
        </BenchmarkSection>
      </div>
    </div>
  );
}

function BenchmarkMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-3">
      <p className="font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </p>
      <p className="mt-1 truncate font-display text-lg font-semibold text-on-surface">
        {value}
      </p>
    </div>
  );
}

function BenchmarkSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-4">
      <h3 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-on-surface">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function BenchmarkRow({
  title,
  detail,
  badge,
  tone,
  href,
}: {
  title: string;
  detail: string;
  badge: string;
  tone: "good" | "bad" | "neutral";
  href?: string;
}) {
  const toneClass =
    tone === "good"
      ? "border-success/30 bg-success/10 text-success"
      : tone === "bad"
        ? "border-primary/30 bg-primary/10 text-primary"
        : "border-outline-variant bg-surface-high text-on-surface-muted";
  const content = (
    <>
      <div className="min-w-0">
        <p className="truncate font-display text-sm font-semibold text-on-surface">{title}</p>
        <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">{detail}</p>
      </div>
      <span
        className={`shrink-0 rounded-[2px] border px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider ${toneClass}`}
      >
        {badge}
      </span>
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex items-start justify-between gap-3 rounded-[2px] bg-surface-low p-3 transition-colors hover:bg-surface-mid"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-[2px] bg-surface-low p-3">
      {content}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="font-body text-sm text-on-surface-muted">{text}</p>;
}
