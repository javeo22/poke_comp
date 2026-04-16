import type { CheatsheetResponse } from "@/types/cheatsheet";

const TYPE_COLORS: Record<string, string> = {
  fire: "bg-[#EE8130]/15 text-[#EE8130]",
  water: "bg-[#6390F0]/15 text-[#6390F0]",
  grass: "bg-[#7AC74C]/15 text-[#7AC74C]",
  electric: "bg-[#F7D02C]/15 text-[#F7D02C]",
  ice: "bg-[#96D9D6]/15 text-[#96D9D6]",
  fighting: "bg-[#C22E28]/15 text-[#C22E28]",
  poison: "bg-[#A33EA1]/15 text-[#A33EA1]",
  ground: "bg-[#E2BF65]/15 text-[#E2BF65]",
  flying: "bg-[#A98FF3]/15 text-[#A98FF3]",
  psychic: "bg-[#F95587]/15 text-[#F95587]",
  bug: "bg-[#A6B91A]/15 text-[#A6B91A]",
  rock: "bg-[#B6A136]/15 text-[#B6A136]",
  ghost: "bg-[#735797]/15 text-[#735797]",
  dragon: "bg-[#6F35FC]/15 text-[#6F35FC]",
  dark: "bg-[#705746]/15 text-[#705746]",
  steel: "bg-[#B7B7CE]/15 text-[#B7B7CE]",
  fairy: "bg-[#D685AD]/15 text-[#D685AD]",
  normal: "bg-[#A8A77A]/15 text-[#A8A77A]",
};

const MOVE_CATEGORY_CLASSES: Record<string, string> = {
  stab: "bg-primary-container/30 text-primary",
  priority: "bg-tertiary-container/30 text-tertiary",
  utility: "bg-[#FBBF24]/10 text-[#FBBF24]",
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

export function CheatsheetContent({ data }: { data: CheatsheetResponse }) {
  const maxSpeed = Math.max(...data.speed_tiers.map((t) => t.speed), 1);

  return (
    <div className="flex flex-col gap-6 pt-2">
      {/* Roster table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="text-left">
              <th className="pb-3 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Pokemon
              </th>
              <th className="pb-3 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Item
              </th>
              <th className="pb-3 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Ability
              </th>
              <th className="pb-3 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Nature / SP
              </th>
              <th className="pb-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Moves
              </th>
            </tr>
          </thead>
          <tbody>
            {data.roster.map((mon, i) => (
              <tr key={i} className="group transition-colors hover:bg-surface-mid/40">
                <td className="py-3 pr-4 align-top">
                  <div className="flex items-center gap-2">
                    <span className="font-body text-sm font-bold text-on-surface">
                      {mon.name}
                    </span>
                    {mon.is_mega && (
                      <span className="rounded-full bg-primary-container/30 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-primary">
                        Mega
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {mon.types.map((type) => (
                      <span
                        key={type}
                        className={`rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${
                          TYPE_COLORS[type.toLowerCase()] ?? "bg-surface-mid text-on-surface-muted"
                        }`}
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 pr-4 align-top">
                  <span className="font-body text-xs text-[#FBBF24]">{mon.item ?? "--"}</span>
                </td>
                <td className="py-3 pr-4 align-top">
                  <span className="font-body text-xs text-secondary">{mon.ability ?? "--"}</span>
                </td>
                <td className="py-3 pr-4 align-top">
                  <span className="font-body text-xs text-on-surface-muted">
                    {mon.nature ?? "--"}
                  </span>
                  {mon.stat_points && (
                    <p className="mt-0.5 font-body text-[0.6rem] text-on-surface-muted/60">
                      {mon.stat_points}
                    </p>
                  )}
                </td>
                <td className="py-3 align-top">
                  <div className="flex flex-wrap gap-1.5">
                    {mon.moves.map((move, j) => (
                      <span
                        key={j}
                        className={`rounded-full px-2.5 py-0.5 font-display text-[0.6rem] tracking-wide ${
                          MOVE_CATEGORY_CLASSES[move.category] ??
                          "bg-surface-mid text-on-surface-muted"
                        }`}
                      >
                        {move.name}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4 flex items-center gap-5 pt-3">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              STAB
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FBBF24]" />
            <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Utility
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-tertiary" />
            <span className="font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
              Priority
            </span>
          </div>
        </div>
      </div>

      {/* 3-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Game Plan */}
        <div className="rounded-[1rem] bg-surface-mid/30 p-5">
          <h4 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Game Plan
          </h4>
          <div className="flex flex-col gap-5">
            {data.game_plan.map((step) => (
              <div key={step.step} className="flex gap-3">
                <span className="font-display text-3xl leading-none text-primary/70">
                  {step.step}
                </span>
                <div className="min-w-0">
                  <p className="font-body text-sm font-bold text-primary">{step.title}</p>
                  <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Speed Tiers */}
        <div className="rounded-[1rem] bg-surface-mid/30 p-5">
          <h4 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Speed Tiers
          </h4>
          <div className="flex flex-col gap-3">
            {data.speed_tiers.map((tier, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <div className="flex items-baseline gap-2 min-w-0">
                    <span className="font-body text-xs font-semibold text-on-surface truncate">
                      {tier.pokemon}
                    </span>
                    {tier.note && (
                      <span className="font-body text-[0.6rem] text-secondary shrink-0">
                        {tier.note}
                      </span>
                    )}
                  </div>
                  <span className="font-display text-xs font-bold text-on-surface-muted shrink-0">
                    {tier.speed}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-surface-mid overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-primary/50 transition-all duration-500"
                    style={{ width: `${(tier.speed / maxSpeed) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Key Rules */}
        <div className="rounded-[1rem] bg-surface-mid/30 p-5">
          <h4 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Key Rules
          </h4>
          <div className="flex flex-col gap-4">
            {data.key_rules.map((rule, i) => (
              <div
                key={i}
                className="pl-4"
                style={{
                  borderLeft:
                    "2px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
                }}
              >
                <p className="font-body text-sm font-bold text-primary">{rule.title}</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                  {rule.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Lead Matchups + Weaknesses */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-[1rem] bg-surface-mid/30 p-5">
          <h4 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Lead Matchups
          </h4>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {data.lead_matchups.map((matchup, i) => (
              <div key={i} className="rounded-[1rem] bg-surface-low/60 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-mono text-xs font-medium text-[#FBBF24]">
                    {matchup.archetype}
                  </span>
                  <span className="rounded-full bg-tertiary-container/30 px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-tertiary">
                    {matchup.threat_tier}
                  </span>
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <span className="font-display text-[0.55rem] uppercase tracking-widest text-on-surface-muted w-10 shrink-0">
                    Lead
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {matchup.lead.map((name, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-primary-container/30 px-2.5 py-0.5 font-display text-[0.6rem] text-primary"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mb-3 flex items-center gap-2">
                  <span className="font-display text-[0.55rem] uppercase tracking-widest text-on-surface-muted w-10 shrink-0">
                    Back
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {matchup.back.map((name, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-surface-high px-2.5 py-0.5 font-display text-[0.6rem] text-on-surface-muted"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                {matchup.note && (
                  <p className="font-body text-[0.65rem] leading-relaxed text-on-surface-muted">
                    {renderNoteWithBold(matchup.note)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1rem] bg-surface-mid/30 p-5">
          <h4 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Weaknesses
          </h4>
          <div className="flex flex-col gap-4">
            {data.weaknesses.map((weakness, i) => (
              <div
                key={i}
                className="pl-4"
                style={{
                  borderLeft:
                    "2px solid color-mix(in srgb, var(--color-tertiary) 50%, transparent)",
                }}
              >
                <p className="font-body text-sm font-bold text-[#FBBF24]">{weakness.title}</p>
                <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                  {weakness.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Disclaimer */}
      {data.ai_disclaimer && (
        <div className="rounded-xl border border-outline-variant bg-surface-lowest px-5 py-3">
          <p className="font-body text-xs leading-relaxed text-on-surface-muted">
            {data.ai_disclaimer}
          </p>
        </div>
      )}
    </div>
  );
}
