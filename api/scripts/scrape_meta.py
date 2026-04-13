"""Scrape Game8 tier lists and store structured meta snapshots.

Usage:
    uv run python -m scripts.scrape_meta

Fetches the latest Game8 tier list pages for singles, doubles, and megas.
Uses Claude API to parse the HTML into structured tier data (S/A+/A/B/C).
Upserts into meta_snapshots table (unique on snapshot_date + format).
"""

import json
import sys
import time
from datetime import date

import anthropic
import httpx
from bs4 import BeautifulSoup
from supabase import Client, create_client

from app.config import settings

GAME8_URLS: dict[str, str] = {
    "singles": "https://game8.co/games/Pokemon-Champions/archives/592465",
    "doubles": "https://game8.co/games/Pokemon-Champions/archives/593883",
    "megas": "https://game8.co/games/Pokemon-Champions/archives/593897",
}

HEADERS = {
    "User-Agent": "PokemonChampionsCompanion/0.1 (personal-tool; +github.com/javeo22/poke_comp)",
    "Accept": "text/html",
}

# Expected tiers from Game8
VALID_TIERS = {"S", "A+", "A", "B", "C"}


def create_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_service_key)


def create_anthropic_client() -> anthropic.Anthropic:
    if not settings.anthropic_api_key:
        print("ERROR: ANTHROPIC_API_KEY is not set in .env")
        sys.exit(1)
    return anthropic.Anthropic(api_key=settings.anthropic_api_key)


def fetch_page(url: str) -> str:
    """Fetch a Game8 tier list page and return cleaned text content."""
    print(f"  Fetching {url}")
    resp = httpx.get(url, headers=HEADERS, timeout=30, follow_redirects=True)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove scripts, styles, nav, footer to reduce noise
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    # Extract the main article content
    article = soup.find("article") or soup.find("div", class_="archive-style-wrapper")
    if article:
        text = article.get_text(separator="\n", strip=True)
    else:
        text = soup.get_text(separator="\n", strip=True)

    # Trim to reasonable size for the API (keep first ~8000 chars of content)
    return text[:8000]


def parse_tier_list(client: anthropic.Anthropic, page_text: str, format_name: str) -> dict:
    """Use Claude to extract structured tier data from page text."""
    print(f"  Parsing {format_name} tier list with Claude API...")

    prompt = f"""Extract the Pokemon tier list from this Game8 page for {format_name}.

Return ONLY a JSON object mapping tier names to arrays of Pokemon names.
Use these exact tier keys: "S", "A+", "A", "B", "C"
Use Title Case for Pokemon names (e.g. "Garchomp", "Wash Rotom", "Mega Gengar").
If a tier has no Pokemon, include it as an empty array.
Do not include any explanation, just the JSON.

Page content:
{page_text}"""

    message = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    block = message.content[0]
    if block.type != "text":
        raise ValueError(f"Unexpected response block type: {block.type}")
    response_text = block.text.strip()

    # Strip markdown code fences if present
    if response_text.startswith("```"):
        lines = response_text.split("\n")
        response_text = "\n".join(lines[1:-1])

    tier_data = json.loads(response_text)

    # Validate structure
    for tier in VALID_TIERS:
        if tier not in tier_data:
            tier_data[tier] = []
        if not isinstance(tier_data[tier], list):
            tier_data[tier] = []

    # Remove any unexpected keys
    tier_data = {k: v for k, v in tier_data.items() if k in VALID_TIERS}

    total = sum(len(v) for v in tier_data.values())
    print(f"  Extracted {total} Pokemon across {len([t for t in tier_data.values() if t])} tiers")

    return tier_data


def upsert_snapshot(
    sb: Client, format_name: str, tier_data: dict, source_url: str
) -> None:
    """Upsert a meta snapshot for today's date and format."""
    today = date.today().isoformat()

    data = {
        "snapshot_date": today,
        "format": format_name,
        "tier_data": tier_data,
        "source_url": source_url,
        "source": "game8",
    }

    sb.table("meta_snapshots").upsert(
        data, on_conflict="snapshot_date,format"
    ).execute()

    print(f"  Upserted {format_name} snapshot for {today}")


def main() -> None:
    print("=== Pokemon Champions Meta Scraper ===\n")
    start = time.time()

    sb = create_supabase_client()
    ai = create_anthropic_client()

    for format_name, url in GAME8_URLS.items():
        print(f"\n[{format_name.upper()}]")
        try:
            page_text = fetch_page(url)
            tier_data = parse_tier_list(ai, page_text, format_name)
            upsert_snapshot(sb, format_name, tier_data, url)
        except httpx.HTTPStatusError as e:
            print(f"  ERROR: HTTP {e.response.status_code} fetching {url}")
            continue
        except json.JSONDecodeError as e:
            print(f"  ERROR: Failed to parse Claude response as JSON: {e}")
            continue
        except anthropic.APIError as e:
            print(f"  ERROR: Claude API error: {e}")
            continue

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
