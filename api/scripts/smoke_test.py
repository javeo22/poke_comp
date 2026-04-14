"""Smoke test: verify Champions data integrity after ingest.

Checks:
  1. Pokemon roster count matches expected Champions roster
  2. No non-Champions Pokemon in pokemon_usage
  3. All items in pokemon_usage are Champions-legal
  4. All abilities in pokemon_usage belong to Champions-eligible Pokemon
  5. tournament_teams reference only Champions-eligible Pokemon

Usage:
    uv run python -m scripts.smoke_test
"""

import sys

from postgrest.types import CountMethod
from supabase import Client, create_client

from app.config import settings


def _check_roster(sb: Client) -> list[str]:
    """Verify Champions roster count is reasonable (180-250 eligible)."""
    result = (
        sb.table("pokemon")
        .select("id", count=CountMethod.exact)
        .eq("champions_eligible", True)
        .execute()
    )
    count = result.count or 0
    if count < 180:
        return [f"FAIL: Only {count} Champions-eligible Pokemon (expected 180+)"]
    if count > 300:
        return [f"WARN: {count} Champions-eligible Pokemon seems high (expected <300)"]
    print(f"  Roster: {count} Champions-eligible Pokemon")
    return []


def _check_usage_roster(sb: Client) -> list[str]:
    """Verify all pokemon_usage entries reference Champions-eligible Pokemon."""
    # Get all unique Pokemon names from usage
    usage_result = sb.table("pokemon_usage").select("pokemon_name").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]
    usage_names = {row["pokemon_name"] for row in usage_rows}

    # Get Champions roster names
    roster_result = sb.table("pokemon").select("name").eq("champions_eligible", True).execute()
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    roster_names = {row["name"] for row in roster_rows}

    orphans = usage_names - roster_names
    if orphans:
        return [f"FAIL: pokemon_usage has non-Champions Pokemon: {sorted(orphans)[:10]}"]
    print(f"  Usage roster: {len(usage_names)} Pokemon, all Champions-eligible")
    return []


def _check_usage_items(sb: Client) -> list[str]:
    """Verify items in pokemon_usage are Champions-legal."""
    # Get Champions items
    items_result = sb.table("items").select("name").eq("champions_shop_available", True).execute()
    items_rows: list[dict] = items_result.data  # type: ignore[assignment]
    legal_items = {row["name"].lower() for row in items_rows}

    # Get all items from usage data
    usage_result = sb.table("pokemon_usage").select("items").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    illegal: set[str] = set()
    for row in usage_rows:
        items_list: list[dict] = row.get("items") or []
        for item in items_list:
            name = item.get("name", "")
            if name.lower() not in legal_items:
                illegal.add(name)

    if illegal:
        return [f"WARN: pokemon_usage has non-Champions items: {sorted(illegal)[:10]}"]
    print("  Usage items: all Champions-legal")
    return []


def _check_usage_abilities(sb: Client) -> list[str]:
    """Verify abilities in pokemon_usage belong to Champions-eligible Pokemon."""
    # Get all abilities from Champions roster
    roster_result = sb.table("pokemon").select("abilities").eq("champions_eligible", True).execute()
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    legal_abilities: set[str] = set()
    for row in roster_rows:
        for ab in row.get("abilities") or []:
            legal_abilities.add(ab.lower())

    # Get all abilities from usage data
    usage_result = sb.table("pokemon_usage").select("abilities").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    illegal: set[str] = set()
    for row in usage_rows:
        ab_list: list[dict] = row.get("abilities") or []
        for ab in ab_list:
            name = ab.get("name", "")
            if name.lower() not in legal_abilities:
                illegal.add(name)

    if illegal:
        return [f"WARN: pokemon_usage has non-Champions abilities: {sorted(illegal)[:10]}"]
    print("  Usage abilities: all Champions-legal")
    return []


def _check_tournament_teams(sb: Client) -> list[str]:
    """Verify tournament_teams reference only Champions-eligible Pokemon."""
    # Get Champions IDs
    roster_result = sb.table("pokemon").select("id").eq("champions_eligible", True).execute()
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    legal_ids = {row["id"] for row in roster_rows}

    # Get tournament teams
    teams_result = sb.table("tournament_teams").select("pokemon_ids, tournament_name").execute()
    teams_rows: list[dict] = teams_result.data  # type: ignore[assignment]

    issues: list[str] = []
    for row in teams_rows:
        ids: list[int] = row.get("pokemon_ids") or []
        illegal = [pid for pid in ids if pid not in legal_ids]
        if illegal:
            issues.append(f"WARN: {row['tournament_name']} has non-Champions IDs: {illegal}")

    if not issues:
        print(f"  Tournament teams: {len(teams_rows)} teams, all Champions-legal")
    return issues


def run_smoke_test() -> None:
    sb = create_client(settings.supabase_url, settings.supabase_service_key)

    print("=== Champions Data Smoke Test ===\n")
    all_issues: list[str] = []

    checks = [
        ("Roster count", _check_roster),
        ("Usage roster integrity", _check_usage_roster),
        ("Usage item legality", _check_usage_items),
        ("Usage ability legality", _check_usage_abilities),
        ("Tournament team legality", _check_tournament_teams),
    ]

    for name, check_fn in checks:
        print(f"[{name}]")
        issues = check_fn(sb)
        all_issues.extend(issues)
        for issue in issues:
            print(f"  {issue}")
        print()

    if all_issues:
        fails = [i for i in all_issues if i.startswith("FAIL")]
        warns = [i for i in all_issues if i.startswith("WARN")]
        print(f"\n=== RESULT: {len(fails)} failures, {len(warns)} warnings ===")
        if fails:
            sys.exit(1)
    else:
        print("\n=== RESULT: All checks passed ===")


if __name__ == "__main__":
    try:
        run_smoke_test()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
