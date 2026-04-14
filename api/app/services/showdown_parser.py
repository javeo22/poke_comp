"""Parse and export Pokemon teams in Showdown paste format.

Showdown format example:
    Garchomp @ Focus Sash
    Ability: Rough Skin
    Nature: Jolly
    EVs: 252 Atk / 4 SpD / 252 Spe
    - Earthquake
    - Rock Slide
    - Swords Dance
    - Protect
"""

from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel

from app.database import supabase

# ── EV stat key mapping ──────────────────────────────────────────────────

# Showdown uses abbreviated stat names; our DB uses full names.
SHOWDOWN_STAT_MAP: dict[str, str] = {
    "HP": "hp",
    "Atk": "attack",
    "Def": "defense",
    "SpA": "sp_attack",
    "SpD": "sp_defense",
    "Spe": "speed",
}


class ParsedPokemon(BaseModel):
    """A single Pokemon parsed from Showdown paste."""

    name: str
    item: str | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict[str, int] | None = None
    moves: list[str] = []

    # Resolved IDs (filled after DB lookup)
    pokemon_id: int | None = None
    item_id: int | None = None


class ParsedTeam(BaseModel):
    """A full team parsed from Showdown paste."""

    pokemon: list[ParsedPokemon]
    warnings: list[str] = []


def parse_showdown_paste(paste: str) -> ParsedTeam:
    """Parse a Showdown paste into structured Pokemon data.

    Splits on double-newlines to get individual Pokemon blocks,
    then extracts name, item, ability, nature, EVs, and moves.
    """
    blocks = re.split(r"\n\s*\n", paste.strip())
    pokemon: list[ParsedPokemon] = []
    warnings: list[str] = []

    for block in blocks:
        lines = [line.strip() for line in block.strip().split("\n") if line.strip()]
        if not lines:
            continue

        parsed = _parse_pokemon_block(lines)
        if parsed:
            pokemon.append(parsed)
        else:
            warnings.append(f"Could not parse block: {lines[0][:50]}")

    if not pokemon:
        warnings.append("No Pokemon found in paste")

    return ParsedTeam(pokemon=pokemon, warnings=warnings)


def _parse_pokemon_block(lines: list[str]) -> ParsedPokemon | None:
    """Parse a single Pokemon block from Showdown format."""
    if not lines:
        return None

    # Line 1: "Pokemon @ Item" or "Pokemon" or "Nickname (Pokemon) @ Item"
    first_line = lines[0]
    name = ""
    item = None

    if " @ " in first_line:
        name_part, item = first_line.split(" @ ", 1)
        item = item.strip()
    else:
        name_part = first_line

    # Handle nickname: "Nickname (RealName)" -> "RealName"
    paren_match = re.search(r"\(([^)]+)\)\s*$", name_part)
    if paren_match:
        name = paren_match.group(1).strip()
    else:
        # Remove gender suffix (M) or (F)
        name = re.sub(r"\s*\([MF]\)\s*$", "", name_part).strip()

    if not name:
        return None

    ability = None
    nature = None
    stat_points: dict[str, int] | None = None
    moves: list[str] = []

    for line in lines[1:]:
        if line.startswith("Ability:"):
            ability = line.split(":", 1)[1].strip()
        elif line.startswith("Nature:"):
            nature = line.split(":", 1)[1].strip()
        elif line.startswith("EVs:"):
            stat_points = _parse_evs(line.split(":", 1)[1].strip())
        elif line.startswith("- "):
            move = line[2:].strip()
            if move:
                moves.append(move)

    return ParsedPokemon(
        name=name,
        item=item,
        ability=ability,
        nature=nature,
        stat_points=stat_points,
        moves=moves if len(moves) == 4 else (moves if moves else []),
    )


def _parse_evs(ev_string: str) -> dict[str, int]:
    """Parse '252 Atk / 4 SpD / 252 Spe' into stat_points dict."""
    stat_points: dict[str, int] = {}
    parts = [p.strip() for p in ev_string.split("/")]
    for part in parts:
        match = re.match(r"(\d+)\s+(\w+)", part)
        if match:
            value = int(match.group(1))
            stat_abbrev = match.group(2)
            db_key = SHOWDOWN_STAT_MAP.get(stat_abbrev)
            if db_key:
                stat_points[db_key] = value
    return stat_points if stat_points else {}


def resolve_pokemon_ids(
    parsed: ParsedTeam,
) -> ParsedTeam:
    """Resolve Pokemon and item names to database IDs.

    Modifies parsed.pokemon in place and adds warnings for unresolved names.
    """
    # Build lookup maps with a single query each
    pokemon_names = [p.name for p in parsed.pokemon]
    item_names = [p.item for p in parsed.pokemon if p.item]

    # Pokemon lookup (case-insensitive)
    poke_lookup: dict[str, int] = {}
    if pokemon_names:
        result = (
            supabase.table("pokemon")
            .select("id, name, champions_eligible")
            .eq("champions_eligible", True)
            .execute()
        )
        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        for row in rows:
            poke_lookup[row["name"].lower()] = row["id"]

    # Item lookup (case-insensitive)
    item_lookup: dict[str, int] = {}
    if item_names:
        result = (
            supabase.table("items")
            .select("id, name, champions_shop_available")
            .eq("champions_shop_available", True)
            .execute()
        )
        rows = result.data  # type: ignore[assignment]
        for row in rows:
            item_lookup[row["name"].lower()] = row["id"]

    for p in parsed.pokemon:
        # Resolve pokemon
        pid = poke_lookup.get(p.name.lower())
        if pid:
            p.pokemon_id = pid
        else:
            parsed.warnings.append(f"'{p.name}' not found or not Champions-eligible")

        # Resolve item
        if p.item:
            iid = item_lookup.get(p.item.lower())
            if iid:
                p.item_id = iid
            else:
                parsed.warnings.append(f"Item '{p.item}' not found or not in Champions shop")

    return parsed


def export_showdown_paste(
    pokemon_data: list[dict[str, Any]],
) -> str:
    """Export a team to Showdown paste format.

    Each dict should have: name, item (name str), ability, nature,
    stat_points (dict), moves (list of str).
    """
    blocks: list[str] = []

    for p in pokemon_data:
        lines: list[str] = []

        # Line 1: Name @ Item
        name = p.get("name", "Unknown")
        item = p.get("item_name")
        if item:
            lines.append(f"{name} @ {item}")
        else:
            lines.append(name)

        # Ability
        if p.get("ability"):
            lines.append(f"Ability: {p['ability']}")

        # Nature
        if p.get("nature"):
            lines.append(f"Nature: {p['nature']}")

        # EVs
        stat_points = p.get("stat_points") or {}
        if stat_points:
            reverse_map = {v: k for k, v in SHOWDOWN_STAT_MAP.items()}
            ev_parts = []
            for db_key, value in stat_points.items():
                if value and value > 0:
                    abbrev = reverse_map.get(db_key, db_key)
                    ev_parts.append(f"{value} {abbrev}")
            if ev_parts:
                lines.append(f"EVs: {' / '.join(ev_parts)}")

        # Moves
        moves = p.get("moves") or []
        for move in moves:
            lines.append(f"- {move}")

        blocks.append("\n".join(lines))

    return "\n\n".join(blocks)
