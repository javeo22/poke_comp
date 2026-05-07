"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import type { Team } from "@/types/team";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import {
  fetchTeams,
  fetchPokemon,
  fetchUserPokemon,
  generateCheatsheet,
  generateSelectionCheatsheet,
  fetchAllCheatsheets,
  fetchAiUsage,
  toggleCheatsheetVisibility,
  deleteCheatsheet,
} from "@/lib/api";
import type { AiUsageMonth, AiUsageToday, SavedCheatsheet, CheatsheetResponse } from "@/lib/api";
import { QuotaIndicator } from "@/components/quota-indicator";
import { exportCheatsheetPDF } from "@/lib/pdf-export";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";
import { CheatsheetContent } from "@/components/cheatsheet/cheatsheet-content";
import { DataFreshness } from "@/components/data-freshness";
import { AuthEmptyState } from "@/components/ui/auth-empty-state";
import {
  DEMO_CHEATSHEET,
  DEMO_ROSTER,
  DEMO_TEAMS,
  isDemoModeEnabled,
} from "@/lib/demo-data";
import { friendlyError } from "@/lib/errors";

// ── Helpers ──

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function CheatsheetPage() {
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [roster, setRoster] = useState<UserPokemon[]>([]);
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [savedCheatsheets, setSavedCheatsheets] = useState<SavedCheatsheet[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(preselectedTeamId || null);
  
  // Selection Mode
  const [selectionMode, setSelectionMode] = useState<"team" | "quick">("team");
  const [quickSelection, setQuickSelection] = useState<string[]>([]);
  
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [tempSheet, setTempSheet] = useState<CheatsheetResponse | null>(null);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [demoMode] = useState(isDemoModeEnabled);
  const [quota, setQuota] = useState<AiUsageToday | null>(null);
  const [quotaMonth, setQuotaMonth] = useState<AiUsageMonth | null>(null);
  const [isSupporter, setIsSupporter] = useState(false);
  const [isUnlimited, setIsUnlimited] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setAuthRequired(false);
    try {
      if (demoMode) {
        const pokemonResult = await fetchPokemon({ limit: 1000, champions_only: true });
        const pMap = new Map<number, Pokemon>();
        for (const p of pokemonResult.data) pMap.set(p.id, p);
        setPokemonMap(pMap);
        setTeams(DEMO_TEAMS);
        setRoster(DEMO_ROSTER);
        setSavedCheatsheets([
          {
            id: "demo-cheatsheet",
            team_id: "demo-balance",
            cheatsheet_json: DEMO_CHEATSHEET,
            is_public: false,
            created_at: "2026-05-07T00:00:00.000Z",
            updated_at: "2026-05-07T00:00:00.000Z",
          },
        ]);
        return;
      }
      const [teamsResult, cheatsheetsResult, rosterResult, pokemonResult] = await Promise.allSettled([
        fetchTeams({ limit: 200 }),
        fetchAllCheatsheets(),
        fetchUserPokemon({ limit: 500 }),
        fetchPokemon({ limit: 1000, champions_only: true }),
      ]);
      if (teamsResult.status === "fulfilled") setTeams(teamsResult.value.data);
      if (cheatsheetsResult.status === "fulfilled") setSavedCheatsheets(cheatsheetsResult.value);
      if (rosterResult.status === "fulfilled") setRoster(rosterResult.value.data);
      const rejected = [teamsResult, cheatsheetsResult, rosterResult].find(
        (result) =>
          result.status === "rejected" && friendlyError(result.reason).isAuthRequired
      );
      if (rejected) setAuthRequired(true);
      if (pokemonResult.status === "fulfilled") {
        const pMap = new Map<number, Pokemon>();
        for (const p of pokemonResult.value.data) pMap.set(p.id, p);
        setPokemonMap(pMap);
      }
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
          setIsUnlimited(usage.unlimited);
        })
        .catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, [demoMode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  const refreshUsage = () => {
    fetchAiUsage()
      .then((usage) => {
        setQuota(usage.today);
        setQuotaMonth(usage.month);
        setIsSupporter(usage.supporter);
        setIsUnlimited(usage.unlimited);
      })
      .catch(() => {});
  };

  const handleGenerate = async () => {
    if (selectionMode === "team") {
      if (!selectedTeamId || isGenerating) return;
      setIsGenerating(true);
      setError(null);
      setTempSheet(null);
      try {
        if (demoMode) {
          setSavedCheatsheets((prev) => (prev.length ? prev : [{
            id: "demo-cheatsheet",
            team_id: "demo-balance",
            cheatsheet_json: DEMO_CHEATSHEET,
            is_public: false,
            created_at: "2026-05-07T00:00:00.000Z",
            updated_at: "2026-05-07T00:00:00.000Z",
          }]));
          setExpandedId("demo-balance");
          return;
        }
        await generateCheatsheet(selectedTeamId);
        // Reload all cheatsheets to get the new one
        const updated = await fetchAllCheatsheets();
        setSavedCheatsheets(updated);
        setExpandedId(selectedTeamId);
        setSelectedTeamId("");
        refreshUsage();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate cheatsheet");
      } finally {
        setIsGenerating(false);
      }
    } else {
      if (quickSelection.length === 0) {
        setError("Please select at least one Pokemon from your roster.");
        return;
      }
      setIsGenerating(true);
      setError(null);
      setTempSheet(null);
      try {
        if (demoMode) {
          setTempSheet(DEMO_CHEATSHEET);
          return;
        }
        const res = await generateSelectionCheatsheet({
          roster_ids: quickSelection,
          team_name: "Quick Selection",
          format: "doubles",
        });
        setTempSheet(res);
        refreshUsage();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to generate quick cheatsheet");
      } finally {
        setIsGenerating(false);
      }
    }
  };

  const toggleExpand = (teamId: string) => {
    setExpandedId((prev) => (prev === teamId ? null : teamId));
  };

  const handleRegenerate = async (teamId: string) => {
    if (regeneratingId) return;
    setRegeneratingId(teamId);
    setError(null);
    try {
      await generateCheatsheet(teamId, { force: true });
      const updated = await fetchAllCheatsheets();
      setSavedCheatsheets(updated);
      refreshUsage();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate cheatsheet");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (deletingId) return;
    if (!window.confirm("Delete this cheatsheet? You can regenerate it later.")) return;
    setDeletingId(teamId);
    setError(null);
    try {
      await deleteCheatsheet(teamId);
      setSavedCheatsheets((prev) => prev.filter((s) => s.team_id !== teamId));
      if (expandedId === teamId) setExpandedId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete cheatsheet");
    } finally {
      setDeletingId(null);
    }
  };

  // A cheatsheet is stale when the underlying team has been edited after the
  // cheatsheet was generated -- the AI's game plan + lead matchups may
  // reference moves/items the team no longer has.
  const isCheatsheetStale = (saved: SavedCheatsheet): boolean => {
    const team = teams.find((t) => t.id === saved.team_id);
    if (!team) return false;
    return new Date(team.updated_at).getTime() > new Date(saved.updated_at).getTime();
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

  if (authRequired) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-8">
        <AuthEmptyState
          title="Sign in to generate cheatsheets"
          description="Cheatsheets are built from your saved teams and can be regenerated when your sets change."
        />
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-1.5">
            <div className="font-mono text-[0.7rem] tracking-[0.22em] text-accent">
              ◆ CHEATSHEET
            </div>
            <DataFreshness format="doubles" />
          </div>
          <h1 className="m-0 font-display text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-on-surface">
            Print it. <span className="text-gradient">Or read it.</span>
          </h1>
          <p className="mt-2 max-w-xl text-on-surface-muted text-base">
            AI-generated game plans, one A4 page per team. Bring it on a tablet or print it in a sleeve.
          </p>
        </div>

        {/* Selection Mode Toggle */}
        <div className="flex rounded-xl bg-surface-low p-1">
          <button
            onClick={() => setSelectionMode("team")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.7rem] uppercase tracking-wider transition-colors ${
              selectionMode === "team"
                ? "bg-primary text-surface shadow-sm"
                : "text-on-surface-muted hover:bg-surface-mid"
            }`}
          >
            Saved Team
          </button>
          <button
            onClick={() => setSelectionMode("quick")}
            className={`rounded-lg px-4 py-1.5 font-display text-[0.7rem] uppercase tracking-wider transition-colors ${
              selectionMode === "quick"
                ? "bg-primary text-surface shadow-sm"
                : "text-on-surface-muted hover:bg-surface-mid"
            }`}
          >
            Quick Pick
          </button>
        </div>
      </div>

      {/* Generate new */}
      <div className="rounded-[1rem] bg-surface-low p-6 mb-8">
        <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
          Generate {selectionMode === "team" ? "Team Cheatsheet" : `Quick Cheatsheet (${quickSelection.length}/6)`}
        </h2>
        
        {selectionMode === "team" ? (
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
              <QuotaIndicator
                today={quota}
                month={quotaMonth}
                supporter={isSupporter}
                unlimited={isUnlimited}
              />
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
               {roster.map(rp => {
                 const p = pokemonMap.get(rp.pokemon_id);
                 const active = quickSelection.includes(rp.id);
                 return (
                   <button
                    key={rp.id}
                    onClick={() => setQuickSelection(prev => prev.includes(rp.id) ? prev.filter(id => id !== rp.id) : prev.length < 6 ? [...prev, rp.id] : prev)}
                    className={`flex items-center gap-3 rounded-lg border p-2 text-left transition-all ${active ? "border-primary bg-primary/10" : "border-outline-variant bg-surface-lowest hover:bg-surface-mid"}`}
                   >
                     {p?.sprite_url ? (
                       <Image src={p.sprite_url} alt="" width={24} height={24} className="image-rendering-pixelated" unoptimized />
                     ) : (
                       <div className="h-6 w-6 rounded bg-surface-high flex items-center justify-center text-[0.4rem] uppercase">PKMN</div>
                     )}
                     <div className="flex-1 min-w-0">
                       <p className={`truncate font-display text-[0.65rem] font-bold ${active ? 'text-primary' : 'text-on-surface'}`}>{p?.name || "Unknown"}</p>
                       <p className="text-[0.5rem] text-on-surface-muted uppercase truncate">{rp.ability || "--"}</p>
                     </div>
                   </button>
                 );
               })}
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleGenerate}
                disabled={quickSelection.length === 0 || isGenerating}
                className="btn-primary h-12 px-8 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40"
              >
                Generate Selection
              </button>
              {quickSelection.length > 0 && (
                <button onClick={() => setQuickSelection([])} className="font-display text-xs uppercase tracking-widest text-on-surface-muted hover:text-tertiary">Clear Selection</button>
              )}
            </div>
          </div>
        )}
        
        {error && (
          <p className="mt-3 font-body text-sm text-tertiary">{error}</p>
        )}
      </div>

      {/* Saved cheatsheets */}
      {(savedCheatsheets.length === 0 && !isGenerating && !tempSheet) ? (
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

          {/* Ephemeral selection sheet */}
          {tempSheet && (
             <div className="rounded-[1rem] bg-surface-lowest overflow-hidden border-2 border-primary/40 shadow-xl">
                <div className="flex w-full items-center justify-between p-5 bg-primary/5">
                   <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-surface">
                         <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      </div>
                      <div>
                         <h3 className="font-display text-lg font-bold uppercase tracking-tight text-on-surface">
                           {tempSheet.team_title} (Session)
                         </h3>
                         <p className="font-display text-xs text-on-surface-muted">
                           Generated from selection &middot; {tempSheet.archetype}
                         </p>
                      </div>
                   </div>
                   <div className="flex items-center gap-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCheatsheetPDF(tempSheet.team_title);
                        }}
                        className="btn-ghost h-9 px-4 font-display text-xs font-medium uppercase tracking-wider"
                      >
                        Export PDF
                      </button>
                      <button onClick={() => setTempSheet(null)} className="btn-ghost h-9 px-4 font-display text-xs uppercase tracking-wider">Close</button>
                   </div>
                </div>
                <div className="p-5">
                   <CheatsheetContent data={tempSheet} />
                </div>
             </div>
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
                    {/* Stale banner -- team edited after this cheatsheet was generated */}
                    {isCheatsheetStale(saved) && (
                      <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <svg
                            className="h-4 w-4 shrink-0 text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 9v2m0 4h.01M5.07 19h13.86a2 2 0 001.74-3L13.74 4a2 2 0 00-3.48 0L3.34 16a2 2 0 001.73 3z"
                            />
                          </svg>
                          <p className="font-body text-xs text-amber-200">
                            Team was edited after this cheatsheet was generated. Game plan may be out of date.
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerate(saved.team_id);
                          }}
                          disabled={regeneratingId === saved.team_id}
                          className="btn-primary h-8 px-4 font-display text-[0.6rem] uppercase tracking-wider shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {regeneratingId === saved.team_id ? "Regenerating..." : "Regenerate"}
                        </button>
                      </div>
                    )}

                    {/* Action bar */}
                    <div className="mb-4 flex items-center gap-3 flex-wrap">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          exportCheatsheetPDF(data.team_title);
                        }}
                        className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider"
                      >
                        Export PDF
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRegenerate(saved.team_id);
                        }}
                        disabled={regeneratingId === saved.team_id || (quota !== null && quota.remaining <= 0)}
                        className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                        title="Force a fresh AI run (bypasses cache)"
                      >
                        {regeneratingId === saved.team_id ? "Regenerating..." : "Regenerate"}
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          try {
                            const result = await toggleCheatsheetVisibility(saved.team_id);
                            setSavedCheatsheets((prev) =>
                              prev.map((s) =>
                                s.team_id === saved.team_id
                                  ? { ...s, is_public: result.is_public }
                                  : s
                              )
                            );
                          } catch (err) {
                            console.error("Toggle visibility failed:", err);
                          }
                        }}
                        className={`btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider ${
                          saved.is_public ? "text-green-400 border-green-400/30" : ""
                        }`}
                        title={saved.is_public ? "Make private" : "Make public"}
                      >
                        {saved.is_public ? "Public" : "Share"}
                      </button>
                      {saved.is_public && saved.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const url = `${window.location.origin}/share/${saved.id}`;
                            navigator.clipboard.writeText(url);
                          }}
                          className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider"
                          title="Copy share link"
                        >
                          Copy Link
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(saved.team_id);
                        }}
                        disabled={deletingId === saved.team_id}
                        className="btn-ghost h-9 px-5 font-display text-xs font-medium uppercase tracking-wider text-tertiary border-tertiary/30 hover:bg-tertiary/10 disabled:opacity-40 disabled:cursor-not-allowed ml-auto"
                      >
                        {deletingId === saved.team_id ? "Deleting..." : "Delete"}
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
