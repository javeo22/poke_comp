"""Import Champions-specific data from Serebii, overwriting PokeAPI baseline.

Usage:
    uv run python -m scripts.import_serebii
    uv run python -m scripts.import_serebii --pokemon-only
    uv run python -m scripts.import_serebii --items-only
    uv run python -m scripts.import_serebii --moves-only

Scrapes:
  1. Pokemon roster list + per-Pokemon movepools, abilities, stats
  2. Items with VP costs and shop availability
  3. Moves with Champions-specific stats
  4. Updated attacks (Champions vs mainline diffs)
  5. Mega evolution abilities

No AI needed — pure HTML parsing with BeautifulSoup.
Respects Serebii with 0.5s delay between requests.
"""

import asyncio
import re
import sys
import time
from dataclasses import dataclass, field

import httpx
from bs4 import BeautifulSoup, Tag
from supabase import Client, create_client

from app.config import settings

BASE_URL = "https://www.serebii.net"
CHAMPIONS_URL = f"{BASE_URL}/pokemonchampions"
POKEDEX_URL = f"{BASE_URL}/pokedex-champions"

HEADERS = {
    "User-Agent": ("PokemonChampionsCompanion/0.1 (personal-tool; +github.com/javeo22/poke_comp)"),
    "Accept": "text/html",
}

REQUEST_DELAY = 0.5  # seconds between requests to be respectful
CONCURRENT_LIMIT = 3  # max concurrent requests


# ═══════════════════════════════════════════════════════════════
# Data classes
# ═══════════════════════════════════════════════════════════════


@dataclass
class PokemonEntry:
    dex_number: int
    name: str
    slug: str  # URL slug like "garchomp"
    types: list[str] = field(default_factory=list)
    is_mega: bool = False


@dataclass
class PokemonDetail:
    dex_number: int
    name: str
    types: list[str]
    abilities: list[str]
    base_stats: dict[str, int]
    movepool: list[str]
    mega_ability: str | None = None
    mega_stats: dict[str, int] | None = None
    mega_types: list[str] | None = None


@dataclass
class ItemEntry:
    name: str
    effect: str
    location: str
    category: str  # held, mega_stone, berry, misc
    vp_cost: int | None = None
    champions_shop: bool = False


@dataclass
class MoveEntry:
    name: str
    move_type: str
    category: str  # physical, special, status
    pp: int | None = None
    power: int | None = None
    accuracy: int | None = None
    effect: str = ""


# ═══════════════════════════════════════════════════════════════
# HTTP helpers
# ═══════════════════════════════════════════════════════════════

semaphore: asyncio.Semaphore


async def fetch_page(client: httpx.AsyncClient, url: str) -> BeautifulSoup:
    """Fetch a page and return parsed BeautifulSoup."""
    async with semaphore:
        resp = await client.get(url, headers=HEADERS, follow_redirects=True)
        resp.raise_for_status()
        await asyncio.sleep(REQUEST_DELAY)
    return BeautifulSoup(resp.text, "html.parser")


def clean_text(el: Tag | None) -> str:
    """Extract clean text from a BeautifulSoup element."""
    if el is None:
        return ""
    return el.get_text(strip=True)


def parse_int(text: str) -> int | None:
    """Parse an integer from text, returning None if not a number."""
    text = text.strip().replace(",", "")
    if text in ("", "—", "--", "-"):
        return None
    try:
        return int(text)
    except ValueError:
        return None


def normalize_type(raw: str) -> str:
    """Normalize type name to lowercase."""
    return raw.strip().lower().replace("-type", "").replace(" ", "")


def title_case_name(name: str) -> str:
    """Convert Pokemon/move name to Title Case, handling hyphens."""
    # Handle special cases
    name = name.strip()
    if not name:
        return name
    # Split on spaces and capitalize each word
    return " ".join(w.capitalize() for w in name.split())


# ═══════════════════════════════════════════════════════════════
# 1. POKEMON ROSTER + MOVEPOOLS
# ═══════════════════════════════════════════════════════════════


async def scrape_pokemon_roster(client: httpx.AsyncClient) -> list[PokemonEntry]:
    """Scrape the roster list from pokemon.shtml."""
    print("\n[1/5] Scraping Pokemon roster list...")
    soup = await fetch_page(client, f"{CHAMPIONS_URL}/pokemon.shtml")

    entries: list[PokemonEntry] = []
    seen_slugs: set[str] = set()

    # Find all table rows with Pokemon data
    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 4:
            continue

        # First cell should have dex number like #0003
        dex_text = clean_text(cells[0])
        dex_match = re.match(r"#?(\d+)", dex_text)
        if not dex_match:
            continue

        dex_number = int(dex_match.group(1))
        if dex_number == 0:
            continue

        # Name cell (usually cell[2])
        name_cell = cells[2]
        name_link = name_cell.find("a")
        name = clean_text(name_cell)

        is_mega = "mega" in name.lower() and name.lower() != "meganium"

        # Extract slug from link
        slug = ""
        if name_link and name_link.get("href"):
            href = name_link["href"]
            # Pattern: /pokedex-champions/garchomp/
            slug_match = re.search(r"/pokedex-champions/([^/]+)/?", str(href))
            if slug_match:
                slug = slug_match.group(1)

        if not slug:
            continue

        # Extract types from type images/links
        types: list[str] = []
        type_cell = cells[3] if len(cells) > 3 else None
        if type_cell:
            for img in type_cell.find_all("img"):
                src = str(img.get("src", ""))
                type_match = re.search(r"/(\w+)\.gif", src)
                if type_match:
                    types.append(type_match.group(1).lower())

        # Skip mega entries in the roster list — we get their data
        # from the base Pokemon's detail page
        if is_mega:
            continue

        if slug not in seen_slugs:
            seen_slugs.add(slug)
            entries.append(
                PokemonEntry(
                    dex_number=dex_number,
                    name=title_case_name(name),
                    slug=slug,
                    types=types,
                    is_mega=False,
                )
            )

    print(f"  Found {len(entries)} unique base-form Pokemon")
    return entries


async def scrape_pokemon_detail(
    client: httpx.AsyncClient, entry: PokemonEntry
) -> PokemonDetail | None:
    """Scrape a single Pokemon's detail page for movepool, abilities, stats."""
    url = f"{POKEDEX_URL}/{entry.slug}/"
    try:
        soup = await fetch_page(client, url)
    except httpx.HTTPStatusError:
        print(f"  WARN: Failed to fetch {entry.name} ({url})")
        return None

    # ── Abilities ──
    # Abilities are in <td> cells with text starting with "Abilities:"
    abilities: list[str] = []
    for td in soup.find_all("td"):
        text = td.get_text(strip=True)
        if text.startswith("Abilities:") and len(text) < 150:
            for link in td.find_all("a"):
                href = str(link.get("href", ""))
                if "/abilitydex/" in href and href != "/abilitydex/":
                    ability_name = clean_text(link)
                    if ability_name and ability_name not in abilities:
                        abilities.append(title_case_name(ability_name))
            if abilities:
                break  # Use the first (base form) abilities

    # ── Base Stats ──
    base_stats: dict[str, int] = {}
    stat_names = ["hp", "attack", "defense", "sp_attack", "sp_defense", "speed"]

    for table in soup.find_all("table"):
        table_text = table.get_text()
        if "Base Stats" in table_text and "HP" in table_text:
            # Find stat value cells
            stat_cells = []
            for row in table.find_all("tr"):
                cells = row.find_all("td")
                for cell in cells:
                    text = clean_text(cell)
                    val = parse_int(text)
                    if val is not None and 1 <= val <= 255:
                        stat_cells.append(val)

            # Map the first 6 valid stat values
            if len(stat_cells) >= 6:
                for i, stat_key in enumerate(stat_names):
                    base_stats[stat_key] = stat_cells[i]
            break

    # ── Movepool ──
    # Moves are in a table with links to /attackdex-champions/[move].shtml
    # Filter out the nav link "-Champions Attackdex"
    movepool: list[str] = []
    for table in soup.find_all("table"):
        attack_links = [
            link
            for link in table.find_all("a")
            if "/attackdex-champions/" in str(link.get("href", ""))
            and link.get_text(strip=True)
            and not link.get_text(strip=True).startswith("-")
            and ".shtml" in str(link.get("href", ""))
        ]
        if len(attack_links) > 5:  # This is the movepool table
            for link in attack_links:
                move_name = clean_text(link)
                if move_name and move_name not in movepool:
                    movepool.append(title_case_name(move_name))
            break

    # ── Types (from detail page, more reliable) ──
    types: list[str] = []
    for table in soup.find_all("table"):
        table_text = table.get_text()
        if "Type" in table_text:
            for img in table.find_all("img"):
                src = str(img.get("src", ""))
                if "/type/" in src:
                    type_match = re.search(r"/(\w+)\.gif", src)
                    if type_match:
                        t = type_match.group(1).lower()
                        if t not in types and t in VALID_TYPES:
                            types.append(t)
            if types:
                break

    if not types:
        types = entry.types

    return PokemonDetail(
        dex_number=entry.dex_number,
        name=entry.name,
        types=types,
        abilities=abilities,
        base_stats=base_stats,
        movepool=movepool,
    )


VALID_TYPES = {
    "normal",
    "fire",
    "water",
    "electric",
    "grass",
    "ice",
    "fighting",
    "poison",
    "ground",
    "flying",
    "psychic",
    "bug",
    "rock",
    "ghost",
    "dragon",
    "dark",
    "steel",
    "fairy",
}


async def scrape_all_pokemon(
    client: httpx.AsyncClient,
) -> list[PokemonDetail]:
    """Scrape roster list, then fetch details for each Pokemon."""
    roster = await scrape_pokemon_roster(client)

    print(f"\n[2/5] Scraping detail pages for {len(roster)} Pokemon...")
    details: list[PokemonDetail] = []

    # Process in batches
    batch_size = 10
    for i in range(0, len(roster), batch_size):
        batch = roster[i : i + batch_size]
        tasks = [scrape_pokemon_detail(client, entry) for entry in batch]
        results = await asyncio.gather(*tasks)
        for result in results:
            if result:
                details.append(result)
        done = min(i + batch_size, len(roster))
        print(f"  {done}/{len(roster)} Pokemon scraped...")

    # Stats summary
    with_movepool = sum(1 for d in details if d.movepool)
    with_abilities = sum(1 for d in details if d.abilities)
    with_stats = sum(1 for d in details if d.base_stats)
    print(f"  Results: {len(details)} Pokemon")
    print(f"    With movepools: {with_movepool}")
    print(f"    With abilities: {with_abilities}")
    print(f"    With stats: {with_stats}")

    return details


# ═══════════════════════════════════════════════════════════════
# 2. ITEMS
# ═══════════════════════════════════════════════════════════════


async def scrape_items(client: httpx.AsyncClient) -> list[ItemEntry]:
    """Scrape all items from items.shtml."""
    print("\n[3/5] Scraping items...")
    soup = await fetch_page(client, f"{CHAMPIONS_URL}/items.shtml")

    items: list[ItemEntry] = []
    current_category = "held"

    # Category detection from headers
    category_map = {
        "hold item": "held",
        "mega stone": "mega_stone",
        "berr": "berry",
        "miscellaneous": "misc",
    }

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            # Check for category headers
            header = row.find("h2") or row.find("h3")
            if header:
                header_text = clean_text(header).lower()
                for key, cat in category_map.items():
                    if key in header_text:
                        current_category = cat
                        break
                continue

            cells = row.find_all("td")
            if len(cells) < 4:
                continue

            # Try to extract item data
            # Columns: Picture, Name, Effect, Location
            name_cell = cells[1] if len(cells) >= 4 else None
            effect_cell = cells[2] if len(cells) >= 4 else None
            location_cell = cells[3] if len(cells) >= 4 else None

            if not name_cell:
                continue

            name = clean_text(name_cell)
            if not name or len(name) < 2:
                continue

            # Skip header-like rows
            if name.lower() in ("name", "picture", "item"):
                continue

            effect = clean_text(effect_cell) if effect_cell else ""
            location = clean_text(location_cell) if location_cell else ""

            # Parse VP cost from location
            vp_cost = None
            champions_shop = False
            if "shop" in location.lower():
                champions_shop = True
                vp_match = re.search(r"(\d[\d,]*)\s*VP", location)
                if vp_match:
                    vp_cost = int(vp_match.group(1).replace(",", ""))

            # Detect mega stones by name -- but do NOT mutate current_category.
            # Previous behavior: once any "-ite" item was seen, current_category
            # stuck on "mega_stone" and contaminated every subsequent item,
            # including berries parsed later on the same page. Root cause of
            # the 28 berries miscategorized as mega_stone in prod (fixed
            # 2026-04-17). Compute a per-item category locally instead.
            item_category = current_category
            if name.endswith("ite") and current_category != "berry":
                item_category = "mega_stone"

            items.append(
                ItemEntry(
                    name=title_case_name(name),
                    effect=effect,
                    location=location,
                    category=item_category,
                    vp_cost=vp_cost,
                    champions_shop=champions_shop,
                )
            )

    print(f"  Found {len(items)} items")
    cats = {}
    for item in items:
        cats[item.category] = cats.get(item.category, 0) + 1
    for cat, count in sorted(cats.items()):
        print(f"    {cat}: {count}")
    return items


# ═══════════════════════════════════════════════════════════════
# 3. MOVES
# ═══════════════════════════════════════════════════════════════


async def scrape_moves(client: httpx.AsyncClient) -> list[MoveEntry]:
    """Scrape all moves from moves.shtml."""
    print("\n[4/5] Scraping moves...")
    soup = await fetch_page(client, f"{CHAMPIONS_URL}/moves.shtml")

    moves: list[MoveEntry] = []

    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all("td")
            if len(cells) < 7:
                continue

            # Columns: Name, Type, Cat, PP, Base Power, Accuracy, Effect
            name = clean_text(cells[0])
            if not name or name.lower() == "name":
                continue

            # Type from image
            move_type = ""
            for img in cells[1].find_all("img"):
                src = str(img.get("src", ""))
                type_match = re.search(r"/(\w+)\.gif", src)
                if type_match:
                    move_type = type_match.group(1).lower()
                    break
            if not move_type:
                move_type = clean_text(cells[1]).lower()

            # Category from image
            category = "status"
            for img in cells[2].find_all("img"):
                src = str(img.get("src", "")).lower()
                if "physical" in src:
                    category = "physical"
                elif "special" in src:
                    category = "special"
                elif "other" in src:
                    category = "status"
                break

            pp = parse_int(clean_text(cells[3]))
            power = parse_int(clean_text(cells[4]))
            accuracy = parse_int(clean_text(cells[5]))
            effect = clean_text(cells[6])

            if move_type in VALID_TYPES:
                moves.append(
                    MoveEntry(
                        name=title_case_name(name),
                        move_type=move_type,
                        category=category,
                        pp=pp,
                        power=power,
                        accuracy=accuracy,
                        effect=effect,
                    )
                )

    print(f"  Found {len(moves)} moves")
    return moves


# ═══════════════════════════════════════════════════════════════
# 4. MEGA ABILITIES
# ═══════════════════════════════════════════════════════════════


@dataclass
class MegaAbilityEntry:
    dex_number: int
    name: str
    types: list[str]
    ability: str


async def scrape_mega_abilities(
    client: httpx.AsyncClient,
) -> list[MegaAbilityEntry]:
    """Scrape Champions-specific mega abilities."""
    print("\n[5/5] Scraping mega abilities...")
    soup = await fetch_page(client, f"{CHAMPIONS_URL}/megaabilities.shtml")

    entries: list[MegaAbilityEntry] = []

    for row in soup.find_all("tr"):
        cells = row.find_all("td")
        if len(cells) < 5:
            continue

        dex_text = clean_text(cells[0])
        dex_match = re.match(r"#?(\d+)", dex_text)
        if not dex_match:
            continue

        dex_number = int(dex_match.group(1))

        # Name could be in cell[2] or cell[3] depending on colspan
        name = ""
        ability = ""
        for cell in cells:
            text = clean_text(cell)
            if "mega" in text.lower() and not name:
                name = text
            # Ability is usually the last non-empty cell
        # Get ability from last cell with text
        for cell in reversed(cells):
            text = clean_text(cell)
            if text and not text.startswith("#") and "mega" not in text.lower():
                ability = text
                break

        # Types from images in any cell
        types: list[str] = []
        for cell in cells:
            for img in cell.find_all("img"):
                src = str(img.get("src", ""))
                type_match = re.search(r"/type/(\w+)\.gif", src)
                if type_match:
                    t = type_match.group(1).lower()
                    if t in VALID_TYPES:
                        types.append(t)

        if name and ability:
            entries.append(
                MegaAbilityEntry(
                    dex_number=dex_number,
                    name=title_case_name(name),
                    types=types,
                    ability=title_case_name(ability),
                )
            )

    print(f"  Found {len(entries)} mega abilities")
    return entries


# ═══════════════════════════════════════════════════════════════
# DATABASE UPSERTS
# ═══════════════════════════════════════════════════════════════


def upsert_pokemon(sb: Client, details: list[PokemonDetail]) -> None:
    """Upsert Pokemon data, overwriting PokeAPI baseline."""
    print("\n  Upserting Pokemon data...")
    updated = 0

    for d in details:
        update_data: dict = {"champions_eligible": True}

        if d.types:
            update_data["types"] = d.types
        if d.abilities:
            update_data["abilities"] = [title_case_name(a) for a in d.abilities]
        if d.base_stats:
            update_data["base_stats"] = d.base_stats
        if d.movepool:
            update_data["movepool"] = d.movepool

        result = sb.table("pokemon").update(update_data).eq("id", d.dex_number).execute()
        if result.data:
            updated += 1

    # Also reset champions_eligible=false for Pokemon NOT in the roster
    print(f"  Updated {updated}/{len(details)} Pokemon records")


def reset_eligibility(sb: Client, eligible_ids: set[int]) -> None:
    """Set champions_eligible=false for Pokemon not in the roster."""
    print("  Resetting eligibility for non-roster Pokemon...")
    # Get all Pokemon currently marked eligible
    result = sb.table("pokemon").select("id").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    current_eligible = {row["id"] for row in rows}
    to_reset = current_eligible - eligible_ids

    if to_reset:
        for pid in to_reset:
            sb.table("pokemon").update({"champions_eligible": False}).eq("id", pid).execute()
        print(f"  Reset {len(to_reset)} Pokemon to ineligible")
    else:
        print("  No eligibility resets needed")


def upsert_items(sb: Client, items: list[ItemEntry]) -> None:
    """Upsert items from Serebii data."""
    print("\n  Upserting items...")
    upserted = 0
    new_items = 0

    # Get the max existing ID to generate new IDs for unknown items
    max_result = sb.table("items").select("id").order("id", desc=True).limit(1).execute()
    max_rows: list[dict] = max_result.data  # type: ignore[assignment]
    next_id = max(20000, (max_rows[0]["id"] + 1) if max_rows else 20000)

    for item in items:
        # Skip miscellaneous/ticket items
        if item.category == "misc":
            continue

        data: dict = {
            "name": item.name,
            "effect_text": item.effect,
            "category": item.category,
            "champions_shop_available": item.champions_shop,
        }
        if item.vp_cost is not None:
            data["vp_cost"] = item.vp_cost

        # Try to find existing item by name (case-insensitive)
        existing = (
            sb.table("items")
            .select("id, champions_shop_available")
            .ilike("name", item.name)
            .execute()
        )

        existing_rows: list[dict] = existing.data  # type: ignore[assignment]
        if existing_rows:
            # Never downgrade champions_shop_available from True to False.
            # The seed script or prior ingest may have marked it available;
            # Serebii's location text may simply not mention "shop".
            if existing_rows[0].get("champions_shop_available") and not item.champions_shop:
                del data["champions_shop_available"]
            sb.table("items").update(data).eq("id", existing_rows[0]["id"]).execute()
            upserted += 1
        else:
            # Insert new item with generated ID
            data["id"] = next_id
            next_id += 1
            try:
                sb.table("items").insert(data).execute()
                upserted += 1
                new_items += 1
            except Exception as e:
                print(f"  WARN: Failed to insert {item.name}: {e}")

    print(f"  Upserted {upserted} items ({new_items} new)")


def upsert_moves(sb: Client, moves: list[MoveEntry]) -> None:
    """Upsert moves from Serebii data."""
    print("\n  Upserting moves...")
    upserted = 0
    new_moves = 0

    # Get max existing ID for generating new ones
    max_result = sb.table("moves").select("id").order("id", desc=True).limit(1).execute()
    max_rows: list[dict] = max_result.data  # type: ignore[assignment]
    next_id = max(20000, (max_rows[0]["id"] + 1) if max_rows else 20000)

    for move in moves:
        data: dict = {
            "name": move.name,
            "type": move.move_type,
            "category": move.category,
            "champions_available": True,
        }
        if move.power is not None:
            data["power"] = move.power
        if move.accuracy is not None:
            data["accuracy"] = move.accuracy
        if move.effect:
            data["effect_text"] = move.effect

        # Try to find existing move by name (case-insensitive)
        existing = sb.table("moves").select("id").ilike("name", move.name).execute()

        existing_rows: list[dict] = existing.data  # type: ignore[assignment]
        if existing_rows:
            sb.table("moves").update(data).eq("id", existing_rows[0]["id"]).execute()
            upserted += 1
        else:
            data["id"] = next_id
            next_id += 1
            try:
                sb.table("moves").insert(data).execute()
                upserted += 1
                new_moves += 1
            except Exception as e:
                print(f"  WARN: Failed to insert {move.name}: {e}")

    print(f"  Upserted {upserted} moves ({new_moves} new)")


def upsert_mega_abilities(sb: Client, megas: list[MegaAbilityEntry]) -> None:
    """Update mega Pokemon abilities from Serebii data."""
    print("\n  Updating mega abilities...")
    updated = 0

    for mega in megas:
        # Find the mega Pokemon by name pattern
        name_patterns = [
            f"Mega {mega.name.replace('Mega ', '')}",
            mega.name,
        ]
        for name in name_patterns:
            result = sb.table("pokemon").select("id, name").ilike("name", f"%{name}%").execute()
            matched: list[dict] = result.data  # type: ignore[assignment]
            if matched:
                update_data: dict = {
                    "abilities": [mega.ability],
                }
                if mega.types:
                    update_data["types"] = mega.types

                sb.table("pokemon").update(update_data).eq("id", matched[0]["id"]).execute()
                updated += 1
                break

    print(f"  Updated {updated}/{len(megas)} mega abilities")


# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════


async def async_main(
    pokemon_only: bool = False,
    items_only: bool = False,
    moves_only: bool = False,
) -> None:
    global semaphore
    semaphore = asyncio.Semaphore(CONCURRENT_LIMIT)

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    run_all = not (pokemon_only or items_only or moves_only)

    async with httpx.AsyncClient(timeout=30) as client:
        if run_all or pokemon_only:
            details = await scrape_all_pokemon(client)
            upsert_pokemon(sb, details)
            eligible_ids = {d.dex_number for d in details}
            reset_eligibility(sb, eligible_ids)

        if run_all or items_only:
            items = await scrape_items(client)
            upsert_items(sb, items)

        if run_all or moves_only:
            moves = await scrape_moves(client)
            upsert_moves(sb, moves)

        if run_all or pokemon_only:
            megas = await scrape_mega_abilities(client)
            upsert_mega_abilities(sb, megas)


def main() -> None:
    print("=== Serebii Champions Data Import ===")
    start = time.time()

    pokemon_only = "--pokemon-only" in sys.argv
    items_only = "--items-only" in sys.argv
    moves_only = "--moves-only" in sys.argv

    asyncio.run(async_main(pokemon_only, items_only, moves_only))

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
