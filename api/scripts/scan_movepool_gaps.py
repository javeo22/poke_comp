"""Scan for Pokemon with movepool gaps vs PokeAPI.

For each champions_eligible Pokemon in the DB:
1. Fetch the full PokeAPI movepool by PokeAPI ID.
2. Diff: moves in PokeAPI's list but missing from DB.
3. Filter the diff to only include moves that EXIST in our `moves` table
   (so we don't surface moves we never imported in the first place).

Output: JSON report sorted by gap size, written to
`api/movepool_gaps_report.json`. Top entries are the best candidates for
a manual movepool override migration (see `seed_champions.py` and
`supabase/migrations/20260601200000_movepool_overrides.sql` for the pattern).

Usage:
    cd api && uv run python -m scripts.scan_movepool_gaps
    cd api && uv run python -m scripts.scan_movepool_gaps --top 20
    cd api && uv run python -m scripts.scan_movepool_gaps --pokemon "Ninetales Alola"

The PokeAPI baseline isn't perfect (it includes legacy moves a Pokemon
can't currently learn in any game). Treat this as a *candidate list* to
review against in-game knowledge, not an authoritative diff.
"""

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

import httpx
from supabase import create_client

from app.config import settings
from scripts.import_pokeapi import format_name

POKEAPI_BASE = "https://pokeapi.co/api/v2"
MAX_CONCURRENT = 15  # gentler than the bulk importer


async def fetch_pokeapi_movepool(
    client: httpx.AsyncClient,
    pokemon_id: int,
    semaphore: asyncio.Semaphore,
) -> set[str] | None:
    """Return the formatted move-name set for a given PokeAPI Pokemon ID,
    or None if the fetch failed (404 etc)."""
    async with semaphore:
        try:
            resp = await client.get(f"{POKEAPI_BASE}/pokemon/{pokemon_id}")
            resp.raise_for_status()
            data = resp.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            raise
        except httpx.RequestError:
            return None
    return {format_name(m["move"]["name"]) for m in data.get("moves", [])}


async def scan(top_n: int | None, pokemon_filter: str | None) -> dict:
    if not settings.supabase_url or not settings.supabase_service_key:
        print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set", file=sys.stderr)
        sys.exit(1)

    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    # Fetch all champions_eligible Pokemon and their current movepool.
    query = sb.table("pokemon").select("id, name, movepool").eq("champions_eligible", True)
    if pokemon_filter:
        query = query.ilike("name", pokemon_filter)
    poke_rows: list[dict] = query.order("id").execute().data or []  # type: ignore[assignment]

    if not poke_rows:
        print("No Pokemon matched the filter.", file=sys.stderr)
        sys.exit(1)

    print(f"Scanning {len(poke_rows)} Pokemon...")

    # Fetch the universe of move names we know about. The PokeAPI gap is
    # only actionable if the move actually exists in our DB.
    moves_rows: list[dict] = sb.table("moves").select("name").execute().data or []  # type: ignore[assignment]
    known_moves: set[str] = {m["name"] for m in moves_rows}
    print(f"  {len(known_moves)} moves in DB.")

    # Fetch each Pokemon's PokeAPI movepool concurrently.
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    results: list[dict] = []
    start = time.time()

    async with httpx.AsyncClient(timeout=30.0) as client:
        tasks = [
            fetch_pokeapi_movepool(client, p["id"], semaphore) for p in poke_rows
        ]
        pokeapi_movepools = await asyncio.gather(*tasks, return_exceptions=True)

    for poke, pokeapi_pool in zip(poke_rows, pokeapi_movepools):
        if isinstance(pokeapi_pool, BaseException) or pokeapi_pool is None:
            results.append(
                {
                    "id": poke["id"],
                    "name": poke["name"],
                    "db_count": len(poke.get("movepool") or []),
                    "pokeapi_count": 0,
                    "gap_count": 0,
                    "missing_moves": [],
                    "error": str(pokeapi_pool) if pokeapi_pool else "fetch failed",
                }
            )
            continue

        db_pool = set(poke.get("movepool") or [])
        # Moves in PokeAPI but not in DB, AND that we actually know about.
        # We don't auto-include moves that were pruned (Champions-only
        # filter at import time stripped most non-Champions moves).
        missing = (pokeapi_pool - db_pool) & known_moves
        results.append(
            {
                "id": poke["id"],
                "name": poke["name"],
                "db_count": len(db_pool),
                "pokeapi_count": len(pokeapi_pool),
                "gap_count": len(missing),
                "missing_moves": sorted(missing),
                "error": None,
            }
        )

    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s.")

    # Sort by gap size (most likely to need attention first).
    results.sort(key=lambda r: r["gap_count"], reverse=True)
    if top_n:
        results = results[:top_n]

    # Summary stats
    with_gaps = [r for r in results if r["gap_count"] > 0]
    total_missing = sum(r["gap_count"] for r in with_gaps)

    report = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "scanned_count": len(poke_rows),
        "with_gaps_count": len(with_gaps),
        "total_missing_moves": total_missing,
        "results": results,
    }

    # Write JSON report
    out_path = Path(__file__).resolve().parent.parent / "movepool_gaps_report.json"
    out_path.write_text(json.dumps(report, indent=2))
    print(f"\nReport written to {out_path}")

    # Print top-20 summary to stdout
    print(f"\nTop {min(20, len(with_gaps))} candidates (most missing moves first):")
    print(f"{'ID':>6}  {'Name':30}  {'DB':>4} {'API':>4} {'Gap':>4}  Missing (sample)")
    print("-" * 100)
    for r in with_gaps[:20]:
        sample = ", ".join(r["missing_moves"][:5])
        if r["gap_count"] > 5:
            sample += f", +{r['gap_count'] - 5} more"
        print(
            f"{r['id']:>6}  {r['name'][:30]:30}  "
            f"{r['db_count']:>4} {r['pokeapi_count']:>4} {r['gap_count']:>4}  {sample}"
        )

    return report


def main():
    parser = argparse.ArgumentParser(description="Scan for movepool gaps vs PokeAPI")
    parser.add_argument(
        "--top", type=int, default=None, help="Limit results to top N gaps"
    )
    parser.add_argument(
        "--pokemon",
        type=str,
        default=None,
        help="ILIKE filter for a specific Pokemon name (e.g. 'Ninetales%%')",
    )
    args = parser.parse_args()
    asyncio.run(scan(args.top, args.pokemon))


if __name__ == "__main__":
    main()
