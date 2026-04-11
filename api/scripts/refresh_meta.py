"""Refresh Champions meta data (tier lists, usage stats) using AI extraction.

Usage:
    uv run python -m scripts.refresh_meta

Fetches current tier list pages, sends content to Claude API for structured
extraction, and updates meta_snapshots in Supabase. Designed to run daily
via cron, scheduled task, or Claude Code /schedule.

Requires ANTHROPIC_API_KEY in .env.
"""

import json
import sys
from datetime import date

import anthropic
import httpx
from supabase import Client, create_client

from app.config import settings

SOURCES = [
    {
        "name": "Game8",
        "urls": {
            "singles": "https://game8.co/games/Pokemon-Champions/archives/592465",
            "doubles": "https://game8.co/games/Pokemon-Champions/archives/592465",
            "megas": "https://game8.co/games/Pokemon-Champions/archives/592465",
        },
    },
    {
        "name": "Pikalytics",
        "urls": {
            "singles": "https://www.pikalytics.com/champions",
            "doubles": "https://www.pikalytics.com/champions",
        },
    },
]

EXTRACTION_PROMPT = """\
You are a Pokemon Champions competitive data extractor.

Given the HTML content of a tier list or usage stats page, extract structured
tier data. Return ONLY valid JSON with this exact structure:

{
  "singles": {
    "S": ["Pokemon1", "Pokemon2"],
    "A+": ["Pokemon3"],
    "A": ["Pokemon4", "Pokemon5"],
    "B": ["Pokemon6"],
    "C": ["Pokemon7"]
  },
  "doubles": {
    "S": ["Pokemon1"],
    "A+": ["Pokemon2"],
    "A": ["Pokemon3"],
    "B": ["Pokemon4"]
  },
  "megas": {
    "S": ["Mega Pokemon1"],
    "A+": ["Mega Pokemon2"],
    "A": ["Mega Pokemon3"],
    "B": ["Mega Pokemon4"]
  }
}

Rules:
- Use the Pokemon's display name (Title Case, e.g. "Garchomp", "Mega Delphox")
- Include all tiers present on the page
- If a format is not present in the content, omit that key
- Only include Pokemon explicitly listed in the tier list
- Return ONLY the JSON, no markdown fences or explanation
"""


def fetch_page_content(url: str) -> str | None:
    """Fetch a web page and return its text content."""
    try:
        resp = httpx.get(
            url,
            timeout=30,
            headers={"User-Agent": "PokemonChampionsCompanion/1.0"},
            follow_redirects=True,
        )
        resp.raise_for_status()
        return resp.text
    except Exception as e:
        print(f"  Failed to fetch {url}: {e}")
        return None


def extract_tier_data(client: anthropic.Anthropic, html_content: str) -> dict | None:
    """Use Claude API to extract structured tier data from HTML."""
    # Truncate to avoid token limits (keep first 100k chars)
    content = html_content[:100_000]

    try:
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=4096,
            messages=[
                {
                    "role": "user",
                    "content": f"{EXTRACTION_PROMPT}\n\n---\n\nHTML CONTENT:\n{content}",
                }
            ],
        )
        block = message.content[0]
        response_text = block.text if hasattr(block, "text") else ""
        return json.loads(response_text)
    except json.JSONDecodeError:
        print("  Warning: Claude response was not valid JSON")
        return None
    except Exception as e:
        print(f"  Claude API error: {e}")
        return None


def update_meta_snapshots(
    supabase: Client, tier_data: dict, source_name: str, source_url: str
) -> None:
    """Upsert tier data into meta_snapshots table."""
    today = date.today().isoformat()

    for format_key, tiers in tier_data.items():
        supabase.table("meta_snapshots").upsert(
            {
                "snapshot_date": today,
                "format": format_key,
                "tier_data": tiers,
                "source_url": source_url,
                "source": source_name,
            },
            on_conflict="snapshot_date,format",
        ).execute()
        print(f"  Updated {format_key} snapshot for {today}")


def main() -> None:
    if not settings.anthropic_api_key:
        print("Error: ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)

    db = create_client(settings.supabase_url, settings.supabase_service_key)
    claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    for source in SOURCES:
        print(f"\nRefreshing from {source['name']}...")

        # Fetch from first available URL
        first_url = next(iter(source["urls"].values()))
        html = fetch_page_content(first_url)
        if not html:
            print(f"  Skipping {source['name']} (fetch failed)")
            continue

        print(f"  Fetched {len(html)} chars, extracting with Claude...")
        tier_data = extract_tier_data(claude, html)
        if not tier_data:
            print(f"  Skipping {source['name']} (extraction failed)")
            continue

        update_meta_snapshots(db, tier_data, source["name"], first_url)
        print(f"  {source['name']} refresh complete.")
        break  # Use first successful source

    print("\nMeta refresh complete.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
