"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Team } from "@/types/team";
import Image from "next/image";
import type { Pokemon } from "@/features/pokemon/types";
import type { UserPokemon } from "@/types/user-pokemon";
import type { DraftResponse } from "@/types/draft";
import { fetchTeams, fetchPokemon, fetchUserPokemon, analyzeDraft, createMatchup, fetchAiUsage } from "@/lib/api";
import type { AiUsageMonth, AiUsageToday } from "@/lib/api";
import { QuotaIndicator } from "@/components/quota-indicator";
import { SearchableDropdown } from "@/components/ui/searchable-dropdown";
import type { DropdownOption } from "@/components/ui/searchable-dropdown";

const THREAT_COLORS: Record<string, string> = {
  high: "text-tertiary",
  medium: "text-amber-400",
  low: "text-secondary",
};

export default function DraftPage() {
  const searchParams = useSearchParams();
  const preselectedTeamId = searchParams.get("team") ?? "";

  const [teams, setTeams] = useState<Team[]>([]);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  const [rosterLookup, setRosterLookup] = useState<Map<string, UserPokemon>>(new Map());
  const [pokemonMap, setPokemonMap] = useState<Map<number, Pokemon>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [selectedTeamId, setSelectedTeamId] = useState(preselectedTeamId);
  const [opponentSlots, setOpponentSlots] = useState<string[]>(["", "", "", "", "", ""]);

  // Analysis state
  const [result, setResult] = useState<DraftResponse | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
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

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [teamsResult, pokemonResult, rosterResult] = await Promise.allSettled([
        fetchTeams({ limit: 200 }),
        fetchPokemon({ limit: 500, champions_only: true }),
        fetchUserPokemon({ limit: 200 }),
      ]);
      if (teamsResult.status === "fulfilled") {
        setTeams(teamsResult.value.data);
      } else {
        console.error("Failed to load teams:", teamsResult.reason);
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
      } else {
        console.error("Failed to load Pokemon list:", pokemonResult.reason);
      }
      if (rosterResult.status === "fulfilled") {
        const rMap = new Map<string, UserPokemon>();
        for (const entry of rosterResult.value.data) {
          rMap.set(entry.id, entry);
        }
        setRosterLookup(rMap);
      } else {
        console.error("Failed to load roster:", rosterResult.reason);
      }
      // Load AI quota (non-blocking)
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
        })
        .catch(() => {});
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateOpponentSlot = (index: number, value: string) => {
    setOpponentSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const filledOpponents = opponentSlots.filter((s) => s.trim() !== "");
  const canAnalyze = selectedTeamId && filledOpponents.length >= 1;

  // Filter out already-selected Pokemon from each slot's dropdown options
  const getSlotOptions = (slotIndex: number) => {
    const selectedInOtherSlots = opponentSlots.filter(
      (s, i) => i !== slotIndex && s.trim() !== ""
    );
    return pokemonOptions.filter((o) => !selectedInOtherSlots.includes(o.value));
  };

  const handleAnalyze = async () => {
    if (!canAnalyze) return;
    setIsAnalyzing(true);
    setError(null);
    setSavedId(null);
    setSaveOutcome(null);
    setResult(null);
    try {
      const response = await analyzeDraft({
        opponent_team: filledOpponents,
        my_team_id: selectedTeamId,
      });
      setResult(response);
      // Refresh quota after analysis
      fetchAiUsage()
        .then((usage) => {
          setQuota(usage.today);
          setQuotaMonth(usage.month);
          setIsSupporter(usage.supporter);
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
    if (!selectedTeamId || !result || !pendingOutcome) return;
    setIsSaving(true);
    try {
      const leads =
        saveLeads[0] && saveLeads[1] ? saveLeads : undefined;
      const matchup = await createMatchup({
        my_team_id: selectedTeamId,
        opponent_team_data: filledOpponents.map((name) => ({ name })),
        lead_pair: leads,
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

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-on-surface">
          Draft Helper
        </h1>
        <p className="mt-1 font-body text-sm text-on-surface-muted">
          Team preview analysis &middot; Pick your 4
        </p>
      </div>

      {/* Input section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* My team selector */}
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

        {/* Opponent team input */}
        <div className="rounded-xl bg-surface-low p-6">
          <h2 className="mb-4 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
            Opponent&apos;s Team (6 from preview)
          </h2>
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
            {filledOpponents.length}/6 Pokemon entered
          </p>
        </div>
      </div>

      {/* Analyze button */}
      <div className="mt-6 flex items-center gap-4">
        <button
          onClick={handleAnalyze}
          disabled={!canAnalyze || isAnalyzing || (quota !== null && quota.remaining <= 0)}
          className="btn-primary h-12 px-8 font-display text-sm font-medium uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isAnalyzing ? "Analyzing..." : "Analyze Matchup"}
        </button>
        {quota !== null && (
          <QuotaIndicator today={quota} month={quotaMonth} supporter={isSupporter} />
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
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-surface-low" />
          ))}
        </div>
      )}

      {/* Results */}
      {result && !isAnalyzing && (
        <div className="mt-8 flex flex-col gap-6">
          {/* Summary */}
          <div className="rounded-xl bg-surface-low p-6">
            <h3 className="mb-3 font-display text-xs font-medium uppercase tracking-wider text-on-surface-muted">
              Matchup Overview
            </h3>
            <p className="font-body text-sm leading-relaxed text-on-surface">
              {result.analysis.summary}
            </p>
          </div>

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
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-on-surface">
                          {rec.pokemon}
                        </span>
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
                <div key={i} className="rounded-xl bg-surface-mid p-4">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-on-surface">
                      {threat.pokemon}
                    </span>
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
                  {result.analysis.damage_calcs.map((calc, i) => (
                    <tr key={i} className="group">
                      <td className="py-2 pr-4 font-body text-sm text-on-surface">
                        {calc.attacker}
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
                        {calc.note}
                      </td>
                    </tr>
                  ))}
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
