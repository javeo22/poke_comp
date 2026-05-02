"""Deterministic Pokemon damage calculator for VGC doubles.

Replaces AI-generated damage strings ("65-78%") in draft analysis with real
arithmetic. The LLM proposes the *scenario* (which attacker, move, defender,
and what set assumption); this module computes the actual range.

Scope: Gen 9+ formula, level 50, doubles-aware (spread reduction). Covers
the modifiers that change damage by >5%: STAB, type effectiveness, doubles
spread, weather (sun/rain), and the standard 0.85-1.00 random roll.

NOT covered (intentional, MVP scope): items (Life Orb, Choice Specs),
abilities (Tinted Lens, Fluffy, Multiscale), crits, burn, screens, terrain,
Tera. These can be layered in later via `extra_modifier` if scenario_note
documents them. Better to return a deterministic but slightly-conservative
range than to have the AI invent numbers.

References: https://bulbapedia.bulbagarden.net/wiki/Damage
"""

from dataclasses import dataclass
from math import floor
from typing import Literal

# Mirror of web/src/components/teams/type-coverage.tsx TYPE_CHART.
# attacker -> defender -> multiplier (0 = immune, 0.5 = resisted, 2 = SE).
# Long-line linting suppressed -- this matrix is far more readable as a grid.
# fmt: off
# ruff: noqa: E501
TYPE_CHART: dict[str, dict[str, float]] = {
    "normal":   {"rock": 0.5, "ghost": 0, "steel": 0.5},
    "fire":     {"fire": 0.5, "water": 0.5, "grass": 2, "ice": 2, "bug": 2, "rock": 0.5, "dragon": 0.5, "steel": 2},
    "water":    {"fire": 2, "water": 0.5, "grass": 0.5, "ground": 2, "rock": 2, "dragon": 0.5},
    "electric": {"water": 2, "electric": 0.5, "grass": 0.5, "ground": 0, "flying": 2, "dragon": 0.5},
    "grass":    {"fire": 0.5, "water": 2, "grass": 0.5, "poison": 0.5, "ground": 2, "flying": 0.5, "bug": 0.5, "rock": 2, "dragon": 0.5, "steel": 0.5},
    "ice":      {"fire": 0.5, "water": 0.5, "grass": 2, "ice": 0.5, "ground": 2, "flying": 2, "dragon": 2, "steel": 0.5},
    "fighting": {"normal": 2, "ice": 2, "poison": 0.5, "flying": 0.5, "psychic": 0.5, "bug": 0.5, "rock": 2, "ghost": 0, "dark": 2, "steel": 2, "fairy": 0.5},
    "poison":   {"grass": 2, "poison": 0.5, "ground": 0.5, "rock": 0.5, "ghost": 0.5, "steel": 0, "fairy": 2},
    "ground":   {"fire": 2, "electric": 2, "grass": 0.5, "poison": 2, "flying": 0, "bug": 0.5, "rock": 2, "steel": 2},
    "flying":   {"electric": 0.5, "grass": 2, "fighting": 2, "bug": 2, "rock": 0.5, "steel": 0.5},
    "psychic":  {"fighting": 2, "poison": 2, "psychic": 0.5, "dark": 0, "steel": 0.5},
    "bug":      {"fire": 0.5, "grass": 2, "fighting": 0.5, "poison": 0.5, "flying": 0.5, "psychic": 2, "ghost": 0.5, "dark": 2, "steel": 0.5, "fairy": 0.5},
    "rock":     {"fire": 2, "ice": 2, "fighting": 0.5, "ground": 0.5, "flying": 2, "bug": 2, "steel": 0.5},
    "ghost":    {"normal": 0, "psychic": 2, "ghost": 2, "dark": 0.5},
    "dragon":   {"dragon": 2, "steel": 0.5, "fairy": 0},
    "dark":     {"fighting": 0.5, "psychic": 2, "ghost": 2, "dark": 0.5, "fairy": 0.5},
    "steel":    {"fire": 0.5, "water": 0.5, "electric": 0.5, "ice": 2, "rock": 2, "steel": 0.5, "fairy": 2},
    "fairy":    {"fire": 0.5, "poison": 0.5, "dragon": 2, "dark": 2, "steel": 0.5},
}

# Spread targets in the moves table -> doubles spread reduction multiplier.
# Single-target moves get full damage; multi-target moves take 0.75x.
_SPREAD_TARGETS = {
    "all-opponents",
    "all-other-pokemon",
    "all-pokemon",
    "all-other-pokemon-and-user",
}

Weather = Literal["none", "sun", "rain", "snow", "sand"]


@dataclass(frozen=True)
class CalcPokemon:
    """Stat snapshot used by the calc. Defaults to level-50, IV31/EV0/neutral
    nature, which is what you get from `base + 5` (or `base + 60` for HP)."""

    name: str
    types: list[str]  # lowercase, 1-2 entries
    hp: int          # final HP at level 50, e.g. base + 60 if no EVs
    attack: int      # final Attack
    sp_attack: int   # final Sp. Attack
    defense: int     # final Defense
    sp_defense: int  # final Sp. Defense
    speed: int = 0   # not used for damage but kept for ordering


@dataclass(frozen=True)
class CalcMove:
    """Move data needed for the formula. Pull from the `moves` table."""

    name: str
    type: str        # lowercase
    category: str    # "physical" | "special" | "status"
    power: int       # 0 for status moves
    target: str = "selected-pokemon"


# Nature multipliers — Pokemon Champions uses standard mainline values (1.1x / 0.9x).
_NATURE_EFFECTS: dict[str, dict[str, float]] = {
    "Adamant": {"attack": 1.1, "sp_attack": 0.9},
    "Bold": {"defense": 1.1, "attack": 0.9},
    "Brave": {"attack": 1.1, "speed": 0.9},
    "Calm": {"sp_defense": 1.1, "attack": 0.9},
    "Careful": {"sp_defense": 1.1, "sp_attack": 0.9},
    "Gentle": {"sp_defense": 1.1, "defense": 0.9},
    "Hasty": {"speed": 1.1, "defense": 0.9},
    "Impish": {"defense": 1.1, "sp_attack": 0.9},
    "Jolly": {"speed": 1.1, "sp_attack": 0.9},
    "Lax": {"defense": 1.1, "sp_defense": 0.9},
    "Lonely": {"attack": 1.1, "defense": 0.9},
    "Mild": {"sp_attack": 1.1, "defense": 0.9},
    "Modest": {"sp_attack": 1.1, "attack": 0.9},
    "Naive": {"speed": 1.1, "sp_defense": 0.9},
    "Naughty": {"attack": 1.1, "sp_defense": 0.9},
    "Quiet": {"sp_attack": 1.1, "speed": 0.9},
    "Rash": {"sp_attack": 1.1, "sp_defense": 0.9},
    "Relaxed": {"defense": 1.1, "speed": 0.9},
    "Sassy": {"sp_defense": 1.1, "speed": 0.9},
    "Timid": {"speed": 1.1, "attack": 0.9},
}


def from_base_stats(
    name: str,
    types: list[str],
    base_stats: dict,
    stat_points: dict | None = None,
    nature: str | None = None,
    level: int = 50,
) -> CalcPokemon:
    """Convert base stats from the `pokemon` table to Champions-mode actual
    stats.

    Formula: Floor((2*base + 31) * L/100) + 5 + stat_points.
    If nature is provided, the final non-HP stat is multiplied by 1.1 or 0.9.
    """
    points = stat_points or {}
    nature_map = _NATURE_EFFECTS.get(nature or "", {})

    def stat(key: str) -> int:
        base = base_stats.get(key, 0)
        # Mainline naked base at L50
        val = floor((2 * base + 31) * level / 100) + 5
        # Champions investment is added directly to the naked stat
        val += points.get(key, 0)
        # Nature multiplier
        mult = nature_map.get(key, 1.0)
        return floor(val * mult)

    hp_base = base_stats.get("hp", 0)
    hp_val = floor((2 * hp_base + 31) * level / 100) + level + 10
    hp_val += points.get("hp", 0)

    return CalcPokemon(
        name=name,
        types=[t.lower() for t in types],
        hp=hp_val,
        attack=stat("attack"),
        sp_attack=stat("sp_attack"),
        defense=stat("defense"),
        sp_defense=stat("sp_defense"),
        speed=stat("speed"),
    )


def type_multiplier(attack_type: str, defender_types: list[str]) -> float:
    """Combined effectiveness against all defender types (multiplicative)."""
    mult = 1.0
    for dt in defender_types:
        mult *= TYPE_CHART.get(attack_type, {}).get(dt, 1)
    return mult


def calculate_damage(
    attacker: CalcPokemon,
    move: CalcMove,
    defender: CalcPokemon,
    *,
    level: int = 50,
    weather: Weather = "none",
    is_doubles: bool = True,
    extra_modifier: float = 1.0,
) -> dict:
    """Run the damage formula and return a structured result.

    Returns:
        {
            "min": int,                  # min HP damage (0.85 roll)
            "max": int,                  # max HP damage (1.00 roll)
            "min_pct": float,            # min as % of defender HP
            "max_pct": float,            # max as % of defender HP
            "defender_hp": int,
            "type_effectiveness": float,
            "stab": bool,
            "is_ohko_chance": bool,      # True if max >= defender HP
            "is_guaranteed_ohko": bool,  # True if min >= defender HP
            "skipped_reason": str | None,  # set if calc was skipped (status move, immune)
        }
    """
    base_result = {
        "min": 0,
        "max": 0,
        "min_pct": 0.0,
        "max_pct": 0.0,
        "defender_hp": defender.hp,
        "type_effectiveness": 1.0,
        "stab": False,
        "is_ohko_chance": False,
        "is_guaranteed_ohko": False,
        "skipped_reason": None,
    }

    if move.category == "status" or move.power <= 0:
        return {**base_result, "skipped_reason": "status move (no damage)"}

    type_mult = type_multiplier(move.type, defender.types)
    if type_mult == 0:
        return {**base_result, "type_effectiveness": 0.0, "skipped_reason": "immune"}

    # Pick A/D pair by category
    if move.category == "physical":
        attack_stat = attacker.attack
        defense_stat = defender.defense
    else:  # special
        attack_stat = attacker.sp_attack
        defense_stat = defender.sp_defense

    # Base formula: floor(floor((2*L/5 + 2) * P * A / D) / 50) + 2
    base = floor(floor((2 * level / 5 + 2) * move.power * attack_stat / defense_stat) / 50) + 2

    # Modifiers (multiplicative, applied in standard order)
    spread = 0.75 if (is_doubles and move.target in _SPREAD_TARGETS) else 1.0

    weather_mult = 1.0
    if weather == "sun" and move.type == "fire":
        weather_mult = 1.5
    elif weather == "sun" and move.type == "water":
        weather_mult = 0.5
    elif weather == "rain" and move.type == "water":
        weather_mult = 1.5
    elif weather == "rain" and move.type == "fire":
        weather_mult = 0.5

    stab = move.type in attacker.types
    stab_mult = 1.5 if stab else 1.0

    fixed_modifiers = spread * weather_mult * stab_mult * type_mult * extra_modifier

    min_dmg = floor(base * 0.85 * fixed_modifiers)
    max_dmg = floor(base * 1.00 * fixed_modifiers)

    return {
        "min": min_dmg,
        "max": max_dmg,
        "min_pct": round(min_dmg / defender.hp * 100, 1),
        "max_pct": round(max_dmg / defender.hp * 100, 1),
        "defender_hp": defender.hp,
        "type_effectiveness": type_mult,
        "stab": stab,
        "is_ohko_chance": max_dmg >= defender.hp,
        "is_guaranteed_ohko": min_dmg >= defender.hp,
        "skipped_reason": None,
    }


def format_damage_string(result: dict) -> str:
    """Format a calc result as a human-readable string for the AI response.
    Mirrors the previous "65-78%" output from the LLM, but with real numbers."""
    if result["skipped_reason"]:
        return result["skipped_reason"]
    if result["is_guaranteed_ohko"]:
        return f"{result['min_pct']}-{result['max_pct']}% (guaranteed OHKO)"
    if result["is_ohko_chance"]:
        return f"{result['min_pct']}-{result['max_pct']}% (chance to OHKO)"
    return f"{result['min_pct']}-{result['max_pct']}%"
