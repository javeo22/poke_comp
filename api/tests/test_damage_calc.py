import pytest
from app.services.damage_calc import (
    CalcMove,
    CalcPokemon,
    calculate_damage,
    format_damage_string,
    from_base_stats,
    type_multiplier,
)

def test_super_effective_combos():
    # Ice on Dragon/Flying = 4x
    assert type_multiplier("ice", ["dragon", "flying"]) == 4.0
    # Electric on Water/Flying = 4x
    assert type_multiplier("electric", ["water", "flying"]) == 4.0

def test_immunities():
    # Ground on Flying = 0
    assert type_multiplier("ground", ["flying"]) == 0
    # Normal on Ghost = 0
    assert type_multiplier("normal", ["ghost"]) == 0

def test_resisted():
    # Fire on Water = 0.5
    assert type_multiplier("fire", ["water"]) == 0.5
    # Fire on Water/Dragon = 0.25
    assert type_multiplier("fire", ["water", "dragon"]) == 0.25

def test_level_50_naked_stats():
    # Garchomp base stats: HP 108, Atk 130, Def 95, SpA 80, SpD 85, Spe 102
    # Level 50, IV31, EV0, neutral nature:
    #   HP = floor((2*108 + 31)*50/100) + 50 + 10 = floor(123.5) + 60 = 183
    #   Atk = floor((2*130 + 31)*50/100) + 5 = floor(145.5) + 5 = 150
    garchomp = from_base_stats(
        "Garchomp",
        ["dragon", "ground"],
        {
            "hp": 108,
            "attack": 130,
            "defense": 95,
            "sp_attack": 80,
            "sp_defense": 85,
            "speed": 102,
        },
    )
    assert garchomp.hp == 183
    assert garchomp.attack == 150
    assert garchomp.defense == 115
    assert garchomp.speed == 122

def test_ice_beam_vs_garchomp_4x():
    # Sneasler (special atk 70 base) Ice Beam vs Garchomp (Dragon/Ground, 4x ice)
    # Naked: SpA = 70+5=75, Garchomp SpD = 85+5=90, HP = 183
    # Ice Beam power 90, special, STAB false
    sneasler = from_base_stats(
        "Sneasler",
        ["fighting", "poison"],
        {
            "hp": 80,
            "attack": 130,
            "defense": 60,
            "sp_attack": 40,
            "sp_defense": 80,
            "speed": 120,
        },
    )
    garchomp = from_base_stats(
        "Garchomp",
        ["dragon", "ground"],
        {
            "hp": 108,
            "attack": 130,
            "defense": 95,
            "sp_attack": 80,
            "sp_defense": 85,
            "speed": 102,
        },
    )
    ice_beam = CalcMove(name="Ice Beam", type="ice", category="special", power=90)
    result = calculate_damage(sneasler, ice_beam, garchomp, is_doubles=False)

    assert result["type_effectiveness"] == 4.0
    assert not result["stab"]
    assert result["max"] > 0
    assert result["max_pct"] > result["min_pct"]

def test_stab_doubles_calc():
    # Garchomp Earthquake vs Incineroar in doubles
    garchomp = from_base_stats(
        "Garchomp",
        ["dragon", "ground"],
        {
            "hp": 108,
            "attack": 130,
            "defense": 95,
            "sp_attack": 80,
            "sp_defense": 85,
            "speed": 102,
        },
    )
    incineroar = from_base_stats(
        "Incineroar",
        ["fire", "dark"],
        {
            "hp": 95,
            "attack": 115,
            "defense": 90,
            "sp_attack": 80,
            "sp_defense": 90,
            "speed": 60,
        },
    )
    eq = CalcMove(
        name="Earthquake",
        type="ground",
        category="physical",
        power=100,
        target="all-other-pokemon",
    )
    result = calculate_damage(garchomp, eq, incineroar, is_doubles=True)

    assert result["type_effectiveness"] == 2.0
    assert result["stab"]
    # Doubles spread should reduce vs singles
    result_singles = calculate_damage(garchomp, eq, incineroar, is_doubles=False)
    assert result_singles["max"] > result["max"]

def test_immunity_returns_zero():
    # Ground move vs Flying defender = 0 damage
    garchomp = from_base_stats(
        "Garchomp",
        ["dragon", "ground"],
        {
            "hp": 108,
            "attack": 130,
            "defense": 95,
            "sp_attack": 80,
            "sp_defense": 85,
            "speed": 102,
        },
    )
    flying_dummy = CalcPokemon(
        name="Flying Dummy",
        types=["flying"],
        hp=200,
        attack=100,
        defense=100,
        sp_attack=100,
        sp_defense=100,
        speed=100,
    )
    eq = CalcMove(name="Earthquake", type="ground", category="physical", power=100)
    result = calculate_damage(garchomp, eq, flying_dummy)

    assert result["max"] == 0
    assert result["type_effectiveness"] == 0.0
    assert result["skipped_reason"] == "immune"

def test_status_move_skipped():
    attacker = CalcPokemon(
        name="A", types=["normal"], hp=100, attack=50, defense=50, sp_attack=50, sp_defense=50
    )
    defender = CalcPokemon(
        name="D", types=["normal"], hp=100, attack=50, defense=50, sp_attack=50, sp_defense=50
    )
    protect = CalcMove(name="Protect", type="normal", category="status", power=0)
    result = calculate_damage(attacker, protect, defender)
    assert result["max"] == 0
    assert result["skipped_reason"] == "status move (no damage)"

def test_format_string():
    ohko_chance = {
        "min": 80,
        "max": 120,
        "min_pct": 80.0,
        "max_pct": 120.0,
        "defender_hp": 100,
        "type_effectiveness": 2.0,
        "stab": True,
        "is_ohko_chance": True,
        "is_guaranteed_ohko": False,
        "skipped_reason": None,
    }
    guaranteed = {**ohko_chance, "min_pct": 105.0, "is_guaranteed_ohko": True}
    normal = {
        "min": 30,
        "max": 36,
        "min_pct": 30.0,
        "max_pct": 36.0,
        "defender_hp": 100,
        "type_effectiveness": 1.0,
        "stab": True,
        "is_ohko_chance": False,
        "is_guaranteed_ohko": False,
        "skipped_reason": None,
    }
    skipped = {**normal, "skipped_reason": "immune"}

    assert "guaranteed OHKO" in format_damage_string(guaranteed)
    assert "chance to OHKO" in format_damage_string(ohko_chance)
    assert format_damage_string(normal) == "30.0-36.0%"
    assert format_damage_string(skipped) == "immune"
