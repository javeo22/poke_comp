"""Verification script for cache_utils normalization.

Runs as a plain Python script (the repo has no pytest harness yet).
Each check prints a result and accumulates failures; script exits non-zero
if any assertion fails.

Usage:
    cd api && uv run python -m scripts.test_cache_utils
"""

import sys

from app.services.cache_utils import (
    CACHE_VERSION,
    cache_hash_v2,
    is_v2_key,
    normalize_opponent_names,
    normalize_roster,
)


def _check(label: str, condition: bool) -> list[str]:
    if condition:
        print(f"  PASS  {label}")
        return []
    print(f"  FAIL  {label}")
    return [label]


def test_opponent_normalization() -> list[str]:
    print("opponent normalization:")
    failures: list[str] = []

    # Dedupe, lowercase, sort.
    result = normalize_opponent_names(["Gholdengo", "Urshifu", "gholdengo", "  Flutter Mane  "])
    failures += _check(
        "dedupes case-insensitively, strips, sorts",
        result == ["flutter mane", "gholdengo", "urshifu"],
    )

    # Order-independence.
    a = normalize_opponent_names(["Miraidon", "Calyrex-Shadow"])
    b = normalize_opponent_names(["Calyrex-Shadow", "Miraidon"])
    failures += _check("order-independent", a == b)

    # Empty input.
    failures += _check("empty list -> empty list", normalize_opponent_names([]) == [])

    return failures


def test_roster_normalization() -> list[str]:
    print("roster normalization:")
    failures: list[str] = []

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

    failures += _check("stat tweak + move reorder -> same hash", hash_a == hash_b)
    failures += _check("different item -> different hash", hash_a != hash_c)

    # Roster reorder should not change hash.
    roster_1 = normalize_roster([build_a, build_c])
    roster_2 = normalize_roster([build_c, build_a])
    failures += _check("roster reorder -> same canonical order", roster_1 == roster_2)

    return failures


def test_hash_format() -> list[str]:
    print("hash format:")
    failures: list[str] = []
    h = cache_hash_v2({"x": 1})
    failures += _check("has v2: prefix", h.startswith("v2:"))
    failures += _check("is_v2_key agrees", is_v2_key(h))
    failures += _check("CACHE_VERSION is 2", CACHE_VERSION == 2)
    return failures


def main() -> int:
    failures: list[str] = []
    failures += test_opponent_normalization()
    failures += test_roster_normalization()
    failures += test_hash_format()

    print()
    if failures:
        print(f"FAILED: {len(failures)} assertion(s)")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("All cache_utils checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
