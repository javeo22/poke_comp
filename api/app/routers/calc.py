"""Standalone damage calculator endpoint.

The engine in `app.services.damage_calc` is already used by the AI draft
post-processor. This router exposes it directly so users can run their own
calcs from the `/calc` page without involving Claude.
"""

from math import floor
from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.services.damage_calc import (
    CalcMove,
    CalcPokemon,
    Weather,
    calculate_damage,
    format_damage_string,
)

router = APIRouter(prefix="/calc", tags=["calc"])


# Nature multipliers — Pokemon Champions uses standard mainline values.
# Only stat-altering natures actually shift damage; neutral natures are 1.0.
_PLUS_STAT_MULT = 1.1
_MINUS_STAT_MULT = 0.9


class CalcRequest(BaseModel):
    attacker_id: int = Field(..., description="pokemon.id of the attacker")
    defender_id: int = Field(..., description="pokemon.id of the defender")
    move_id: int = Field(..., description="moves.id")
    # Optional EV overrides. Keys: hp, attack, defense, sp_attack, sp_defense, speed.
    # Values: 0-252 each, total <= 510 (not enforced server-side; UI guards it).
    attacker_evs: dict[str, int] | None = None
    defender_evs: dict[str, int] | None = None
    # +X / -X stat names (e.g. {"plus": "attack", "minus": "speed"}).
    # Either side optional. Skip both for neutral nature.
    attacker_nature: dict[str, str] | None = None
    defender_nature: dict[str, str] | None = None
    weather: Literal["none", "sun", "rain", "snow", "sand"] = "none"
    is_doubles: bool = True
    extra_modifier: float = Field(1.0, ge=0.1, le=10.0)


class CalcResponseShape(BaseModel):
    """Mirrors the dict returned by `calculate_damage()` plus a formatted
    human-readable string and resolved attacker/defender/move metadata so
    the frontend can render context without a second round-trip."""

    min: int
    max: int
    min_pct: float
    max_pct: float
    defender_hp: int
    type_effectiveness: float
    stab: bool
    is_ohko_chance: bool
    is_guaranteed_ohko: bool
    skipped_reason: str | None
    formatted: str
    attacker_name: str
    defender_name: str
    move_name: str
    move_type: str
    move_category: str
    move_power: int


_STAT_KEYS = ("hp", "attack", "defense", "sp_attack", "sp_defense", "speed")


def _final_stat(
    base: int,
    stat_key: str,
    evs: dict[str, int] | None,
    nature: dict[str, str] | None,
    *,
    is_hp: bool = False,
    level: int = 50,
) -> int:
    """Standard mainline stat formula at level 50 with IV 31, optional EV
    investment (default 0), and optional nature multiplier."""
    ev = (evs or {}).get(stat_key, 0)
    if is_hp:
        # HP formula has no nature multiplier and a different shape.
        return floor((2 * base + 31 + ev // 4) * level / 100) + level + 10
    raw = floor((2 * base + 31 + ev // 4) * level / 100) + 5
    if nature:
        if nature.get("plus") == stat_key:
            raw = floor(raw * _PLUS_STAT_MULT)
        elif nature.get("minus") == stat_key:
            raw = floor(raw * _MINUS_STAT_MULT)
    return raw


def _build_calc_pokemon(
    row: dict[str, Any],
    evs: dict[str, int] | None,
    nature: dict[str, str] | None,
) -> CalcPokemon:
    base_stats: dict[str, int] = row.get("base_stats") or {}
    return CalcPokemon(
        name=row["name"],
        types=[t.lower() for t in (row.get("types") or [])],
        hp=_final_stat(base_stats.get("hp", 0), "hp", evs, nature, is_hp=True),
        attack=_final_stat(base_stats.get("attack", 0), "attack", evs, nature),
        sp_attack=_final_stat(base_stats.get("sp_attack", 0), "sp_attack", evs, nature),
        defense=_final_stat(base_stats.get("defense", 0), "defense", evs, nature),
        sp_defense=_final_stat(base_stats.get("sp_defense", 0), "sp_defense", evs, nature),
        speed=_final_stat(base_stats.get("speed", 0), "speed", evs, nature),
    )


def _validate_nature(nature: dict[str, str] | None) -> None:
    if not nature:
        return
    for key in ("plus", "minus"):
        v = nature.get(key)
        if v is not None and v not in _STAT_KEYS[1:]:  # exclude HP — natures don't affect it
            raise HTTPException(
                status_code=400,
                detail=f"Invalid nature {key} stat: {v}",
            )


# NOTE: This endpoint is intentionally public (no auth required) as it
# provides reference calculation services.
@router.post("", response_model=CalcResponseShape)
def run_calc(req: CalcRequest) -> CalcResponseShape:
    _validate_nature(req.attacker_nature)
    _validate_nature(req.defender_nature)

    # Fetch all three rows in parallel-ish (Supabase client is sync).
    try:
        atk_res = (
            supabase.table("pokemon")
            .select("id, name, types, base_stats")
            .eq("id", req.attacker_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Attacker not found") from exc
    try:
        def_res = (
            supabase.table("pokemon")
            .select("id, name, types, base_stats")
            .eq("id", req.defender_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Defender not found") from exc
    try:
        move_res = (
            supabase.table("moves")
            .select("id, name, type, category, power, target")
            .eq("id", req.move_id)
            .single()
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=404, detail="Move not found") from exc

    atk_row: dict[str, Any] = atk_res.data  # type: ignore[assignment]
    def_row: dict[str, Any] = def_res.data  # type: ignore[assignment]
    move_row: dict[str, Any] = move_res.data  # type: ignore[assignment]

    attacker = _build_calc_pokemon(atk_row, req.attacker_evs, req.attacker_nature)
    defender = _build_calc_pokemon(def_row, req.defender_evs, req.defender_nature)
    move = CalcMove(
        name=move_row["name"],
        type=(move_row.get("type") or "").lower(),
        category=move_row.get("category") or "physical",
        power=int(move_row.get("power") or 0),
        target=move_row.get("target") or "selected-pokemon",
    )

    weather: Weather = req.weather  # type: ignore[assignment]
    result = calculate_damage(
        attacker,
        move,
        defender,
        weather=weather,
        is_doubles=req.is_doubles,
        extra_modifier=req.extra_modifier,
    )
    return CalcResponseShape(
        **result,
        formatted=format_damage_string(result),
        attacker_name=attacker.name,
        defender_name=defender.name,
        move_name=move.name,
        move_type=move.type,
        move_category=move.category,
        move_power=move.power,
    )
