"""
Ingest weekly meta statistics from Smogon/data.pkmn.cc.
Pulls real usage percentages, item/ability breakdowns, and writes
to the consolidated ``pokemon_usage`` table.

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

# gen9ou is the closest proxy for Champions singles until a dedicated ladder exists
SMOGON_STATS_URL = "https://pkmn.github.io/smogon/data/stats/gen9ou.json"
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
    """Fetch the raw JSON payload from the data.pkmn.cc endpoint."""
    print(f"Fetching meta data from {SMOGON_STATS_URL}...")
    headers = {"User-Agent": "poke_comp_companion/1.0"}

    try:
        resp = httpx.get(SMOGON_STATS_URL, headers=headers, timeout=20)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        print(f"  HTTP Error: {e.response.status_code}")
        return None
    except Exception as e:
        print(f"  Network Error: {e}")
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


def ingest_smogon_data(sb: Client) -> None:
    """Validate, clean, and upsert Smogon usage stats into pokemon_usage."""
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
            "items": _top_entries(stats.items, 5),
            "abilities": _top_entries(stats.abilities, 3),
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
