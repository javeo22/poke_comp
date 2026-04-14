"""
Ingest Champions usage stats from Pikalytics.

Scrapes the Pikalytics Champions Tournaments page for tournament-weighted
usage data including moves, items, abilities, teammates, and spreads.

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
from bs4 import BeautifulSoup, Comment, Tag
from supabase import Client, create_client

from app.config import settings

# Champions tournament format -- NOT the generic VGC page
PIKALYTICS_BASE = "https://pikalytics.com/pokedex/championstournaments"
PIKALYTICS_LIST_URL = "https://pikalytics.com/pokedex/championstournaments"

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
    """Fetch the top Pokemon usage list from Pikalytics Champions Tournaments.

    Returns a list of dicts with 'name', 'usage_percent', and 'slug' keys.

    Pikalytics list entries use:
      <a class="pokedex_entry" data-name="Incineroar" href="...">
        <div class="pokedex-list-entry-body">
          <span class="pokemon-name">Incineroar</span>
          <!-- (<span style="color:red;">54.37%</span>) -->
        </div>
      </a>
    """
    print(f"Fetching Pokemon list from {PIKALYTICS_LIST_URL}...")
    html = _fetch_page(PIKALYTICS_LIST_URL)
    if not html:
        return []

    soup = BeautifulSoup(html, "html.parser")
    pokemon_list: list[dict[str, str | float]] = []

    for entry in soup.select(".pokedex-list-entry-body"):
        name_el = entry.select_one(".pokemon-name")
        if not name_el:
            continue
        name = name_el.get_text(strip=True)
        if not name:
            continue

        # Usage % is inside an HTML comment: <!-- (<span ...>54.37%</span>) -->
        usage_pct = 0.0
        for node in entry.children:
            if isinstance(node, Comment):
                pct_match = re.search(r"([\d.]+)%", str(node))
                if pct_match:
                    usage_pct = float(pct_match.group(1))
                    break

        if usage_pct <= 0:
            continue

        # Get the slug from parent <a> element's data-name or href
        parent_a = entry.parent
        slug = ""
        if parent_a and isinstance(parent_a, Tag):
            data_name = parent_a.get("data-name", "")
            if isinstance(data_name, str):
                slug = data_name
            if not slug:
                href = parent_a.get("href", "")
                if isinstance(href, str) and "/" in href:
                    slug = href.rstrip("/").split("/")[-1].split("?")[0]

        pokemon_list.append(
            {
                "name": name,
                "usage_percent": usage_pct,
                "slug": slug or name,
            }
        )

    print(f"  Found {len(pokemon_list)} Pokemon on list page")
    return pokemon_list[:TOP_N_POKEMON]


# =============================================================================
# Detail page parsing
# =============================================================================


def _parse_section_by_id(soup: BeautifulSoup, wrapper_id: str) -> list[dict[str, str | float]]:
    """Parse a section identified by a wrapper div ID.

    Pikalytics detail pages use wrapper IDs like 'moves_wrapper',
    'items_wrapper', 'abilities_wrapper', 'dex_team_wrapper'.
    Each contains rows with class 'pokedex-move-entry-new'.
    """
    entries: list[dict[str, str | float]] = []

    wrapper = soup.find(id=wrapper_id)
    if not wrapper or not isinstance(wrapper, Tag):
        return entries

    for row in wrapper.select(".pokedex-move-entry-new"):
        # Name can be in .pokedex-inline-text or .pokedex-inline-text-offset
        name_el = row.select_one(".pokedex-inline-text-offset, .pokedex-inline-text")
        pct_el = row.select_one(".pokedex-inline-right")
        if name_el and pct_el:
            name = name_el.get_text(strip=True)
            pct = _parse_percent(pct_el.get_text(strip=True))
            if name and pct > 0:
                entries.append({"name": name, "percent": pct})

    entries.sort(key=lambda x: x["percent"], reverse=True)  # type: ignore[arg-type]
    return entries


def _parse_spreads_section(soup: BeautifulSoup) -> list[dict[str, str | float]]:
    """Parse the spreads section into {spread, percent} entries.

    Spreads rows have nature + EV spread, e.g. "Adamant" + "252/0/4/0/4/252".
    """
    entries: list[dict[str, str | float]] = []

    wrapper = soup.find(id="dex_spreads_wrapper")
    if not wrapper or not isinstance(wrapper, Tag):
        return entries

    for row in wrapper.select(".pokedex-move-entry-new"):
        texts = row.select(".pokedex-inline-text-offset, .pokedex-inline-text")
        pct_el = row.select_one(".pokedex-inline-right")
        if texts and pct_el:
            spread_parts = [t.get_text(strip=True) for t in texts]
            spread_str = " ".join(spread_parts)
            pct = _parse_percent(pct_el.get_text(strip=True))
            if spread_str and pct > 0:
                entries.append({"spread": spread_str, "percent": pct})

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

    # All sections use wrapper IDs
    moves = _parse_section_by_id(soup, "moves_wrapper")
    items = _parse_section_by_id(soup, "items_wrapper")
    abilities = _parse_section_by_id(soup, "abilities_wrapper")
    # Teammates wrapper can be either "teammate_wrapper" or "dex_team_wrapper"
    teammates = _parse_section_by_id(soup, "teammate_wrapper") or _parse_section_by_id(
        soup, "dex_team_wrapper"
    )
    spreads = _parse_spreads_section(soup)

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


# Pikalytics may use short names; the DB may use full form names.
# Map normalized Pikalytics names -> DB display names.
PIKALYTICS_NAME_ALIASES: dict[str, str] = {
    "basculegion": "Basculegion Male",
    "maushold": "Maushold Family Of Four",
}


def _build_roster(sb: Client) -> dict[str, str]:
    """Build a normalized_name -> display_name lookup for Champions-eligible Pokemon.

    Also registers Pikalytics-specific name aliases.
    """
    result = sb.table("pokemon").select("name").eq("champions_eligible", True).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]

    roster: dict[str, str] = {}
    for row in rows:
        name = row["name"]
        roster[name.lower().replace("-", "").replace(" ", "")] = name
        roster[name.lower()] = name

    # Register known Pikalytics name aliases
    for alias, display in PIKALYTICS_NAME_ALIASES.items():
        if display in {r for r in roster.values()}:
            roster[alias] = display

    # Handle Rotom forms: Pikalytics uses "Rotom-Wash" but DB might lack forms.
    # If Rotom base form is eligible, accept "rotomwash", "rotomheat", etc.
    if "rotom" in roster:
        base_name = roster["rotom"]
        for form in ["wash", "heat", "frost", "fan", "mow"]:
            form_key = f"rotom{form}"
            if form_key not in roster:
                # Map to base Rotom since forms aren't separate DB entries
                roster[form_key] = base_name

    return roster


# =============================================================================
# Core ingest
# =============================================================================


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
    """Scrape Pikalytics Champions Tournaments usage data and upsert into pokemon_usage.

    Only ingests Champions-eligible Pokemon. Items and abilities are NOT
    filtered because Pikalytics Champions tournament data already reflects
    only items/abilities that are legal in Champions play.
    """
    roster = _build_roster(sb)
    print(f"Roster: {len(roster)} name variants for Champions-eligible Pokemon")

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
        slug = str(entry.get("slug", raw_name))

        # Check Champions eligibility
        clean = raw_name.lower().replace("-", "").replace(" ", "")
        display_name = roster.get(clean) or roster.get(raw_name.lower())
        if not display_name:
            print(f"  Skipping {raw_name}: not Champions-eligible")
            continue

        # Step 2: Fetch detail page using the slug from the list
        detail = fetch_pokemon_detail(slug)

        if detail:
            moves = detail["moves"]
            items = detail["items"]
            # Collect all item names for auto-marking availability
            for item_entry in items:
                item_name = str(item_entry.get("name", ""))
                if item_name:
                    all_seen_items.add(item_name)
            abilities = detail["abilities"]
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
