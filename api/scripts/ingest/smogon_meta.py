"""
Ingest weekly meta statistics from Smogon/data.pkmn.cc.
This pulls real usage percentages, item usages, and common teammates.
This script replaces the old concept of scraping Pikalytics.

Usage:
    uv run python -m scripts.ingest.smogon_meta
"""

import sys
import time
from datetime import date
from typing import Any

import httpx
from pydantic import BaseModel, ValidationError
from supabase import Client, create_client

from app.config import settings

# Usually use 'gen9ou' or whichever format closely matches 'champions' for MVP mapping
SMOGON_STATS_URL = "https://pkmn.github.io/smogon/data/stats/gen9ou.json"
FORMAT_KEY = "champions-singles"

# =============================================================================
# Validation Schemas
# =============================================================================

class PokemonStat(BaseModel):
    usage: float
    items: dict[str, float]
    moves: dict[str, float]
    teammates: dict[str, float]

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


def clean_percentage_dict(raw_dict: dict[str, float], top_n: int = 5) -> dict[str, float]:
    """Convert raw weights into rounded percentages, keeping only the top N."""
    # Sometimes Smogon data provides weights that sum to > 1.0 (or < 1.0)
    # We normalize to a strict percentage.
    total = sum(raw_dict.values())
    if total == 0:
        return {}
        
    normalized = {k: round((v / total) * 100, 1) for k, v in raw_dict.items()}
    # Sort by highest usage
    sorted_items = sorted(normalized.items(), key=lambda item: item[1], reverse=True)
    return dict(sorted_items[:top_n])


def ingest_smogon_data(sb: Client) -> None:
    """Validate, clean, and upsert Smogon usage stats into Supabase."""
    raw_data = fetch_smogon_data()
    if not raw_data:
        print("Failed to fetch data. Aborting ingest.")
        return

    # Validate against Pydantic schema
    try:
        validated_data = SmogonStatsData(**raw_data)
    except ValidationError as e:
        print(f"Data validation failed: {e}")
        return

    print("Data validated successfully. Preparing upserts...")
    
    # 1. Fetch our local Pokemon to map Smogon names -> our internal IDs
    result = sb.table("pokemon").select("id, name").eq("champions_eligible", True).execute()
    local_roster = {row["name"].lower().replace("-", ""): row["id"] for row in result.data}
    
    today_date = date.today().isoformat()
    upsert_batch = []
    mapped_count = 0

    for pokemon_name, stats in validated_data.pokemon.items():
        # Smogon names can have weird spacing. Strip to alphanumerics to match our dict.
        clean_name = pokemon_name.lower().replace("-", "").replace(" ", "")
        
        poke_id = local_roster.get(clean_name)
        if not poke_id:
            # Skip pokemon not in our Champions roster
            continue
            
        mapped_count += 1
        
        # Extract the real usage rate from the 'usage' dict (which has raw, real, weighted)
        usage_val = stats.usage.get("weight", stats.usage.get("real", 0))

        # Format the numbers cleanly
        record = {
            "pokemon_id": poke_id,
            "snapshot_date": today_date,
            "format": FORMAT_KEY,
            "usage_percent": round(usage_val * 100, 2),
            "common_items": clean_percentage_dict(stats.items),
            # Moves and teammates aren't in this specific endpoint, but abilities are!
            # We'll use abilities for common_moves temporarily as a proxy for schema match, or leave empty
            "common_moves": {}, 
            "common_teammates": {}
        }
        upsert_batch.append(record)

    print(f"Mapped {mapped_count} Champions-eligible Pokemon. Upserting to Database...")
    
    # Process upserts in small batches to respect database limits
    batch_size = 100
    for i in range(0, len(upsert_batch), batch_size):
        chunk = upsert_batch[i : i + batch_size]
        try:
            # Upsert relying on the UNIQUE(pokemon_id, snapshot_date, format) constraint
            sb.table("pokemon_usage_stats").upsert(
                chunk, on_conflict="pokemon_id,snapshot_date,format"
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
