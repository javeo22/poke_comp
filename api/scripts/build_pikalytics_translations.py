"""Build a translation cache: foreign-language name -> canonical English name.

Pikalytics ignores the Accept-Language header on a subset of its Champions
tournament detail pages (confirmed 2026-04-18 for Incineroar, Charizard,
Pelipper, Gengar -- always served in German/French). This cache lets the
ingest normalize those foreign names back to English before upsert.

Source: PokeAPI provides multi-language names for every move/item/ability:
    GET /move/{id}           -> names[]: [{name: "Mogelhieb", language: "de"}, ...]
    GET /item/{name_or_id}   -> names[]: [{name: "Sitrusbeere", language: "de"}, ...]
    GET /ability/{name_or_id}-> names[]: [{name: "Bedroher",    language: "de"}, ...]

Strategy: iterate our canonical moves/items/abilities by DB ID, fetch
PokeAPI translations, and write a single JSON file mapping foreign names to
the canonical English name. The ingest loads this at startup.

Usage:
    cd api && uv run python -m scripts.build_pikalytics_translations

Re-run monthly or whenever PokeAPI adds languages. Output:
    api/pikalytics_translations.json
"""

import asyncio
import json
import sys
import time
from pathlib import Path

import httpx
from supabase import create_client

from app.config import settings

POKEAPI_BASE = "https://pokeapi.co/api/v2"
MAX_CONCURRENT = 20


def norm(s: str) -> str:
    return s.strip().lower().replace("-", " ").replace("'", "")


async def fetch_translations(
    client: httpx.AsyncClient,
    endpoint: str,
    ident: int | str,
    english_name: str,
    semaphore: asyncio.Semaphore,
) -> dict[str, str]:
    """Fetch foreign-language names for one entity. Returns
    {normalized_foreign_name: english_name}."""
    async with semaphore:
        try:
            r = await client.get(f"{POKEAPI_BASE}/{endpoint}/{ident}")
            r.raise_for_status()
            data = r.json()
        except httpx.HTTPStatusError:
            return {}
        except httpx.RequestError:
            return {}

    mapping: dict[str, str] = {}
    for entry in data.get("names", []):
        name = entry.get("name")
        if not name:
            continue
        mapping[norm(name)] = english_name
    return mapping


async def fetch_all(
    client: httpx.AsyncClient,
    endpoint: str,
    rows: list[dict],
    ident_col: str,
) -> dict[str, str]:
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)
    tasks = [
        fetch_translations(client, endpoint, row[ident_col], row["name"], semaphore)
        for row in rows
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    merged: dict[str, str] = {}
    for res in results:
        if isinstance(res, dict):
            merged.update(res)
    return merged


async def main():
    if not settings.supabase_url or not settings.supabase_service_key:
        print("ERROR: Supabase credentials missing", file=sys.stderr)
        sys.exit(1)

    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    moves_rows: list[dict] = sb.table("moves").select("id, name").execute().data  # type: ignore[assignment]
    items_rows: list[dict] = sb.table("items").select("id, name").execute().data  # type: ignore[assignment]
    abilities_rows: list[dict] = (
        sb.table("abilities").select("name").execute().data  # type: ignore[assignment]
    )

    print(
        f"Fetching translations for {len(moves_rows)} moves, "
        f"{len(items_rows)} items, {len(abilities_rows)} abilities..."
    )

    start = time.time()
    async with httpx.AsyncClient(timeout=30.0) as client:
        # PokeAPI abilities don't have numeric IDs everywhere; use name slug.
        # Our abilities are stored as Title Case -> convert to kebab-lowercase.
        abilities_lookup = [
            {"name": r["name"], "slug": r["name"].lower().replace(" ", "-")}
            for r in abilities_rows
        ]
        moves_map, items_map, abilities_map = await asyncio.gather(
            fetch_all(client, "move", moves_rows, "id"),
            fetch_all(client, "item", items_rows, "id"),
            fetch_all(client, "ability", abilities_lookup, "slug"),
        )

    elapsed = time.time() - start
    print(f"  Done in {elapsed:.1f}s.")
    print(
        f"  moves: {len(moves_map)} translations, "
        f"items: {len(items_map)}, abilities: {len(abilities_map)}"
    )

    out = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S"),
        "moves": moves_map,
        "items": items_map,
        "abilities": abilities_map,
    }
    out_path = Path(__file__).resolve().parent.parent / "pikalytics_translations.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"Written to {out_path}")


if __name__ == "__main__":
    asyncio.run(main())
