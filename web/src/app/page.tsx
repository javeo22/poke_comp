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
  fetchPokemonBasic
} from "@/lib/api";
import type { PublicStats } from "@/lib/api";
import type { MetaTrend } from "@/types/meta";
import type { UserPokemon } from "@/types/user-pokemon";
import type { Matchup } from "@/types/matchup";
import { pokeArt, pokeSprite } from "@/lib/sprites";
import { createClient } from "@/utils/supabase/client";
import { SearchableDropdown, type DropdownOption } from "@/components/ui/searchable-dropdown";
import { ChevronRight, Play, Trophy, Users, Zap, Shield } from "lucide-react";
import { LabDashboard } from "@/components/ui/lab-dashboard";
import { BASELINE_TRENDS } from "@/features/meta/baseline-trends";

export default function HomePage() {
  const router = useRouter();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [trends, setTrends] = useState<MetaTrend[]>(BASELINE_TRENDS);
  const [loadingTrends, setLoadingTrends] = useState(true);
  const [userPokemon, setUserPokemon] = useState<UserPokemon[]>([]);
  const [lastMatch, setMatch] = useState<Matchup | null>(null);
  const [pokemonOptions, setPokemonOptions] = useState<DropdownOption[]>([]);
  const [isLogged, setIsLogged] = useState(false);
  const [loadingUser, setLoadingUser] = useState(false);

  useEffect(() => {
    // 1. Static stats & Meta
    fetchPublicStats().then(setStats).catch(() => {});
    fetchMetaTrends("doubles", 6)
      .then(res => {
        if (res && res.length > 0) {
          setTrends(res);
        }
      })
      .catch((err) => console.error("Failed to fetch trends:", err))
      .finally(() => setLoadingTrends(false));

    // 2. Search options
    fetchPokemonBasic({ champions_only: true, limit: 1000 }).then(res => {
      setPokemonOptions(res.data.map(p => ({
        value: String(p.id),
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
          Promise.all([
            fetchUserPokemon({ limit: 14 }),
            fetchMatchups({ limit: 1 })
          ]).then(([up, m]) => {
            setUserPokemon(up.data);
            if (m.data.length > 0) setMatch(m.data[0]);
          }).catch(() => {})
          .finally(() => setLoadingUser(false));
        }
      });
    }
  }, []);

  const handleQuickDraft = (id: string) => {
    if (!id) return;
    router.push(`/draft?opp=${id}`);
  };

  return (
    <LabDashboard>
      <div className="relative z-10 w-full">
        {/* HERO SECTION */}
        <section className="mx-auto max-w-[82rem] px-6 pt-16 pb-12 sm:px-9">
        <div className="flex flex-col lg:flex-row lg:items-center gap-12">
          <div className="flex-1">
            <div className="inline-flex flex-col gap-1 mb-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-outline-variant px-3 py-1 bg-surface-low/50 w-fit">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_var(--color-primary)] animate-pulse" />
                <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-on-surface-muted">
                  REGULATION M-A DASHBOARD
                </span>
              </div>
              <span className="px-3 font-mono text-[0.55rem] uppercase tracking-[0.15em] text-on-surface-dim">
                LIVE TELEMETRY FROM SEASON M-1 CHAMPIONS
              </span>
            </div>

            <h1 className="font-display font-bold tracking-[-0.04em] text-[3rem] leading-[1.05] sm:text-6xl lg:text-[5.5rem] lg:leading-[0.98] text-on-surface m-0">
              Master the <br />
              <span className="text-gradient">Champions Meta.</span>
            </h1>

            <p className="mt-8 max-w-[38rem] text-lg sm:text-xl leading-relaxed text-on-surface-dim">
              The only AI-powered companion built exclusively for Pokemon Champions. 
              Draft counters, track your roster, and outplay the meta with real-time data.
            </p>

            {/* Quick Action Search */}
            <div className="mt-10 max-w-[32rem]">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur opacity-25 group-focus-within:opacity-100 transition duration-500" />
                <div className="relative flex items-center gap-2 rounded-2xl border border-outline-variant bg-surface-lowest/80 p-2 backdrop-blur-xl shadow-2xl">
                  <div className="flex-1 px-2">
                    <SearchableDropdown
                      value={""}
                      onChange={(v) => handleQuickDraft(v)}
                      options={pokemonOptions}
                      placeholder="Enter opponent's Pokemon to start draft..."
                    />
                  </div>
                  <button 
                    className="h-12 w-12 flex items-center justify-center rounded-xl bg-accent text-surface-lowest hover:scale-105 active:scale-95 transition-all shadow-lg"
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
                      onClick={() => handleQuickDraft(String(t.id))}
                      className="font-mono text-[0.65rem] text-primary hover:text-accent transition-colors"
                    >
                      {t.pokemon_name.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Feature Badge Grid (Visual) */}
          <div className="hidden lg:grid grid-cols-2 gap-4 w-[380px]">
            <FeatureCard icon={<Zap size={18} />} title="Real-time Stats" desc="Pikalytics + Limitless" />
            <FeatureCard icon={<Shield size={18} />} title="Roster Guard" desc="Legal data only" />
            <FeatureCard icon={<Trophy size={18} />} title="Tournament Meta" desc="Recent high-placing wins" />
            <FeatureCard icon={<Users size={18} />} title="Community" desc="Built by fan-grinders" />
          </div>
        </div>
      </section>

      {/* DYNAMIC LIVE BOARD */}
      <section className="mx-auto max-w-[82rem] px-6 py-12 sm:px-9">
        <div
          className="overflow-hidden rounded-3xl border border-outline-variant shadow-2xl"
          style={{
            background: "linear-gradient(180deg, rgba(20,12,28,0.9), rgba(15,9,22,0.95))",
            boxShadow: "0 0 0 1px rgba(255,210,63,0.05) inset",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-outline-variant px-6 py-4 bg-surface-low/30">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--color-primary)]" />
              <span className="font-mono text-[0.75rem] font-bold tracking-[0.25em] text-primary uppercase">
                {isLogged && lastMatch ? "Your Latest Match" : "Global Meta Snapshot"}
              </span>
            </div>
            <div className="font-mono text-[0.65rem] tracking-[0.15em] text-on-surface-muted">
              {isLogged && lastMatch ? new Date(lastMatch.played_at).toLocaleDateString() : "REFRESHED 6H AGO"}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2">
            {/* Board Left: The Match/Meta */}
            <div className="p-8 border-b lg:border-b-0 lg:border-r border-outline-variant">
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
                    const name = p.name || p.pokemon_name || "Unknown";
                    // Attempt to find ID for matchup opponents to show correct art
                    const found = pokemonOptions.find(o => o.label.toLowerCase() === name.toLowerCase());
                    const id = p.id || (found ? Number(found.value) : 0);
                    
                    return (
                      <div key={idx} className="group relative aspect-square rounded-xl border border-primary/20 bg-primary/5 p-1 transition-all hover:border-primary/50">
                        <Image
                          src={id ? pokeArt(id) : pokeArt(1)} 
                          alt={name}
                          fill
                          unoptimized
                          className="object-contain p-1 drop-shadow-2xl"
                        />
                        <div className="absolute -bottom-1 -right-1 h-5 px-1.5 rounded bg-surface border border-outline-variant text-[0.5rem] font-mono font-bold flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          {name.toUpperCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Logic Block */}
              <div className="rounded-2xl bg-surface-lowest/50 border border-outline-variant p-6">
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
            <div className="p-8 bg-surface-low/20">
              <div className="mb-8">
                <div className="mb-3 font-mono text-[0.7rem] uppercase tracking-widest text-accent">◆ Strategy & Counterplay</div>
                <div className="grid grid-cols-2 gap-4">
                   {/* Recommendation slots */}
                   {trends.slice(0, 2).map(t => (
                     <div key={t.id} className="relative overflow-hidden rounded-2xl border border-accent/20 bg-accent/5 p-4 group cursor-pointer hover:border-accent/40 transition-all">
                        <Image src={pokeArt(t.id)} alt="" fill unoptimized className="absolute -right-4 -bottom-4 h-24 w-24 opacity-10 group-hover:opacity-25 transition-opacity" />
                        <div className="relative">
                          <div className="text-[0.6rem] font-mono uppercase text-accent tracking-tighter mb-1">Top Tier Pillar</div>
                          <div className="text-lg font-display font-bold text-on-surface">{t.pokemon_name}</div>
                          <div className="mt-2 flex gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-surface border border-outline-variant text-[0.55rem] font-mono text-on-surface-muted">USG {t.usage_percent.toFixed(1)}%</span>
                            <span className="px-1.5 py-0.5 rounded bg-surface border border-outline-variant text-[0.55rem] font-mono text-on-surface-muted">WR {t.win_rate.toFixed(1)}%</span>
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
                       <div key={i} className="aspect-[4/5] rounded-xl bg-surface-low animate-pulse" />
                     ))
                  ) : (
                    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
                    (isLogged && userPokemon.length > 0 ? userPokemon.slice(0, 4) : trends.slice(0, 4) as any[]).map((p: any, idx) => (
                      <div key={idx} className="aspect-[4/5] rounded-xl border border-outline-variant bg-surface-lowest/30 p-2 flex flex-col items-center justify-center text-center">
                         <Image 
                          src={p.pokemon_id ? pokeSprite(p.pokemon_id) : pokeSprite(p.id || 1)} 
                          alt="" 
                          width={40} 
                          height={40} 
                          unoptimized 
                          className="image-rendering-pixelated mb-2"
                        />
                         <span className="text-[0.6rem] font-display font-bold text-on-surface truncate w-full">{p.pokemon_name || pokemonOptions.find(o => o.value === String(p.pokemon_id))?.label || "Pokemon"}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <Link href="/draft" className="mt-8 block w-full py-4 rounded-xl bg-accent text-surface-lowest text-center font-display font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl">
                START FULL DRAFT ANALYSIS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* META MOVERS (COMPACT) */}
      <section className="mx-auto max-w-[82rem] px-6 py-12 sm:px-9">
        <div className="flex items-baseline justify-between mb-8">
          <h2 className="font-display text-3xl font-bold text-on-surface">Trending Mooves.</h2>
          <Link href="/meta" className="font-mono text-xs text-primary hover:text-accent uppercase tracking-widest">View All</Link>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {loadingTrends ? <div className="col-span-full h-40 flex items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div> : trends.map(t => (
            <Link key={t.id} href={`/pokemon/${t.id}`} className="card-interactive relative overflow-hidden p-4 group min-h-[140px]">
               <Image src={pokeArt(t.id)} alt="" width={80} height={80} unoptimized className="absolute -right-3 -top-2 opacity-15 group-hover:opacity-30 transition-opacity" />
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
                            <span key={m.name} className="text-[0.55rem] text-on-surface-dim bg-surface px-1 rounded border border-outline-variant/50">{m.name}</span>
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
        <section className="border-t border-outline-variant mt-12 bg-surface-low/20 py-16">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6 flex-wrap gap-12">
            <StatItem value={stats.pokemon_count} label="Roster" />
            <div className="h-12 w-px bg-outline-variant hidden md:block" />
            <StatItem value={stats.teams_count} label="Teams Built" />
            <div className="h-12 w-px bg-outline-variant hidden md:block" />
            <StatItem value={stats.matches_count} label="Matches Analyzed" />
          </div>
        </section>
      )}
      </div>
    </LabDashboard>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-low/30 p-5 backdrop-blur-md">
      <div className="mb-3 text-accent">{icon}</div>
      <div className="font-display text-sm font-bold text-on-surface mb-1">{title}</div>
      <div className="font-body text-xs text-on-surface-muted">{desc}</div>
    </div>
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
