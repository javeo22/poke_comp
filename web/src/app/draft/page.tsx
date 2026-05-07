"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Team } from "@/types/team";
import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { DraftResponse } from "@/types/draft";
import {
  fetchTeams,
  fetchPokemon,
  fetchUserPokemon,
  analyzeDraft,
  createMatchup,
  fetchAiUsage,
  resolvePokemonNames,
} from "@/lib/api";
import type { AiUsageMonth, AiUsageToday } from "@/lib/api";
import { QuotaIndicator } from "@/components/quota-indicator";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";
import { DataFreshness } from "@/components/data-freshness";
import { AuthEmptyState } from "@/components/ui/auth-empty-state";
import { DEMO_DRAFT_RESULT, DEMO_ROSTER, DEMO_TEAMS, isDemoModeEnabled } from "@/lib/demo-data";
import { friendlyError } from "@/lib/errors";

const THREAT_COLORS: Record<string, string> = {
  high: "text-primary",
  medium: "text-accent",
  low: "text-on-surface-muted",
};

export default function DraftPage() {
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  const [roster, setRoster] = useState<UserPokemon[]>([]);
  const [rosterLookup, setRosterLookup] = useState<Map<string, UserPokemon>>(new Map());
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [demoMode] = useState(isDemoModeEnabled);
  const [hydratedOppParam, setHydratedOppParam] = useState("");

  // Selection Mode
  const [selectionMode, setSelectionMode] = useState<"team" | "quick">("team");
  const [quickSelection, setQuickSelection] = useState<string[]>([]);

  // Form state. Hydrate selectedTeamId from URL param first, then
  // localStorage ("last team used") so mid-ladder users don't re-pick
  // their team every match.
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId);
  const [opponentSlots, setOpponentSlots] = useState<string[]>(["", "", "", "", "", ""]);
  const [quickPaste, setQuickPaste] = useState("");
  const [quickPasteError, setQuickPasteError] = useState<string | null>(null);

  // Analysis state
  const [result, setResult] = useState<DraftResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [deepMode, setDeepMode] = useState(false); // Haiku (fast) by default
  const [error, setError] = useState<string | null>(null);
  const [saveOutcome, setSaveOutcome] = useState<"win" | "loss" | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [pendingOutcome, setPendingOutcome] = useState<"win" | "loss" | null>(null);
  const [saveLeads, setSaveLeads] = useState<[string, string]>(["", ""]);
  const [saveNotes, setSaveNotes] = useState("");
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
        setPokemonOptions(
          pokemonResult.data.map((p: Pokemon) => ({
            value: p.name,
            label: p.name,
            sublabel: p.types.join("/"),
          }))
        );
        setTeams(DEMO_TEAMS);
        setRoster(DEMO_ROSTER);
        setRosterLookup(new Map(DEMO_ROSTER.map((entry) => [entry.id, entry])));
        return;
      }

      const [teamsResult, pokemonResult, rosterResult] = await Promise.allSettled([
        fetchTeams({ limit: 200 }),
        fetchPokemon({ limit: 1000, champions_only: true }),
        fetchUserPokemon({ limit: 500 }),
      ]);
      const rejected = [teamsResult, pokemonResult, rosterResult].find(
        (result) =>
          result.status === "rejected" && friendlyError(result.reason).isAuthRequired
      );
      if (rejected) setAuthRequired(true);
      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value.data);
      }
      if (pokemonResult.status === "fulfilled") {
        const pMap = new Map<number, Pokemon>();
        for (const p of pokemonResult.value.data) {
          pMap.set(p.id, p);
        }
        setPokemonMap(pMap);
        setPokemonOptions(
          pokemonResult.value.data.map((p: Pokemon) => ({
            value: p.name,
            label: p.name,
            sublabel: p.types.join("/"),
          }))
        );
      }
      if (rosterResult.status === "fulfilled") {
        setRoster(rosterResult.value.data);
        const rMap = new Map<string, UserPokemon>();
        for (const entry of rosterResult.value.data) {
          rMap.set(entry.id, entry);
        }
        setRosterLookup(rMap);
      }
      // Load AI quota (non-blocking)
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

  // Hydrate selectedTeamId from localStorage once teams have loaded, but
  // only if no URL param and no explicit user selection yet.
  useEffect(() => {
    if (teams.length === 0) return;
    if (preselectedTeamId || selectedTeamId) return;
    if (typeof window === "undefined") return;
    const lastTeam = localStorage.getItem("pokecomp_draft_last_team") ?? "";
    if (lastTeam && teams.some((t) => t.id === lastTeam)) {
      setSelectedTeamId(lastTeam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teams]);

  // Persist last-used team so a returning user lands with it preselected.
  useEffect(() => {
    if (typeof window !== "undefined" && selectedTeamId) {
      localStorage.setItem("pokecomp_draft_last_team", selectedTeamId);
    }
  }, [selectedTeamId]);

  // Parse a blob of 6 Pokemon names (newline, comma, or semicolon separated)
  // into the opponent slots. VGC team preview often lists opponent names in
  // chat/screenshots, so pasting them saves six separate dropdown interactions.
  const resolveOpponentInputs = useCallback(
    async (rawNames: string[]) => {
      const resolvedFromIds: string[] = [];
      const namesToResolve: string[] = [];
      for (const raw of rawNames) {
        const maybeId = Number(raw);
        const byId = Number.isFinite(maybeId) ? pokemonMap.get(maybeId)?.name : undefined;
        if (byId) {
          resolvedFromIds.push(byId);
        } else {
          namesToResolve.push(raw);
        }
      }

      const exactByLabel = new Map(pokemonOptions.map((o) => [o.label.toLowerCase(), o.value]));
      const resolved: string[] = [...resolvedFromIds];
      const unresolved: string[] = [];
      const apiInputs = namesToResolve.filter((raw) => !exactByLabel.has(raw.toLowerCase()));
      for (const raw of namesToResolve) {
        const exact = exactByLabel.get(raw.toLowerCase());
        if (exact) resolved.push(exact);
      }

      if (apiInputs.length > 0) {
        try {
          const apiResolved = await resolvePokemonNames(apiInputs);
          resolved.push(...apiResolved.resolved.map((item) => item.name));
          unresolved.push(...apiResolved.unresolved);
        } catch {
          unresolved.push(...apiInputs);
        }
      }

      const deduped = [...new Set(resolved)].slice(0, 6);
      return { resolved: deduped, unresolved };
    },
    [pokemonMap, pokemonOptions]
  );

  useEffect(() => {
    const opp = searchParams.get("opp") ?? "";
    if (!opp || opp === hydratedOppParam || pokemonOptions.length === 0) return;
    const rawNames = opp
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (rawNames.length === 0) return;
    setHydratedOppParam(opp);
    resolveOpponentInputs(rawNames).then(({ resolved, unresolved }) => {
      setOpponentSlots([...resolved, ...Array(6 - resolved.length).fill("")].slice(0, 6));
      setQuickPasteError(
        unresolved.length > 0
          ? `Filled ${resolved.length}/${rawNames.length}. Couldn't match: ${unresolved.join(", ")}`
          : null
      );
    });
  }, [hydratedOppParam, pokemonOptions.length, resolveOpponentInputs, searchParams]);

  const handleQuickPaste = async () => {
    if (!quickPaste.trim()) return;
    const rawNames = quickPaste
      .split(/[,;\n]/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    if (rawNames.length === 0) {
      setQuickPasteError("Paste 1-6 Pokemon names, separated by commas or lines.");
      return;
    }
    const { resolved, unresolved } = await resolveOpponentInputs(rawNames);
    const nextSlots = [...resolved, ...Array(6 - resolved.length).fill("")].slice(0, 6);
    setOpponentSlots(nextSlots);
    setQuickPaste("");
    setQuickPasteError(
      unresolved.length > 0
        ? `Filled ${resolved.length}/${rawNames.length}. Couldn't match: ${unresolved.join(", ")}`
        : null,
    );
  };

  const updateOpponentSlot = (index: number, value: string) => {
    setOpponentSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const filledOpponents = opponentSlots.filter((s) => s.trim() !== "");
  const canAnalyze = (selectionMode === "team" ? !!selectedTeamId : quickSelection.length > 0) && filledOpponents.length >= 1;

  // Filter out already-selected Pokemon from each slot's dropdown options
  const getSlotOptions = (slotIndex: number) => {
    const selectedInOtherSlots = opponentSlots.filter(
      (s, i) => i !== slotIndex && s.trim() !== ""
    );
    return pokemonOptions.filter((o) => !selectedInOtherSlots.includes(o.value));
  };

  // Elapsed-time ticker while analyzing. Shows the user that work is happening
  // during team preview (90s window) so they know whether to wait or bail.
  useEffect(() => {
    if (!isAnalyzing) {
      setElapsedMs(0);
      return;
    }
    const started = Date.now();
    const id = setInterval(() => setElapsedMs(Date.now() - started), 100);
    return () => clearInterval(id);
  }, [isAnalyzing]);

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setSavedId(null);
    setSaveOutcome(null);
    setResult(null);
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 350));
        setResult(DEMO_DRAFT_RESULT);
        return;
      }
      const response = await analyzeDraft(
        {
          opponent_team: filledOpponents,
          my_team_id: selectionMode === "team" ? selectedTeamId : undefined,
          my_selection: selectionMode === "quick" ? quickSelection : undefined,
        },
        deepMode ? "claude-sonnet-4-6" : undefined, // default (undefined) -> Haiku
      );
      setResult(response);
      // Refresh quota after analysis
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
          setIsUnlimited(usage.unlimited);
        })
        .catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleStartSave = (outcome: "win" | "loss") => {
    setPendingOutcome(outcome);
    // Pre-fill with AI-recommended leads
    if (result) {
      setSaveLeads([
        result.analysis.lead_pair[0] ?? "",
        result.analysis.lead_pair[1] ?? "",
      ]);
      setSaveNotes("");
    }
  };

  const handleConfirmSave = async () => {
    if (!result || !pendingOutcome) return;
    const actualLineup =
      selectionMode === "quick"
        ? quickSelection
            .map((id) => {
              const entry = rosterLookup.get(id);
              return entry ? pokemonMap.get(entry.pokemon_id)?.name : "";
            })
            .filter((name): name is string => !!name)
        : undefined;
    if (selectionMode === "team" && !selectedTeamId) return;
    if (selectionMode === "quick" && (!actualLineup || actualLineup.length === 0)) return;
    setIsSaving(true);
    try {
      if (demoMode) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        setSavedId("demo-match");
        setSaveOutcome(pendingOutcome);
        setPendingOutcome(null);
        return;
      }
      const leads =
        saveLeads[0] && saveLeads[1] ? saveLeads : undefined;
      const matchup = await createMatchup({
        my_team_id: selectionMode === "team" ? selectedTeamId : undefined,
        my_team_actual: actualLineup,
        opponent_team_data: filledOpponents.map((name) => ({ name })),
        lead_pair: leads,
        my_selected_four: result.analysis.bring_four.map((rec) => rec.pokemon),
        opponent_selected_four: result.analysis.opponent_likely_bring_four ?? undefined,
        opponent_lead_pair: result.analysis.opponent_likely_leads?.[0] ?? undefined,
        outcome: pendingOutcome,
        notes: saveNotes || undefined,
      });
      setSavedId(matchup.id);
      setSaveOutcome(pendingOutcome);
      setPendingOutcome(null);
    } catch (err) {
      console.error("Failed to save matchup:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const teamOptions: DropdownOption[] = teams.map((t) => ({
    value: t.id,
    label: t.name,
    sublabel: t.format,
  }));

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
        <div className="h-10 w-48 animate-pulse rounded-xl bg-surface-low mb-8" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-xl bg-surface-low" />
          ))}
        </div>
      </div>
    );
  }

  if (authRequired) {
    return (
      <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-8">
        <AuthEmptyState
          title="Sign in to use Draft Helper"
          description="Draft analysis needs a saved team or roster selection so recommendations match your actual builds."
        />
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto w-full max-w-[82rem] flex-1 px-6 sm:px-9 py-8">
      {/* Header */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <div className="flex items-center gap-2 font-mono text-[0.7rem] tracking-[0.22em] text-primary">
              <span className="pulse-dot" />
              LIVE DRAFT · TEAM PREVIEW
            </div>
            <DataFreshness format="doubles" />
          </div>
          <h1 className="m-0 font-display text-4xl sm:text-5xl font-bold tracking-[-0.03em] text-on-surface">
            Draft Helper
          </h1>
          <p className="mt-2 max-w-xl text-on-surface-muted text-base">
            Drop in any opponent&apos;s six. Get your bring-4, lead pair, key rolls, and a plain-English plan.
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

      {/* Input section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* My team selector */}
        {selectionMode === "team" ? (
          <div className="rounded-xl bg-surface-low p-6">
            <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              My Team
            </h2>
            <SearchableDropdown
              placeholder="Select a team..."
              value={selectedTeamId}
              onChange={setSelectedTeamId}
              options={teamOptions}
            />
            {selectedTeamId && (
              <div className="mt-3">
                {(() => {
                  const team = teams.find((t) => t.id === selectedTeamId);
                  if (!team) return null;
                  return (
                    <div className="flex flex-wrap gap-2">
                      {team.pokemon_ids.map((pid, i) => {
                        const entry = rosterLookup.get(pid);
                        const poke = entry ? pokemonMap.get(entry.pokemon_id) : null;
                        return (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-surface-mid px-3 py-1 font-display text-xs text-on-surface"
                          >
                            {poke?.sprite_url && (
                              <Image
                                src={poke.sprite_url}
                                alt={poke.name}
                                width={20}
                                height={20}
                                className="pixelated"
                                unoptimized
                              />
                            )}
                            {poke?.name ?? `#${pid.slice(0, 6)}`}
                          </span>
                        );
                      })}
                      {team.archetype_tag && (
                        <span className="rounded-lg bg-primary/20 px-3 py-1 font-display text-xs text-primary">
                          {team.archetype_tag}
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-surface-low p-6 flex flex-col max-h-[400px]">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
                Quick Selection ({quickSelection.length}/6)
              </h2>
              {quickSelection.length > 0 && (
                <button onClick={() => setQuickSelection([])} className="font-display text-[0.6rem] uppercase text-tertiary hover:underline">Clear All</button>
              )}
            </div>
            <div className="overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {roster.map((rp) => {
                const p = pokemonMap.get(rp.pokemon_id);
                const active = quickSelection.includes(rp.id);
                return (
                  <button
                    key={rp.id}
                    onClick={() => {
                      setQuickSelection(prev => 
                        prev.includes(rp.id) 
                          ? prev.filter(id => id !== rp.id) 
                          : prev.length < 6 ? [...prev, rp.id] : prev
                      );
                    }}
                    className={`flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-all ${
                      active 
                        ? "border-primary bg-primary/10" 
                        : "border-outline-variant hover:bg-surface-mid bg-surface-lowest"
                    }`}
                  >
                    {p?.sprite_url ? (
                      <Image src={p.sprite_url} alt="" width={32} height={32} className="image-rendering-pixelated" unoptimized />
                    ) : (
                      <div className="h-8 w-8 rounded bg-surface-high flex items-center justify-center text-[0.5rem] uppercase">PKMN</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className={`truncate font-display text-xs font-bold ${active ? 'text-primary' : 'text-on-surface'}`}>{p?.name || "Unknown"}</p>
                      <p className="text-[0.55rem] text-on-surface-muted uppercase">{rp.ability || "--"} {rp.nature ? `· ${rp.nature}` : ""}</p>
                    </div>
                    {active && (
                       <div className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-surface" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" />
                          </svg>
                       </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Opponent team input */}
        <div className="rounded-xl bg-surface-low p-6">
          <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Opponent&apos;s Team (6 from preview)
          </h2>
          {/* Quick-paste bar: saves 6 separate dropdown interactions when
              you can screenshot/copy the opponent preview from chat. */}
          <div className="mb-3 flex flex-col gap-2 sm:flex-row">
            <input
              type="text"
              value={quickPaste}
              onChange={(e) => setQuickPaste(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleQuickPaste()}
              placeholder="Paste 6 names (comma, newline, or semicolon separated)"
              className="input-field h-10 flex-1 rounded-lg px-3 font-body text-xs text-on-surface placeholder:text-on-surface-muted outline-none"
            />
            <button
              type="button"
              onClick={handleQuickPaste}
              disabled={!quickPaste.trim()}
              className="btn-ghost h-10 px-4 font-display text-[0.65rem] uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Quick fill
            </button>
          </div>
          {quickPasteError && (
            <p className="mb-3 font-body text-[0.7rem] text-amber-400">
              {quickPasteError}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {opponentSlots.map((slot, i) => (
              <SearchableDropdown
                key={i}
                placeholder={`Slot ${i + 1}`}
                value={slot}
                onChange={(v) => updateOpponentSlot(i, v)}
                options={getSlotOptions(i)}
              />
            ))}
          </div>
          <p className="mt-3 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
            {filledOpponents.length}/6 Pokemon entered · Confidence{" "}
            {filledOpponents.length >= 6 ? "High" : filledOpponents.length >= 4 ? "Medium" : "Low"}
          </p>
        </div>
      </div>

      {/* Analyze button + mode toggle */}
      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button
          onClick={handleAnalyze}
          disabled={
            !canAnalyze ||
            isAnalyzing ||
            (deepMode && quota !== null && quota.remaining <= 0)
          }
          className="btn-primary h-12 px-8 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAnalyzing
            ? `Analyzing… ${(elapsedMs / 1000).toFixed(1)}s`
            : "Analyze Matchup"}
        </button>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={deepMode}
            disabled={isAnalyzing}
            onChange={(e) => setDeepMode(e.target.checked)}
            className="h-4 w-4 accent-primary"
          />
          <span className="font-display text-[0.7rem] uppercase tracking-wider text-on-surface-muted">
            Tournament prep (Sonnet, slower)
          </span>
        </label>
        {!isAnalyzing && !result && (
          <span className="font-display text-[0.65rem] uppercase tracking-wider text-secondary">
            {deepMode ? "Tournament prep · ~10-15s" : "Ladder quick read · ~3-5s"}
          </span>
        )}
        {deepMode && quota !== null && (
          <QuotaIndicator
            today={quota}
            month={quotaMonth}
            supporter={isSupporter}
            unlimited={isUnlimited}
          />
        )}
        {result?.cached && (
          <span className="font-display text-xs text-on-surface-muted">
            Cached result
          </span>
        )}
        {result && !result.cached && (
          <span className="font-display text-xs text-on-surface-muted">
            ~${result.estimated_cost_usd.toFixed(3)}
          </span>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-6 rounded-xl bg-tertiary/10 p-4">
          <p className="font-body text-sm text-tertiary">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {isAnalyzing && (
        <div className="mt-8 flex flex-col gap-4">
          <div className="rounded-xl border border-outline-variant bg-surface-low p-4">
            <div className="flex items-center justify-between">
              <p className="font-display text-xs uppercase tracking-wider text-secondary">
                {deepMode ? "Tournament prep (Sonnet)" : "Ladder quick read (Haiku)"}
              </p>
              <p className="font-mono text-xs text-on-surface-muted tabular-nums">
                {(elapsedMs / 1000).toFixed(1)}s
                {" · "}
                <span className="text-on-surface-muted">
                  typical {deepMode ? "10-15s" : "3-5s"}
                </span>
              </p>
            </div>
            <p className="mt-2 font-body text-xs text-on-surface-muted">
              AI is reviewing usage data, your roster, matchup history, and building a game plan.
            </p>
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-low" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div className="mt-8 flex flex-col gap-6">
          {/* Verification warnings */}
          {result.analysis.warnings && result.analysis.warnings.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
              <p className="mb-2 font-display text-xs font-bold uppercase tracking-wider text-amber-400">
                ⚠ AI output could not be fully verified
              </p>
              <p className="mb-2 font-body text-xs text-on-surface-muted">
                The AI referenced data that doesn&apos;t match our canonical DB.
                Claims marked with ⚠ below should be treated as low-confidence.
              </p>
              <ul className="flex flex-col gap-1 font-body text-xs text-on-surface">
                {result.analysis.warnings.map((w, i) => (
                  <li key={i} className="pl-2 border-l-2 border-amber-500/40">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Team Preview Mode */}
          <div className="rounded-xl border border-primary/30 bg-primary/10 p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-display text-xs font-bold uppercase tracking-wider text-primary">
                Team Preview Mode
              </h3>
              <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Compact game-one read
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <PreviewReadout
                label="Bring 4"
                value={result.analysis.bring_four.map((rec) => rec.pokemon).join(" / ")}
              />
              <PreviewReadout
                label="Lead Pair"
                value={result.analysis.lead_pair.join(" + ")}
              />
              <PreviewReadout
                label="Opponent 4"
                value={
                  result.analysis.opponent_likely_bring_four?.join(" / ") ||
                  "Not enough signal"
                }
              />
              <PreviewReadout
                label="Likely Lead"
                value={
                  result.analysis.opponent_likely_leads?.[0]?.join(" + ") ||
                  result.analysis.threats[0]?.pokemon ||
                  "Unknown"
                }
              />
              <PreviewReadout
                label="Biggest Threat"
                value={result.analysis.threats[0]?.pokemon || "Unknown"}
              />
              <PreviewReadout
                label="Turn One"
                value={result.analysis.lead_matchups?.[0]?.note || result.analysis.game_plan}
              />
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <PreviewReadout
                label="Must Preserve"
                value={result.analysis.bring_four[2]?.pokemon || result.analysis.lead_pair[0]}
              />
              <PreviewReadout
                label="Avoid"
                value={
                  result.analysis.threats[0]
                    ? `Letting ${result.analysis.threats[0].pokemon} dictate turn-one tempo`
                    : "Overcommitting before scouting items"
                }
              />
            </div>
          </div>

          {/* Summary */}
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Matchup Overview
            </h3>
            <p className="font-body text-sm leading-relaxed text-on-surface">
              {result.analysis.summary}
            </p>
          </div>

          {result.analysis.lead_matchups && result.analysis.lead_matchups.length > 0 && (
            <div className="rounded-xl bg-surface-low p-6">
              <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
                Lead Matchups
              </h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {result.analysis.lead_matchups.map((matchup, i) => (
                  <div key={i} className="rounded-xl bg-surface-mid p-4">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-display text-sm font-bold text-on-surface">
                        {matchup.my_lead.join(" + ")} vs {matchup.opponent_lead.join(" + ")}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-display text-[0.55rem] uppercase tracking-wider ${
                          matchup.favorability === "favored"
                            ? "bg-secondary/20 text-secondary"
                            : matchup.favorability === "unfavored"
                              ? "bg-tertiary/20 text-tertiary"
                              : "bg-surface-high text-on-surface-muted"
                        }`}
                      >
                        {matchup.favorability}
                      </span>
                    </div>
                    <p className="mt-2 font-body text-xs leading-relaxed text-on-surface-muted">
                      {matchup.note}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Bring 4 + Leads */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="rounded-xl bg-surface-low p-6">
              <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
                Bring These 4
              </h3>
              <div className="flex flex-col gap-3">
                {result.analysis.bring_four.map((rec, i) => {
                  const isLead = result.analysis.lead_pair.includes(rec.pokemon);
                  return (
                    <div
                      key={i}
                      className={`rounded-xl p-4 transition-all ${
                        isLead ? "bg-primary/10" : "bg-surface-mid"
                      } ${rec.verified === false ? "ring-1 ring-amber-500/40" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-on-surface">
                          {rec.pokemon}
                        </span>
                        {rec.verified === false && (
                          <span
                            title={rec.verification_note ?? "Could not verify"}
                            className="font-display text-sm text-amber-400 cursor-help"
                          >
                            ⚠
                          </span>
                        )}
                        {isLead && (
                          <span className="rounded-full bg-primary/20 px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-primary">
                            Lead
                          </span>
                        )}
                        <span className="ml-auto rounded-full bg-surface-high px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                          {rec.role}
                        </span>
                      </div>
                      <p className="mt-1 font-body text-xs text-on-surface-muted">
                        {rec.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Game Plan */}
            <div className="rounded-xl bg-surface-low p-6">
              <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
                Game Plan
              </h3>
              <p className="font-body text-sm leading-relaxed text-on-surface">
                {result.analysis.game_plan}
              </p>
            </div>
          </div>

          {/* Threats */}
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Threats
            </h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {result.analysis.threats.map((threat, i) => (
                <div
                  key={i}
                  className={`rounded-xl bg-surface-mid p-4 ${
                    threat.verified === false ? "ring-1 ring-amber-500/40" : ""
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-on-surface">
                      {threat.pokemon}
                    </span>
                    {threat.verified === false && (
                      <span
                        title={threat.verification_note ?? "Could not verify"}
                        className="font-display text-sm text-amber-400 cursor-help"
                      >
                        ⚠
                      </span>
                    )}
                    <span
                      className={`ml-auto font-display text-[0.6rem] font-bold uppercase tracking-wider ${
                        THREAT_COLORS[threat.threat_level] ?? "text-on-surface-muted"
                      }`}
                    >
                      {threat.threat_level}
                    </span>
                  </div>
                  <p className="mt-1 font-body text-xs text-on-surface-muted">
                    {threat.reason}
                  </p>
                  <div className="mt-2">
                    <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Likely set:{" "}
                    </span>
                    <span className="font-body text-xs text-on-surface">
                      {threat.likely_set}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {threat.key_moves.map((move, j) => (
                      <span
                        key={j}
                        className="rounded-full bg-surface-high px-2 py-0.5 font-body text-[0.6rem] text-on-surface"
                      >
                        {move}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Damage Calcs */}
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Key Damage Calculations
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left">
                    <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Attacker
                    </th>
                    <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Move
                    </th>
                    <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Defender
                    </th>
                    <th className="pb-2 pr-4 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Damage
                    </th>
                    <th className="pb-2 font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                      Note
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {result.analysis.damage_calcs.map((calc, i) => {
                    const attackerId = [...pokemonMap.values()].find((p) => p.name === calc.attacker)?.id;
                    const defenderId = [...pokemonMap.values()].find((p) => p.name === calc.defender)?.id;
                    const calcHref =
                      attackerId && defenderId
                        ? `/calc?attacker=${attackerId}&defender=${defenderId}`
                        : "/calc";
                    return (
                      <tr
                        key={i}
                        className={
                          calc.verified === false ? "bg-amber-500/5" : "group"
                        }
                      >
                        <td className="py-2 pr-4 font-body text-sm text-on-surface">
                          <span className="inline-flex items-center gap-1">
                            {calc.attacker}
                            {calc.verified === false && (
                              <span
                                title={calc.verification_note ?? "Could not verify"}
                                className="text-amber-400 cursor-help"
                              >
                                ⚠
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-body text-sm text-primary">
                          {calc.move}
                        </td>
                        <td className="py-2 pr-4 font-body text-sm text-on-surface">
                          {calc.defender}
                        </td>
                        <td className="py-2 pr-4 font-display text-sm font-bold text-secondary">
                          {calc.estimated_damage}
                        </td>
                        <td className="py-2 font-body text-xs text-on-surface-muted">
                          <div className="flex items-center gap-2">
                            <span>{calc.note}</span>
                            <a
                              href={calcHref}
                              className="shrink-0 font-display text-[0.55rem] uppercase tracking-wider text-primary hover:text-accent"
                            >
                              Calc
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Disclaimer */}
          {result.ai_disclaimer && (
            <div className="rounded-xl border border-outline-variant bg-surface-lowest px-5 py-3">
              <p className="font-body text-xs leading-relaxed text-on-surface-muted">
                {result.ai_disclaimer}
              </p>
            </div>
          )}

          {/* Contextual support prompt */}
          {!result.cached && (
            <div className="rounded-xl bg-surface-low/50 px-5 py-3 flex items-center justify-between gap-4">
              <p className="font-body text-xs text-on-surface-muted">
                This analysis cost ~${result.estimated_cost_usd.toFixed(3)} to generate.
                Help keep PokeComp free for everyone.
              </p>
              <a
                href="https://ko-fi.com/pokecompapp"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-ghost h-8 px-4 font-display text-[0.6rem] uppercase tracking-wider shrink-0"
              >
                Support
              </a>
            </div>
          )}

          {/* Record Outcome */}
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Record Outcome
            </h3>
            {savedId ? (
              <div className="flex items-center gap-3">
                <span className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider ${
                  saveOutcome === "win"
                    ? "bg-secondary/20 text-secondary"
                    : "bg-tertiary/20 text-tertiary"
                }`}>
                  {saveOutcome === "win" ? "Victory" : "Defeat"} Recorded
                </span>
                <a
                  href="/matches"
                  className="font-display text-xs uppercase tracking-wider text-primary hover:text-primary/80"
                >
                  View match log →
                </a>
              </div>
            ) : !pendingOutcome ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleStartSave("win")}
                  className="h-10 rounded-lg bg-secondary/20 px-6 font-display text-sm font-medium uppercase tracking-wider text-secondary transition-all hover:bg-secondary/30"
                >
                  Win
                </button>
                <button
                  onClick={() => handleStartSave("loss")}
                  className="h-10 rounded-lg bg-tertiary/20 px-6 font-display text-sm font-medium uppercase tracking-wider text-tertiary transition-all hover:bg-tertiary/30"
                >
                  Loss
                </button>
                <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                  Save this matchup to your match log
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Outcome indicator */}
                <div className="flex items-center gap-3">
                  <span className={`rounded-lg px-4 py-2 font-display text-sm font-bold uppercase tracking-wider ${
                    pendingOutcome === "win"
                      ? "bg-secondary/20 text-secondary"
                      : "bg-tertiary/20 text-tertiary"
                  }`}>
                    {pendingOutcome === "win" ? "Victory" : "Defeat"}
                  </span>
                  <button
                    onClick={() => setPendingOutcome(null)}
                    className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted hover:text-on-surface"
                  >
                    Change
                  </button>
                </div>

                {/* My leads */}
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    My Leads (optional)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-w-md">
                    {(() => {
                      const bringFourOptions: DropdownOption[] =
                        result?.analysis.bring_four.map((rec) => ({
                          value: rec.pokemon,
                          label: rec.pokemon,
                          sublabel: rec.role,
                        })) ?? [];
                      return (
                        <>
                          <SearchableDropdown
                            placeholder="Lead 1"
                            value={saveLeads[0]}
                            onChange={(v) => setSaveLeads([v, saveLeads[1]])}
                            options={bringFourOptions}
                          />
                          <SearchableDropdown
                            placeholder="Lead 2"
                            value={saveLeads[1]}
                            onChange={(v) => setSaveLeads([saveLeads[0], v])}
                            options={bringFourOptions}
                          />
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <label className="mb-1 block font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                    Notes (optional)
                  </label>
                  <textarea
                    value={saveNotes}
                    onChange={(e) => setSaveNotes(e.target.value)}
                    placeholder="What happened? Key turns, misplays..."
                    rows={2}
                    className="input-field w-full max-w-md rounded-xl px-4 py-3 font-body text-sm text-on-surface placeholder:text-on-surface-muted outline-none"
                  />
                </div>

                {/* Confirm */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleConfirmSave}
                    disabled={isSaving}
                    className="btn-primary h-10 px-6 font-display text-xs font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isSaving ? "Saving..." : "Save to Match Log"}
                  </button>
                  <button
                    onClick={() => setPendingOutcome(null)}
                    disabled={isSaving}
                    className="h-10 rounded-lg px-4 font-display text-xs uppercase tracking-wider text-on-surface-muted hover:bg-surface-high transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewReadout({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-lowest/70 p-3">
      <div className="mb-1 font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {label}
      </div>
      <p className="line-clamp-2 font-body text-xs leading-relaxed text-on-surface">
        {value}
      </p>
    </div>
  );
}
