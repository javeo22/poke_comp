"""Multi-source validation of Champions data.

Cross-checks our live DB against:
  - Serebii (canonical Champions roster, items, moves, abilities)
  - PokeAPI (canonical base stats, types, abilities for non-Champions-specific data)

Writes a structured report to `champions_validation_report.json` with every
discrepancy, and prints a human summary. Safe to run repeatedly — read-only.

Usage:
    cd api && uv run python -m scripts.validate_champions_sources
    cd api && uv run python -m scripts.validate_champions_sources --sample-size 20
    cd api && uv run python -m scripts.validate_champions_sources --skip-detail

User-requested 2026-04-17: "do an extensive validation across multiple
sources to make sure we have the correct data for champions."
"""

from __future__ import annotations

import argparse
import asyncio
import json
import random
import sys
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx
from supabase import Client, create_client

from app.config import settings

# Reuse scrapers from the Serebii ingest script
from scripts.ingest import serebii_static as serebii

POKEAPI_BASE = "https://pokeapi.co/api/v2"
REPORT_PATH = Path(__file__).resolve().parent.parent / "champions_validation_report.json"


# ═══════════════════════════════════════════════════════════════════════════
# Report types
# ═══════════════════════════════════════════════════════════════════════════


@dataclass
class CheckResult:
    name: str
    status: str  # "pass" | "warn" | "fail"
    summary: str
    details: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class ValidationReport:
    checks: list[CheckResult] = field(default_factory=list)
    sources: dict[str, str] = field(default_factory=dict)

    def add(self, result: CheckResult) -> None:
        self.checks.append(result)

    def to_dict(self) -> dict[str, Any]:
        return {
            "sources": self.sources,
            "checks": [asdict(c) for c in self.checks],
            "summary": self.summary(),
        }

    def summary(self) -> dict[str, int]:
        return {
            "pass": sum(1 for c in self.checks if c.status == "pass"),
            "warn": sum(1 for c in self.checks if c.status == "warn"),
            "fail": sum(1 for c in self.checks if c.status == "fail"),
            "total": len(self.checks),
        }


# ═══════════════════════════════════════════════════════════════════════════
# DB loaders
# ═══════════════════════════════════════════════════════════════════════════


def load_db_roster(sb: Client) -> list[dict]:
    rows: list[dict] = (
        sb.table("pokemon")
        .select("id, name, types, base_stats, abilities, movepool, champions_eligible")
        .eq("champions_eligible", True)
        .order("id")
        .execute()
        .data  # type: ignore[assignment]
    )
    return rows


def load_db_items(sb: Client) -> list[dict]:
    rows: list[dict] = (
        sb.table("items")
        .select("id, name, category, champions_shop_available")
        .eq("champions_shop_available", True)
        .execute()
        .data  # type: ignore[assignment]
    )
    return rows


def load_db_moves(sb: Client) -> list[dict]:
    rows: list[dict] = (
        sb.table("moves")
        .select("id, name, type, category, power, accuracy, champions_available")
        .eq("champions_available", True)
        .execute()
        .data  # type: ignore[assignment]
    )
    return rows


# ═══════════════════════════════════════════════════════════════════════════
# Normalizers (cross-source name matching)
# ═══════════════════════════════════════════════════════════════════════════


def _n(text: str) -> str:
    """Normalize a name for case/punctuation-insensitive comparison."""
    return (
        text.strip().lower().replace("-", " ").replace("_", " ").replace("'", "")
    )


# ═══════════════════════════════════════════════════════════════════════════
# CHECKS
# ═══════════════════════════════════════════════════════════════════════════


def check_roster_presence(db_pokemon: list[dict], serebii_entries: list) -> CheckResult:
    """Compare the set of Champions-eligible Pokemon in our DB vs Serebii's Champions dex."""
    db_names = {_n(p["name"]) for p in db_pokemon if p["id"] < 10000}
    serebii_names = {_n(e.name) for e in serebii_entries}

    missing_from_db = sorted(serebii_names - db_names)
    extra_in_db = sorted(db_names - serebii_names)

    details = []
    for name in missing_from_db:
        details.append({"issue": "missing_from_db", "serebii_name": name})
    for name in extra_in_db:
        details.append({"issue": "extra_in_db", "db_name": name})

    if not missing_from_db and not extra_in_db:
        return CheckResult(
            name="roster_presence",
            status="pass",
            summary=f"All {len(db_names)} base Champions Pokemon match Serebii's roster",
        )
    return CheckResult(
        name="roster_presence",
        status="warn" if len(details) < 20 else "fail",
        summary=(
            f"{len(missing_from_db)} Pokemon on Serebii missing from our DB; "
            f"{len(extra_in_db)} in our DB not on Serebii"
        ),
        details=details,
    )


def check_regional_forms(db_pokemon: list[dict]) -> CheckResult:
    """Confirm all 15 expected regional forms are present + eligible."""
    expected = {
        "Raichu Alola",
        "Ninetales Alola",
        "Slowbro Galar",
        "Slowking Galar",
        "Stunfisk Galar",
        "Arcanine Hisui",
        "Typhlosion Hisui",
        "Samurott Hisui",
        "Zoroark Hisui",
        "Goodra Hisui",
        "Avalugg Hisui",
        "Decidueye Hisui",
        "Tauros Paldea Combat Breed",
        "Tauros Paldea Blaze Breed",
        "Tauros Paldea Aqua Breed",
    }
    db_regional = {p["name"] for p in db_pokemon if p["id"] >= 10000}
    missing = sorted(expected - db_regional)
    extra = sorted(db_regional - expected)

    details = []
    for name in missing:
        details.append({"issue": "regional_missing", "expected": name})
    for name in extra:
        details.append({"issue": "regional_extra", "db_name": name})

    if missing:
        return CheckResult(
            name="regional_forms",
            status="fail",
            summary=f"{len(missing)}/15 regional forms missing from DB",
            details=details,
        )
    if extra:
        return CheckResult(
            name="regional_forms",
            status="warn",
            summary=f"Found {len(extra)} unexpected regional forms in DB",
            details=details,
        )
    return CheckResult(
        name="regional_forms",
        status="pass",
        summary=f"All {len(expected)} regional forms present and flagged eligible",
    )


async def check_stats_vs_pokeapi(
    client: httpx.AsyncClient, db_pokemon: list[dict], sample_size: int
) -> CheckResult:
    """Cross-check base stats + types + abilities against PokeAPI (mainline canonical).

    Note: Champions may intentionally differ from mainline for some Pokemon
    (e.g. restricted ability slots). Treat diffs as warnings, not failures.
    """
    sample = random.sample(db_pokemon, min(sample_size, len(db_pokemon)))
    details: list[dict[str, Any]] = []

    # PokeAPI uses kebab-case slugs. Our DB names like "Raichu Alola" -> slug "raichu-alola".
    for p in sample:
        slug = p["name"].lower().replace(" ", "-")
        try:
            resp = await client.get(f"{POKEAPI_BASE}/pokemon/{slug}", timeout=15)
            if resp.status_code != 200:
                details.append(
                    {
                        "pokemon": p["name"],
                        "issue": f"pokeapi_404_or_error_{resp.status_code}",
                    }
                )
                continue
            data = resp.json()
        except Exception as e:
            details.append({"pokemon": p["name"], "issue": f"pokeapi_fetch_error: {e}"})
            continue

        # Base stats comparison
        stat_map = {
            "hp": "hp",
            "attack": "attack",
            "defense": "defense",
            "special-attack": "sp_attack",
            "special-defense": "sp_defense",
            "speed": "speed",
        }
        pokeapi_stats = {
            stat_map[s["stat"]["name"]]: s["base_stat"]
            for s in data["stats"]
            if s["stat"]["name"] in stat_map
        }
        db_stats = p.get("base_stats") or {}
        stat_diffs = []
        for stat_key, pokeapi_val in pokeapi_stats.items():
            db_val = db_stats.get(stat_key)
            if db_val != pokeapi_val:
                stat_diffs.append({"stat": stat_key, "db": db_val, "pokeapi": pokeapi_val})

        # Types comparison (case-insensitive)
        pokeapi_types = {t["type"]["name"].lower() for t in data["types"]}
        db_types = {t.lower() for t in (p.get("types") or [])}
        types_match = pokeapi_types == db_types

        # Abilities set intersection (Champions may restrict, so just report delta)
        pokeapi_abilities = {_n(a["ability"]["name"]) for a in data["abilities"]}
        db_abilities = {_n(a) for a in (p.get("abilities") or [])}
        abilities_missing_in_db = pokeapi_abilities - db_abilities
        abilities_extra_in_db = db_abilities - pokeapi_abilities

        if stat_diffs or not types_match or abilities_missing_in_db or abilities_extra_in_db:
            entry: dict[str, Any] = {"pokemon": p["name"]}
            if stat_diffs:
                entry["stat_diffs"] = stat_diffs
            if not types_match:
                entry["types_diff"] = {
                    "db": sorted(db_types),
                    "pokeapi": sorted(pokeapi_types),
                }
            if abilities_missing_in_db:
                entry["abilities_missing_in_db"] = sorted(abilities_missing_in_db)
            if abilities_extra_in_db:
                entry["abilities_extra_in_db"] = sorted(abilities_extra_in_db)
            details.append(entry)

    if not details:
        return CheckResult(
            name="stats_types_abilities_vs_pokeapi",
            status="pass",
            summary=f"All {len(sample)} sampled Pokemon match PokeAPI for stats/types/abilities",
        )
    return CheckResult(
        name="stats_types_abilities_vs_pokeapi",
        status="warn",
        summary=(
            f"{len(details)}/{len(sample)} sampled Pokemon have diffs vs PokeAPI "
            "(expected for Champions ability restrictions; stat diffs are the concern)"
        ),
        details=details,
    )


def check_items_count(db_items: list[dict], serebii_items: list) -> CheckResult:
    """Compare our Champions shop to Serebii's listed Champions items (count + name sanity)."""
    db_names = {_n(i["name"]) for i in db_items}
    serebii_names = {_n(i.name) for i in serebii_items if i.champions_shop}

    if not serebii_names:
        return CheckResult(
            name="items_count",
            status="warn",
            summary="Serebii returned no items flagged champions_shop; cannot compare",
        )

    missing = sorted(serebii_names - db_names)
    extra = sorted(db_names - serebii_names)

    details = []
    for name in missing[:30]:
        details.append({"issue": "item_missing_in_db", "serebii_name": name})
    for name in extra[:30]:
        details.append({"issue": "item_extra_in_db", "db_name": name})

    if not missing and not extra:
        return CheckResult(
            name="items_count",
            status="pass",
            summary=f"All {len(db_names)} Champions shop items match Serebii",
        )
    return CheckResult(
        name="items_count",
        status="warn",
        summary=(
            f"db={len(db_names)} vs serebii={len(serebii_names)}: "
            f"{len(missing)} missing, {len(extra)} extra"
        ),
        details=details,
    )


def check_moves_count(db_moves: list[dict], serebii_moves: list) -> CheckResult:
    db_names = {_n(m["name"]) for m in db_moves}
    serebii_names = {_n(m.name) for m in serebii_moves}

    if not serebii_names:
        return CheckResult(
            name="moves_count",
            status="warn",
            summary="Serebii returned no moves; cannot compare",
        )

    missing = sorted(serebii_names - db_names)
    extra = sorted(db_names - serebii_names)

    details = []
    for name in missing[:30]:
        details.append({"issue": "move_missing_in_db", "serebii_name": name})
    for name in extra[:30]:
        details.append({"issue": "move_extra_in_db", "db_name": name})

    if not missing and not extra:
        return CheckResult(
            name="moves_count",
            status="pass",
            summary=f"All {len(db_names)} Champions moves match Serebii",
        )
    return CheckResult(
        name="moves_count",
        status="warn",
        summary=(
            f"db={len(db_names)} vs serebii={len(serebii_names)}: "
            f"{len(missing)} missing, {len(extra)} extra"
        ),
        details=details,
    )


async def check_movepool_samples(
    db_pokemon: list[dict],
    serebii_details: dict[str, Any],
    sample_size: int,
) -> CheckResult:
    """Compare per-Pokemon movepools for a sample against Serebii Champions pages."""
    eligible_samples = [
        p for p in db_pokemon if p["id"] < 10000 and _n(p["name"]) in serebii_details
    ]
    sample = random.sample(eligible_samples, min(sample_size, len(eligible_samples)))

    details: list[dict[str, Any]] = []
    for p in sample:
        ser = serebii_details.get(_n(p["name"]))
        if not ser:
            continue
        ser_moves = {_n(m) for m in (ser.movepool or [])}
        db_moves = {_n(m) for m in (p.get("movepool") or [])}
        if not ser_moves:
            continue  # Serebii had no movepool data
        missing = ser_moves - db_moves
        extra = db_moves - ser_moves
        if missing or extra:
            details.append(
                {
                    "pokemon": p["name"],
                    "serebii_count": len(ser_moves),
                    "db_count": len(db_moves),
                    "missing_in_db": sorted(missing)[:10],
                    "extra_in_db": sorted(extra)[:10],
                }
            )

    if not details:
        return CheckResult(
            name="movepool_vs_serebii_sample",
            status="pass",
            summary=f"Sampled {len(sample)} movepools: all match Serebii",
        )
    return CheckResult(
        name="movepool_vs_serebii_sample",
        status="warn",
        summary=f"{len(details)}/{len(sample)} sampled Pokemon have movepool diffs vs Serebii",
        details=details,
    )


# ═══════════════════════════════════════════════════════════════════════════
# Main runner
# ═══════════════════════════════════════════════════════════════════════════


async def async_main(sample_size: int, skip_detail: bool, movepool_sample: int) -> int:
    report = ValidationReport()
    report.sources = {
        "db": settings.supabase_url,
        "serebii": serebii.CHAMPIONS_URL,
        "pokeapi": POKEAPI_BASE,
    }

    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    print("Loading DB snapshots...")
    db_pokemon = load_db_roster(sb)
    db_items = load_db_items(sb)
    db_moves = load_db_moves(sb)
    print(
        f"  DB: {len(db_pokemon)} champions_eligible, "
        f"{len(db_items)} shop items, {len(db_moves)} available moves"
    )

    serebii.semaphore = asyncio.Semaphore(serebii.CONCURRENT_LIMIT)

    async with httpx.AsyncClient(timeout=httpx.Timeout(30)) as client:
        print("Fetching Serebii Champions sources...")
        try:
            serebii_roster = await serebii.scrape_pokemon_roster(client)
        except Exception as e:
            print(f"  Serebii roster scrape failed: {e}")
            serebii_roster = []

        try:
            serebii_items = await serebii.scrape_items(client)
        except Exception as e:
            print(f"  Serebii items scrape failed: {e}")
            serebii_items = []

        try:
            serebii_moves = await serebii.scrape_moves(client)
        except Exception as e:
            print(f"  Serebii moves scrape failed: {e}")
            serebii_moves = []

        # Run checks that don't need per-Pokemon detail pages
        report.add(check_regional_forms(db_pokemon))
        report.add(check_roster_presence(db_pokemon, serebii_roster))
        report.add(check_items_count(db_items, serebii_items))
        report.add(check_moves_count(db_moves, serebii_moves))

        # PokeAPI sampled stats/types/abilities check
        if not skip_detail:
            report.add(await check_stats_vs_pokeapi(client, db_pokemon, sample_size))

        # Movepool sample check requires per-Pokemon Serebii detail pages
        if not skip_detail and movepool_sample > 0:
            print(f"Fetching {movepool_sample} Serebii detail pages for movepool check...")
            eligible_for_sample = [p for p in db_pokemon if p["id"] < 10000]
            sample_for_detail = random.sample(
                eligible_for_sample, min(movepool_sample, len(eligible_for_sample))
            )
            serebii_by_name: dict[str, Any] = {}
            for p in sample_for_detail:
                # Map DB name back to a serebii roster entry to get the slug
                match = next(
                    (e for e in serebii_roster if _n(e.name) == _n(p["name"])),
                    None,
                )
                if not match:
                    continue
                try:
                    detail = await serebii.scrape_pokemon_detail(client, match)
                    if detail:
                        serebii_by_name[_n(p["name"])] = detail
                except Exception as e:
                    print(f"  Failed to scrape {p['name']}: {e}")

            report.add(
                await check_movepool_samples(
                    db_pokemon, serebii_by_name, movepool_sample
                )
            )

    # Write + print
    REPORT_PATH.write_text(json.dumps(report.to_dict(), indent=2))
    print(f"\nReport: {REPORT_PATH}")

    print("\n═══ Validation Summary ═══")
    for check in report.checks:
        icon = {"pass": "OK", "warn": "WARN", "fail": "FAIL"}.get(check.status, "?")
        print(f"  [{icon}] {check.name}: {check.summary}")

    s = report.summary()
    print(f"\n  {s['pass']} pass, {s['warn']} warn, {s['fail']} fail / {s['total']} total")
    return 0 if s["fail"] == 0 else 1


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--sample-size", type=int, default=15,
                        help="Number of Pokemon to deep-check vs PokeAPI (default 15)")
    parser.add_argument(
        "--movepool-sample",
        type=int,
        default=8,
        help="Number of Pokemon to deep-check movepool vs Serebii (default 8)",
    )
    parser.add_argument("--skip-detail", action="store_true",
                        help="Skip per-Pokemon detail fetches (fast roster/items/moves only)")
    args = parser.parse_args()

    exit_code = asyncio.run(
        async_main(args.sample_size, args.skip_detail, args.movepool_sample)
    )
    sys.exit(exit_code)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
