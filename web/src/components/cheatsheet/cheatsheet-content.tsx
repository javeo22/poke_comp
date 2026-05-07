import Image from "next/image";
import type { ReactNode } from "react";
import type { CheatsheetResponse } from "@/types/cheatsheet";
import { pokeSprite } from "@/lib/sprites";

const TYPE_COLORS: Record<string, string> = {
  fire: "#EE8130",
  water: "#6390F0",
  grass: "#7AC74C",
  electric: "#F7D02C",
  ice: "#96D9D6",
  fighting: "#C22E28",
  poison: "#A33EA1",
  ground: "#E2BF65",
  flying: "#A98FF3",
  psychic: "#F95587",
  bug: "#A6B91A",
  rock: "#B6A136",
  ghost: "#735797",
  dragon: "#6F35FC",
  dark: "#705746",
  steel: "#B7B7CE",
  fairy: "#D685AD",
  normal: "#A8A77A",
};

function renderNoteWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="font-bold text-primary">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function shortDate(value?: string | null) {
  if (!value) return "Fresh run";
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CheatsheetContent({ data }: { data: CheatsheetResponse }) {
  const roster = data.roster.slice(0, 6);

  return (
    <div className="mx-auto w-full max-w-[860px] bg-surface-lowest p-5 text-on-surface sm:p-7">
      <article className="relative min-h-[1100px] overflow-hidden border-2 border-outline-variant bg-surface-lowest p-6 shadow-[8px_8px_0_var(--color-outline-variant)] sm:p-8">
        {/* Masthead */}
        <header className="mb-4 flex items-end justify-between gap-4 border-b-[3px] border-double border-outline-variant pb-3">
          <div className="min-w-0">
            <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-primary">
              ◆ Operative briefing
            </p>
            <h2 className="mt-1 truncate font-display text-3xl font-bold uppercase leading-none tracking-[-0.01em] text-on-surface sm:text-4xl">
              {data.team_title}
            </h2>
          </div>
          <div className="shrink-0 text-right font-mono text-[0.55rem] uppercase tracking-[0.15em] text-on-surface-muted">
            {data.format}
            <br />
            {shortDate(data.generated_at)}
          </div>
        </header>

        {/* Team row */}
        <section className="mb-5 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {roster.map((mon, index) => (
            <div
              key={`${mon.name}-${index}`}
              className="relative aspect-square border border-outline-variant bg-surface"
            >
              {mon.id ? (
                <Image
                  src={pokeSprite(mon.id)}
                  alt={mon.name}
                  fill
                  unoptimized
                  className="image-rendering-pixelated object-contain p-1"
                />
              ) : (
                <div className="grid h-full place-items-center font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
                  PKMN
                </div>
              )}
            </div>
          ))}
        </section>

        {/* Roster cards */}
        <section className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {roster.map((mon, index) => (
            <div
              key={`${mon.name}-card-${index}`}
              className="border border-outline-variant bg-surface p-2.5"
            >
              <div className="mb-1.5 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-sm font-bold uppercase tracking-[0.02em]">
                    {mon.name}
                  </h3>
                  <p className="truncate font-mono text-[0.5rem] uppercase tracking-[0.12em] text-on-surface-muted">
                    {mon.item ?? "No item"} · {mon.ability ?? "No ability"}
                  </p>
                </div>
                {mon.is_mega && (
                  <span className="border border-outline-variant bg-primary px-1.5 py-0.5 font-mono text-[0.45rem] font-bold uppercase tracking-wider text-surface">
                    Mega
                  </span>
                )}
              </div>

              <div className="mb-2 flex flex-wrap gap-1">
                {mon.types.map((type) => (
                  <span
                    key={type}
                    className="border border-outline-variant px-1.5 py-0.5 font-mono text-[0.48rem] font-bold uppercase tracking-[0.08em] text-on-surface"
                    style={{ background: TYPE_COLORS[type.toLowerCase()] ?? "var(--color-surface-high)" }}
                  >
                    {type}
                  </span>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-1 border-t border-outline-variant pt-2">
                {mon.moves.slice(0, 4).map((move, moveIndex) => (
                  <span
                    key={`${move.name}-${moveIndex}`}
                    className="truncate border border-outline-variant bg-surface-lowest px-1.5 py-0.5 font-mono text-[0.5rem] text-on-surface-muted"
                  >
                    {move.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Two-column dossier */}
        <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Speed tiers">
            <div className="space-y-1.5 font-mono text-[0.65rem] leading-relaxed">
              {data.speed_tiers.map((tier, index) => (
                <div key={`${tier.pokemon}-${index}`} className="flex gap-2">
                  <span className="w-10 shrink-0 font-bold text-primary">{tier.speed}</span>
                  <span className="min-w-0 flex-1 truncate">
                    <strong>{tier.pokemon}</strong>
                    {tier.note && (
                      <span className="text-on-surface-muted"> · {tier.note}</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Game plan">
            <div className="space-y-2">
              {data.game_plan.map((step) => (
                <div key={step.step} className="grid grid-cols-[2rem_1fr] gap-2">
                  <span className="font-display text-2xl font-bold leading-none text-primary/50">
                    {step.step.toString().padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-display text-sm font-bold uppercase leading-tight">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-on-surface-muted">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </section>

        <section className="mb-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Panel title="Key rules">
            <div className="space-y-2">
              {data.key_rules.map((rule, index) => (
                <div key={`${rule.title}-${index}`} className="border-l-2 border-primary pl-3">
                  <p className="font-display text-sm font-bold uppercase leading-tight">
                    {rule.title}
                  </p>
                  <p className="mt-0.5 text-xs leading-relaxed text-on-surface-muted">
                    {rule.description}
                  </p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Watch out">
            <div className="space-y-2">
              {data.weaknesses.length > 0 ? (
                data.weaknesses.map((weakness, index) => (
                  <div key={`${weakness.title}-${index}`}>
                    <p className="font-display text-sm font-bold uppercase leading-tight">
                      {weakness.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-relaxed text-on-surface-muted">
                      {weakness.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-xs leading-relaxed text-on-surface-muted">
                  No major weaknesses were returned for this sheet.
                </p>
              )}
            </div>
          </Panel>
        </section>

        {/* Lead matchups table */}
        <section className="mb-12">
          <div className="mb-1 border-b border-outline-variant pb-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-primary">
            Lead matrix · vs common threats
          </div>
          <div className="overflow-hidden border border-outline-variant">
            <table className="w-full border-collapse font-mono text-[0.58rem]">
              <thead className="bg-surface">
                <tr>
                  <TableHead>Vs archetype</TableHead>
                  <TableHead>Lead</TableHead>
                  <TableHead>Back</TableHead>
                  <TableHead>Tier</TableHead>
                </tr>
              </thead>
              <tbody>
                {data.lead_matchups.map((matchup, index) => (
                  <tr key={`${matchup.archetype}-${index}`}>
                    <TableCell>
                      <strong>{matchup.archetype}</strong>
                      <span className="block truncate text-on-surface-muted">
                        {matchup.example}
                      </span>
                    </TableCell>
                    <TableCell>{matchup.lead.join(" + ")}</TableCell>
                    <TableCell>{matchup.back.join(" + ")}</TableCell>
                    <TableCell>
                      <span className="font-bold text-primary">{matchup.threat_tier}</span>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data.lead_matchups[0]?.note && (
            <p className="mt-2 text-xs italic leading-relaxed text-on-surface-muted">
              {renderNoteWithBold(data.lead_matchups[0].note)}
            </p>
          )}
        </section>

        <footer className="absolute bottom-4 left-6 right-6 flex justify-between border-t border-outline-variant pt-2 font-mono text-[0.5rem] uppercase tracking-[0.15em] text-on-surface-muted sm:left-8 sm:right-8">
          <span>PokeComp · {data.team_name}</span>
          <span className="text-primary">Prepare for trouble.</span>
          <span>{data.cached ? "Cached" : "Fresh"} · AI sheet</span>
        </footer>
      </article>

      {data.ai_disclaimer && (
        <p className="mt-4 text-center font-mono text-[0.55rem] uppercase tracking-[0.12em] text-on-surface-muted">
          {data.ai_disclaimer}
        </p>
      )}
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 border-b border-outline-variant pb-1 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-primary">
        {title}
      </div>
      {children}
    </div>
  );
}

function TableHead({ children }: { children: ReactNode }) {
  return (
    <th className="border border-outline-variant px-2 py-1.5 text-left font-semibold uppercase tracking-[0.08em]">
      {children}
    </th>
  );
}

function TableCell({ children }: { children: ReactNode }) {
  return (
    <td className="border border-outline-variant px-2 py-1.5 align-top">
      {children}
    </td>
  );
}
