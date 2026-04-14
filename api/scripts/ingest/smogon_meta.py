"""
Ingest weekly meta statistics from Smogon/data.pkmn.cc.
Pulls real usage percentages, item/ability breakdowns, and writes
to the consolidated ``pokemon_usage`` table.

Validates ingested items and abilities against Champions legality
(items must exist in the Champions shop; abilities must belong to
a Champions-eligible Pokemon).

Usage:
    uv run python -m scripts.ingest.smogon_meta
"""

import sys
from datetime import date
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError
from supabase import Client, create_client

from app.config import settings

# VGC 2026 is the correct Champions competitive format
SMOGON_STATS_URL = "https://pkmn.github.io/smogon/data/stats/gen9vgc2026.json"
# Fallback if gen9vgc2026 is not yet available on pkmn.github.io
SMOGON_FALLBACK_URL = "https://pkmn.github.io/smogon/data/stats/gen9vgc2025.json"
FORMAT_KEY = "doubles"

# =============================================================================
# Validation Schemas
# =============================================================================


class PokemonData(BaseModel):
    lead: dict[str, float] | None = None
    usage: dict[str, float]
    count: int
    weight: float | None = None
    viability: list[int] | None = None
    abilities: dict[str, float]
    items: dict[str, float]


class SmogonStatsData(BaseModel):
    battles: int
    pokemon: dict[str, PokemonData]


# =============================================================================
# Helpers
# =============================================================================


def fetch_smogon_data() -> dict[str, Any] | None:
    """Fetch the raw JSON payload from data.pkmn.cc.

    Tries gen9vgc2026 first; falls back to gen9vgc2025 if unavailable.
    """
    headers = {"User-Agent": "poke_comp_companion/1.0"}

    for url in (SMOGON_STATS_URL, SMOGON_FALLBACK_URL):
        print(f"Fetching meta data from {url}...")
        try:
            resp = httpx.get(url, headers=headers, timeout=20)
            resp.raise_for_status()
            print(f"  Success: {url}")
            return resp.json()
        except httpx.HTTPStatusError as e:
            print(f"  HTTP Error {e.response.status_code} for {url}, trying next...")
        except Exception as e:
            print(f"  Network Error: {e}")
            return None

    print("All Smogon URLs failed.")
    return None


def _top_entries(raw_dict: dict[str, float], top_n: int = 5) -> list[dict[str, str | float]]:
    """Normalize weights to [{name, percent}] sorted descending, top N only."""
    total = sum(raw_dict.values())
    if total == 0:
        return []

    items = [{"name": k, "percent": round((v / total) * 100, 1)} for k, v in raw_dict.items()]
    items.sort(key=lambda x: x["percent"], reverse=True)  # type: ignore[arg-type]
    return items[:top_n]


def _smogon_name_to_title(name: str) -> str:
    """Convert Smogon identifiers like 'Great Tusk' to Title Case."""
    return " ".join(w.capitalize() for w in name.split())


# =============================================================================
# Core ingest
# =============================================================================


def _build_legal_items(sb: Client) -> set[str]:
    """Build a set of normalized item names available in the Champions shop."""
    result = sb.table("items").select("name").eq("champions_shop_available", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    return {row["name"].lower().replace(" ", "").replace("-", "") for row in rows}


def _build_legal_abilities(sb: Client) -> set[str]:
    """Build a set of normalized ability names used by Champions-eligible Pokemon."""
    result = sb.table("pokemon").select("abilities").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    abilities: set[str] = set()
    for row in rows:
        for ab in row.get("abilities") or []:
            abilities.add(ab.lower().replace(" ", "").replace("-", ""))
    return abilities


def _top_entries_filtered(
    raw_dict: dict[str, float],
    legal_set: set[str] | None,
    top_n: int = 5,
) -> list[dict[str, str | float]]:
    """Like _top_entries, but drops entries not in legal_set (if provided)."""
    total = sum(raw_dict.values())
    if total == 0:
        return []

    items = []
    dropped = 0
    for k, v in raw_dict.items():
        normalized = k.lower().replace(" ", "").replace("-", "")
        if legal_set and normalized not in legal_set:
            dropped += 1
            continue
        items.append({"name": k, "percent": round((v / total) * 100, 1)})

    if dropped:
        print(f"    Filtered {dropped} non-Champions entries")

    items.sort(key=lambda x: x["percent"], reverse=True)  # type: ignore[arg-type]
    return items[:top_n]


def ingest_smogon_data(sb: Client) -> None:
    """Validate, clean, and upsert Smogon usage stats into pokemon_usage.

    Items and abilities are validated against Champions legality:
    - Items must exist in the Champions shop
    - Abilities must belong to a Champions-eligible Pokemon
    """
    raw_data = fetch_smogon_data()
    if not raw_data:
        print("Failed to fetch data. Aborting ingest.")
        return

    try:
        validated_data = SmogonStatsData(**raw_data)
    except ValidationError as e:
        print(f"Data validation failed: {e}")
        return

    print("Data validated successfully. Preparing upserts...")

    # Build a lookup of our Champions roster: normalized_name -> display_name
    result = sb.table("pokemon").select("name").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    local_roster: dict[str, str] = {
        row["name"].lower().replace("-", "").replace(" ", ""): row["name"] for row in rows
    }

    # Build legality sets for validation during ingest
    legal_items = _build_legal_items(sb)
    legal_abilities = _build_legal_abilities(sb)
    print(f"Legality sets: {len(legal_items)} items, {len(legal_abilities)} abilities")

    today_date = date.today().isoformat()
    upsert_batch: list[dict] = []
    mapped_count = 0

    for pokemon_name, stats in validated_data.pokemon.items():
        clean_name = pokemon_name.lower().replace("-", "").replace(" ", "")

        display_name = local_roster.get(clean_name)
        if not display_name:
            continue

        mapped_count += 1

        usage_val = stats.usage.get("weight", stats.usage.get("real", 0))

        record = {
            "pokemon_name": display_name,
            "format": FORMAT_KEY,
            "snapshot_date": today_date,
            "usage_percent": round(usage_val * 100, 2),
            "items": _top_entries_filtered(stats.items, legal_items, 5),
            "abilities": _top_entries_filtered(stats.abilities, legal_abilities, 3),
            "moves": [],  # not available from this Smogon endpoint
            "teammates": [],  # not available from this Smogon endpoint
            "source": "smogon",
        }
        upsert_batch.append(record)

    print(f"Mapped {mapped_count} Champions-eligible Pokemon. Upserting...")

    batch_size = 100
    for i in range(0, len(upsert_batch), batch_size):
        chunk = upsert_batch[i : i + batch_size]
        try:
            sb.table("pokemon_usage").upsert(
                chunk, on_conflict="pokemon_name,format,snapshot_date"
            ).execute()
        except Exception as e:
            print(f"  Warning: Database upsert chunk failed: {e}")

    print("Smogon Meta Ingest complete.")


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    ingest_smogon_data(db)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
