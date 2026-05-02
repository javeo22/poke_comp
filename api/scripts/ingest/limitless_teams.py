"""
Ingest Limitless VGC tournament team data.
Fetches winning teams from recent Limitless tournaments via their
public API and stores them in the ``tournament_teams`` table.

Handles:
  - Real API calls to play.limitlesstcg.com
  - Pokemon name resolution against local Champions roster
  - Archetype classification via team composition heuristics
  - Deduplication via upsert on (tournament_name, placement)

Usage:
    uv run python -m scripts.ingest.limitless_teams
    uv run python -m scripts.ingest.limitless_teams --tournament-id abc123
"""

import asyncio
import sys
import time
from typing import Any

import httpx
from supabase import Client, create_client

from app.config import settings
from app.models.ingest import IngestResult
from app.services.classifier import TournamentClassifier
from app.services.review_service import ReviewService

LIMITLESS_API_BASE = "https://play.limitlesstcg.com/api"
REQUEST_HEADERS = {
    "User-Agent": "PokemonChampionsCompanion/1.0 (+github.com/javeo22/poke_comp)",
    "Accept": "application/json",
}

# Delay between API calls to be respectful
REQUEST_DELAY = 1.0


# =============================================================================
# API helpers
# =============================================================================


async def _fetch_json(client: httpx.AsyncClient, url: str) -> dict[str, Any] | list[Any] | None:
    """GET a JSON endpoint with error handling."""
    print(f"  GET {url}")
    try:
        resp = await client.get(url, headers=REQUEST_HEADERS, timeout=30)
        resp.raise_for_status()
        return resp.json()
    except httpx.HTTPStatusError as e:
        print(f"    HTTP Error: {e.response.status_code}")
        return None
    except Exception as e:
        print(f"    Network Error: {e}")
        return None


async def fetch_recent_tournament_ids(
    client: httpx.AsyncClient, game: str = "VGC", limit: int = 5
) -> list[dict[str, Any]]:
    """Fetch recent completed tournament IDs from Limitless.

    Returns a list of dicts with 'id' and 'name' keys.
    """
    params = f"game={game}&format=all&type=all&completed=true&limit={limit}"
    url = f"{LIMITLESS_API_BASE}/tournaments?{params}"
    data = await _fetch_json(client, url)
    if not data or not isinstance(data, list):
        return []

    tournaments = []
    for t in data:
        tid = t.get("id")
        name = t.get("name", f"Tournament {tid}")
        if tid:
            tournaments.append({"id": str(tid), "name": name})
    return tournaments


async def fetch_tournament_standings(
    client: httpx.AsyncClient, tournament_id: str
) -> list[dict[str, Any]]:
    """Fetch top-cut standings for a tournament.

    Returns a list of standing dicts with 'placing' and 'decklist' keys.
    """
    url = f"{LIMITLESS_API_BASE}/tournaments/{tournament_id}/standings"
    data = await _fetch_json(client, url)
    if not data or not isinstance(data, list):
        return []
    return data


def _extract_team_names(standing: dict[str, Any]) -> list[str]:
    """Extract Pokemon names from a Limitless standing entry.

    The Limitless API structure varies -- team data can be nested under
    'decklist', 'team', or 'pokemon'. We try each path.
    """
    # Path 1: decklist.pokemon[]
    decklist = standing.get("decklist") or {}
    if isinstance(decklist, dict):
        pokemon_list = decklist.get("pokemon") or decklist.get("team") or []
        if isinstance(pokemon_list, list):
            names = []
            for p in pokemon_list:
                if isinstance(p, dict):
                    names.append(p.get("name", p.get("pokemon", "")))
                elif isinstance(p, str):
                    names.append(p)
            if names:
                return [n for n in names if n]

    # Path 2: team.pokemon[]
    team = standing.get("team") or {}
    if isinstance(team, dict):
        pokemon_list = team.get("pokemon") or []
        if isinstance(pokemon_list, list):
            names = []
            for p in pokemon_list:
                if isinstance(p, dict):
                    names.append(p.get("name", ""))
                elif isinstance(p, str):
                    names.append(p)
            if names:
                return [n for n in names if n]

    # Path 3: direct pokemon[] on the standing
    pokemon_list = standing.get("pokemon") or []
    if isinstance(pokemon_list, list):
        names = []
        for p in pokemon_list:
            if isinstance(p, dict):
                names.append(p.get("name", ""))
            elif isinstance(p, str):
                names.append(p)
        return [n for n in names if n]

    return []


# =============================================================================
# Archetype detection
# =============================================================================


def determine_archetype(team_names: list[str]) -> str:
    """Basic heuristic to determine team archetype based on composition."""
    names_lower = {n.lower() for n in team_names}

    if "pelipper" in names_lower or "politoed" in names_lower:
        return "Rain"
    if "torkoal" in names_lower or "mega charizard y" in names_lower:
        return "Sun"
    if "farigiraf" in names_lower or "hatterene" in names_lower or "porygon2" in names_lower:
        return "Trick Room"
    if "hippowdon" in names_lower or "tyranitar" in names_lower:
        return "Sand"
    if "alolan ninetales" in names_lower or "abomasnow" in names_lower:
        return "Snow"

    return "Good Stuff / Balance"


# =============================================================================
# Name resolution
# =============================================================================


def _build_name_lookup(sb: Client) -> dict[str, int]:
    """Build a normalized name -> Pokemon ID lookup for the Champions roster."""
    result = sb.table("pokemon").select("id, name").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    lookup: dict[str, int] = {}
    for row in rows:
        name: str = row["name"]
        pid: int = row["id"]
        # Index by multiple normalizations for fuzzy matching
        lookup[name.lower()] = pid
        lookup[name.lower().replace("-", "").replace(" ", "")] = pid
        lookup[name.lower().replace(" ", "-")] = pid
    return lookup


def _resolve_pokemon_ids(team_names: list[str], lookup: dict[str, int]) -> list[int]:
    """Resolve a list of Pokemon names to IDs using the Champions roster lookup."""
    ids = []
    for name in team_names:
        clean = name.lower().strip()
        pid = lookup.get(clean)
        if not pid:
            pid = lookup.get(clean.replace("-", "").replace(" ", ""))
        if not pid:
            pid = lookup.get(clean.replace(" ", "-"))
        if pid:
            ids.append(pid)
    return ids


# =============================================================================
# Core ingest
# =============================================================================


async def ingest_limitless_tournaments(
    sb: Client,
    tournament_ids: list[str] | None = None,
    top_cut: int = 8,
    dry_run: bool = False,
) -> IngestResult:
    """Fetch, validate, and stage Limitless tournament standings.

    If tournament_ids is None, fetches the 5 most recent completed
    VGC tournaments automatically. When ``dry_run`` is true, queries
    the API and resolves team names but performs no DB writes.
    """
    started = time.monotonic()
    result = IngestResult(source="limitless", dry_run=dry_run)
    classifier = TournamentClassifier()

    name_lookup = _build_name_lookup(sb)
    print(f"Champions roster lookup: {len(name_lookup)} entries")

    async with httpx.AsyncClient() as client:
        # Discover tournaments if none specified
        if not tournament_ids:
            print("Discovering recent VGC tournaments...")
            tournaments = await fetch_recent_tournament_ids(client, "VGC", limit=5)
            if not tournaments:
                result.warnings.append("No recent VGC tournaments found on Limitless API")
                result.duration_ms = int((time.monotonic() - started) * 1000)
                return result
            print(f"Found {len(tournaments)} tournaments:")
            for t in tournaments:
                print(f"  - {t['name']} (ID: {t['id']})")
        else:
            tournaments = [{"id": tid, "name": f"Tournament {tid}"} for tid in tournament_ids]

        total_staged = 0
        skipped = 0

        for tournament in tournaments:
            tid = tournament["id"]
            tname = tournament["name"]
            print(f"\nProcessing: {tname}...")

            # Classify the tournament
            # Limitless API doesn't always provide a description, so we use name
            classification = await classifier.classify(tname)
            print(
                f"    Classification: {classification['category']} ({classification['confidence']})"
            )

            standings = await fetch_tournament_standings(client, tid)
            if not standings:
                result.warnings.append(f"No standings data for {tname}")
                await asyncio.sleep(REQUEST_DELAY)
                continue

            for standing in standings:
                placing = standing.get("placing", standing.get("place", 0))
                if not isinstance(placing, int) or placing > top_cut or placing < 1:
                    continue

                team_names = _extract_team_names(standing)
                if len(team_names) < 4:
                    skipped += 1
                    continue

                team_ids = _resolve_pokemon_ids(team_names, name_lookup)
                if len(team_ids) < 4:
                    resolved = f"{len(team_ids)}/{len(team_names)}"
                    print(f"    Placing {placing}: only resolved {resolved} Pokemon, skipping")
                    skipped += 1
                    continue

                archetype = determine_archetype(team_names)

                record = {
                    "tournament_name": tname,
                    "placement": placing,
                    "pokemon_ids": team_ids,
                    "archetype": archetype,
                    "source": "Limitless",
                }

                if dry_run:
                    total_staged += 1
                    print(
                        f"    [dry-run] Stage Placing {placing}: "
                        f"{', '.join(team_names[:6])} [{archetype}]"
                    )
                    continue

                try:
                    # Stage for review instead of direct insert
                    await ReviewService.stage_item(
                        source="limitless",
                        payload=record,
                        external_id=f"{tid}-{placing}",
                        metadata={
                            "classification": classification,
                            "team_names": team_names,
                        },
                    )
                    total_staged += 1
                    print(
                        f"    Staged Placing {placing}: {', '.join(team_names[:6])} [{archetype}]"
                    )
                except Exception as e:
                    result.warnings.append(f"Staging failed for {tname} placing {placing}: {e}")

            await asyncio.sleep(REQUEST_DELAY)

    result.rows_staged = total_staged
    result.rows_skipped = skipped
    result.duration_ms = int((time.monotonic() - started) * 1000)
    print(f"\nLimitless ingest complete: {total_staged} teams staged.")
    return result


def run(
    dry_run: bool = False,
    tournament_ids: list[str] | None = None,
) -> IngestResult:
    """Entrypoint for HTTP/cron invocation. Returns an IngestResult."""
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    return asyncio.run(
        ingest_limitless_tournaments(db, tournament_ids=tournament_ids, dry_run=dry_run)
    )


async def amain() -> None:
    # Check for --tournament-id flag
    tournament_ids = None
    if "--tournament-id" in sys.argv:
        idx = sys.argv.index("--tournament-id")
        if idx + 1 < len(sys.argv):
            tournament_ids = [sys.argv[idx + 1]]
    dry_run = "--dry-run" in sys.argv
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    await ingest_limitless_tournaments(db, dry_run=dry_run, tournament_ids=tournament_ids)


if __name__ == "__main__":
    try:
        asyncio.run(amain())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
