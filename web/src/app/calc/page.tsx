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
import { ErrorCard } from "@/components/ui/error-card";
import { TypeBadge } from "@/features/pokemon/components/type-badge";
import { friendlyError } from "@/lib/errors";
import type { Move } from "@/types/move";
import type { PokemonBasic } from "@/features/pokemon/types";

type Weather = "none" | "sun" | "rain" | "snow" | "sand";

const WEATHERS: { value: Weather; label: string }[] = [
  { value: "none", label: "None" },
  { value: "sun", label: "Sun" },
  { value: "rain", label: "Rain" },
  { value: "sand", label: "Sand" },
  { value: "snow", label: "Snow" },
];

export default function CalcPage() {
  const searchParams = useSearchParams();
  const initialAttacker = searchParams.get("attacker") || "";
  const initialDefender = searchParams.get("defender") || "";

  const [pokemon, setPokemon] = useState<PokemonBasic[]>([]);
  const [allMoves, setAllMoves] = useState<Move[]>([]);
  const [attackerMovepool, setAttackerMovepool] = useState<string[] | null>(null);

  const [attackerId, setAttackerId] = useState<string>(initialAttacker);
  const [defenderId, setDefenderId] = useState<string>(initialDefender);
  const [moveId, setMoveId] = useState<string>("");
  const [weather, setWeather] = useState<Weather>("none");
  const [isDoubles, setIsDoubles] = useState(true);

  const [result, setResult] = useState<CalcResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Load Pokemon list (Champions only) once.
  useEffect(() => {
    fetchPokemonBasic({ champions_only: true, limit: 1000 })
      .then((res) => setPokemon(res.data))
      .catch((err) => setError(friendlyError(err).message));
  }, []);

  // Load full move list (Champions only).
  useEffect(() => {
    fetchMoves({ champions_only: true, limit: 1000 })
      .then((res) => setAllMoves(res.data))
      .catch(() => setAllMoves([]));
  }, []);

  // When attacker changes, fetch their movepool to filter the move picker.
  useEffect(() => {
    if (!attackerId) {
      setAttackerMovepool(null);
      return;
    }
    fetchPokemonDetail(Number(attackerId))
      .then((res) => setAttackerMovepool(res.movepool || []))
      .catch(() => setAttackerMovepool(null));
  }, [attackerId]);

  const pokemonOptions: DropdownOption[] = useMemo(
    () =>
      pokemon.map((p) => ({
        value: String(p.id),
        label: p.name,
        sublabel: p.types.join(" / "),
      })),
    [pokemon]
  );

  const moveOptions: DropdownOption[] = useMemo(() => {
    const set = attackerMovepool ? new Set(attackerMovepool) : null;
    return allMoves
      .filter((m) => (set ? set.has(m.name) : true))
      .filter((m) => m.category !== "status" && (m.power ?? 0) > 0)
      .map((m) => ({
        value: String(m.id),
        label: m.name,
        sublabel: `${m.type} · ${m.category} · ${m.power}bp`,
      }));
  }, [allMoves, attackerMovepool]);

  const canRun = attackerId && defenderId && moveId;

  const handleRun = async () => {
    if (!canRun) return;
    setRunning(true);
    setError(null);
    setResult(null);
    setCopied(false);
    try {
      const res = await runCalc({
        attacker_id: Number(attackerId),
        defender_id: Number(defenderId),
        move_id: Number(moveId),
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

  const handleCopy = async () => {
    if (!result) return;
    const line = `${result.attacker_name} ${result.move_name} vs. ${result.defender_name}: ${result.formatted}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
      {/* Header */}
      <div className="mb-2 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">
        ◆ CALC · DAMAGE · L50
      </div>
      <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-on-surface">
        Damage Calculator
      </h1>
      <p className="mt-1 font-body text-sm text-on-surface-muted">
        Deterministic Gen 9+ formula. STAB, type effectiveness, doubles spread, weather.
        Items, abilities, terrain, and Tera not modeled — sanity tool, not a full sim.
      </p>

      {/* Two-panel attacker / defender */}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="card p-5">
          <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-primary">
            ◆ ATTACKER
          </div>
          <SearchableDropdown
            label="Pokemon"
            placeholder="Search Pokemon..."
            value={attackerId}
            onChange={(v) => {
              setAttackerId(v);
              setMoveId(""); // reset move when attacker changes
            }}
            options={pokemonOptions}
          />
          <div className="mt-4">
            <SearchableDropdown
              label={
                attackerMovepool
                  ? "Move (movepool only)"
                  : "Move (pick attacker first)"
              }
              placeholder={
                attackerMovepool
                  ? "Search moves..."
                  : "Pick attacker to see moves"
              }
              value={moveId}
              onChange={setMoveId}
              options={moveOptions}
              disabled={!attackerId}
            />
          </div>
        </div>

        <div className="card p-5">
          <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-accent">
            ◆ DEFENDER
          </div>
          <SearchableDropdown
            label="Pokemon"
            placeholder="Search Pokemon..."
            value={defenderId}
            onChange={setDefenderId}
            options={pokemonOptions}
          />
        </div>
      </div>

      {/* Field state */}
      <div className="mt-6 card p-5">
        <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-on-surface-muted">
          ◆ FIELD
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-on-surface-muted">
              Weather
            </span>
            <div className="flex gap-1">
              {WEATHERS.map((w) => (
                <button
                  key={w.value}
                  onClick={() => setWeather(w.value)}
                  className={`h-9 rounded-lg px-3 font-display text-xs uppercase tracking-wider transition-all ${
                    weather === w.value
                      ? "bg-primary text-surface"
                      : "bg-surface-high text-on-surface-muted hover:text-on-surface"
                  }`}
                >
                  {w.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isDoubles}
              onChange={(e) => setIsDoubles(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-display text-sm text-on-surface">
              Doubles (spread move 0.75x)
            </span>
          </label>
        </div>
      </div>

      {/* Run button */}
      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleRun}
          disabled={!canRun || running}
          className="btn-primary px-6 py-2.5 font-display text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? "Calculating..." : "Run calc"}
        </button>
        {result && (
          <button
            onClick={handleCopy}
            className="btn-ghost px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.18em]"
          >
            {copied ? "Copied!" : "Copy result"}
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4">
          <ErrorCard variant="inline" message={error} onRetry={handleRun} />
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="mt-6 card p-6">
          <div className="mb-3 font-mono text-[0.65rem] uppercase tracking-[0.22em] text-accent">
            ◆ RESULT
          </div>
          <div className="font-display text-lg font-semibold text-on-surface">
            {result.attacker_name}{" "}
            <span className="text-on-surface-muted font-normal">·</span>{" "}
            <span className="text-primary">{result.move_name}</span>{" "}
            <span className="text-on-surface-muted font-normal">vs.</span>{" "}
            {result.defender_name}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <TypeBadge type={result.move_type} />
            <span className="font-mono text-xs text-on-surface-muted">
              {result.move_category} · {result.move_power}bp
            </span>
            {result.stab && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] text-accent">
                STAB
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.18em] ${
                result.type_effectiveness >= 2
                  ? "bg-primary/20 text-primary"
                  : result.type_effectiveness === 0
                  ? "bg-surface-high text-on-surface-muted"
                  : result.type_effectiveness < 1
                  ? "bg-on-surface-muted/20 text-on-surface-muted"
                  : "bg-accent/20 text-accent"
              }`}
            >
              {result.type_effectiveness}x
            </span>
          </div>

          {result.skipped_reason ? (
            <div className="mt-4 font-body text-sm text-on-surface-muted">
              {result.skipped_reason}
            </div>
          ) : (
            <>
              <div className="mt-5 font-display text-4xl font-bold text-accent">
                {result.formatted}
              </div>
              <div className="mt-1 font-mono text-xs text-on-surface-muted">
                {result.min}-{result.max} HP · defender {result.defender_hp} HP
              </div>

              {/* HP bar */}
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-surface-high">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  style={{
                    width: `${Math.min(100, result.max_pct).toFixed(1)}%`,
                  }}
                />
              </div>

              {result.is_guaranteed_ohko && (
                <div className="mt-4 inline-block rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-primary">
                  Guaranteed OHKO
                </div>
              )}
              {!result.is_guaranteed_ohko && result.is_ohko_chance && (
                <div className="mt-4 inline-block rounded-full border border-accent/40 bg-accent/10 px-3 py-1 font-mono text-[0.65rem] uppercase tracking-[0.18em] text-accent">
                  Chance to OHKO
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
