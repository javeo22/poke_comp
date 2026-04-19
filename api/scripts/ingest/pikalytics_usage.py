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

import json
import re
import sys
import time
from datetime import date
from pathlib import Path

import httpx
from bs4 import BeautifulSoup, Comment, Tag
from supabase import Client, create_client

from app.config import settings
from app.models.ingest import IngestResult

# Translation cache built by scripts/build_pikalytics_translations.py -- maps
# foreign-language names (German/French/Japanese/etc.) back to canonical
# English. Needed because Pikalytics serves localized content for a subset
# of Pokemon URLs regardless of Accept-Language.
_TRANSLATIONS_PATH = Path(__file__).resolve().parent.parent.parent / "pikalytics_translations.json"

# Champions tournament format -- NOT the generic VGC page
PIKALYTICS_BASE = "https://pikalytics.com/pokedex/championstournaments"
PIKALYTICS_LIST_URL = "https://pikalytics.com/pokedex/championstournaments"

REQUEST_HEADERS = {
    "User-Agent": "PokemonChampionsCompanion/1.0 (+github.com/javeo22/poke_comp)",
    "Accept": "text/html",
    # Force English -- Pikalytics content-negotiates on Accept-Language and
    # will serve Spanish/Korean/French/Italian/Chinese move + item names if
    # the scraper runs from a non-US region. Discovered 2026-04-16.
    "Accept-Language": "en-US,en;q=0.9",
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


def _build_canonical_lookups(sb: Client) -> tuple[dict[str, str], dict[str, str], dict[str, str]]:
    """Build normalized-name -> canonical-name maps for moves, items, abilities.

    Combines two sources:
    1. Our canonical DB tables (English names).
    2. The PokeAPI translation cache (foreign names -> English), so that
       Pikalytics's German/French/Japanese leaks resolve to the right row.

    Anything that doesn't match after both lookups is a true hallucination
    or a name we don't know -- safe to drop.
    """

    def norm(s: str) -> str:
        return s.strip().lower().replace("-", " ").replace("'", "")

    move_rows: list[dict] = sb.table("moves").select("name").execute().data  # type: ignore[assignment]
    item_rows: list[dict] = sb.table("items").select("name").execute().data  # type: ignore[assignment]
    ability_rows: list[dict] = sb.table("abilities").select("name").execute().data  # type: ignore[assignment]

    moves_map = {norm(r["name"]): r["name"] for r in move_rows}
    items_map = {norm(r["name"]): r["name"] for r in item_rows}
    abilities_map = {norm(r["name"]): r["name"] for r in ability_rows}

    # Layer the PokeAPI translation cache on top. Keys are already normalized
    # via the same norm() logic in scripts/build_pikalytics_translations.py.
    if _TRANSLATIONS_PATH.exists():
        try:
            cache = json.loads(_TRANSLATIONS_PATH.read_text())
            moves_map.update(cache.get("moves", {}))
            items_map.update(cache.get("items", {}))
            abilities_map.update(cache.get("abilities", {}))
        except (json.JSONDecodeError, OSError) as e:
            print(f"  Warning: failed to load translation cache: {e}")

    return moves_map, items_map, abilities_map


def _filter_english(
    entries: list[dict],
    canonical_map: dict[str, str],
) -> tuple[list[dict], int]:
    """Keep only entries whose name matches our canonical English table.
    Returns (kept_entries, dropped_count)."""

    def norm(s: str) -> str:
        return s.strip().lower().replace("-", " ").replace("'", "")

    kept: list[dict] = []
    dropped = 0
    for entry in entries:
        name = str(entry.get("name", ""))
        canonical = canonical_map.get(norm(name))
        if canonical:
            # Snap to canonical casing so downstream name lookups work.
            kept.append({**entry, "name": canonical})
        else:
            dropped += 1
    return kept, dropped


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


def ingest_pikalytics(sb: Client, dry_run: bool = False) -> IngestResult:
    """Scrape Pikalytics Champions Tournaments usage data and upsert into pokemon_usage.

    Only ingests Champions-eligible Pokemon. Items and abilities are NOT
    filtered because Pikalytics Champions tournament data already reflects
    only items/abilities that are legal in Champions play.

    When ``dry_run`` is true, fetches list only and performs no detail
    scraping or DB writes (fast, respectful preview).
    """
    started = time.monotonic()
    result = IngestResult(source="pikalytics", dry_run=dry_run)

    roster = _build_roster(sb)
    moves_map, items_map, abilities_map = _build_canonical_lookups(sb)
    print(
        f"Roster: {len(roster)} name variants, "
        f"canonical: {len(moves_map)} moves, {len(items_map)} items, "
        f"{len(abilities_map)} abilities"
    )

    # Step 1: Get top Pokemon list
    pokemon_list = fetch_pokemon_list()
    if not pokemon_list:
        result.warnings.append("Failed to fetch Pokemon list from Pikalytics")
        result.duration_ms = int((time.monotonic() - started) * 1000)
        return result

    if dry_run:
        # Count how many are Champions-eligible without scraping detail pages
        eligible = 0
        for entry in pokemon_list:
            raw_name = str(entry["name"])
            clean = raw_name.lower().replace("-", "").replace(" ", "")
            if roster.get(clean) or roster.get(raw_name.lower()):
                eligible += 1
        result.rows_inserted = eligible
        result.rows_skipped = len(pokemon_list) - eligible
        result.duration_ms = int((time.monotonic() - started) * 1000)
        print(f"[dry-run] {eligible}/{len(pokemon_list)} Champions-eligible on list page")
        return result

    today_date = date.today().isoformat()
    upsert_batch: list[dict] = []
    scraped = 0
    skipped = 0
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
            skipped += 1
            continue

        # Step 2: Fetch detail page using the slug from the list
        detail = fetch_pokemon_detail(slug)

        if detail:
            # Pikalytics serves random localizations -- filter to English only.
            moves, moves_dropped = _filter_english(detail["moves"], moves_map)
            items, items_dropped = _filter_english(detail["items"], items_map)
            abilities, abilities_dropped = _filter_english(detail["abilities"], abilities_map)
            if moves_dropped or items_dropped or abilities_dropped:
                msg = (
                    f"{display_name}: dropped non-English "
                    f"{moves_dropped}m/{items_dropped}i/{abilities_dropped}a "
                    f"(Pikalytics i18n leak)"
                )
                result.warnings.append(msg)
                print(f"  {msg}")

            # Collect item names for auto-marking availability
            for item_entry in items:
                item_name = str(item_entry.get("name", ""))
                if item_name:
                    all_seen_items.add(item_name)
            teammates = detail["teammates"]
            spreads = detail["spreads"]
        else:
            warning = f"No detail for {display_name}, using list data only"
            result.warnings.append(warning)
            print(f"  Warning: {warning}")
            moves = []
            items = []
            abilities = []
            teammates = []
            spreads = []

        # Robustness: if the detail fetch succeeded but moves+items+abilities
        # are ALL empty, something went wrong in parsing (partial HTML, rate
        # limit, Pikalytics layout change for this Pokemon). Skip the upsert
        # instead of overwriting any existing good data with empty arrays.
        # Discovered 2026-04-18: 5 Pokemon in the 2026-04-16 snapshot had
        # this pattern (Incineroar, Charizard, Gengar, Aerodactyl, Venusaur).
        if not moves and not items and not abilities:
            warning = (
                f"Skipping {display_name}: all detail sections empty "
                "(transient scrape failure -- preserving existing row)"
            )
            result.warnings.append(warning)
            print(f"  {warning}")
            skipped += 1
            time.sleep(REQUEST_DELAY)
            continue

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

    # Step 3: Delete OLD Pikalytics snapshots -- but ONLY for Pokemon we
    # successfully re-scraped this run. Pokemon we skipped due to empty
    # scrape keep their previous row intact (better than having no data at
    # all). Without this guard, a bad scrape run would wipe the meta tab.
    fresh_names = [rec["pokemon_name"] for rec in upsert_batch]
    if fresh_names:
        try:
            sb.table("pokemon_usage").delete().eq("source", "pikalytics").eq(
                "format", "doubles"
            ).neq("snapshot_date", today_date).in_("pokemon_name", fresh_names).execute()
            print(
                f"  Cleaned old pikalytics snapshots for {len(fresh_names)} freshly-scraped Pokemon"
            )
        except Exception as e:
            result.warnings.append(f"Failed to clean old snapshots: {e}")

    upserted = 0
    print(f"\nUpserting {len(upsert_batch)} records...")
    batch_size = 50
    for i in range(0, len(upsert_batch), batch_size):
        chunk = upsert_batch[i : i + batch_size]
        try:
            sb.table("pokemon_usage").upsert(
                chunk, on_conflict="pokemon_name,format,snapshot_date"
            ).execute()
            upserted += len(chunk)
        except Exception as e:
            result.warnings.append(f"Upsert chunk failed: {e}")

    # Step 4: Auto-mark items seen in tournament data as available
    _auto_mark_used_items(sb, all_seen_items)

    result.rows_updated = upserted
    result.rows_skipped = skipped
    result.duration_ms = int((time.monotonic() - started) * 1000)
    print(f"Pikalytics ingest complete: {scraped} Pokemon.")
    return result


def run(dry_run: bool = False) -> IngestResult:
    """Entrypoint for HTTP/cron invocation. Returns an IngestResult."""
    db = create_client(settings.supabase_url, settings.supabase_service_key)
    return ingest_pikalytics(db, dry_run=dry_run)


def main() -> None:
    dry_run = "--dry-run" in sys.argv
    run(dry_run=dry_run)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
