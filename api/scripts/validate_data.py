"""Champions data validation agent.

Runs integrity checks against the database and reports issues.
Can optionally quarantine or fix problems.

Checks:
  1. Pokemon roster -- expected Champions roster count
  2. Pokemon form guardrails -- base/regional form data is not mixed together
  3. Item legality -- all pokemon_usage items exist in Champions shop
  4. Move legality -- all pokemon_usage moves exist in the moves table
  5. Ability legality -- all pokemon_usage abilities belong to Champions Pokemon
  6. Source URL verification -- meta_snapshots source_urls are reachable
  7. Cross-source drift -- usage % variance between sources for same Pokemon
  8. Format column integrity -- no invalid format values in pokemon_usage
  9. Meta snapshot names -- tier list names exist in Champions roster

Modes:
  --check   (default) Report issues without modifying data
  --fix     Attempt to fix issues (remove illegal entries, etc.)

Usage:
    uv run python -m scripts.validate_data
    uv run python -m scripts.validate_data --fix
"""

import json
import sys
from dataclasses import dataclass, field
from datetime import date, timedelta
from typing import Any

import httpx
from postgrest.types import CountMethod
from supabase import Client, create_client

from app.config import settings

EXPECTED_ROSTER_MIN = 180
EXPECTED_ROSTER_MAX = 300
VALID_FORMATS = {"doubles", "singles"}
VALID_SOURCES = {"smogon", "pikalytics", "manual"}
DRIFT_THRESHOLD_PCT = 20.0  # Flag if sources differ by more than 20%
REGIONAL_FORM_MARKERS = ("Alola", "Galar", "Hisui", "Paldea")


@dataclass(frozen=True)
class PokemonFormGuardrail:
    name: str
    types: tuple[str, ...]
    base_stats: dict[str, int]
    abilities: tuple[str, ...]


CANONICAL_POKEMON_FORM_GUARDRAILS: dict[int, PokemonFormGuardrail] = {
    26: PokemonFormGuardrail(
        name="Raichu",
        types=("electric",),
        base_stats={
            "hp": 60,
            "attack": 90,
            "defense": 55,
            "sp_attack": 90,
            "sp_defense": 80,
            "speed": 110,
        },
        abilities=("Static", "Lightning Rod"),
    ),
    10100: PokemonFormGuardrail(
        name="Raichu Alola",
        types=("electric", "psychic"),
        base_stats={
            "hp": 60,
            "attack": 85,
            "defense": 50,
            "sp_attack": 95,
            "sp_defense": 85,
            "speed": 110,
        },
        abilities=("Surge Surfer",),
    ),
    59: PokemonFormGuardrail(
        name="Arcanine",
        types=("fire",),
        base_stats={
            "hp": 90,
            "attack": 110,
            "defense": 80,
            "sp_attack": 100,
            "sp_defense": 80,
            "speed": 95,
        },
        abilities=("Intimidate", "Flash Fire", "Justified"),
    ),
    10230: PokemonFormGuardrail(
        name="Arcanine Hisui",
        types=("fire", "rock"),
        base_stats={
            "hp": 95,
            "attack": 115,
            "defense": 80,
            "sp_attack": 95,
            "sp_defense": 80,
            "speed": 90,
        },
        abilities=("Intimidate", "Flash Fire", "Rock Head"),
    ),
    157: PokemonFormGuardrail(
        name="Typhlosion",
        types=("fire",),
        base_stats={
            "hp": 78,
            "attack": 84,
            "defense": 78,
            "sp_attack": 109,
            "sp_defense": 85,
            "speed": 100,
        },
        abilities=("Blaze", "Flash Fire"),
    ),
    10233: PokemonFormGuardrail(
        name="Typhlosion Hisui",
        types=("fire", "ghost"),
        base_stats={
            "hp": 73,
            "attack": 84,
            "defense": 78,
            "sp_attack": 119,
            "sp_defense": 85,
            "speed": 95,
        },
        abilities=("Blaze", "Frisk"),
    ),
    503: PokemonFormGuardrail(
        name="Samurott",
        types=("water",),
        base_stats={
            "hp": 95,
            "attack": 100,
            "defense": 85,
            "sp_attack": 108,
            "sp_defense": 70,
            "speed": 70,
        },
        abilities=("Torrent", "Shell Armor"),
    ),
    10236: PokemonFormGuardrail(
        name="Samurott Hisui",
        types=("water", "dark"),
        base_stats={
            "hp": 90,
            "attack": 108,
            "defense": 80,
            "sp_attack": 100,
            "sp_defense": 65,
            "speed": 85,
        },
        abilities=("Torrent", "Sharpness"),
    ),
    713: PokemonFormGuardrail(
        name="Avalugg",
        types=("ice",),
        base_stats={
            "hp": 95,
            "attack": 117,
            "defense": 184,
            "sp_attack": 44,
            "sp_defense": 46,
            "speed": 28,
        },
        abilities=("Own Tempo", "Ice Body", "Sturdy"),
    ),
    10243: PokemonFormGuardrail(
        name="Avalugg Hisui",
        types=("ice", "rock"),
        base_stats={
            "hp": 95,
            "attack": 127,
            "defense": 184,
            "sp_attack": 34,
            "sp_defense": 36,
            "speed": 38,
        },
        abilities=("Strong Jaw", "Ice Body", "Sturdy"),
    ),
}


# =============================================================================
# Result types
# =============================================================================


@dataclass
class CheckResult:
    name: str
    status: str  # "pass", "warn", "fail", "error"
    message: str
    details: list[str] = field(default_factory=list)
    fixed: int = 0


@dataclass
class ValidationReport:
    checks: list[CheckResult] = field(default_factory=list)
    total_issues: int = 0
    total_fixed: int = 0
    total_errors: int = 0  # checks that crashed (network/db issues, NOT data issues)

    def add(self, result: CheckResult) -> None:
        self.checks.append(result)
        if result.status in ("warn", "fail"):
            self.total_issues += len(result.details) or 1
        if result.status == "error":
            self.total_errors += 1
        self.total_fixed += result.fixed

    def to_dict(self) -> dict:
        return {
            "checked_at": date.today().isoformat(),
            "total_issues": self.total_issues,
            "total_fixed": self.total_fixed,
            "total_errors": self.total_errors,
            "checks": [
                {
                    "name": c.name,
                    "status": c.status,
                    "message": c.message,
                    "details": c.details[:20],  # Cap detail output
                    "fixed": c.fixed,
                }
                for c in self.checks
            ],
        }

    def summary(self) -> str:
        passes = sum(1 for c in self.checks if c.status == "pass")
        warns = sum(1 for c in self.checks if c.status == "warn")
        fails = sum(1 for c in self.checks if c.status == "fail")
        errors = sum(1 for c in self.checks if c.status == "error")
        return (
            f"{passes} pass, {warns} warn, {fails} fail, {errors} error "
            f"({self.total_issues} data issues, {errors} crashed)"
        )


# =============================================================================
# Check 1: Pokemon roster count
# =============================================================================


def check_roster(sb: Client, fix: bool = False) -> CheckResult:
    """Verify Champions roster count is within expected range."""
    result = (
        sb.table("pokemon")
        .select("id", count=CountMethod.exact)
        .eq("champions_eligible", True)
        .execute()
    )
    count = result.count or 0

    if count < EXPECTED_ROSTER_MIN:
        return CheckResult(
            name="pokemon_roster",
            status="fail",
            message=f"Only {count} Champions-eligible Pokemon (expected {EXPECTED_ROSTER_MIN}+)",
        )
    if count > EXPECTED_ROSTER_MAX:
        return CheckResult(
            name="pokemon_roster",
            status="warn",
            message=(
                f"{count} Champions-eligible Pokemon seems high (expected <{EXPECTED_ROSTER_MAX})"
            ),
        )
    return CheckResult(
        name="pokemon_roster",
        status="pass",
        message=f"{count} Champions-eligible Pokemon",
    )


# =============================================================================
# Check 2: Pokemon form guardrails
# =============================================================================


def _normalize_names(value: object) -> list[str]:
    if not isinstance(value, list):
        return []
    return [str(v).strip().lower() for v in value if str(v).strip()]


def _regional_base_name(name: str) -> str | None:
    for marker in REGIONAL_FORM_MARKERS:
        token = f" {marker}"
        if token in name:
            return name.split(token, 1)[0]
    return None


def _canonical_form_guardrail_issues(rows: list[dict[str, Any]]) -> dict[int, list[str]]:
    rows_by_id = {int(row["id"]): row for row in rows if row.get("id") is not None}
    issues_by_id: dict[int, list[str]] = {}

    for pokemon_id, expected in CANONICAL_POKEMON_FORM_GUARDRAILS.items():
        row = rows_by_id.get(pokemon_id)
        if row is None:
            issues_by_id[pokemon_id] = [f"{expected.name} (id {pokemon_id}) is missing"]
            continue

        issues: list[str] = []
        actual_name = str(row.get("name") or "")
        if actual_name != expected.name:
            issues.append(f"{expected.name}: stored as {actual_name!r}")

        actual_types = _normalize_names(row.get("types"))
        expected_types = list(expected.types)
        if actual_types != expected_types:
            issues.append(f"{expected.name}: expected types {expected_types}, found {actual_types}")

        actual_stats = row.get("base_stats") or {}
        if not isinstance(actual_stats, dict):
            issues.append(f"{expected.name}: base_stats is not an object")
        else:
            mismatched_stats = [
                f"{stat}={actual_stats.get(stat)!r} expected {value}"
                for stat, value in expected.base_stats.items()
                if actual_stats.get(stat) != value
            ]
            if mismatched_stats:
                issues.append(f"{expected.name}: stat mismatch ({', '.join(mismatched_stats)})")

        actual_abilities = [str(a) for a in row.get("abilities") or [] if str(a).strip()]
        actual_ability_keys = {a.lower() for a in actual_abilities}
        expected_ability_keys = {a.lower() for a in expected.abilities}
        missing = [a for a in expected.abilities if a.lower() not in actual_ability_keys]
        extra = [a for a in actual_abilities if a.lower() not in expected_ability_keys]
        if missing:
            issues.append(f"{expected.name}: missing abilities {missing}")
        if extra:
            issues.append(f"{expected.name}: unexpected abilities {extra}")

        if issues:
            issues_by_id[pokemon_id] = issues

    return issues_by_id


def _regional_form_separation_issues(
    rows: list[dict[str, Any]], skip_base_ids: set[int] | None = None
) -> list[str]:
    skip_base_ids = skip_base_ids or set()
    rows_by_name = {str(row.get("name")): row for row in rows if row.get("name")}
    issues: list[str] = []

    for regional_row in rows:
        regional_name = str(regional_row.get("name") or "")
        base_name = _regional_base_name(regional_name)
        if not base_name:
            continue

        base_row = rows_by_name.get(base_name)
        if not base_row:
            continue

        base_id = int(base_row.get("id") or 0)
        if base_id in skip_base_ids:
            continue

        base_types = _normalize_names(base_row.get("types"))
        regional_types = _normalize_names(regional_row.get("types"))
        if base_types and regional_types and base_types == regional_types:
            issues.append(
                f"{base_name} shares regional typing with {regional_name}: "
                f"{', '.join(regional_types)}"
            )

    return issues


def check_pokemon_form_guardrails(sb: Client, fix: bool = False) -> CheckResult:
    """Catch base/regional form data contamination.

    The deterministic Raichu guardrail fixes the user-reported corruption where
    base Raichu picked up Alolan Raichu's Psychic typing and Surge Surfer. The
    generic separation check catches the same type of mistake on other regional
    form pairs without relying on network calls during admin data health checks.
    """
    result = (
        sb.table("pokemon")
        .select("id, name, types, base_stats, abilities")
        .eq("champions_eligible", True)
        .execute()
    )
    rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]

    canonical_issues = _canonical_form_guardrail_issues(rows)
    separation_issues = _regional_form_separation_issues(rows, set(canonical_issues))
    present_ids = {int(row["id"]) for row in rows if row.get("id") is not None}

    fixed = 0
    if fix and canonical_issues:
        for pokemon_id in canonical_issues:
            if pokemon_id not in present_ids:
                continue
            expected = CANONICAL_POKEMON_FORM_GUARDRAILS[pokemon_id]
            update_data = {
                "name": expected.name,
                "types": list(expected.types),
                "base_stats": dict(expected.base_stats),
                "abilities": list(expected.abilities),
            }
            try:
                sb.table("pokemon").update(update_data).eq("id", pokemon_id).execute()
                fixed += 1
            except Exception as exc:  # noqa: BLE001 -- surface remediation failure in details
                canonical_issues[pokemon_id].append(
                    f"{expected.name}: fix failed ({type(exc).__name__}: {exc})"
                )

    details = [
        issue for issues in canonical_issues.values() for issue in issues
    ] + separation_issues
    if details:
        return CheckResult(
            name="pokemon_form_guardrails",
            status="fail",
            message=f"{len(details)} Pokemon form data issue(s)",
            details=details,
            fixed=fixed,
        )

    return CheckResult(
        name="pokemon_form_guardrails",
        status="pass",
        message="Base and regional form data are separated",
    )


# =============================================================================
# Check 3: Item legality
# =============================================================================


def check_item_legality(sb: Client, fix: bool = False) -> CheckResult:
    """Verify all items in pokemon_usage are Champions-legal."""
    # Get legal items
    items_result = sb.table("items").select("name").eq("champions_shop_available", True).execute()
    items_rows: list[dict] = items_result.data  # type: ignore[assignment]
    legal_items = {row["name"].lower() for row in items_rows}

    # Get all usage items
    usage_result = sb.table("pokemon_usage").select("id, pokemon_name, items").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    illegal_entries: list[str] = []
    rows_to_fix: list[dict] = []

    for row in usage_rows:
        items_list: list[dict] = row.get("items") or []
        illegal = [i["name"] for i in items_list if i.get("name", "").lower() not in legal_items]
        if illegal:
            illegal_entries.append(f"{row['pokemon_name']}: {', '.join(illegal)}")
            if fix:
                cleaned = [i for i in items_list if i.get("name", "").lower() in legal_items]
                rows_to_fix.append({"id": row["id"], "items": cleaned})

    fixed = 0
    if fix and rows_to_fix:
        for row_fix in rows_to_fix:
            try:
                sb.table("pokemon_usage").update({"items": row_fix["items"]}).eq(
                    "id", row_fix["id"]
                ).execute()
                fixed += 1
            except Exception:
                pass

    if illegal_entries:
        return CheckResult(
            name="item_legality",
            status="warn",
            message=f"{len(illegal_entries)} Pokemon have non-Champions items",
            details=illegal_entries[:20],
            fixed=fixed,
        )
    return CheckResult(
        name="item_legality",
        status="pass",
        message="All usage items are Champions-legal",
    )


# =============================================================================
# Check 4: Move legality
# =============================================================================


def check_move_legality(sb: Client, fix: bool = False) -> CheckResult:
    """Verify all moves in pokemon_usage exist in the moves table.

    Catches non-English moves (Spanish/Korean/French/Italian/Chinese) that
    slipped in from localized Pikalytics pages, plus any stale names.
    """
    # Get all known moves
    moves_result = sb.table("moves").select("name").execute()
    moves_rows: list[dict] = moves_result.data  # type: ignore[assignment]
    known_moves = {row["name"].lower() for row in moves_rows}

    # Get usage moves
    usage_result = sb.table("pokemon_usage").select("id, pokemon_name, moves").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    unknown_entries: list[str] = []
    rows_to_fix: list[dict] = []

    for row in usage_rows:
        moves_list: list[dict] = row.get("moves") or []
        unknown = [
            m["name"]
            for m in moves_list
            if m.get("name", "").lower() not in known_moves and m.get("name")
        ]
        if unknown:
            unknown_entries.append(f"{row['pokemon_name']}: {', '.join(unknown)}")
            if fix:
                cleaned = [m for m in moves_list if m.get("name", "").lower() in known_moves]
                rows_to_fix.append({"id": row["id"], "moves": cleaned})

    fixed = 0
    if fix and rows_to_fix:
        for row_fix in rows_to_fix:
            try:
                sb.table("pokemon_usage").update({"moves": row_fix["moves"]}).eq(
                    "id", row_fix["id"]
                ).execute()
                fixed += 1
            except Exception:
                pass

    if unknown_entries:
        return CheckResult(
            name="move_legality",
            status="warn",
            message=f"{len(unknown_entries)} Pokemon have unknown moves",
            details=unknown_entries[:20],
            fixed=fixed,
        )
    return CheckResult(
        name="move_legality",
        status="pass",
        message="All usage moves exist in moves table",
    )


# =============================================================================
# Check 5: Ability legality
# =============================================================================


def check_ability_legality(sb: Client, fix: bool = False) -> CheckResult:
    """Verify all abilities in pokemon_usage belong to Champions Pokemon."""
    # Get all abilities from Champions roster
    roster_result = sb.table("pokemon").select("abilities").eq("champions_eligible", True).execute()
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    legal_abilities: set[str] = set()
    for row in roster_rows:
        for ab in row.get("abilities") or []:
            legal_abilities.add(ab.lower())

    # Get usage abilities
    usage_result = sb.table("pokemon_usage").select("id, pokemon_name, abilities").execute()
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    illegal_entries: list[str] = []
    rows_to_fix: list[dict] = []

    for row in usage_rows:
        ab_list: list[dict] = row.get("abilities") or []
        illegal = [
            a["name"]
            for a in ab_list
            if a.get("name", "").lower() not in legal_abilities and a.get("name")
        ]
        if illegal:
            illegal_entries.append(f"{row['pokemon_name']}: {', '.join(illegal)}")
            if fix:
                cleaned = [a for a in ab_list if a.get("name", "").lower() in legal_abilities]
                rows_to_fix.append({"id": row["id"], "abilities": cleaned})

    fixed = 0
    if fix and rows_to_fix:
        for row_fix in rows_to_fix:
            try:
                sb.table("pokemon_usage").update({"abilities": row_fix["abilities"]}).eq(
                    "id", row_fix["id"]
                ).execute()
                fixed += 1
            except Exception:
                pass

    if illegal_entries:
        return CheckResult(
            name="ability_legality",
            status="warn",
            message=f"{len(illegal_entries)} Pokemon have non-Champions abilities",
            details=illegal_entries[:20],
            fixed=fixed,
        )
    return CheckResult(
        name="ability_legality",
        status="pass",
        message="All usage abilities are Champions-legal",
    )


# =============================================================================
# Check 6: Source URL verification
# =============================================================================


def check_source_urls(sb: Client, fix: bool = False) -> CheckResult:
    """Verify meta_snapshots source_urls are reachable."""
    result = (
        sb.table("meta_snapshots")
        .select("id, format, source_url")
        .order("snapshot_date", desc=True)
        .limit(10)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]

    unreachable: list[str] = []
    for row in rows:
        url = row.get("source_url")
        if not url:
            continue
        try:
            resp = httpx.head(
                url,
                headers={"User-Agent": "poke_comp_validator/1.0"},
                timeout=10,
                follow_redirects=True,
            )
            if resp.status_code >= 400:
                unreachable.append(f"{row['format']}: {url} (HTTP {resp.status_code})")
        except Exception as e:
            unreachable.append(f"{row['format']}: {url} ({e})")

    if unreachable:
        return CheckResult(
            name="source_urls",
            status="warn",
            message=f"{len(unreachable)} source URLs unreachable",
            details=unreachable,
        )
    return CheckResult(
        name="source_urls",
        status="pass",
        message="All recent source URLs are reachable",
    )


# =============================================================================
# Check 7: Cross-source drift
# =============================================================================


def check_cross_source_drift(sb: Client, fix: bool = False) -> CheckResult:
    """Flag Pokemon where usage % varies significantly between sources."""
    # Get recent usage from all sources
    cutoff = (date.today() - timedelta(days=7)).isoformat()
    result = (
        sb.table("pokemon_usage")
        .select("pokemon_name, usage_percent, source, format")
        .gte("snapshot_date", cutoff)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]

    # Group by (pokemon_name, format)
    groups: dict[tuple[str, str], list[dict]] = {}
    for row in rows:
        key = (row["pokemon_name"], row["format"])
        groups.setdefault(key, []).append(row)

    drift_issues: list[str] = []
    for (name, fmt), entries in groups.items():
        if len(entries) < 2:
            continue
        pcts = [e["usage_percent"] for e in entries]
        max_pct = max(pcts)
        min_pct = min(pcts)
        if max_pct - min_pct > DRIFT_THRESHOLD_PCT:
            sources = ", ".join(f"{e['source']}={e['usage_percent']}%" for e in entries)
            drift_issues.append(f"{name} ({fmt}): {sources}")

    if drift_issues:
        return CheckResult(
            name="cross_source_drift",
            status="warn",
            message=f"{len(drift_issues)} Pokemon have >20% usage drift between sources",
            details=drift_issues[:20],
        )
    return CheckResult(
        name="cross_source_drift",
        status="pass",
        message="No significant cross-source usage drift detected",
    )


# =============================================================================
# Check 8: Format column integrity
# =============================================================================


def check_format_integrity(sb: Client, fix: bool = False) -> CheckResult:
    """Verify all format values in pokemon_usage are valid."""
    result = sb.table("pokemon_usage").select("id, format, pokemon_name").execute()
    rows: list[dict] = result.data  # type: ignore[assignment]

    invalid_entries: list[str] = []
    ids_to_delete: list[int] = []

    for row in rows:
        fmt = row.get("format", "")
        if fmt not in VALID_FORMATS:
            invalid_entries.append(f"ID {row['id']}: {row['pokemon_name']} has format='{fmt}'")
            if fix:
                ids_to_delete.append(row["id"])

    fixed = 0
    if fix and ids_to_delete:
        for row_id in ids_to_delete:
            try:
                sb.table("pokemon_usage").delete().eq("id", row_id).execute()
                fixed += 1
            except Exception:
                pass

    if invalid_entries:
        return CheckResult(
            name="format_integrity",
            status="fail",
            message=f"{len(invalid_entries)} rows have invalid format values",
            details=invalid_entries[:20],
            fixed=fixed,
        )
    return CheckResult(
        name="format_integrity",
        status="pass",
        message="All format values are valid",
    )


# =============================================================================
# Check 9: Meta snapshot roster integrity
# =============================================================================


def check_meta_snapshot_names(sb: Client, fix: bool = False) -> CheckResult:
    """Verify Pokemon names in meta_snapshots tier_data exist in the Champions roster."""
    # Build roster lookup
    roster_result = sb.table("pokemon").select("name").eq("champions_eligible", True).execute()
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    roster_names = {row["name"] for row in roster_rows}
    # Normalize for fuzzy matching
    roster_normalized = {name.lower().replace("-", "").replace(" ", "") for name in roster_names}

    # Get latest snapshot for each format
    recent_snapshots: list[dict] = (
        sb.table("meta_snapshots")
        .select("id, format, snapshot_date, tier_data")
        .order("snapshot_date", desc=True)
        .limit(9)  # 3 formats x 3 recent dates max
        .execute()
        .data  # type: ignore[assignment]
    )

    unmatched: list[str] = []
    seen: set[str] = set()

    for snapshot in recent_snapshots:
        tier_data = snapshot.get("tier_data") or {}
        fmt = snapshot.get("format", "?")
        for _tier, pokemon_list in tier_data.items():
            for name in pokemon_list:
                if name in seen:
                    continue
                seen.add(name)
                # Fuzzy check
                norm = name.lower().replace("-", "").replace(" ", "")
                if name not in roster_names and norm not in roster_normalized:
                    unmatched.append(f"{fmt}: {name!r}")

    if unmatched:
        return CheckResult(
            name="meta_snapshot_names",
            status="warn",
            message=f"{len(unmatched)} tier list names not in Champions roster",
            details=unmatched[:20],
        )
    return CheckResult(
        name="meta_snapshot_names",
        status="pass",
        message="All tier list Pokemon names match the Champions roster",
    )


# =============================================================================
# Runner
# =============================================================================


ALL_CHECKS = [
    ("Pokemon Roster", check_roster),
    ("Pokemon Form Guardrails", check_pokemon_form_guardrails),
    ("Item Legality", check_item_legality),
    ("Move Legality", check_move_legality),
    ("Ability Legality", check_ability_legality),
    ("Source URL Verification", check_source_urls),
    ("Cross-Source Drift", check_cross_source_drift),
    ("Format Column Integrity", check_format_integrity),
    ("Meta Snapshot Names", check_meta_snapshot_names),
]


def _probe_connectivity(sb: Client) -> CheckResult | None:
    """Quick "can we even reach Supabase" probe before running real checks.

    Catches DNS / network / auth issues that would otherwise turn every
    downstream check into an `error` row with the same root cause -- the
    2026-04-17 weekly run logged `[Errno 8] nodename nor servname provided`
    on every check, which is what motivated this probe.

    Returns ``None`` on success, or an ``error``-status CheckResult that
    the caller should add to the report and use as a kill-switch.
    """
    try:
        sb.table("pokemon").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001 -- want any failure surfaced verbatim
        return CheckResult(
            name="connectivity_probe",
            status="error",
            message=(
                f"Cannot reach Supabase: {type(exc).__name__}: {exc}. "
                "Skipping all data checks -- this is a connectivity issue, "
                "not a data issue."
            ),
        )
    return None


def run_validation(sb: Client, fix: bool = False) -> ValidationReport:
    """Run all validation checks and return a report.

    Each check runs in isolation -- a crash in one is captured as an
    ``error`` status (distinct from data-integrity ``fail``), so a single
    network blip can't tank the whole report. ``--fix`` mode refuses to
    run remediations when more than half the checks errored, since a
    half-blind fix is more dangerous than no fix.
    """
    report = ValidationReport()

    probe_failure = _probe_connectivity(sb)
    if probe_failure is not None:
        report.add(probe_failure)
        print(f"[Connectivity Probe]\n  ERROR: {probe_failure.message}\n")
        return report

    error_threshold = (len(ALL_CHECKS) + 1) // 2  # > half => abort fix
    errors_seen = 0

    for name, check_fn in ALL_CHECKS:
        print(f"[{name}]")
        if fix and errors_seen >= error_threshold:
            result = CheckResult(
                name=name.lower().replace(" ", "_"),
                status="error",
                message=(
                    f"Skipped: {errors_seen} earlier checks crashed -- "
                    "refusing to apply --fix on partial data."
                ),
            )
        else:
            try:
                result = check_fn(sb, fix=fix)
            except Exception as exc:  # noqa: BLE001 -- isolation per check
                errors_seen += 1
                result = CheckResult(
                    name=name.lower().replace(" ", "_"),
                    status="error",
                    message=f"Check crashed: {type(exc).__name__}: {exc}",
                )
        report.add(result)

        icon = {
            "pass": "OK",
            "warn": "WARN",
            "fail": "FAIL",
            "error": "ERROR",
        }[result.status]
        print(f"  {icon}: {result.message}")
        for detail in result.details[:5]:
            print(f"    - {detail}")
        if result.fixed:
            print(f"    Fixed: {result.fixed} entries")
        print()

    return report


def main() -> None:
    fix_mode = "--fix" in sys.argv

    print("=== Champions Data Validation Agent ===")
    print(f"Mode: {'FIX' if fix_mode else 'CHECK (read-only)'}")
    print()

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    report = run_validation(sb, fix=fix_mode)

    print(f"=== RESULT: {report.summary()} ===")
    if fix_mode:
        print(f"Fixed: {report.total_fixed} entries")

    # Write JSON report for API consumption
    report_path = "validation_report.json"
    with open(report_path, "w") as f:
        json.dump(report.to_dict(), f, indent=2)
    print(f"\nReport written to {report_path}")

    # Exit with error code if any failures or unrecoverable errors
    if any(c.status in ("fail", "error") for c in report.checks):
        sys.exit(1)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
