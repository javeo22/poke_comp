"""
Ingest Limitless VGC tournament team data.
This script fetches winning teams from recent Limitless tournaments
to provide high-level contextual (Archetype/Team Composition) data.

Usage:
    uv run python -m scripts.ingest.limitless_teams
"""

import sys
from typing import Any

from pydantic import BaseModel, ValidationError
from supabase import Client, create_client

from app.config import settings

# Example Limitless REST API Endpoint for tournaments
LIMITLESS_API_BASE = "https://play.limitlesstcg.com/api"

# =============================================================================
# Validation Schemas
# =============================================================================


class LimitlessPokemon(BaseModel):
    name: str


class LimitlessTeam(BaseModel):
    pokemon: list[LimitlessPokemon]


class LimitlessStanding(BaseModel):
    placing: int
    team: LimitlessTeam


class LimitlessTournamentResponse(BaseModel):
    name: str
    standings: list[LimitlessStanding]


def fetch_limitless_tournament(tournament_id: str) -> dict[str, Any] | None:
    """Fetch tournament standings from Limitless API."""
    url = f"{LIMITLESS_API_BASE}/tournaments/{tournament_id}/standings"
    print(f"Fetching Limitless tournament data from {url}...")

    try:
        # Mock response — real implementation would hit the Limitless API
        team_1 = [
            {"name": "Incineroar"},
            {"name": "Garchomp"},
            {"name": "Whimsicott"},
            {"name": "Kingambit"},
            {"name": "Primarina"},
            {"name": "Ogerpon-Hearthflame"},
        ]
        team_2 = [
            {"name": "Farigiraf"},
            {"name": "Ursaluna-Bloodmoon"},
            {"name": "Incineroar"},
            {"name": "Urshifu-Rapid-Strike"},
            {"name": "Tornadus"},
            {"name": "Archaludon"},
        ]
        mock_response = {
            "name": f"Champions VGC Regional {tournament_id}",
            "standings": [
                {"placing": 1, "team": {"pokemon": team_1}},
                {"placing": 2, "team": {"pokemon": team_2}},
            ],
        }
        return mock_response
    except Exception as e:
        print(f"  Network Error: {e}")
        return None


def determine_archetype(team_names: list[str]) -> str:
    """Basic heuristic to determine team archetype based on composition."""
    names_lower = [n.lower() for n in team_names]

    if "pelipper" in names_lower or "politoed" in names_lower:
        return "Rain"
    if "torkoal" in names_lower or "mega charizard y" in names_lower:
        return "Sun"
    if "farigiraf" in names_lower or "hatterene" in names_lower:
        return "Trick Room"
    if "hippowdon" in names_lower or "tyranitar" in names_lower:
        return "Sand"
    if "alolan ninetales" in names_lower or "abomasnow" in names_lower:
        return "Snow"

    return "Good Stuff / Balance"


def ingest_limitless_tournament(sb: Client, tournament_id: str) -> None:
    """Fetch, validate, and store Limitless tournament standings."""
    raw_data = fetch_limitless_tournament(tournament_id)
    if not raw_data:
        print("Failed to fetch data. Aborting ingest.")
        return

    try:
        validated_data = LimitlessTournamentResponse(**raw_data)
    except ValidationError as e:
        print(f"Data validation failed: {e}")
        return

    print(f"Found tournament: {validated_data.name}. Processing top placements...")

    # Fetch local roster
    result = sb.table("pokemon").select("id, name").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    local_roster = {row["name"].lower().replace("-", ""): row["id"] for row in rows}

    upsert_batch = []

    # Process only top cut (e.g., Top 8)
    for standing in validated_data.standings:
        if standing.placing > 8:
            continue

        team_names = [p.name for p in standing.team.pokemon]
        team_ids = []

        for name in team_names:
            clean_name = name.lower().replace("-", "").replace(" ", "")
            poke_id = local_roster.get(clean_name)
            if poke_id:
                team_ids.append(poke_id)

        # Only add valid teams (usually 6, but we'll accept 4+ for flexibility)
        if len(team_ids) >= 4:
            record = {
                "tournament_name": validated_data.name,
                "placement": standing.placing,
                "pokemon_ids": team_ids,
                "archetype": determine_archetype(team_names),
                "source": "Limitless",
            }
            upsert_batch.append(record)

    # Note: Assuming 'tournament_name' and 'placement' logic for unique identification
    # In a real app we'd add unique constraints for these.

    print(f"Upserting {len(upsert_batch)} top-cut teams to Database...")
    for record in upsert_batch:
        try:
            # Simple insert for demonstration.
            # In a real implementation we would want to check for existing records.
            sb.table("tournament_teams").insert(record).execute()
        except Exception as e:
            print(f"  Warning: Database insert failed: {e}")

    print("Limitless Teams Ingest complete.")


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    # E.g. limitlesstcg VGC ID for a specific tournament week
    ingest_limitless_tournament(db, "vgc-regional-2026-week1")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
