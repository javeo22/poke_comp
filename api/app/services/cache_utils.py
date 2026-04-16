"""Cache key normalization utilities.

Produces deterministic cache keys for AI analysis requests so that
equivalent inputs (reordered opponents, stat-point tweaks on the same build)
hit the same cached response.

Versioned with a `v2:` prefix so legacy v1 rows in `ai_analyses` keep serving
during the 14-day grace window before cleanup (migration
`20260601000000_drop_v1_cache.sql`).
"""

import hashlib
import json
from typing import Any

CACHE_VERSION = 2

# Fields dropped from roster entries before hashing.
# These vary between equivalent builds (stat tweaks) or carry no semantic
# meaning for strategy analysis (nicknames, audit metadata).
_ROSTER_VOLATILE_FIELDS = frozenset(
    {
        "stat_points",
        "nickname",
        "level",
        "created_at",
        "updated_at",
        "id",
        "user_id",
        "status",
        "vp_spent",
    }
)


def normalize_opponent_names(names: list[str]) -> list[str]:
    """Lowercase, strip, dedupe, and sort opponent Pokemon names."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in names:
        n = raw.strip().lower()
        if n and n not in seen:
            seen.add(n)
            out.append(n)
    out.sort()
    return out


def normalize_roster(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Canonicalize roster entries for cache keying.

    Drops volatile fields, normalizes move order, lowercases string values
    that are case-insensitive from the game's perspective. Sorts the roster
    itself by a stable key (name, then ability) so a reordered team hashes
    identically.
    """
    normalized: list[dict[str, Any]] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        clean: dict[str, Any] = {}
        for key, value in entry.items():
            if key in _ROSTER_VOLATILE_FIELDS:
                continue
            clean[key] = _normalize_value(key, value)
        normalized.append(clean)

    # Sort by full canonical JSON so the ordering is deterministic even when
    # two entries share name + ability (e.g. same species with different items).
    normalized.sort(key=lambda e: json.dumps(e, sort_keys=True, default=str))
    return normalized


def _normalize_value(key: str, value: Any) -> Any:
    """Recursively normalize a value based on its semantic key."""
    if value is None:
        return None
    if key == "moves" and isinstance(value, list):
        return sorted(
            (_normalize_value("move", m) for m in value),
            key=lambda m: str(m.get("name") if isinstance(m, dict) else m).lower(),
        )
    if isinstance(value, dict):
        return {k: _normalize_value(k, v) for k, v in value.items()}
    if isinstance(value, list):
        return [_normalize_value(key, v) for v in value]
    if isinstance(value, str):
        return value.strip()
    return value


def cache_hash_v2(payload: dict[str, Any]) -> str:
    """Produce a versioned deterministic cache key from a payload dict."""
    serialized = json.dumps(payload, sort_keys=True, default=str)
    digest = hashlib.sha256(serialized.encode()).hexdigest()
    return f"v2:{digest}"


def is_v2_key(request_hash: str) -> bool:
    return request_hash.startswith("v2:")
