"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  fetchPublicStats,
  fetchMetaTrends,
  fetchUserPokemon,
  fetchMatchups,
  fetchPokemonBasic,
  fetchTeams,
  fetchTeamBenchmark,
  fetchMatchupInsights,
  resolvePokemonNames,
  type TeamBenchmarkResponse
} from "@/lib/api";
import type { PublicStats } from "@/lib/api";
import type { MetaTrend } from "@/types/meta";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Matchup } from "@/types/matchup";
import type { MatchupInsights } from "@/types/matchup";
import type { Team } from "@/types/team";
import { pokeArt, pokeSprite } from "@/lib/sprites";
import { createClient } from "@/utils/supabase/client";
import { SearchableDropdown, type DropdownOption } from "@/components/ui/searchable-dropdown";
import { ChevronRight, Play, Target } from "lucide-react";
import { LabDashboard } from "@/components/ui/lab-dashboard";
import { BASELINE_TRENDS } from "@/features/meta/baseline-trends";
import { DataFreshness } from "@/components/data-freshness";
import { PcEmblem } from "@/components/pc-mark";
import { TeamBenchmarkPanel } from "@/components/teams/team-benchmark-panel";
import { SourceBadge } from "@/components/meta/source-badge";

const normalizePokemonName = (name: string) =>
  name
    .trim()
    .toLowerCase()
    .replace(/♀/g, "f")
    .replace(/♂/g, "m")
    .replace(/[^a-z0-9]+/g, "");

const coercePokemonId = (value: unknown) => {
  const id =
    typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(id) && id > 0 ? id : null;
};

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [trends, setTrends] = useState<MetaTrend[]>(BASELINE_TRENDS);
  const [usingBaselineTrends, setUsingBaselineTrends] = useState(true);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [userPokemon, setUserPokemon] = useState<UserPokemon[]>([]);
  const [lastMatch, setMatch] = useState<Matchup | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [benchmark, setBenchmark] = useState<TeamBenchmarkResponse | null>(null);
  const [benchmarkLoading, setBenchmarkLoading] = useState(false);
  const [benchmarkError, setBenchmarkError] = useState<string | null>(null);
  const [insights, setInsights] = useState<MatchupInsights | null>(null);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  const [pokemonNameById, setPokemonNameById] = useState<Map<number, string>>(new Map());
  const [pokemonIdByName, setPokemonIdByName] = useState<Map<string, number>>(new Map());
  const [quickDraftPokemon, setQuickDraftPokemon] = useState("");
  const [opponentPaste, setOpponentPaste] = useState("");
  const [opponentPreview, setOpponentPreview] = useState<string[]>([]);
  const [opponentError, setOpponentError] = useState<string | null>(null);
  const [resolvingOpponents, setResolvingOpponents] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    // 1. Static stats & Meta
    fetchPublicStats().then(setStats).catch(() => {});
    fetchMetaTrends("doubles", 6)
      .then(res => {
        if (res && res.length > 0) {
          setTrends(res);
          setUsingBaselineTrends(false);
        }
      })
      .catch(() => {
        setUsingBaselineTrends(true);
      })
      .finally(() => setLoadingTrends(false));

    // 2. Search options
    fetchPokemonBasic({ champions_only: true, limit: 1000 }).then(res => {
      setPokemonNameById(new Map(res.data.map((p) => [p.id, p.name])));
      setPokemonIdByName(
        new Map(res.data.map((p) => [normalizePokemonName(p.name), p.id]))
      );
      setPokemonOptions(res.data.map(p => ({
        value: p.name,
        label: p.name,
        sublabel: p.types.join(" / ")
      })));
    }).catch(() => {});

    // 3. User Data if logged in
    const supabase = createClient();
    if (supabase) {
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) {
          setIsLogged(true);
          setLoadingUser(true);
          Promise.allSettled([
            fetchUserPokemon({ limit: 14 }),
            fetchMatchups({ limit: 1 }),
            fetchTeams({ limit: 50 }),
            fetchMatchupInsights(),
          ]).then(([up, m, t, i]) => {
            if (up.status === "fulfilled") setUserPokemon(up.value.data);
            if (m.status === "fulfilled" && m.value.data.length > 0) setMatch(m.value.data[0]);
            if (t.status === "fulfilled") {
              setTeams(t.value.data);
              setSelectedTeamId((current) => current || t.value.data[0]?.id || "");
            }
            if (i.status === "fulfilled") setInsights(i.value);
          }).catch(() => {})
          .finally(() => setLoadingUser(false));
        }
      });
    }
  }, []);

  useEffect(() => {
    if (!selectedTeamId) {
      setBenchmark(null);
      setBenchmarkError(null);
      return;
    }
    const team = teams.find((entry) => entry.id === selectedTeamId);
    let alive = true;
    setBenchmarkLoading(true);
    setBenchmarkError(null);
    fetchTeamBenchmark(selectedTeamId, { format: team?.format ?? "doubles", limit: 12 })
      .then((data) => {
        if (!alive) return;
        setBenchmark(data);
      })
      .catch((err) => {
        if (!alive) return;
        setBenchmark(null);
        setBenchmarkError(err instanceof Error ? err.message : "Benchmark failed");
      })
      .finally(() => {
        if (alive) setBenchmarkLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedTeamId, teams]);

  const handleQuickDraft = (name: string) => {
    if (!name) return;
    const params = new URLSearchParams();
    if (selectedTeamId) params.set("team", selectedTeamId);
    params.set("opp", name);
    router.push(`/draft?${params.toString()}`);
  };

  const resolveOpponentPaste = async (raw: string[]) => {
    const exactByLabel = new Map(pokemonOptions.map((option) => [option.label.toLowerCase(), option.value]));
    const exact: string[] = [];
    const needsApi: string[] = [];

    for (const name of raw) {
      const match = exactByLabel.get(name.toLowerCase());
      if (match) {
        exact.push(match);
      } else {
        needsApi.push(name);
      }
    }

    if (needsApi.length === 0) return { resolved: exact, unresolved: [] };
    const apiResolved = await resolvePokemonNames(needsApi);
    return {
      resolved: [...exact, ...apiResolved.resolved.map((item) => item.name)],
      unresolved: apiResolved.unresolved,
    };
  };

  const handlePrepAnalyze = async () => {
    if (!selectedTeamId) return;
    const rawNames = opponentPaste
      .split(/[,;\n]/)
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, 6);
    const namesToUse = rawNames.length > 0 ? rawNames : opponentPreview;
    if (namesToUse.length === 0) return;

    setResolvingOpponents(true);
    setOpponentError(null);
    try {
      const { resolved, unresolved } = await resolveOpponentPaste(namesToUse);
      const deduped = [...new Set(resolved)].slice(0, 6);
      setOpponentPreview(deduped);
      if (unresolved.length > 0) {
        setOpponentError(`Couldn't match: ${unresolved.join(", ")}`);
      }
      const params = new URLSearchParams();
      params.set("team", selectedTeamId);
      params.set("opp", deduped.length > 0 ? deduped.join(",") : namesToUse.join(","));
      router.push(`/draft?${params.toString()}`);
    } catch {
      const params = new URLSearchParams();
      params.set("team", selectedTeamId);
      params.set("opp", namesToUse.join(","));
      setOpponentError("Using pasted names without alias resolution.");
      router.push(`/draft?${params.toString()}`);
    } finally {
      setResolvingOpponents(false);
    }
  };

  const selectedTeam = teams.find((entry) => entry.id === selectedTeamId);
  const teamOptions: DropdownOption[] = teams.map((team) => ({
    value: team.id,
    label: team.name,
    sublabel: team.format,
  }));
  const hasOpponentInput = opponentPaste.trim().length > 0 || opponentPreview.length > 0;

  return (
    <LabDashboard>
      <div className="relative z-10 w-full">
        {/* HERO SECTION */}
        <section className="mx-auto max-w-[82rem] px-6 pt-16 pb-12 sm:px-9">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex flex-col gap-1 mb-6">
              <div className="inline-flex w-fit items-center gap-2 rounded-full bg-on-surface px-3 py-1 text-surface">
                <span className="h-4 w-4 rounded-full bg-primary" />
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-surface">
                  CHAMPIONS META DASHBOARD
                </span>
              </div>
              <span className="px-3 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-on-surface-dim">
                LIVE USAGE SNAPSHOTS AND PERSONAL PREP
              </span>
            </div>

            <h1 className="font-display m-0 text-[3.25rem] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-on-surface sm:text-6xl lg:text-[5.75rem]">
              Master the <br />
              <span className="text-gradient relative inline-block">
                Champions Meta.
                <span className="absolute -bottom-1 left-0 h-1 w-full bg-on-surface" />
              </span>
            </h1>

            <p className="mt-8 max-w-[38rem] text-base leading-relaxed text-on-surface-muted sm:text-lg">
              The only AI-powered companion built exclusively for Pokemon Champions. 
              Draft counters, track your roster, and outplay the meta with real-time data.
            </p>

            {/* Quick Action Search */}
            <div className="mt-10 max-w-[32rem]">
              <div className="relative">
                <div className="relative flex items-center gap-2 rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-2 shadow-[4px_4px_0_var(--color-outline-variant)]">
                  <div className="flex-1 px-2">
                    <SearchableDropdown
                      value={quickDraftPokemon}
                      onChange={(v) => {
                        setQuickDraftPokemon(v);
                        handleQuickDraft(v);
                      }}
                      options={pokemonOptions}
                      placeholder="Enter opponent's Pokemon to start draft..."
                    />
                  </div>
                  <button 
                    onClick={() => handleQuickDraft(quickDraftPokemon)}
                    disabled={!quickDraftPokemon}
                    className="flex h-12 w-12 items-center justify-center rounded-[2px] border-2 border-outline-variant bg-primary text-surface transition-all hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--color-outline-variant)] active:translate-x-0 active:translate-y-0"
                    title="Quick Draft"
                  >
                    <Play className="fill-current" size={20} />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-4 px-2">
                <span className="font-mono text-[0.6rem] uppercase tracking-widest text-on-surface-muted">Common Leads:</span>
                <div className="flex gap-3">
                  {trends.slice(0, 3).map(t => (
                    <button 
                      key={t.id} 
                      onClick={() => handleQuickDraft(t.pokemon_name)}
                      className="font-mono text-[0.65rem] text-primary underline decoration-on-surface decoration-2 underline-offset-4 transition-colors hover:text-on-surface"
                    >
                      {t.pokemon_name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Team badge visual from the redesign */}
          <div className="hidden w-[340px] xl:w-[360px] lg:block">
            <PcEmblem className="border-[3px] border-outline-variant shadow-[8px_8px_0_var(--color-outline-variant)]" />
          </div>
        </div>
      </section>

      {isLogged && (
        <section className="mx-auto max-w-[82rem] px-6 py-8 sm:px-9">
          <div className="border-2 border-outline-variant bg-surface-lowest shadow-[6px_6px_0_var(--color-outline-variant)]">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-outline-variant bg-on-surface px-6 py-4 text-surface">
              <div>
                <div className="mb-1 flex items-center gap-2 font-mono text-[0.65rem] uppercase tracking-[0.24em] text-accent">
                  <Target size={14} />
                  Prep Cockpit
                </div>
                <h2 className="font-display text-2xl font-bold uppercase tracking-[0.08em]">
                  Next match read
                </h2>
              </div>
              <DataFreshness format={selectedTeam?.format ?? "doubles"} className="text-surface" />
            </div>

            <div className="grid grid-cols-1 border-b-2 border-outline-variant lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <div className="border-b-2 border-outline-variant p-6 lg:border-b-0 lg:border-r-2">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block font-mono text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                      Saved team
                    </label>
                    <SearchableDropdown
                      value={selectedTeamId}
                      onChange={setSelectedTeamId}
                      options={teamOptions}
                      placeholder={teams.length > 0 ? "Select team..." : "No saved teams yet"}
                      disabled={teams.length === 0}
                    />
                    {selectedTeam && (
                      <p className="mt-2 font-body text-xs text-on-surface-muted">
                        {selectedTeam.format.toUpperCase()}
                        {selectedTeam.archetype_tag ? ` · ${selectedTeam.archetype_tag}` : ""}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-2 block font-mono text-[0.65rem] uppercase tracking-wider text-on-surface-muted">
                      Opponent preview
                    </label>
                    <textarea
                      value={opponentPaste}
                      onChange={(event) => setOpponentPaste(event.target.value)}
                      placeholder="Paste 1-6 names, comma or line separated"
                      rows={3}
                      className="input-field w-full resize-none rounded-[2px] px-3 py-2 font-body text-sm text-on-surface placeholder:text-on-surface-muted"
                    />
                    {opponentError && (
                      <p className="mt-2 font-body text-xs text-primary">{opponentError}</p>
                    )}
                  </div>
                </div>

                {opponentPreview.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {opponentPreview.map((name) => (
                      <span
                        key={name}
                        className="rounded-[2px] border border-outline-variant bg-surface px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-on-surface-muted"
                      >
                        {name}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrepAnalyze}
                    disabled={!selectedTeamId || !hasOpponentInput || resolvingOpponents}
                    className="btn-primary h-11 px-6 font-display text-xs uppercase tracking-wider disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {resolvingOpponents ? "Resolving..." : "Analyze Preview"}
                  </button>
                  <Link
                    href={selectedTeamId ? `/draft?team=${selectedTeamId}` : "/draft"}
                    className="btn-ghost flex h-11 items-center px-5 font-display text-xs uppercase tracking-wider"
                  >
                    Open Draft
                  </Link>
                  <Link
                    href="/teams"
                    className="font-mono text-[0.65rem] uppercase tracking-wider text-on-surface-muted hover:text-primary"
                  >
                    Manage teams
                  </Link>
                </div>
              </div>

              <PrepNotesPanel insights={insights} loading={loadingUser} />
            </div>

            <div className="p-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary">
                    ◆ Team vs Meta
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-on-surface">
                    Benchmark summary
                  </h3>
                </div>
                {selectedTeam && (
                  <Link
                    href={`/teams`}
                    className="font-mono text-[0.65rem] uppercase tracking-wider text-on-surface-muted hover:text-primary"
                  >
                    Full team audit
                  </Link>
                )}
              </div>
              <TeamBenchmarkPanel
                data={benchmark}
                loading={benchmarkLoading}
                error={benchmarkError}
                compact
                onRetry={() => {
                  if (!selectedTeamId) return;
                  const team = teams.find((entry) => entry.id === selectedTeamId);
                  setBenchmarkLoading(true);
                  setBenchmarkError(null);
                  fetchTeamBenchmark(selectedTeamId, { format: team?.format ?? "doubles", limit: 12 })
                    .then(setBenchmark)
                    .catch((err) => setBenchmarkError(err instanceof Error ? err.message : "Benchmark failed"))
                    .finally(() => setBenchmarkLoading(false));
                }}
              />
            </div>
          </div>
        </section>
      )}

      {/* DYNAMIC LIVE BOARD */}
      <section className="mx-auto max-w-[82rem] px-6 py-12 sm:px-9">
        <div
          className="overflow-hidden rounded-[2px] border-2 border-outline-variant shadow-[6px_6px_0_var(--color-outline-variant)]"
          style={{
            background: "var(--color-surface-lowest)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b-2 border-outline-variant bg-on-surface px-6 py-4 text-surface">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 animate-pulse rounded-full bg-primary" />
              <span className="font-mono text-[0.75rem] font-bold uppercase tracking-[0.25em] text-accent">
                {isLogged && lastMatch ? "Your Latest Match" : "Global Meta Snapshot"}
              </span>
            </div>
            <div className="font-mono text-[0.65rem] tracking-[0.15em] text-surface">
              {isLogged && lastMatch ? (
                new Date(lastMatch.played_at).toLocaleDateString()
              ) : (
                <DataFreshness format="doubles" />
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Board Left: The Match/Meta */}
            <div className="border-b-2 border-outline-variant p-8 lg:border-b-0 lg:border-r-2">
              <div className="mb-8">
                <h3 className="font-display text-xl font-bold text-on-surface flex items-center gap-2 mb-2">
                  {isLogged && lastMatch ? "Matchup History" : "Meta Threat Assessment"}
                </h3>
                <p className="text-sm text-on-surface-dim">
                  {isLogged && lastMatch 
                    ? "Deep dive into your last recorded matchup strategy." 
                    : "Top tier threats currently dominating the Champions circuit."}
                </p>
              </div>

              {/* Opponent Grid */}
              <div className="mb-8">
                <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-widest text-primary">◆ The Opposition</div>
                <div className="grid grid-cols-6 gap-3">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  {(isLogged && lastMatch?.opponent_team_data ? lastMatch.opponent_team_data : trends.slice(0, 6)).map((p: any, idx: number) => {
                    const name = typeof p === "string" ? p : p.name || p.pokemon_name || "Unknown";
                    const explicitId = typeof p === "string" ? null : coercePokemonId(p.pokemon_id ?? p.id);
                    const resolvedId = explicitId ?? pokemonIdByName.get(normalizePokemonName(name));
                    const id = resolvedId ?? 1;
                    
                    return (
                      <div key={idx} className="group relative aspect-square rounded-[2px] border-2 border-outline-variant bg-surface p-1 transition-all hover:shadow-[3px_3px_0_var(--color-primary)]">
                        <Image
                          src={pokeArt(id)} 
                          alt={name}
                          fill
                          unoptimized
                          sizes="80px"
                          className="object-contain p-1 drop-shadow-2xl"
                        />
                        <div className="absolute -bottom-1 -right-1 flex h-5 items-center justify-center rounded-[2px] border border-outline-variant bg-surface-lowest px-1.5 font-mono text-[0.5rem] font-bold opacity-0 transition-opacity group-hover:opacity-100">
                          {name.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Logic Block */}
              <div className="rounded-[2px] border-2 border-outline-variant bg-surface p-6 shadow-[3px_3px_0_var(--color-outline-variant)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="font-mono text-[0.65rem] uppercase tracking-widest text-accent">◆ AI Logic</span>
                  {isLogged && lastMatch && (
                    <span className={`px-2 py-0.5 rounded font-mono text-[0.6rem] font-bold ${lastMatch.outcome === "win" ? "bg-success/20 text-success border border-success/30" : "bg-primary/20 text-primary border border-primary/30"}`}>
                      {lastMatch.outcome.toUpperCase()}
                    </span>
                  )}
                </div>
                <p className="font-body text-sm leading-relaxed text-on-surface-muted italic">
                  {isLogged && lastMatch?.notes 
                    ? lastMatch.notes 
                    : "The current meta favors strong lead momentum with weather-control pivots. Garchomp remains a central threat, necessitating robust Steel/Fairy defensive cores."}
                </p>
              </div>
            </div>

            {/* Board Right: The Solution/Counters */}
            <div className="bg-surface p-8">
              <div className="mb-8">
                <div className="mb-3 font-mono text-[0.7rem] uppercase tracking-widest text-accent">◆ Strategy & Counterplay</div>
                <div className="grid grid-cols-2 gap-4">
                   {/* Recommendation slots */}
                   {trends.slice(0, 2).map(t => (
                     <div key={t.id} className="group relative cursor-pointer overflow-hidden rounded-[2px] border-2 border-outline-variant bg-accent/30 p-4 transition-all hover:shadow-[3px_3px_0_var(--color-outline-variant)]">
                        <div className="pointer-events-none absolute -right-5 -bottom-5 h-28 w-28 opacity-10 transition-opacity group-hover:opacity-25">
                          <Image
                            src={pokeArt(t.id)}
                            alt=""
                            fill
                            unoptimized
                            sizes="112px"
                            className="object-contain"
                          />
                        </div>
                        <div className="relative">
                          <div className="text-[0.6rem] font-mono uppercase text-accent tracking-tighter mb-1">Top Tier Pillar</div>
                          <div className="text-lg font-display font-bold text-on-surface">{t.pokemon_name}</div>
                          <div className="mt-2 flex gap-1">
                            <span className="rounded-[2px] border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-[0.55rem] text-on-surface-muted">USG {t.usage_percent.toFixed(1)}%</span>
                            <span className="rounded-[2px] border border-outline-variant bg-surface px-1.5 py-0.5 font-mono text-[0.55rem] text-on-surface-muted">WR {t.win_rate.toFixed(1)}%</span>
                          </div>
                        </div>
                     </div>
                   ))}
                </div>
              </div>

              {/* Roster Integration */}
              <div>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono text-[0.7rem] uppercase tracking-widest text-primary">◆ Your Roster Links</span>
                  <Link href="/roster" className="text-[0.65rem] font-mono text-on-surface-muted hover:text-accent uppercase tracking-widest transition-colors flex items-center gap-1">
                    Manage <ChevronRight size={10} />
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-3">
                  {loadingUser ? (
                     Array.from({ length: 4 }).map((_, i) => (
                       <div key={i} className="aspect-[4/5] animate-pulse rounded-[2px] border-2 border-outline-variant bg-surface-high" />
                     ))
                  ) : (
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    (isLogged && userPokemon.length > 0 ? userPokemon.slice(0, 4) : trends.slice(0, 4) as any[]).map((p: any, idx) => (
                      <div key={idx} className="flex aspect-[4/5] flex-col items-center justify-center rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-2 text-center">
                         <Image 
                          src={p.pokemon_id ? pokeSprite(p.pokemon_id) : pokeSprite(p.id || 1)} 
                          alt="" 
                          width={40} 
                          height={40} 
                          unoptimized 
                          className="image-rendering-pixelated mb-2 h-10 w-10 object-contain"
                        />
                         <span className="text-[0.6rem] font-display font-bold text-on-surface truncate w-full">{p.pokemon_name || pokemonNameById.get(p.pokemon_id) || "Pokemon"}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Link href="/draft" className="mt-8 block w-full rounded-[2px] border-2 border-outline-variant bg-primary py-4 text-center font-display text-sm font-bold uppercase tracking-[0.14em] text-surface shadow-[4px_4px_0_var(--color-outline-variant)] transition-all hover:-translate-x-0.5 hover:-translate-y-0.5">
                START FULL DRAFT ANALYSIS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* META MOVERS (COMPACT) */}
      <section className="mx-auto max-w-[82rem] px-6 py-12 sm:px-9">
        <div className="flex items-baseline justify-between mb-8">
          <div className="flex flex-wrap items-baseline gap-3">
            <h2 className="font-display text-3xl font-bold text-on-surface">Trending Mooves.</h2>
            {!loadingTrends && usingBaselineTrends ? (
              <SourceBadge fallback source="baseline" />
            ) : !loadingTrends ? (
              <DataFreshness format="doubles" />
            ) : null}
          </div>
          <Link href="/meta" className="font-mono text-xs text-primary hover:text-accent uppercase tracking-widest">View All</Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {loadingTrends ? <div className="col-span-full h-40 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : trends.map(t => (
            <Link key={t.id} href={`/pokemon/${t.id}`} className="card-interactive group relative min-h-[140px] overflow-hidden p-4">
               <Image src={pokeArt(t.id)} alt="" width={80} height={80} unoptimized className="absolute -right-3 -top-2 h-20 w-20 object-contain opacity-15 transition-opacity group-hover:opacity-30" />
               <div className="relative h-full flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-display font-bold text-sm text-on-surface">{t.pokemon_name}</span>
                    <span className={`text-[0.6rem] font-bold ${t.up ? "text-success" : "text-primary"}`}>
                      {t.up ? "▲" : "▼"} {Math.abs(t.swing).toFixed(1)}%
                    </span>
                  </div>
                  <div className="font-mono text-[0.55rem] text-on-surface-dim uppercase tracking-widest mb-2">{t.role}</div>
                  
                  {/* High Res Details */}
                  <div className="flex-1">
                    {t.top_moves && t.top_moves.length > 0 && (
                      <div className="mb-2">
                        <div className="font-mono text-[0.5rem] uppercase tracking-tighter text-on-surface-muted mb-0.5">Key Moves</div>
                        <div className="flex flex-wrap gap-1">
                          {t.top_moves.slice(0, 2).map(m => (
                            <span key={m.name} className="rounded-[2px] border border-outline-variant/50 bg-surface px-1 text-[0.55rem] text-on-surface-dim">{m.name}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-2 border-t border-outline-variant/30 flex justify-between font-mono text-[0.6rem] text-on-surface-muted">
                    <span>USG {t.usage_percent.toFixed(1)}%</span>
                    <span>WR {t.win_rate.toFixed(1)}%</span>
                  </div>
               </div>
            </Link>
          ))}
        </div>
      </section>

      {/* FOOTER STATS */}
      {stats && (
        <section className="mt-12 border-t-2 border-outline-variant bg-surface-lowest py-16">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 flex-wrap gap-12">
            <StatItem value={stats.pokemon_count} label="Roster" />
            <div className="hidden h-12 w-0.5 bg-outline-variant md:block" />
            <StatItem value={stats.teams_count} label="Teams Built" />
            <div className="hidden h-12 w-0.5 bg-outline-variant md:block" />
            <StatItem value={stats.matches_count} label="Matches Analyzed" />
          </div>
        </section>
      )}
      </div>
    </LabDashboard>
  );
}

function StatItem({ value, label }: { value: number; label: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-bold text-accent mb-1">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[0.7rem] uppercase tracking-[0.25em] text-on-surface-dim">
        {label}
      </div>
    </div>
  );
}

function PrepNotesPanel({
  insights,
  loading,
}: {
  insights: MatchupInsights | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="p-6">
        <div className="h-5 w-40 animate-pulse rounded-[2px] bg-surface-high" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-[2px] bg-surface-high" />
          ))}
        </div>
      </div>
    );
  }

  const recent = insights?.recent;

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary">
            ◆ Prep Notes
          </p>
          <h3 className="mt-1 font-display text-xl font-bold text-on-surface">
            Match log signal
          </h3>
        </div>
        {recent && (
          <span className="rounded-[2px] border border-outline-variant bg-surface px-2 py-1 font-mono text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
            {recent.wins}-{recent.losses} last {recent.total}
          </span>
        )}
      </div>

      {!insights || insights.total_matches === 0 ? (
        <div className="rounded-[2px] border-2 border-dashed border-outline-variant bg-surface-low p-4">
          <p className="font-body text-sm text-on-surface-muted">
            Log match outcomes to unlock matchup-specific prep notes.
          </p>
          <Link
            href="/matches"
            className="mt-3 inline-flex font-mono text-[0.65rem] uppercase tracking-wider text-primary"
          >
            Open match log
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.prep_actions.slice(0, 3).map((action) => (
            <Link
              key={`${action.action}-${action.label}`}
              href={action.action === "benchmark_team" ? "/teams" : "/matches"}
              className="block rounded-[2px] border-2 border-outline-variant bg-surface-lowest p-3 transition-colors hover:bg-surface-low"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display text-sm font-bold text-on-surface">
                    {action.label}
                  </p>
                  <p className="mt-1 font-body text-xs leading-relaxed text-on-surface-muted">
                    {action.detail}
                  </p>
                </div>
                <span className="rounded-[2px] bg-primary px-2 py-1 font-mono text-[0.55rem] uppercase tracking-wider text-surface">
                  {action.action.replace(/_/g, " ")}
                </span>
              </div>
            </Link>
          ))}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <InsightMiniList
              title="Worst opponents"
              items={insights.worst_opponents.map((stat) => ({
                label: stat.label,
                value: `${stat.win_rate.toFixed(1)}% · ${stat.total}`,
              }))}
            />
            <InsightMiniList
              title="Loss tags"
              items={(insights.common_loss_tags.length > 0
                ? insights.common_loss_tags
                : insights.common_loss_reasons
              ).map((item) => ({ label: item.label, value: String(item.count) }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function InsightMiniList({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: string }[];
}) {
  return (
    <div className="rounded-[2px] border border-outline-variant bg-surface p-3">
      <p className="mb-2 font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {title}
      </p>
      {items.length === 0 ? (
        <p className="font-body text-xs text-on-surface-muted">Not enough data yet.</p>
      ) : (
        <div className="space-y-1">
          {items.slice(0, 3).map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-2">
              <span className="truncate font-body text-xs text-on-surface">{item.label}</span>
              <span className="font-mono text-[0.6rem] text-on-surface-muted">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
