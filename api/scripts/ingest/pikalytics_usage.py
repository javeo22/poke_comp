"""
Ingest Champions usage stats from Pikalytics.

Scrapes the Pikalytics VGC page for tournament-weighted usage data
including moves, items, abilities, teammates, and spreads.

Validates all ingested data against Champions legality:
  - Only Champions-eligible Pokemon are ingested
  - Items are filtered against the Champions shop
  - Abilities are filtered against Champions Pokemon abilities

Usage:
    uv run python -m scripts.ingest.pikalytics_usage
"""

import re
import sys
import time
from datetime import date

import httpx
from bs4 import BeautifulSoup, Tag
from supabase import Client, create_client

from app.config import settings

PIKALYTICS_BASE = "https://pikalytics.com/pokedex/vgc"
PIKALYTICS_LIST_URL = "https://pikalytics.com/pokedex/vgc"

REQUEST_HEADERS = {
    "User-Agent": "PokemonChampionsCompanion/1.0 (+github.com/javeo22/poke_comp)",
    "Accept": "text/html",
}

# Respectful delay between page fetches
REQUEST_DELAY = 1.5

# Top N Pokemon to scrape individual pages for
TOP_N_POKEMON = 50


# =============================================================================
# HTML helpers
# =============================================================================


def _fetch_page(url: str) -> str | None:
    """Fetch an HTML page with error handling."""
    try:
        resp = httpx.get(url, headers=REQUEST_HEADERS, timeout=30, follow_redirects=True)
        resp.raise_for_status()
        return resp.text
    except httpx.HTTPStatusError as e:
        print(f"  HTTP Error {e.response.status_code}: {url}")
        return None
    except Exception as e:
        print(f"  Network Error: {e}")
        return None


def _parse_percent(text: str) -> float:
    """Extract a percentage from text like '45.2%' or '45.2'."""
    match = re.search(r"([\d.]+)", text.strip())
    if match:
        return float(match.group(1))
    return 0.0


# =============================================================================
# List page parsing
# =============================================================================


def fetch_pokemon_list() -> list[dict[str, str | float]]:
    """Fetch the top Pokemon usage list from Pikalytics.

    Returns a list of dicts with 'name' and 'usage_percent' keys.
    """
    print(f"Fetching Pokemon list from {PIKALYTICS_LIST_URL}...")
    html = _fetch_page(PIKALYTICS_LIST_URL)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    pokemon_list: list[dict[str, str | float]] = []

    # Pikalytics lists Pokemon in rows/cards with name and usage %
    # Try multiple selector patterns
    for row in soup.select(".pokemon-row, .pokedex-pokemon-row, tr.pokemon"):
        name_el = row.select_one(".pokemon-name, .name, td:first-child")
        usage_el = row.select_one(".pokemon-usage, .usage, td:last-child")
        if name_el and usage_el:
            name = name_el.get_text(strip=True)
            usage = _parse_percent(usage_el.get_text(strip=True))
            if name and usage > 0:
                pokemon_list.append({"name": name, "usage_percent": usage})

    # Fallback: look for links with usage data
    if not pokemon_list:
        for link in soup.select("a[href*='/pokedex/']"):
            text = link.get_text(strip=True)
            parent = link.parent
            if parent:
                parent_text = parent.get_text(strip=True)
                usage = _parse_percent(parent_text.replace(text, ""))
                if text and usage > 0:
                    pokemon_list.append({"name": text, "usage_percent": usage})

    print(f"  Found {len(pokemon_list)} Pokemon on list page")
    return pokemon_list[:TOP_N_POKEMON]


# =============================================================================
# Detail page parsing
# =============================================================================


def _parse_entry_list(soup: BeautifulSoup, section_class: str) -> list[dict[str, str | float]]:
    """Parse a section (moves, items, abilities, teammates) from a detail page.

    Returns [{name, percent}, ...] sorted by percent descending.
    """
    entries: list[dict[str, str | float]] = []

    section = soup.find(class_=section_class)
    if not section or not isinstance(section, Tag):
        return entries

    for row in section.select(".pokemon-stat-row, .stat-row, tr, .entry"):
        name_el = row.select_one(".pokemon-stat-name, .stat-name, .name, td:first-child")
        pct_el = row.select_one(".pokemon-stat-percent, .stat-percent, .percent, td:last-child")
        if name_el and pct_el:
            name = name_el.get_text(strip=True)
            pct = _parse_percent(pct_el.get_text(strip=True))
            if name and pct > 0:
                entries.append({"name": name, "percent": pct})

    entries.sort(key=lambda x: x["percent"], reverse=True)  # type: ignore[arg-type]
    return entries


def fetch_pokemon_detail(pokemon_slug: str) -> dict | None:
    """Fetch detailed usage data for a single Pokemon.

    Returns moves, items, abilities, teammates, and spreads.
    """
    url = f"{PIKALYTICS_BASE}/{pokemon_slug}"
    html = _fetch_page(url)
    if not html:
        return None

    soup = BeautifulSoup(html, "html.parser")

    # Try to parse each section with multiple class name patterns
    moves = (
        _parse_entry_list(soup, "moves-pokemon")
        or _parse_entry_list(soup, "pokemon-moves")
        or _parse_entry_list(soup, "moves")
    )
    items = (
        _parse_entry_list(soup, "items-pokemon")
        or _parse_entry_list(soup, "pokemon-items")
        or _parse_entry_list(soup, "items")
    )
    abilities = (
        _parse_entry_list(soup, "abilities-pokemon")
        or _parse_entry_list(soup, "pokemon-abilities")
        or _parse_entry_list(soup, "abilities")
    )
    teammates = (
        _parse_entry_list(soup, "teammates-pokemon")
        or _parse_entry_list(soup, "pokemon-teammates")
        or _parse_entry_list(soup, "teammates")
    )
    spreads = (
        _parse_entry_list(soup, "spreads-pokemon")
        or _parse_entry_list(soup, "pokemon-spreads")
        or _parse_entry_list(soup, "spreads")
    )

    return {
        "moves": moves[:10],
        "items": items[:5],
        "abilities": abilities[:3],
        "teammates": teammates[:6],
        "spreads": spreads[:5],
    }


# =============================================================================
# Legality validation
# =============================================================================


def _build_legality_sets(sb: Client) -> tuple[dict[str, str], set[str], set[str]]:
    """Build lookup structures for Champions legality validation.

    Returns:
        - roster: normalized_name -> display_name mapping
        - legal_items: set of normalized Champions shop item names
        - legal_abilities: set of normalized Champions ability names
    """
    # Champions roster
    result = sb.table("pokemon").select("name, abilities").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]

    roster: dict[str, str] = {}
    legal_abilities: set[str] = set()
    for row in rows:
        name = row["name"]
        roster[name.lower().replace("-", "").replace(" ", "")] = name
        roster[name.lower()] = name
        for ab in row.get("abilities") or []:
            legal_abilities.add(ab.lower().replace("-", "").replace(" ", ""))

    # Champions items
    items_result = sb.table("items").select("name").eq("champions_shop_available", True).execute()
    items_rows: list[dict] = items_result.data  # type: ignore[assignment]
    legal_items = {row["name"].lower().replace("-", "").replace(" ", "") for row in items_rows}

    return roster, legal_items, legal_abilities


def _filter_entries(
    entries: list[dict[str, str | float]],
    legal_set: set[str],
) -> list[dict[str, str | float]]:
    """Filter entries against a legality set, keeping only legal ones."""
    return [
        e
        for e in entries
        if e["name"].lower().replace("-", "").replace(" ", "") in legal_set  # type: ignore[union-attr]
    ]


# =============================================================================
# Core ingest
# =============================================================================


def _pokemon_slug(name: str) -> str:
    """Convert a Pokemon name to a URL slug for Pikalytics."""
    return name.lower().replace(" ", "-").replace("'", "").replace(".", "")


def _auto_mark_used_items(sb: Client, seen_item_names: set[str]) -> None:
    """Mark items found in tournament usage data as champions_shop_available.

    If Pikalytics shows an item being used competitively, it should be
    selectable in the roster builder. This auto-marks matching items in
    the items table so they appear in the Champions item dropdown.
    """
    if not seen_item_names:
        return

    print(f"\nAuto-marking {len(seen_item_names)} items seen in usage data...")
    marked = 0
    for item_name in seen_item_names:
        result = (
            sb.table("items")
            .select("id, champions_shop_available")
            .ilike("name", item_name)
            .execute()
        )
        rows: list[dict] = result.data  # type: ignore[assignment]
        if rows and not rows[0].get("champions_shop_available"):
            sb.table("items").update({"champions_shop_available": True}).eq(
                "id", rows[0]["id"]
            ).execute()
            marked += 1
            print(f"  Marked '{item_name}' as champions_shop_available")

    print(f"  Auto-marked {marked} items.")


def ingest_pikalytics(sb: Client) -> None:
    """Scrape Pikalytics VGC usage data and upsert into pokemon_usage.

    Only ingests Champions-eligible Pokemon. Items and abilities are
    validated against Champions legality.
    """
    roster, legal_items, legal_abilities = _build_legality_sets(sb)
    print(
        f"Legality: {len(roster)} Pokemon, "
        f"{len(legal_items)} items, {len(legal_abilities)} abilities"
    )

    # Step 1: Get top Pokemon list
    pokemon_list = fetch_pokemon_list()
    if not pokemon_list:
        print("Failed to fetch Pokemon list. Aborting.")
        return

    today_date = date.today().isoformat()
    upsert_batch: list[dict] = []
    scraped = 0
    # Track all item names seen in Pikalytics (before legality filter)
    all_seen_items: set[str] = set()

    for entry in pokemon_list:
        raw_name = str(entry["name"])
        usage_pct = float(entry["usage_percent"])

        # Check Champions eligibility
        clean = raw_name.lower().replace("-", "").replace(" ", "")
        display_name = roster.get(clean) or roster.get(raw_name.lower())
        if not display_name:
            print(f"  Skipping {raw_name}: not Champions-eligible")
            continue

        # Step 2: Fetch detail page
        slug = _pokemon_slug(raw_name)
        detail = fetch_pokemon_detail(slug)

        if detail:
            moves = detail["moves"]
            # Collect all raw item names before filtering
            for item_entry in detail["items"]:
                item_name = str(item_entry.get("name", ""))
                if item_name:
                    all_seen_items.add(item_name)
            items = _filter_entries(detail["items"], legal_items)
            abilities = _filter_entries(detail["abilities"], legal_abilities)
            teammates = detail["teammates"]
            spreads = detail["spreads"]
        else:
            print(f"  Warning: no detail for {display_name}, using list data only")
            moves = []
            items = []
            abilities = []
            teammates = []
            spreads = []

        record = {
            "pokemon_name": display_name,
            "format": "doubles",
            "snapshot_date": today_date,
            "usage_percent": round(usage_pct, 2),
            "moves": moves,
            "items": items,
            "abilities": abilities,
            "teammates": teammates,
            "spreads": spreads,
            "source": "pikalytics",
        }
        upsert_batch.append(record)
        scraped += 1
        print(
            f"  [{scraped}/{len(pokemon_list)}] {display_name}: {usage_pct}% "
            f"({len(moves)} moves, {len(items)} items)"
        )

        time.sleep(REQUEST_DELAY)

    # Step 3: Upsert to database
    print(f"\nUpserting {len(upsert_batch)} records...")
    batch_size = 50
    for i in range(0, len(upsert_batch), batch_size):
        chunk = upsert_batch[i : i + batch_size]
        try:
            sb.table("pokemon_usage").upsert(
                chunk, on_conflict="pokemon_name,format,snapshot_date"
            ).execute()
        except Exception as e:
            print(f"  Warning: upsert chunk failed: {e}")

    # Step 4: Auto-mark items seen in tournament data as available
    _auto_mark_used_items(sb, all_seen_items)

    print(f"Pikalytics ingest complete: {scraped} Pokemon.")


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    ingest_pikalytics(db)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
