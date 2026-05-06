"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchMoves,
  fetchPokemonBasic,
  fetchPokemonDetail,
  runCalc,
  type CalcResponse,
} from "@/lib/api";
import {
  SearchableDropdown,
  type DropdownOption,
} from "@/components/ui/searchable-dropdown";
import { friendlyError } from "@/lib/errors";
import type { Move } from "@/types/move";
import type { PokemonBasic, PokemonDetail } from "@/features/pokemon/types";
import { NATURES } from "@/types/user-pokemon";
import { calcFinalSpeed } from "@/utils/stats";
import Image from "next/image";

type Weather = "none" | "sun" | "rain" | "snow" | "sand";

const WEATHERS: { value: Weather; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sun", label: "Sun" },
  { value: "rain", label: "Rain" },
  { value: "sand", label: "Sand" },
  { value: "snow", label: "Snow" },
];

const STAT_KEYS = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"] as const;
const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  attack: "ATK",
  defense: "DEF",
  sp_attack: "SPA",
  sp_defense: "SPD",
  speed: "SPE",
};

interface SideState {
  pokemonId: string;
  pokemon: PokemonDetail | null;
  statPoints: Record<string, number>;
  nature: string;
}

const DEFAULT_STATS = {
  hp: 0,
  attack: 0,
  defense: 0,
  sp_attack: 0,
  sp_defense: 0,
  speed: 0,
};

export default function CalcPage() {
  const searchParams = useSearchParams();
  const initialAttacker = searchParams.get("attacker") || "";
  const initialDefender = searchParams.get("defender") || "";

  const [allPokemon, setAllPokemon] = useState<PokemonBasic[]>([]);
  const [allMoves, setAllMoves] = useState<Move[]>([]);

  const [attacker, setAttacker] = useState<SideState>({
    pokemonId: initialAttacker,
    pokemon: null,
    statPoints: { ...DEFAULT_STATS },
    nature: "Hardy",
  });

  const [defender, setDefender] = useState<SideState>({
    pokemonId: initialDefender,
    pokemon: null,
    statPoints: { ...DEFAULT_STATS },
    nature: "Hardy",
  });

  const [moveId, setMoveId] = useState<string>("");
  const [weather, setWeather] = useState<Weather>("none");
  const [isDoubles, setIsDoubles] = useState(true);
  const [allMovesToggle, setAllMovesToggle] = useState(false);

  const [result, setResult] = useState<CalcResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setAttacker({ pokemonId: "", pokemon: null, statPoints: { ...DEFAULT_STATS }, nature: "Hardy" });
    setDefender({ pokemonId: "", pokemon: null, statPoints: { ...DEFAULT_STATS }, nature: "Hardy" });
    setMoveId("");
    setWeather("none");
    setResult(null);
  };

  // Initial loads
  useEffect(() => {
    fetchPokemonBasic({ champions_only: true, limit: 1000 }).then((res) =>
      setAllPokemon(res.data)
    );
    fetchMoves({ champions_only: true, limit: 1500 }).then((res) =>
      setAllMoves(res.data)
    );
  }, []);

  // Fetch details when IDs change
  useEffect(() => {
    if (attacker.pokemonId) {
      fetchPokemonDetail(Number(attacker.pokemonId)).then((res) =>
        setAttacker((prev) => ({ ...prev, pokemon: res }))
      );
    }
  }, [attacker.pokemonId]);

  useEffect(() => {
    if (defender.pokemonId) {
      fetchPokemonDetail(Number(defender.pokemonId)).then((res) =>
        setDefender((prev) => ({ ...prev, pokemon: res }))
      );
    }
  }, [defender.pokemonId]);

  const pokemonOptions: DropdownOption[] = useMemo(
    () =>
      allPokemon.map((p) => ({
        value: String(p.id),
        label: p.name,
        sublabel: p.types.join(" / "),
      })),
    [allPokemon]
  );

  const moveOptions: DropdownOption[] = useMemo(() => {
    const movepool = attacker.pokemon?.movepool ? new Set(attacker.pokemon.movepool) : null;
    return allMoves
      .filter((m) => (allMovesToggle || !movepool ? true : movepool.has(m.name)))
      .filter((m) => m.category !== "status" && (m.power ?? 0) > 0)
      .map((m) => ({
        value: String(m.id),
        label: m.name,
        sublabel: `${m.type} · ${m.category} · ${m.power}bp`,
      }));
  }, [allMoves, attacker.pokemon, allMovesToggle]);

  const handleRun = async () => {
    if (!attacker.pokemonId || !defender.pokemonId || !moveId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runCalc({
        attacker_id: Number(attacker.pokemonId),
        defender_id: Number(defender.pokemonId),
        move_id: Number(moveId),
        attacker_stat_points: attacker.statPoints,
        defender_stat_points: defender.statPoints,
        attacker_nature: attacker.nature,
        defender_nature: defender.nature,
        weather,
        is_doubles: isDoubles,
      });
      setResult(res);
    } catch (err) {
      setError(friendlyError(err).message);
    } finally {
      setRunning(false);
    }
  };

  const updateStat = (side: "attacker" | "defender", key: string, val: number) => {
    const setter = side === "attacker" ? setAttacker : setDefender;
    setter((prev) => {
      const otherTotal = Object.entries(prev.statPoints)
        .filter(([k]) => k !== key)
        .reduce((a, [, b]) => a + b, 0);
      const clamped = Math.max(0, Math.min(32, val));
      const maxAllowed = Math.min(clamped, 66 - otherTotal);
      return { ...prev, statPoints: { ...prev.statPoints, [key]: maxAllowed } };
    });
  };

  return (
    <div className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">
      <div className="mb-6">
        <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">
          ◆ COMPETITIVE · TOOLS · L50
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-on-surface">
          Damage Calculator
        </h1>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-2xl font-body text-sm text-on-surface-muted">
            VGC-grade deterministic engine. Models STAB, type effectiveness, doubles spread, and weather. 
            Use the 66-point stat sliders to match Champions builds.
          </p>
          <button 
            onClick={handleReset}
            className="btn-ghost h-9 px-4 font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted hover:text-tertiary transition-colors"
          >
            Reset All
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl bg-tertiary/10 p-4">
          <p className="font-body text-sm text-tertiary">{error}</p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT: Attacker */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="card p-5 border-primary/20">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary">◆ ATTACKER</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.6rem] text-on-surface-muted">
                  {Object.values(attacker.statPoints).reduce((a, b) => a + b, 0)} / 66
                </span>
                {attacker.pokemon?.sprite_url && (
                  <Image src={attacker.pokemon.sprite_url} alt="" width={40} height={40} className="image-rendering-pixelated" unoptimized />
                )}
              </div>
            </div>
            
            <SearchableDropdown
              label="Pokemon"
              placeholder="Pick attacker..."
              value={attacker.pokemonId}
              onChange={(v) => setAttacker(p => ({ ...p, pokemonId: v }))}
              options={pokemonOptions}
            />

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">Nature</span>
                <select 
                  value={attacker.nature}
                  onChange={(e) => setAttacker(p => ({ ...p, nature: e.target.value }))}
                  className="bg-surface-high rounded px-2 py-1 font-body text-xs text-on-surface outline-none"
                >
                  {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                {STAT_KEYS.map(key => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-8 font-mono text-[0.6rem] text-on-surface-muted uppercase">{STAT_LABELS[key]}</span>
                    <input 
                      type="range" min="0" max="32" step="2"
                      value={attacker.statPoints[key] || 0}
                      onChange={(e) => updateStat("attacker", key, parseInt(e.target.value))}
                      className="flex-1 accent-primary h-1.5 rounded-full bg-surface-high appearance-none cursor-pointer"
                    />
                    <span className="w-6 text-right font-mono text-xs font-bold text-primary">{attacker.statPoints[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">◆ MOVE SELECTION</span>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allMovesToggle} onChange={e => setAllMovesToggle(e.target.checked)} className="h-3 w-3" />
                <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">All Moves</span>
              </label>
            </div>
            <SearchableDropdown
              placeholder="Search moves..."
              value={moveId}
              onChange={setMoveId}
              options={moveOptions}
              disabled={!attacker.pokemonId}
            />
          </div>
        </div>

        {/* MIDDLE: Results & Field */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          <div className="card p-6 bg-surface-lowest border-accent/20 flex flex-col items-center text-center">
             <div className="mb-6 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-accent">◆ CALCULATION</div>
             
             {!result ? (
               <div className="py-12 flex flex-col items-center gap-4">
                 <div className="h-16 w-16 rounded-full border-2 border-dashed border-outline-variant flex items-center justify-center">
                   <span className="text-on-surface-muted text-xs">VS</span>
                 </div>
                 <p className="text-on-surface-muted font-body text-sm">Select Pokemon and a move<br/>to see damage rolls</p>
                 <button
                  onClick={handleRun}
                  disabled={!attacker.pokemonId || !defender.pokemonId || !moveId || running}
                  className="mt-4 btn-primary px-8 py-3 font-display text-sm uppercase tracking-widest disabled:opacity-30"
                >
                  {running ? "Analyzing..." : "Execute Calc"}
                </button>
               </div>
             ) : (
               <div className="w-full">
                 <div className="text-4xl font-display font-bold text-accent mb-2">
                   {result.formatted}
                 </div>
                 <div className="text-xs font-mono text-on-surface-muted mb-6">
                    {result.min} - {result.max} HP damage
                 </div>

                 <div className="h-3 w-full bg-surface-high rounded-full overflow-hidden mb-6">
                    <div 
                      className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500"
                      style={{ width: `${Math.min(100, result.max_pct)}%` }}
                    />
                 </div>

                 <div className="flex flex-col gap-2 mb-8">
                    {result.is_guaranteed_ohko && (
                      <div className="bg-primary/10 text-primary text-[0.6rem] font-mono uppercase tracking-widest py-1 rounded border border-primary/20">Guaranteed OHKO</div>
                    )}
                    {result.is_ohko_chance && !result.is_guaranteed_ohko && (
                      <div className="bg-accent/10 text-accent text-[0.6rem] font-mono uppercase tracking-widest py-1 rounded border border-accent/20">OHKO Chance</div>
                    )}

                    {/* Speed Comparison */}
                    {(() => {
                      const atkSpeed = calcFinalSpeed(
                        attacker.pokemon?.base_stats?.speed ?? 0,
                        attacker.statPoints.speed || 0,
                        attacker.nature
                      );
                      const defSpeed = calcFinalSpeed(
                        defender.pokemon?.base_stats?.speed ?? 0,
                        defender.statPoints.speed || 0,
                        defender.nature
                      );
                      const isFaster = atkSpeed > defSpeed;
                      const isTie = atkSpeed === defSpeed;

                      return (
                        <div className="mt-2 bg-surface-mid/50 rounded p-2 border border-outline-variant/30">
                          <div className="flex justify-between items-center mb-1">
                            <span className="font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">Speed Comparison</span>
                            <span className={`font-mono text-[0.55rem] font-bold ${isFaster ? 'text-primary' : isTie ? 'text-accent' : 'text-tertiary'}`}>
                              {isFaster ? 'ATTACKER FASTER' : isTie ? 'SPEED TIE' : 'DEFENDER FASTER'}
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-xs">
                            <div className="flex flex-col items-start">
                              <span className="text-[0.5rem] uppercase text-on-surface-muted">Atk</span>
                              <span className={isFaster ? 'text-primary font-bold' : ''}>{atkSpeed}</span>
                            </div>
                            <div className="flex flex-col items-end">
                              <span className="text-[0.5rem] uppercase text-on-surface-muted">Def</span>
                              <span className={!isFaster && !isTie ? 'text-tertiary font-bold' : ''}>{defSpeed}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                 </div>

                 <button 
                  onClick={handleRun}
                  className="btn-ghost w-full py-2 font-display text-[0.65rem] uppercase tracking-widest border border-outline-variant"
                 >
                   Re-Run Scenario
                 </button>
               </div>
             )}
          </div>

          <div className="card p-5">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">◆ FIELD CONDITIONS</span>
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap gap-1">
                {WEATHERS.map(w => (
                  <button 
                    key={w.value}
                    onClick={() => setWeather(w.value)}
                    className={`flex-1 py-1.5 rounded font-display text-[0.6rem] uppercase tracking-wider transition-colors ${weather === w.value ? 'bg-primary text-surface' : 'bg-surface-high text-on-surface-muted hover:bg-surface-mid'}`}
                  >
                    {w.label}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-3 p-3 bg-surface-low rounded-lg cursor-pointer hover:bg-surface-mid transition-colors">
                <input type="checkbox" checked={isDoubles} onChange={e => setIsDoubles(e.target.checked)} className="h-4 w-4 rounded border-outline-variant" />
                <div className="flex flex-col">
                  <span className="font-display text-xs font-bold text-on-surface">Doubles Format</span>
                  <span className="text-[0.6rem] text-on-surface-muted uppercase tracking-tight">Spread reduction (0.75x) active</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* RIGHT: Defender */}
        <div className="lg:col-span-4 flex flex-col gap-4">
           <div className="card p-5 border-accent/20">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-accent">◆ DEFENDER</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[0.6rem] text-on-surface-muted">
                  {Object.values(defender.statPoints).reduce((a, b) => a + b, 0)} / 66
                </span>
                {defender.pokemon?.sprite_url && (
                  <Image src={defender.pokemon.sprite_url} alt="" width={40} height={40} className="image-rendering-pixelated" unoptimized />
                )}
              </div>
            </div>
            
            <SearchableDropdown
              label="Pokemon"
              placeholder="Pick defender..."
              value={defender.pokemonId}
              onChange={(v) => setDefender(p => ({ ...p, pokemonId: v }))}
              options={pokemonOptions}
            />

            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-display text-[0.65rem] uppercase tracking-wider text-on-surface-muted">Nature</span>
                <select 
                  value={defender.nature}
                  onChange={(e) => setDefender(p => ({ ...p, nature: e.target.value }))}
                  className="bg-surface-high rounded px-2 py-1 font-body text-xs text-on-surface outline-none"
                >
                  {NATURES.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>

              <div className="space-y-3">
                {STAT_KEYS.map(key => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="w-8 font-mono text-[0.6rem] text-on-surface-muted uppercase">{STAT_LABELS[key]}</span>
                    <input 
                      type="range" min="0" max="32" step="2"
                      value={defender.statPoints[key] || 0}
                      onChange={(e) => updateStat("defender", key, parseInt(e.target.value))}
                      className="flex-1 accent-accent h-1.5 rounded-full bg-surface-high appearance-none cursor-pointer"
                    />
                    <span className="w-6 text-right font-mono text-xs font-bold text-accent">{defender.statPoints[key] || 0}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
