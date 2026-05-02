"""Champions data integrity validators.

Shared validation functions called from route handlers (DB-dependent checks)
and Pydantic field validators (static checks). Raises HTTPException(400) on
validation failures so callers don't need to catch and re-raise.
"""

from typing import Any

from fastapi import HTTPException

from app.database import supabase

# ── Static data ──────────────────────────────────────────────────────────────

VALID_NATURES = frozenset(
    [
        "Adamant",
        "Bashful",
        "Bold",
        "Brave",
        "Calm",
        "Careful",
        "Docile",
        "Gentle",
        "Hardy",
        "Hasty",
        "Impish",
        "Jolly",
        "Lax",
        "Lonely",
        "Mild",
        "Modest",
        "Naive",
        "Naughty",
        "Quiet",
        "Quirky",
        "Rash",
        "Relaxed",
        "Sassy",
        "Serious",
        "Timid",
    ]
)

STAT_KEYS = frozenset(["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"])
MAX_PER_STAT = 32
MAX_TOTAL = 66


# ── Pure Python validators (no DB) ──────────────────────────────────────────


def validate_nature(nature: str) -> None:
    """Validate that a nature is one of the 25 legal Pokemon natures."""
    if nature not in VALID_NATURES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid nature '{nature}'. Must be one of: {', '.join(sorted(VALID_NATURES))}",
        )


def validate_stat_points(stat_points: dict) -> None:
    """Validate stat point allocation: 0-32 per stat, 66 total, valid keys."""
    invalid_keys = set(stat_points.keys()) - STAT_KEYS
    if invalid_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid stat keys: {invalid_keys}. Valid keys: {sorted(STAT_KEYS)}",
        )

    total = 0
    for key, value in stat_points.items():
        if not isinstance(value, int) or value < 0 or value > MAX_PER_STAT:
            raise HTTPException(
                status_code=400,
                detail=f"Stat '{key}' must be an integer between 0 and {MAX_PER_STAT}, got {value}",
            )
        total += value

    if total > MAX_TOTAL:
        raise HTTPException(
            status_code=400,
            detail=f"Total stat points ({total}) exceed maximum of {MAX_TOTAL}",
        )


# ── DB-dependent validators ─────────────────────────────────────────────────


def validate_champions_pokemon(pokemon_id: int) -> None:
    """Validate that a Pokemon exists and is Champions-eligible."""
    result = (
        supabase.table("pokemon")
        .select("id, name, champions_eligible")
        .eq("id", pokemon_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon with ID {pokemon_id} not found",
        )
    row: dict[str, Any] = result.data[0]  # type: ignore[assignment]
    if not row.get("champions_eligible"):
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon '{row['name']}' (ID {pokemon_id}) is not available in Champions",
        )


def validate_champions_item(item_id: int) -> None:
    """Validate that an item exists and is available in the Champions shop."""
    result = (
        supabase.table("items")
        .select("id, name, champions_shop_available")
        .eq("id", item_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(
            status_code=400,
            detail=f"Item with ID {item_id} not found",
        )
    row: dict[str, Any] = result.data[0]  # type: ignore[assignment]
    if not row.get("champions_shop_available"):
        raise HTTPException(
            status_code=400,
            detail=f"Item '{row['name']}' (ID {item_id}) is not available in Champions",
        )


def validate_pokemon_ability(pokemon_id: int, ability: str) -> None:
    """Validate that the ability is in the Pokemon's ability list."""
    result = supabase.table("pokemon").select("name, abilities").eq("id", pokemon_id).execute()
    if not result.data:
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon with ID {pokemon_id} not found",
        )
    row: dict[str, Any] = result.data[0]  # type: ignore[assignment]
    abilities: list[str] = row.get("abilities") or []
    if ability not in abilities:
        raise HTTPException(
            status_code=400,
            detail=(
                f"'{ability}' is not a valid ability for {row['name']}. "
                f"Valid abilities: {', '.join(abilities)}"
            ),
        )


def validate_pokemon_moves(pokemon_id: int, moves: list[str]) -> None:
    """Validate that all moves are in the Pokemon's movepool and Champions-available."""
    result = supabase.table("pokemon").select("name, movepool").eq("id", pokemon_id).execute()
    if not result.data:
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon with ID {pokemon_id} not found",
        )
    row: dict[str, Any] = result.data[0]  # type: ignore[assignment]
    movepool: list[str] = row.get("movepool") or []

    invalid_moves = [m for m in moves if m not in movepool]
    if invalid_moves:
        raise HTTPException(
            status_code=400,
            detail=f"{row['name']} cannot learn: {', '.join(invalid_moves)}",
        )


def validate_champions_pokemon_batch(pokemon_ids: list[int]) -> None:
    """Validate that all Pokemon IDs in a list are Champions-eligible.

    Uses a single DB query for efficiency when validating a full team.
    """
    result = (
        supabase.table("pokemon")
        .select("id, name, champions_eligible")
        .in_("id", pokemon_ids)
        .execute()
    )
    rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    found_ids = {row["id"] for row in rows}
    missing = set(pokemon_ids) - found_ids
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon IDs not found: {sorted(missing)}",
        )

    ineligible = [
        f"{row['name']} (ID {row['id']})" for row in rows if not row.get("champions_eligible")
    ]
    if ineligible:
        raise HTTPException(
            status_code=400,
            detail=f"Pokemon not available in Champions: {', '.join(ineligible)}",
        )
