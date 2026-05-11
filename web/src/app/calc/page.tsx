"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  fetchMoves,
  fetchPokemonBasic,
  fetchPokemonDetail,
  fetchUserPokemon,
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
import type { UserPokemon } from "@/types/user-pokemon";
import { NATURES } from "@/types/user-pokemon";
import { calcFinalStats, type StatTable } from "@/utils/stats";
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
  megaPokemonId: string;
  megaPokemon: PokemonDetail | null;
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
  const [rosterBuilds, setRosterBuilds] = useState<UserPokemon[]>([]);

  const [attacker, setAttacker] = useState<SideState>({
    pokemonId: initialAttacker,
    pokemon: null,
    megaPokemonId: "",
    megaPokemon: null,
    statPoints: { ...DEFAULT_STATS },
    nature: "Hardy",
  });

  const [defender, setDefender] = useState<SideState>({
    pokemonId: initialDefender,
    pokemon: null,
    megaPokemonId: "",
    megaPokemon: null,
    statPoints: { ...DEFAULT_STATS },
    nature: "Hardy",
  });

  const [moveId, setMoveId] = useState<string>("");
  const [weather, setWeather] = useState<Weather>("none");
  const [isDoubles, setIsDoubles] = useState(true);
  const [allMovesToggle, setAllMovesToggle] = useState(false);
  const [burnModifier, setBurnModifier] = useState(false);
  const [helpingHandModifier, setHelpingHandModifier] = useState(false);
  const [screenModifier, setScreenModifier] = useState(false);
  const [critModifier, setCritModifier] = useState(false);
  const [spreadModifier, setSpreadModifier] = useState(false);
  const [customModifier, setCustomModifier] = useState(1);

  const [result, setResult] = useState<CalcResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReset = () => {
    setAttacker({
      pokemonId: "",
      pokemon: null,
      megaPokemonId: "",
      megaPokemon: null,
      statPoints: { ...DEFAULT_STATS },
      nature: "Hardy",
    });
    setDefender({
      pokemonId: "",
      pokemon: null,
      megaPokemonId: "",
      megaPokemon: null,
      statPoints: { ...DEFAULT_STATS },
      nature: "Hardy",
    });
    setMoveId("");
    setWeather("none");
    setBurnModifier(false);
    setHelpingHandModifier(false);
    setScreenModifier(false);
    setCritModifier(false);
    setSpreadModifier(false);
    setCustomModifier(1);
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
    fetchUserPokemon({ limit: 500 })
      .then((res) => setRosterBuilds(res.data))
      .catch(() => {});
  }, []);

  // Fetch details when IDs change
  useEffect(() => {
    if (!attacker.pokemonId) {
      setAttacker((prev) => ({
        ...prev,
        pokemon: null,
        megaPokemonId: "",
        megaPokemon: null,
      }));
      return;
    }

    const currentId = attacker.pokemonId;
    let ignore = false;
    fetchPokemonDetail(Number(currentId)).then((res) => {
      if (ignore) return;
      setAttacker((prev) => {
        if (prev.pokemonId !== currentId) return prev;
        const megaIds = res.mega_evolution_ids ?? [];
        const keepMega =
          prev.megaPokemonId !== "" && megaIds.includes(Number(prev.megaPokemonId));
        return {
          ...prev,
          pokemon: res,
          megaPokemonId: keepMega ? prev.megaPokemonId : "",
          megaPokemon: keepMega ? prev.megaPokemon : null,
        };
      });
    });
    return () => {
      ignore = true;
    };
  }, [attacker.pokemonId]);

  useEffect(() => {
    if (!defender.pokemonId) {
      setDefender((prev) => ({
        ...prev,
        pokemon: null,
        megaPokemonId: "",
        megaPokemon: null,
      }));
      return;
    }

    const currentId = defender.pokemonId;
    let ignore = false;
    fetchPokemonDetail(Number(currentId)).then((res) => {
      if (ignore) return;
      setDefender((prev) => {
        if (prev.pokemonId !== currentId) return prev;
        const megaIds = res.mega_evolution_ids ?? [];
        const keepMega =
          prev.megaPokemonId !== "" && megaIds.includes(Number(prev.megaPokemonId));
        return {
          ...prev,
          pokemon: res,
          megaPokemonId: keepMega ? prev.megaPokemonId : "",
          megaPokemon: keepMega ? prev.megaPokemon : null,
        };
      });
    });
    return () => {
      ignore = true;
    };
  }, [defender.pokemonId]);

  useEffect(() => {
    if (!attacker.megaPokemonId) {
      setAttacker((prev) => (prev.megaPokemon ? { ...prev, megaPokemon: null } : prev));
      return;
    }

    const currentId = attacker.megaPokemonId;
    let ignore = false;
    fetchPokemonDetail(Number(currentId)).then((res) => {
      if (ignore) return;
      setAttacker((prev) =>
        prev.megaPokemonId === currentId ? { ...prev, megaPokemon: res } : prev
      );
    });
    return () => {
      ignore = true;
    };
  }, [attacker.megaPokemonId]);

  useEffect(() => {
    if (!defender.megaPokemonId) {
      setDefender((prev) => (prev.megaPokemon ? { ...prev, megaPokemon: null } : prev));
      return;
    }

    const currentId = defender.megaPokemonId;
    let ignore = false;
    fetchPokemonDetail(Number(currentId)).then((res) => {
      if (ignore) return;
      setDefender((prev) =>
        prev.megaPokemonId === currentId ? { ...prev, megaPokemon: res } : prev
      );
    });
    return () => {
      ignore = true;
    };
  }, [defender.megaPokemonId]);

  const activeAttackerPokemon = getActivePokemon(attacker);
  const activeDefenderPokemon = getActivePokemon(defender);
  const attackerCalcPokemonId = attacker.megaPokemonId || attacker.pokemonId;
  const defenderCalcPokemonId = defender.megaPokemonId || defender.pokemonId;
  const attackerFinalStats = useMemo(
    () => calcFinalStats(activeAttackerPokemon?.base_stats, attacker.statPoints, attacker.nature),
    [activeAttackerPokemon?.base_stats, attacker.nature, attacker.statPoints]
  );
  const defenderFinalStats = useMemo(
    () => calcFinalStats(activeDefenderPokemon?.base_stats, defender.statPoints, defender.nature),
    [activeDefenderPokemon?.base_stats, defender.nature, defender.statPoints]
  );

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
    const movepool = activeAttackerPokemon?.movepool
      ? new Set(activeAttackerPokemon.movepool)
      : null;
    return allMoves
      .filter((m) => (allMovesToggle || !movepool ? true : movepool.has(m.name)))
      .filter((m) => m.category !== "status" && (m.power ?? 0) > 0)
      .map((m) => ({
        value: String(m.id),
        label: m.name,
        sublabel: `${m.type} · ${m.category} · ${m.power}bp`,
      }));
  }, [allMoves, activeAttackerPokemon, allMovesToggle]);

  const rosterBuildOptions: DropdownOption[] = useMemo(() => {
    const nameById = new Map(allPokemon.map((p) => [p.id, p.name]));
    return rosterBuilds.map((build) => ({
      value: build.id,
      label: nameById.get(build.pokemon_id) ?? `Pokemon #${build.pokemon_id}`,
      sublabel: [build.item_id ? "item set" : null, build.nature, build.ability]
        .filter(Boolean)
        .join(" / "),
    }));
  }, [allPokemon, rosterBuilds]);

  const extraModifier = useMemo(() => {
    let modifier = customModifier;
    if (burnModifier) modifier *= 0.5;
    if (helpingHandModifier) modifier *= 1.5;
    if (screenModifier) modifier *= 2 / 3;
    if (critModifier) modifier *= 1.5;
    if (spreadModifier) modifier *= 0.75;
    return Number(modifier.toFixed(4));
  }, [
    burnModifier,
    helpingHandModifier,
    screenModifier,
    critModifier,
    spreadModifier,
    customModifier,
  ]);

  const applyRosterBuild = (side: "attacker" | "defender", buildId: string) => {
    const build = rosterBuilds.find((entry) => entry.id === buildId);
    if (!build) return;
    const nextState: SideState = {
      pokemonId: String(build.pokemon_id),
      pokemon: null,
      megaPokemonId: "",
      megaPokemon: null,
      statPoints: { ...DEFAULT_STATS, ...(build.stat_points ?? {}) },
      nature: build.nature ?? "Hardy",
    };
    if (side === "attacker") {
      setAttacker(nextState);
      const firstMove = (build.moves ?? [])
        .map((name) => allMoves.find((move) => move.name.toLowerCase() === name.toLowerCase()))
        .find((move): move is Move => !!move && move.category !== "status" && (move.power ?? 0) > 0);
      if (firstMove) setMoveId(String(firstMove.id));
    } else {
      setDefender(nextState);
    }
  };

  const handleRun = async () => {
    if (!attackerCalcPokemonId || !defenderCalcPokemonId || !moveId) return;
    setRunning(true);
    setError(null);
    try {
      const res = await runCalc({
        attacker_id: Number(attackerCalcPokemonId),
        defender_id: Number(defenderCalcPokemonId),
        move_id: Number(moveId),
        attacker_stat_points: attacker.statPoints,
        defender_stat_points: defender.statPoints,
        attacker_nature: attacker.nature,
        defender_nature: defender.nature,
        weather,
        is_doubles: isDoubles,
        extra_modifier: extraModifier,
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
                {activeAttackerPokemon?.sprite_url && (
                  <Image src={activeAttackerPokemon.sprite_url} alt="" width={40} height={40} className="image-rendering-pixelated" unoptimized />
                )}
              </div>
            </div>
            
            <SearchableDropdown
              label="Pokemon"
              placeholder="Pick attacker..."
              value={attacker.pokemonId}
              onChange={(v) =>
                setAttacker(p => ({ ...p, pokemonId: v, megaPokemonId: "", megaPokemon: null }))
              }
              options={pokemonOptions}
            />
            <MegaFormSelector
              side={attacker}
              tone="primary"
              onChange={(megaPokemonId) =>
                setAttacker((p) => ({ ...p, megaPokemonId, megaPokemon: null }))
              }
            />
            {rosterBuildOptions.length > 0 && (
              <div className="mt-3">
                <SearchableDropdown
                  label="Load from roster"
                  placeholder="Use saved attacker build..."
                  value=""
                  onChange={(v) => applyRosterBuild("attacker", v)}
                  options={rosterBuildOptions}
                />
              </div>
            )}

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
                      type="range" min="0" max="32" step="1"
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
          <StatComparison
            attackerName={activeAttackerPokemon?.name ?? "Attacker"}
            defenderName={activeDefenderPokemon?.name ?? "Defender"}
            attackerTypes={activeAttackerPokemon?.types ?? []}
            defenderTypes={activeDefenderPokemon?.types ?? []}
            attackerStats={attackerFinalStats}
            defenderStats={defenderFinalStats}
            ready={!!activeAttackerPokemon && !!activeDefenderPokemon}
          />

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
                  disabled={!attackerCalcPokemonId || !defenderCalcPokemonId || !moveId || running}
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
                 <div className="mb-6 rounded-lg bg-surface-mid/50 p-2 font-body text-xs text-on-surface-muted">
                   <span className="text-on-surface">{result.attacker_name}</span>
                   <span className="px-2">→</span>
                   <span className="text-on-surface">{result.defender_name}</span>
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
              <div className="grid grid-cols-2 gap-2">
                <ModifierToggle label="Burn" active={burnModifier} onClick={() => setBurnModifier((v) => !v)} />
                <ModifierToggle label="Helping Hand" active={helpingHandModifier} onClick={() => setHelpingHandModifier((v) => !v)} />
                <ModifierToggle label="Screen" active={screenModifier} onClick={() => setScreenModifier((v) => !v)} />
                <ModifierToggle label="Crit" active={critModifier} onClick={() => setCritModifier((v) => !v)} />
                <ModifierToggle label="Spread" active={spreadModifier} onClick={() => setSpreadModifier((v) => !v)} />
                <div className="rounded-lg bg-surface-low p-2">
                  <label className="mb-1 block font-display text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
                    Custom x
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="10"
                    step="0.05"
                    value={customModifier}
                    onChange={(e) => setCustomModifier(Number(e.target.value) || 1)}
                    className="input-field h-8 w-full rounded px-2 font-mono text-xs text-on-surface"
                  />
                </div>
              </div>
              <p className="font-mono text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
                Extra modifier: {extraModifier.toFixed(2)}x
              </p>
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
                {activeDefenderPokemon?.sprite_url && (
                  <Image src={activeDefenderPokemon.sprite_url} alt="" width={40} height={40} className="image-rendering-pixelated" unoptimized />
                )}
              </div>
            </div>
            
            <SearchableDropdown
              label="Pokemon"
              placeholder="Pick defender..."
              value={defender.pokemonId}
              onChange={(v) =>
                setDefender(p => ({ ...p, pokemonId: v, megaPokemonId: "", megaPokemon: null }))
              }
              options={pokemonOptions}
            />
            <MegaFormSelector
              side={defender}
              tone="accent"
              onChange={(megaPokemonId) =>
                setDefender((p) => ({ ...p, megaPokemonId, megaPokemon: null }))
              }
            />
            {rosterBuildOptions.length > 0 && (
              <div className="mt-3">
                <SearchableDropdown
                  label="Load from roster"
                  placeholder="Use saved defender build..."
                  value=""
                  onChange={(v) => applyRosterBuild("defender", v)}
                  options={rosterBuildOptions}
                />
              </div>
            )}

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
                      type="range" min="0" max="32" step="1"
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

function getActivePokemon(side: SideState): PokemonDetail | null {
  if (!side.megaPokemonId) return side.pokemon;
  return side.megaPokemon ?? side.pokemon;
}

function StatComparison({
  attackerName,
  defenderName,
  attackerTypes,
  defenderTypes,
  attackerStats,
  defenderStats,
  ready,
}: {
  attackerName: string;
  defenderName: string;
  attackerTypes: string[];
  defenderTypes: string[];
  attackerStats: StatTable;
  defenderStats: StatTable;
  ready: boolean;
}) {
  const speedDelta = attackerStats.speed - defenderStats.speed;
  const speedVerdict =
    speedDelta > 0
      ? "Attacker outspeeds"
      : speedDelta < 0
        ? "Defender outspeeds"
        : "Speed tie";

  return (
    <div className="card p-5 border-outline-variant/70 bg-surface-lowest">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">
          ◆ FINAL STATS
        </span>
        {ready && (
          <span
            className={`rounded-md border px-2 py-1 font-mono text-[0.55rem] uppercase tracking-wider ${
              speedDelta > 0
                ? "border-primary/30 bg-primary/10 text-primary"
                : speedDelta < 0
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-outline-variant bg-surface-low text-on-surface-muted"
            }`}
          >
            {speedVerdict}
          </span>
        )}
      </div>

      {!ready ? (
        <div className="rounded-lg border border-dashed border-outline-variant bg-surface-low p-5 text-center">
          <p className="font-body text-sm text-on-surface-muted">
            Pick both Pokemon to compare Level 50 stats.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-start gap-2">
            <PokemonStatHeader name={attackerName} types={attackerTypes} tone="primary" />
            <div />
            <PokemonStatHeader name={defenderName} types={defenderTypes} tone="accent" align="right" />
          </div>

          <div className="space-y-1.5">
            {STAT_KEYS.map((key) => {
              const attackerValue = attackerStats[key];
              const defenderValue = defenderStats[key];
              const delta = attackerValue - defenderValue;
              const isSpeed = key === "speed";

              return (
                <div
                  key={key}
                  className={`grid min-h-10 grid-cols-[minmax(0,1fr)_3rem_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 py-1.5 ${
                    isSpeed ? "bg-surface-mid/60" : "bg-surface-low/80"
                  }`}
                >
                  <StatValue
                    value={attackerValue}
                    isLeader={delta > 0}
                    tone="primary"
                    align="left"
                  />
                  <div className="text-center">
                    <span className="block font-display text-[0.58rem] uppercase tracking-wider text-on-surface-muted">
                      {STAT_LABELS[key]}
                    </span>
                    <span
                      className={`block font-mono text-[0.55rem] ${
                        delta === 0
                          ? "text-on-surface-muted"
                          : delta > 0
                            ? "text-primary"
                            : "text-accent"
                      }`}
                    >
                      {delta === 0 ? "Tie" : delta > 0 ? `+${delta}` : `${delta}`}
                    </span>
                  </div>
                  <StatValue
                    value={defenderValue}
                    isLeader={delta < 0}
                    tone="accent"
                    align="right"
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function PokemonStatHeader({
  name,
  types,
  tone,
  align = "left",
}: {
  name: string;
  types: string[];
  tone: "primary" | "accent";
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "min-w-0 text-right" : "min-w-0"}>
      <p
        className={`truncate font-display text-sm font-bold ${
          tone === "primary" ? "text-primary" : "text-accent"
        }`}
      >
        {name}
      </p>
      <p className="truncate font-mono text-[0.55rem] uppercase tracking-wider text-on-surface-muted">
        {types.join(" / ")}
      </p>
    </div>
  );
}

function StatValue({
  value,
  isLeader,
  tone,
  align,
}: {
  value: number;
  isLeader: boolean;
  tone: "primary" | "accent";
  align: "left" | "right";
}) {
  const leaderClass = tone === "primary" ? "text-primary" : "text-accent";
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <span
        className={`font-mono text-lg font-bold ${
          isLeader ? leaderClass : "text-on-surface"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function MegaFormSelector({
  side,
  tone,
  onChange,
}: {
  side: SideState;
  tone: "primary" | "accent";
  onChange: (megaPokemonId: string) => void;
}) {
  const forms = side.pokemon?.mega_evolution_ids.map((id, index) => ({
    id: String(id),
    name: side.pokemon?.mega_evolution_names[index] ?? `Mega Form ${index + 1}`,
  })) ?? [];

  if (forms.length === 0) return null;

  const activeClass =
    tone === "primary"
      ? "border-primary bg-primary/15 text-primary"
      : "border-accent bg-accent/15 text-accent";
  const inactiveClass =
    "border-outline-variant bg-surface-low text-on-surface-muted hover:bg-surface-mid";

  return (
    <div className="mt-3 rounded-lg bg-surface-lowest p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-display text-[0.6rem] uppercase tracking-wider text-on-surface-muted">
          Form
        </span>
        {side.megaPokemonId && side.megaPokemon && (
          <span className="font-mono text-[0.55rem] uppercase text-on-surface-muted">
            {side.megaPokemon.types.join(" / ")}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange("")}
          aria-pressed={!side.megaPokemonId}
          className={`min-h-9 flex-1 rounded-md border px-2 py-1.5 text-center font-display text-[0.58rem] uppercase leading-tight tracking-wider transition-colors ${
            !side.megaPokemonId ? activeClass : inactiveClass
          }`}
        >
          Base
        </button>
        {forms.map((form) => (
          <button
            key={form.id}
            type="button"
            onClick={() => onChange(form.id)}
            aria-pressed={side.megaPokemonId === form.id}
            className={`min-h-9 flex-[2_1_8rem] rounded-md border px-2 py-1.5 text-center font-display text-[0.58rem] uppercase leading-tight tracking-wider transition-colors break-words ${
              side.megaPokemonId === form.id ? activeClass : inactiveClass
            }`}
          >
            {form.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModifierToggle({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg p-2 font-display text-[0.58rem] uppercase tracking-wider transition-colors ${
        active
          ? "bg-primary text-surface"
          : "bg-surface-low text-on-surface-muted hover:bg-surface-mid"
      }`}
    >
      {label}
    </button>
  );
}
