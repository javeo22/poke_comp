"""Bulk import Pokemon, moves, and abilities from PokeAPI into Supabase.

Usage:
    uv run python -m scripts.import_pokeapi

Imports base-form Pokemon (IDs 1-1025), all moves, and all abilities.
Uses async HTTP with concurrency limiting to stay respectful of PokeAPI.
Upserts into Supabase so the script is safe to re-run.
"""

import asyncio
import sys
import time

import httpx
from supabase import Client, create_client

from app.config import settings

POKEAPI_BASE = "https://pokeapi.co/api/v2"
MAX_CONCURRENT = 20
UPSERT_BATCH_SIZE = 50
MAX_POKEMON_ID = 1025

# Regional forms available in Champions (PokeAPI slugs)
# These have IDs > 10000 in PokeAPI and need separate import.
REGIONAL_FORM_SLUGS = [
    "raichu-alola",
    "ninetales-alola",
    "arcanine-hisui",
    "slowbro-galar",
    "tauros-paldea-combat-breed",
    "tauros-paldea-blaze-breed",
    "tauros-paldea-aqua-breed",
    "typhlosion-hisui",
    "slowking-galar",
    "samurott-hisui",
    "zoroark-hisui",
    "stunfisk-galar",
    "goodra-hisui",
    "avalugg-hisui",
    "decidueye-hisui",
]

# National dex ID ranges per generation
GEN_RANGES = [
    (1, 151, 1),
    (152, 251, 2),
    (252, 386, 3),
    (387, 493, 4),
    (494, 649, 5),
    (650, 721, 6),
    (722, 809, 7),
    (810, 905, 8),
    (906, 1025, 9),
]

STAT_NAME_MAP = {
    "hp": "hp",
    "attack": "attack",
    "defense": "defense",
    "special-attack": "sp_attack",
    "special-defense": "sp_defense",
    "speed": "speed",
}


def get_generation(pokemon_id: int) -> int | None:
    for start, end, gen in GEN_RANGES:
        if start <= pokemon_id <= end:
            return gen
    return None


def format_name(name: str) -> str:
    """Convert PokeAPI kebab-case to Title Case. 'thunder-punch' -> 'Thunder Punch'."""
    return name.replace("-", " ").title()


async def fetch_json(client: httpx.AsyncClient, url: str, semaphore: asyncio.Semaphore) -> dict:
    async with semaphore:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.json()


async def fetch_with_retry(
    client: httpx.AsyncClient, url: str, semaphore: asyncio.Semaphore, retries: int = 3
) -> dict | None:
    for attempt in range(retries):
        try:
            return await fetch_json(client, url, semaphore)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 404:
                return None
            if attempt < retries - 1:
                await asyncio.sleep(1 * (attempt + 1))
            else:
                print(f"  Failed after {retries} attempts: {url}")
                raise
        except httpx.RequestError:
            if attempt < retries - 1:
                await asyncio.sleep(1 * (attempt + 1))
            else:
                print(f"  Failed after {retries} attempts: {url}")
                raise
    return None


def parse_pokemon(data: dict) -> dict:
    stats = {}
    for stat in data["stats"]:
        key = STAT_NAME_MAP.get(stat["stat"]["name"])
        if key:
            stats[key] = stat["base_stat"]

    types = [t["type"]["name"] for t in data["types"]]
    abilities = [format_name(a["ability"]["name"]) for a in data["abilities"]]
    movepool = [format_name(m["move"]["name"]) for m in data["moves"]]

    sprite_url = None
    sprites = data.get("sprites", {})
    if sprites.get("front_default"):
        sprite_url = sprites["front_default"]

    return {
        "id": data["id"],
        "name": format_name(data["name"]),
        "types": types,
        "base_stats": stats,
        "abilities": abilities,
        "movepool": movepool,
        "champions_eligible": False,
        "generation": get_generation(data["id"]),
        "sprite_url": sprite_url,
    }


def parse_move(data: dict) -> dict:
    effect_text = None
    for entry in data.get("effect_entries", []):
        if entry["language"]["name"] == "en":
            effect_text = entry.get("short_effect") or entry.get("effect")
            break

    return {
        "id": data["id"],
        "name": format_name(data["name"]),
        "type": data["type"]["name"],
        "category": data["damage_class"]["name"] if data.get("damage_class") else "status",
        "power": data.get("power"),
        "accuracy": data.get("accuracy"),
        "target": data["target"]["name"] if data.get("target") else None,
        "effect_text": effect_text,
        "champions_available": False,
    }


def parse_ability(data: dict) -> dict:
    effect_text = None
    for entry in data.get("effect_entries", []):
        if entry["language"]["name"] == "en":
            effect_text = entry.get("short_effect") or entry.get("effect")
            break

    return {
        "id": data["id"],
        "name": format_name(data["name"]),
        "effect_text": effect_text,
    }


def upsert_batch(supabase: Client, table: str, rows: list[dict]) -> None:
    for i in range(0, len(rows), UPSERT_BATCH_SIZE):
        batch = rows[i : i + UPSERT_BATCH_SIZE]
        supabase.table(table).upsert(batch).execute()


async def get_resource_count(
    client: httpx.AsyncClient, resource: str, semaphore: asyncio.Semaphore
) -> int:
    data = await fetch_json(client, f"{POKEAPI_BASE}/{resource}?limit=1", semaphore)
    return data["count"]


async def import_pokemon(
    client: httpx.AsyncClient, supabase: Client, semaphore: asyncio.Semaphore
) -> None:
    print(f"Importing Pokemon (IDs 1-{MAX_POKEMON_ID})...")
    start = time.time()

    urls = [f"{POKEAPI_BASE}/pokemon/{i}" for i in range(1, MAX_POKEMON_ID + 1)]
    tasks = [fetch_with_retry(client, url, semaphore) for url in urls]
    results = await asyncio.gather(*tasks)

    rows = []
    for data in results:
        if data:
            rows.append(parse_pokemon(data))

    print(f"  Fetched {len(rows)} Pokemon in {time.time() - start:.1f}s")
    upsert_batch(supabase, "pokemon", rows)
    print(f"  Upserted {len(rows)} Pokemon")


async def import_moves(
    client: httpx.AsyncClient, supabase: Client, semaphore: asyncio.Semaphore
) -> None:
    total = await get_resource_count(client, "move", semaphore)
    print(f"Importing moves ({total} total)...")
    start = time.time()

    urls = [f"{POKEAPI_BASE}/move/{i}" for i in range(1, total + 1)]
    tasks = [fetch_with_retry(client, url, semaphore) for url in urls]
    results = await asyncio.gather(*tasks)

    rows = []
    for data in results:
        if data:
            rows.append(parse_move(data))

    print(f"  Fetched {len(rows)} moves in {time.time() - start:.1f}s")
    upsert_batch(supabase, "moves", rows)
    print(f"  Upserted {len(rows)} moves")


async def import_abilities(
    client: httpx.AsyncClient, supabase: Client, semaphore: asyncio.Semaphore
) -> None:
    total = await get_resource_count(client, "ability", semaphore)
    print(f"Importing abilities ({total} total)...")
    start = time.time()

    urls = [f"{POKEAPI_BASE}/ability/{i}" for i in range(1, total + 1)]
    tasks = [fetch_with_retry(client, url, semaphore) for url in urls]
    results = await asyncio.gather(*tasks)

    rows = []
    for data in results:
        if data:
            rows.append(parse_ability(data))

    print(f"  Fetched {len(rows)} abilities in {time.time() - start:.1f}s")
    upsert_batch(supabase, "abilities", rows)
    print(f"  Upserted {len(rows)} abilities")


async def import_regional_forms(
    client: httpx.AsyncClient, supabase: Client, semaphore: asyncio.Semaphore
) -> None:
    """Import regional/alternate forms from PokeAPI (Champions roster)."""
    print(f"Importing {len(REGIONAL_FORM_SLUGS)} regional forms...")
    start = time.time()

    urls = [f"{POKEAPI_BASE}/pokemon/{slug}" for slug in REGIONAL_FORM_SLUGS]
    tasks = [fetch_with_retry(client, url, semaphore) for url in urls]
    results = await asyncio.gather(*tasks)

    rows = []
    for data in results:
        if data:
            parsed = parse_pokemon(data)
            # Regional form names: "Raichu Alola" -> keep as-is from format_name
            rows.append(parsed)

    print(f"  Fetched {len(rows)} regional forms in {time.time() - start:.1f}s")
    upsert_batch(supabase, "pokemon", rows)
    print(f"  Upserted {len(rows)} regional forms")


async def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    semaphore = asyncio.Semaphore(MAX_CONCURRENT)

    async with httpx.AsyncClient(timeout=30.0) as client:
        await import_pokemon(client, db, semaphore)
        await import_moves(client, db, semaphore)
        await import_abilities(client, db, semaphore)
        await import_regional_forms(client, db, semaphore)

    print("\nImport complete.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
