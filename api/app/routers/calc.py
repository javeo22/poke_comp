"""Standalone damage calculator endpoint.

The engine in `app.services.damage_calc` is already used by the AI draft
post-processor. This router exposes it directly so users can run their own
calcs from the `/calc` page without involving Claude.
"""

from typing import Any, Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.database import supabase
from app.services.damage_calc import (
    CalcMove,
    Weather,
    calculate_damage,
    format_damage_string,
    from_base_stats,
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
    # Stat points: 0-32 each, total <= 66.
    attacker_stat_points: dict[str, int] | None = None
    defender_stat_points: dict[str, int] | None = None
    # Nature name (e.g. "Adamant", "Timid").
    attacker_nature: str | None = None
    defender_nature: str | None = None
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


# NOTE: This endpoint is intentionally public (no auth required) as it
# provides reference calculation services.
@router.post("", response_model=CalcResponseShape)
def run_calc(req: CalcRequest) -> CalcResponseShape:
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

    attacker = from_base_stats(
        atk_row["name"],
        atk_row.get("types") or [],
        atk_row.get("base_stats") or {},
        stat_points=req.attacker_stat_points,
        nature=req.attacker_nature,
    )
    defender = from_base_stats(
        def_row["name"],
        def_row.get("types") or [],
        def_row.get("base_stats") or {},
        stat_points=req.defender_stat_points,
        nature=req.defender_nature,
    )
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
