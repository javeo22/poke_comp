import pytest
from app.services.cache_utils import (
    CACHE_VERSION,
    cache_hash_v2,
    is_v2_key,
    normalize_opponent_names,
    normalize_roster,
)

def test_opponent_normalization():
    # Dedupe, lowercase, sort.
    result = normalize_opponent_names(["Gholdengo", "Urshifu", "gholdengo", "  Flutter Mane  "])
    assert result == ["flutter mane", "gholdengo", "urshifu"]

    # Order-independence.
    a = normalize_opponent_names(["Miraidon", "Calyrex-Shadow"])
    b = normalize_opponent_names(["Calyrex-Shadow", "Miraidon"])
    assert a == b

    # Empty input.
    assert normalize_opponent_names([]) == []

def test_roster_normalization():
    build_a = {
        "name": "Urshifu-Rapid-Strike",
        "ability": "Unseen Fist",
        "item": "Mystic Water",
        "nature": "Jolly",
        "stat_points": "252 Atk / 252 Spe / 4 HP",
        "nickname": "stream",
        "created_at": "2026-04-16T00:00:00Z",
        "moves": [
            {"name": "Surging Strikes", "category": "stab"},
            {"name": "Close Combat", "category": "stab"},
        ],
        "is_mega": False,
    }
    build_b = {
        **build_a,
        # same moves in different order, different stat_points, different nickname
        "moves": [
            {"name": "Close Combat", "category": "stab"},
            {"name": "Surging Strikes", "category": "stab"},
        ],
        "stat_points": "4 HP / 252 Atk / 252 Spe",
        "nickname": "kappa",
        "created_at": "2026-04-17T00:00:00Z",
    }
    build_c = {
        **build_a,
        # different item -> should produce a different hash
        "item": "Choice Scarf",
    }

    hash_a = cache_hash_v2({"roster": normalize_roster([build_a])})
    hash_b = cache_hash_v2({"roster": normalize_roster([build_b])})
    hash_c = cache_hash_v2({"roster": normalize_roster([build_c])})

    assert hash_a == hash_b
    assert hash_a != hash_c

    # Roster reorder should not change hash.
    roster_1 = normalize_roster([build_a, build_c])
    roster_2 = normalize_roster([build_c, build_a])
    assert roster_1 == roster_2

def test_hash_format():
    h = cache_hash_v2({"x": 1})
    assert h.startswith("v2:")
    assert is_v2_key(h)
    assert CACHE_VERSION == 2
