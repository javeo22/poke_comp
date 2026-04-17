"""Refresh Champions meta data (tier lists) using AI extraction.

DEPRECATED as of 2026-04-16: the only SOURCE was Game8, which was
removed after a ToS audit flagged AI-bot blocks and anti-reverse-
engineering clauses. The AI extraction scaffolding is preserved for
a future compliant source but SOURCES is intentionally empty --
running this script is a no-op until a new source is added.

Usage:
    uv run python -m scripts.refresh_meta

Requires ANTHROPIC_API_KEY in .env when SOURCES is non-empty.
"""

import json
import sys
from datetime import date

import anthropic
import httpx
from supabase import Client, create_client

from app.config import settings

SOURCES: list[dict] = [
    # Game8 removed 2026-04-16: robots.txt blocks AI bots; ToS prohibits
    # reverse engineering + unauthorized commercial use. See
    # LEGAL_AND_DEV_GUIDELINES.md section 1.C for the full audit.
    # Pikalytics provides usage rates via pikalytics_usage.py, not editorial tiers.
]

EXTRACTION_PROMPT = """\
You are a Pokemon Champions competitive data extractor.

Given the HTML content of a tier list page, extract the structured
tier data. Return ONLY valid JSON mapping tier names to arrays of Pokemon names.

Example output:
{{
  "S": ["Pokemon1", "Pokemon2"],
  "A+": ["Pokemon3"],
  "A": ["Pokemon4", "Pokemon5"],
  "B": ["Pokemon6"],
  "C": ["Pokemon7"]
}}

Rules:
- Use the Pokemon's display name (Title Case, e.g. "Garchomp", "Mega Delphox")
- Include all tiers present on the page (S, A+, A, B, C)
- Only include Pokemon explicitly listed in the tier list
- If a tier has no Pokemon, include it as an empty array
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
        response_text: str = block.text if hasattr(block, "text") else ""  # type: ignore[union-attr]
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
    if not SOURCES:
        print(
            "refresh_meta: no active tier-list sources (Game8 removed 2026-04-16)."
            " Nothing to do."
        )
        return

    if not settings.anthropic_api_key:
        print("Error: ANTHROPIC_API_KEY not set in .env")
        sys.exit(1)

    db = create_client(settings.supabase_url, settings.supabase_service_key)
    claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    for source in SOURCES:
        print(f"\nRefreshing from {source['name']}...")
        any_success = False

        for format_key, url in source["urls"].items():
            print(f"  Fetching {format_key} from {url}...")
            html = fetch_page_content(url)
            if not html:
                print(f"    Skipping {format_key} (fetch failed)")
                continue

            print(f"    Fetched {len(html)} chars, extracting with Claude...")
            tier_data = extract_tier_data(claude, html)
            if not tier_data:
                print(f"    Skipping {format_key} (extraction failed)")
                continue

            # Claude returns flat tier data ({"S": [...], "A+": [...], ...}).
            # Wrap it under the format key for update_meta_snapshots.
            wrapped = {format_key: tier_data}
            update_meta_snapshots(db, wrapped, source["name"], url)
            any_success = True
            print(f"    {format_key} updated.")

        if any_success:
            print(f"  {source['name']} refresh complete.")
            break  # Use first successful source

    print("\nMeta refresh complete.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
