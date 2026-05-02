import Image from "next/image";
import type { CheatsheetResponse } from "@/types/cheatsheet";
import { pokeArt, pokeSprite } from "@/lib/sprites";

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

const MOVE_CATEGORY_CLASSES: Record<string, string> = {
  stab: "border-primary/40 text-primary",
  priority: "border-tertiary/40 text-tertiary",
  utility: "border-accent/40 text-accent",
};

function renderNoteWithBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <span key={i} className="font-bold text-accent">
          {part.slice(2, -2)}
        </span>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

export function CheatsheetContent({ data }: { data: CheatsheetResponse }) {
  const maxSpeed = Math.max(...data.speed_tiers.map((t) => t.speed), 1);

  return (
    <div className="flex flex-col gap-8 pt-4">
      {/* Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.roster.map((mon, i) => (
          <div
            key={i}
            className="card relative overflow-hidden p-4 border border-outline-variant"
            style={{
              background: "linear-gradient(180deg, rgba(20,12,28,0.7), rgba(15,9,22,0.9))",
            }}
          >
            <Image
              src={pokeArt(mon.id || 0)}
              alt={mon.name}
              width={100}
              height={100}
              unoptimized
              className="absolute -right-2 -top-2 h-[100px] w-[100px] opacity-20 pointer-events-none"
            />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <span className="font-display text-base font-bold text-on-surface">
                  {mon.name}
                </span>
                {mon.is_mega && (
                  <span className="rounded-full border border-primary/40 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wider text-primary">
                    Mega
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1 mb-3">
                {mon.types.map((type) => (
                  <span
                    key={type}
                    className="px-2 py-px rounded-full font-mono text-[0.55rem] font-bold uppercase tracking-wider text-surface"
                    style={{ background: TYPE_COLORS[type.toLowerCase()] ?? "var(--color-on-surface-muted)" }}
                  >
                    {type}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mb-4">
                <div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-widest">Item</div>
                  <div className="font-display text-xs font-semibold text-accent">{mon.item ?? "--"}</div>
                </div>
                <div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-widest">Ability</div>
                  <div className="font-display text-xs font-semibold text-secondary">{mon.ability ?? "--"}</div>
                </div>
                <div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-widest">Nature / SP</div>
                  <div className="font-display text-[0.65rem] text-on-surface-muted">
                    {mon.nature ?? "--"} · {mon.stat_points ?? "0 SP"}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-outline-variant/30">
                {mon.moves.map((move, j) => (
                  <span
                    key={j}
                    className={`rounded-md border px-2 py-0.5 font-mono text-[0.6rem] tracking-tight ${
                      MOVE_CATEGORY_CLASSES[move.category] ?? "border-outline-variant text-on-surface-muted"
                    }`}
                  >
                    {move.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Game Plan */}
        <div className="card p-5 border border-primary/20 bg-primary/5">
          <div className="font-mono text-[0.7rem] tracking-[0.22em] text-primary mb-4 uppercase">
            ◆ Game Plan
          </div>
          <div className="flex flex-col gap-6">
            {data.game_plan.map((step) => (
              <div key={step.step} className="flex gap-4">
                <span className="font-display text-4xl font-bold leading-none text-primary/40 italic">
                  {step.step.toString().padStart(2, '0')}
                </span>
                <div className="min-w-0">
                  <p className="font-display text-[0.9rem] font-bold text-on-surface">{step.title}</p>
                  <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Speed Tiers */}
        <div className="card p-5 border border-accent/20 bg-accent/5">
          <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent mb-4 uppercase">
            ◆ Speed Tiers
          </div>
          <div className="flex flex-col gap-3.5">
            {data.speed_tiers.map((tier, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-display text-xs font-bold text-on-surface truncate">
                      {tier.pokemon}
                    </span>
                    {tier.note && (
                      <span className="font-mono text-[0.55rem] text-on-surface-dim uppercase truncate">
                        · {tier.note}
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-xs font-bold text-accent shrink-0">
                    {tier.speed}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-surface-lowest overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-accent/30 transition-all duration-500 shadow-[0_0_8px_var(--color-accent)]"
                    style={{ width: `${(tier.speed / maxSpeed) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Rules */}
        <div className="card p-5 border border-secondary/20 bg-secondary/5">
          <div className="font-mono text-[0.7rem] tracking-[0.22em] text-secondary mb-4 uppercase">
            ◆ Key Rules
          </div>
          <div className="flex flex-col gap-5">
            {data.key_rules.map((rule, i) => (
              <div
                key={i}
                className="relative pl-5 py-0.5"
              >
                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gradient-to-b from-secondary to-transparent" />
                <p className="font-display text-[0.85rem] font-bold text-on-surface">{rule.title}</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                  {rule.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Matchups */}
      <div className="card p-5 border border-outline-variant bg-[rgba(10,5,16,0.4)]">
        <div className="font-mono text-[0.7rem] tracking-[0.22em] text-on-surface-dim mb-6 uppercase">
          ◆ Lead Matchups
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {data.lead_matchups.map((matchup, i) => (
            <div key={i} className="rounded-xl border border-outline-variant p-4 bg-surface-low/40">
              <div className="mb-4 flex items-center justify-between">
                <span className="font-mono text-[0.65rem] font-bold text-accent tracking-[0.15em] uppercase">
                  {matchup.archetype}
                </span>
                <span className={`px-2 py-0.5 rounded text-[0.55rem] font-bold font-mono tracking-widest ${
                  matchup.threat_tier === "HIGH" ? "bg-primary/20 text-primary border border-primary/30" : 
                  matchup.threat_tier === "MEDIUM" ? "bg-accent/20 text-accent border border-accent/30" : 
                  "bg-success/20 text-success border border-success/30"
                }`}>
                  {matchup.threat_tier} THREAT
                </span>
              </div>
              <div className="grid grid-cols-[1fr_1fr] gap-4 mb-4">
                <div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-[0.2em] mb-2">Lead</div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchup.lead.map((name, j) => (
                      <span key={j} className="px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-display text-[0.7rem] font-bold">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-[0.2em] mb-2">Back</div>
                  <div className="flex flex-wrap gap-1.5">
                    {matchup.back.map((name, j) => (
                      <span key={j} className="px-2 py-0.5 rounded bg-on-surface/5 text-on-surface-muted border border-outline-variant font-display text-[0.7rem] font-bold">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              {matchup.note && (
                <div className="pt-3 border-t border-outline-variant/30 font-body text-[0.7rem] leading-relaxed text-on-surface-muted italic">
                  {renderNoteWithBold(matchup.note)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* AI Disclaimer */}
      {data.ai_disclaimer && (
        <div className="rounded-xl border border-outline-variant bg-surface-lowest px-5 py-3 text-center">
          <p className="font-mono text-[0.6rem] tracking-[0.1em] text-on-surface-dim">
            {data.ai_disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
