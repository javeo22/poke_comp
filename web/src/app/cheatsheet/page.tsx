"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Team } from "@/types/team";
import type { CheatsheetResponse } from "@/types/cheatsheet";
import {
  fetchTeams,
  generateCheatsheet,
  fetchAllCheatsheets,
  fetchAiUsage,
} from "@/lib/api";
import type { AiUsageToday, SavedCheatsheet } from "@/lib/api";
import { exportCheatsheetPDF } from "@/lib/pdf-export";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";

// ── Pokemon Type Colors ──

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

// ── Helpers ──

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Cheatsheet Card Content ──

function CheatsheetContent({ data }: { data: CheatsheetResponse }) {
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

// ── Main Page ──

export default function CheatsheetPage() {
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [savedCheatsheets, setSavedCheatsheets] = useState<SavedCheatsheet[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(preselectedTeamId || null);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quota, setQuota] = useState<AiUsageToday | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsResult, cheatsheetsResult] = await Promise.allSettled([
        fetchTeams({ limit: 200 }),
        fetchAllCheatsheets(),
      ]);
      if (teamsResult.status === "fulfilled") setTeams(teamsResult.value.data);
      if (cheatsheetsResult.status === "fulfilled") setSavedCheatsheets(cheatsheetsResult.value);
      fetchAiUsage()
        .then((usage) => setQuota(usage.today))
        .catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Teams that don't have a cheatsheet yet
  const teamsWithoutCheatsheet = useMemo(() => {
    const hasSheet = new Set(savedCheatsheets.map((s) => s.team_id));
    return teams.filter((t) => !hasSheet.has(t.id));
  }, [teams, savedCheatsheets]);

  const teamOptions: DropdownOption[] = useMemo(
    () =>
      teamsWithoutCheatsheet.map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: `${t.format}${t.archetype_tag ? ` / ${t.archetype_tag}` : ""}`,
      })),
    [teamsWithoutCheatsheet]
  );

  // Also allow regenerating for teams that already have one
  const allTeamOptions: DropdownOption[] = useMemo(
    () =>
      teams.map((t) => ({
        value: t.id,
        label: t.name,
        sublabel: `${t.format}${t.archetype_tag ? ` / ${t.archetype_tag}` : ""}`,
      })),
    [teams]
  );

  const handleGenerate = async () => {
    if (!selectedTeamId || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      await generateCheatsheet(selectedTeamId);
      // Reload all cheatsheets to get the new one
      const updated = await fetchAllCheatsheets();
      setSavedCheatsheets(updated);
      setExpandedId(selectedTeamId);
      setSelectedTeamId("");
      fetchAiUsage()
        .then((usage) => setQuota(usage.today))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate cheatsheet");
    } finally {
      setIsGenerating(false);
    }
  };

  const toggleExpand = (teamId: string) => {
    setExpandedId((prev) => (prev === teamId ? null : teamId));
  };

  // Find team name for a saved cheatsheet
  const teamNameMap = useMemo(() => {
    const map = new Map<string, Team>();
    for (const t of teams) map.set(t.id, t);
    return map;
  }, [teams]);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="h-10 w-48 animate-pulse rounded-[1rem] bg-surface-low mb-8" />
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-[1rem] bg-surface-low" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
          Cheatsheets
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-muted">
          AI-generated game plans &middot; One page per team
        </p>
      </div>

      {/* Generate new */}
      <div className="rounded-[1rem] bg-surface-low p-6 mb-8">
        <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Generate Cheatsheet
        </h2>
        <div className="flex flex-wrap items-end gap-4">
          <div className="w-full max-w-sm">
            <SearchableDropdown
              placeholder={
                allTeamOptions.length === 0 ? "No teams yet" : "Select a team..."
              }
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              options={allTeamOptions}
            />
          </div>
          <button
            onClick={handleGenerate}
            disabled={!selectedTeamId || isGenerating || (quota !== null && quota.remaining <= 0)}
            className="btn-primary h-12 px-8 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isGenerating ? "Generating..." : "Generate"}
          </button>
          {quota !== null && (
            <span
              className={`font-display text-xs ${quota.remaining <= 0 ? "text-tertiary" : "text-on-surface-muted"}`}
            >
              {quota.remaining <= 0
                ? "Daily limit reached"
                : `${quota.used}/${quota.limit} analyses today`}
            </span>
          )}
        </div>
        {error && (
          <p className="mt-3 font-body text-sm text-tertiary">{error}</p>
        )}
      </div>

      {/* Saved cheatsheets */}
      {savedCheatsheets.length === 0 && !isGenerating ? (
        <div className="rounded-[1rem] bg-surface-low p-12 text-center">
          <p className="font-display text-sm text-on-surface-muted">
            No cheatsheets yet. Select a team above to generate one.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {isGenerating && (
            <div className="h-20 animate-pulse rounded-[1rem] bg-surface-low" />
          )}
          {savedCheatsheets.map((saved) => {
            const data = saved.cheatsheet_json;
            const team = teamNameMap.get(saved.team_id);
            const isExpanded = expandedId === saved.team_id;

            return (
              <div
                key={saved.team_id}
                className="rounded-[1rem] bg-surface-low overflow-hidden border border-outline-variant"
              >
                {/* Collapsed header -- always visible */}
                <button
                  onClick={() => toggleExpand(saved.team_id)}
                  className="flex w-full items-center gap-4 p-5 text-left transition-colors hover:bg-surface-mid/30"
                >
                  <svg
                    className={`h-4 w-4 shrink-0 text-on-surface-muted transition-transform duration-200 ${
                      isExpanded ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-display text-lg font-bold uppercase tracking-tight text-on-surface truncate">
                        {data.team_title}
                      </h3>
                      <span className="rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted shrink-0">
                        {data.format}
                      </span>
                    </div>
                    <p className="mt-0.5 font-display text-xs text-on-surface-muted truncate">
                      {team?.name ?? data.team_name} &middot; {data.archetype}
                    </p>
                  </div>
                  <span className="font-display text-[0.6rem] text-on-surface-muted/50 shrink-0">
                    {timeAgo(saved.updated_at)}
                  </span>
                </button>

                {/* Expanded content */}
                {isExpanded && (
                  <div className="border-t border-outline-variant px-5 pb-6 pt-4">
                    {/* Action bar */}
                    <div className="mb-4 flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCheatsheetPDF(data.team_title);
                        }}
                        className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider"
                      >
                        Export PDF
                      </button>
                      <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted/50">
                        {data.roster.length} Pokemon
                      </span>
                    </div>
                    <div id="cheatsheet-content">
                      <CheatsheetContent data={data} />
                    </div>
                    {/* Contextual support prompt */}
                    <div className="mt-4 rounded-xl bg-surface-mid/30 px-5 py-3 flex items-center justify-between gap-4">
                      <p className="font-body text-xs text-on-surface-muted">
                        Cheatsheets are powered by AI and cost real money to generate.
                        Help keep PokeComp free for everyone.
                      </p>
                      <a
                        href="https://ko-fi.com/pokecompapp"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost h-8 px-4 font-display text-[0.6rem] uppercase tracking-wider shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Support
                      </a>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
