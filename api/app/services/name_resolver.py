"""Centralized Pokemon name resolver.

Normalizes names from external sources (Smogon, Pikalytics, etc.) to
canonical database format (Title Case, hyphenated forms).

All ingest scripts and scrapers should use this module to map external
names to DB-stored canonical names before upserting.

Examples:
    "Wash Rotom"       -> "Rotom-Wash"
    "Alolan Ninetales" -> "Ninetales-Alola"
    "Hisuian Goodra"   -> "Goodra-Hisui"
    "Great Tusk"       -> "Great Tusk"  (already canonical)
"""

# Explicit alias table for names that don't follow a predictable pattern.
# Keys are external names; values are canonical DB names (or their base form).
_ALIASES: dict[str, str] = {
    # Rotom forms: some sources put the form adjective first
    "Wash Rotom": "Rotom-Wash",
    "Heat Rotom": "Rotom-Heat",
    "Frost Rotom": "Rotom-Frost",
    "Fan Rotom": "Rotom-Fan",
    "Mow Rotom": "Rotom-Mow",
    # Primal forms
    "Primal Groudon": "Groudon-Primal",
    "Primal Kyogre": "Kyogre-Primal",
    # Origin forms
    "Origin Giratina": "Giratina-Origin",
    "Origin Dialga": "Dialga-Origin",
    "Origin Palkia": "Palkia-Origin",
    # Sky form
    "Sky Shaymin": "Shaymin-Sky",
    # Therian forms
    "Therian Tornadus": "Tornadus-Therian",
    "Therian Thundurus": "Thundurus-Therian",
    "Therian Landorus": "Landorus-Therian",
    "Therian Enamorus": "Enamorus-Therian",
    # Incarnate = base form
    "Incarnate Tornadus": "Tornadus",
    "Incarnate Thundurus": "Thundurus",
    "Incarnate Landorus": "Landorus",
    "Incarnate Enamorus": "Enamorus",
    # Urshifu strike styles
    "Single Strike Urshifu": "Urshifu-Single-Strike",
    "Rapid Strike Urshifu": "Urshifu-Rapid-Strike",
    "Single-Strike Urshifu": "Urshifu-Single-Strike",
    "Rapid-Strike Urshifu": "Urshifu-Rapid-Strike",
    # Tauros Paldean breeds
    "Combat Breed Tauros": "Tauros-Paldea-Combat",
    "Blaze Breed Tauros": "Tauros-Paldea-Blaze",
    "Aqua Breed Tauros": "Tauros-Paldea-Aqua",
    # Gender variants
    "Basculegion": "Basculegion-Male",
    # Ogerpon masks (some sources may omit the "Mask" suffix)
    "Ogerpon Wellspring": "Ogerpon-Wellspring-Mask",
    "Ogerpon Hearthflame": "Ogerpon-Hearthflame-Mask",
    "Ogerpon Cornerstone": "Ogerpon-Cornerstone-Mask",
    # Common ladder / stream shorthand
    "Rotom-W": "Rotom-Wash",
    "Rotom W": "Rotom-Wash",
    "Rotom-H": "Rotom-Heat",
    "Rotom H": "Rotom-Heat",
    "Gambit": "Kingambit",
    "H-Arcanine": "Arcanine-Hisui",
    "H Arcanine": "Arcanine-Hisui",
    "Arcanine-H": "Arcanine-Hisui",
    "A-Ninetales": "Ninetales-Alola",
    "A Ninetales": "Ninetales-Alola",
    "Ninetales-A": "Ninetales-Alola",
    "Lando-T": "Landorus-Therian",
    "Lando T": "Landorus-Therian",
    "Thundy-T": "Thundurus-Therian",
    "Thundy T": "Thundurus-Therian",
    "Torn-T": "Tornadus-Therian",
    "Torn T": "Tornadus-Therian",
    "Urshifu-R": "Urshifu-Rapid-Strike",
    "Urshifu R": "Urshifu-Rapid-Strike",
    "Urshifu-S": "Urshifu-Single-Strike",
    "Urshifu S": "Urshifu-Single-Strike",
}

# Regional form prefixes and their canonical suffixes.
_REGIONAL_PREFIXES: dict[str, str] = {
    "Alolan": "Alola",
    "Galarian": "Galar",
    "Hisuian": "Hisui",
    "Paldean": "Paldea",
}


def _apply_regional_pattern(name: str) -> str | None:
    """Transform "Alolan X" -> "X-Alola", "Galarian X" -> "X-Galar", etc."""
    parts = name.split(" ", 1)
    if len(parts) == 2:
        prefix, species = parts
        suffix = _REGIONAL_PREFIXES.get(prefix)
        if suffix:
            return f"{species}-{suffix}"
    return None


def build_roster_index(sb: object) -> dict[str, str]:
    """Build a normalized -> canonical name lookup from the Champions roster.

    Keys are lowercase with hyphens and spaces stripped.
    Values are canonical display names (Title Case, hyphenated).

    Example: {"rotomwash": "Rotom-Wash", "ninetalesalola": "Ninetales-Alola"}

    Args:
        sb: Supabase client instance.
    """
    result = sb.table("pokemon").select("name").eq("champions_eligible", True).execute()  # type: ignore[attr-defined]
    rows: list[dict] = result.data
    return {row["name"].lower().replace("-", "").replace(" ", ""): row["name"] for row in rows}


def resolve_name(name: str, roster_index: dict[str, str]) -> str | None:
    """Resolve an external Pokemon name to the canonical DB form.

    Resolution order:
    1. Fuzzy normalization (strip hyphens + spaces, case-insensitive match)
    2. Explicit alias table
    3. Regional form pattern transform (Alolan/Galarian/Hisuian/Paldean prefix)

    Returns the canonical name if matched in the roster, None otherwise.
    """
    if not name or not name.strip():
        return None

    name = name.strip()

    # 1. Direct fuzzy match (handles canonical names and most Smogon-style names)
    key = name.lower().replace("-", "").replace(" ", "")
    if key in roster_index:
        return roster_index[key]

    # 2. Explicit alias
    alias_target = _ALIASES.get(name)
    if alias_target:
        alias_key = alias_target.lower().replace("-", "").replace(" ", "")
        if alias_key in roster_index:
            return roster_index[alias_key]
        # Alias may point to a name not separately in the roster (e.g. Rotom forms
        # stored under base "Rotom"). Return the alias target verbatim so callers
        # can decide how to handle it.
        return alias_target

    # 3. Regional form pattern
    regional = _apply_regional_pattern(name)
    if regional:
        regional_key = regional.lower().replace("-", "").replace(" ", "")
        if regional_key in roster_index:
            return roster_index[regional_key]

    return None


def normalize_tier_data(
    tier_data: dict[str, list[str]],
    roster_index: dict[str, str],
) -> tuple[dict[str, list[str]], list[str]]:
    """Normalize all Pokemon names in a tier_data dict.

    Applies resolve_name() to every entry. Names that cannot be resolved
    are kept as-is (so no data is silently dropped) but also collected in
    the returned unresolved list for logging.

    Args:
        tier_data: Mapping of tier -> list of Pokemon names (e.g. from meta scrape).
        roster_index: Built by build_roster_index().

    Returns:
        (normalized_tier_data, unresolved_names)
    """
    normalized: dict[str, list[str]] = {}
    unresolved: list[str] = []

    for tier, pokemon_list in tier_data.items():
        resolved_list: list[str] = []
        for name in pokemon_list:
            canonical = resolve_name(name, roster_index)
            if canonical:
                resolved_list.append(canonical)
            else:
                unresolved.append(name)
                resolved_list.append(name)  # preserve original rather than drop
        normalized[tier] = resolved_list

    return normalized, unresolved
