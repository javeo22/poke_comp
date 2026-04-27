"""Champions data validation agent.

Runs 7 integrity checks against the database and reports issues.
Can optionally quarantine or fix problems.

Checks:
  1. Pokemon roster -- expected Champions roster count
  2. Item legality -- all pokemon_usage items exist in Champions shop
  3. Move legality -- all pokemon_usage moves exist in the moves table
  4. Ability legality -- all pokemon_usage abilities belong to Champions Pokemon
  5. Source URL verification -- meta_snapshots source_urls are reachable
  6. Cross-source drift -- usage % variance between sources for same Pokemon
  7. Format column integrity -- no invalid format values in pokemon_usage

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

import httpx
from postgrest.types import CountMethod
from supabase import Client, create_client

from app.config import settings

EXPECTED_ROSTER_MIN = 180
EXPECTED_ROSTER_MAX = 300
VALID_FORMATS = {"doubles", "singles"}
VALID_SOURCES = {"smogon", "pikalytics", "manual"}
DRIFT_THRESHOLD_PCT = 20.0  # Flag if sources differ by more than 20%


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
# Check 2: Item legality
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
# Check 3: Move legality
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
# Check 4: Ability legality
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
# Check 5: Source URL verification
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
# Check 6: Cross-source drift
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
# Check 7: Format column integrity
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
# Check 8: Meta snapshot roster integrity
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
    on all 8 checks, which is what motivated this probe.

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
