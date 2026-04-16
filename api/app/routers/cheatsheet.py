"""AI-generated team cheat sheet.

Combines pre-calculated data (roster, speed tiers, move categories) with
Claude-generated strategic analysis (game plan, key rules, lead matchups,
weaknesses) into a single printable reference card.
"""

import hashlib
import json
from datetime import datetime, timedelta, timezone

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.ai_quota import (
    DEFAULT_MODEL,
    HAIKU_MODEL,
    check_ai_quota,
    estimate_cost,
    get_available_models,
    log_ai_usage,
)
from app.auth import get_current_user
from app.config import settings
from app.database import supabase
from app.limiter import limiter
from app.models.cheatsheet import (
    CheatsheetMove,
    CheatsheetResponse,
    GamePlanStep,
    KeyRule,
    LeadMatchup,
    RosterEntry,
    SpeedTier,
    Weakness,
)

router = APIRouter(prefix="/cheatsheet", tags=["cheatsheet"])


CACHE_TTL_DAYS = 30


# ═══════════════════════════════════════════════════════════════════
# Saved cheatsheet persistence
# ═══════════════════════════════════════════════════════════════════


def _save_cheatsheet(team_id: str, user_id: str, response: CheatsheetResponse) -> None:
    """Persist cheatsheet to team_cheatsheets table (upsert by team_id)."""
    try:
        supabase.table("team_cheatsheets").upsert(
            {
                "team_id": team_id,
                "user_id": user_id,
                "cheatsheet_json": response.model_dump(mode="json"),
            },
            on_conflict="team_id",
        ).execute()
    except Exception:
        # Table may not exist yet (migration not applied) -- silently skip
        pass


def _fetch_saved_cheatsheet(team_id: str, user_id: str) -> dict | None:
    """Fetch a previously saved cheatsheet for a team."""
    try:
        result = (
            supabase.table("team_cheatsheets")
            .select("cheatsheet_json, created_at, updated_at, is_public")
            .eq("team_id", team_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            return None
        return result.data  # type: ignore[return-value]
    except Exception:
        return None

# ═══════════════════════════════════════════════════════════════════
# Constants
# ═══════════════════════════════════════════════════════════════════

PRIORITY_MOVES = {
    "Fake Out",
    "Sucker Punch",
    "Extreme Speed",
    "Aqua Jet",
    "Bullet Punch",
    "Ice Shard",
    "Mach Punch",
    "Quick Attack",
    "Shadow Sneak",
    "Accelerock",
    "Grassy Glide",
    "Water Shuriken",
    "First Impression",
    "Jet Punch",
    "Vacuum Wave",
}

SPEED_DOUBLE_ABILITIES: dict[str, str] = {
    "Unburden": "after item consumed",
    "Chlorophyll": "in Sun",
    "Sand Rush": "in Sand",
    "Swift Swim": "in Rain",
    "Slush Rush": "in Snow",
}

SP_LABEL: dict[str, str] = {
    "hp": "HP",
    "attack": "Atk",
    "defense": "Def",
    "sp_attack": "SpA",
    "sp_defense": "SpD",
    "speed": "Spd",
}


# ═══════════════════════════════════════════════════════════════════
# Data fetching
# ═══════════════════════════════════════════════════════════════════


def _fetch_team(team_id: str, user_id: str) -> dict:
    result = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    row: dict = result.data  # type: ignore[assignment]
    return row


def _fetch_pokemon_data(pokemon_ids: list[int]) -> dict[int, dict]:
    result = (
        supabase.table("pokemon")
        .select("id, name, types, base_stats, abilities, movepool")
        .in_("id", pokemon_ids)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    return {r["id"]: r for r in rows}


def _fetch_user_builds(pokemon_ids: list[int], user_id: str) -> dict[int, dict]:
    result = (
        supabase.table("user_pokemon")
        .select("pokemon_id, ability, moves, item_id, stat_points, nature, notes")
        .eq("user_id", user_id)
        .in_("pokemon_id", pokemon_ids)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    return {r["pokemon_id"]: r for r in rows}


def _fetch_item_names(item_ids: list[int]) -> dict[int, str]:
    if not item_ids:
        return {}
    result = supabase.table("items").select("id, name").in_("id", item_ids).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    return {r["id"]: r["name"] for r in rows}


def _fetch_move_types(move_names: list[str]) -> dict[str, str]:
    """Fetch move types from the moves table for STAB classification."""
    if not move_names:
        return {}
    result = supabase.table("moves").select("name, type").in_("name", move_names).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    return {r["name"]: r["type"] for r in rows}


def _fetch_meta_context(team_format: str = "doubles") -> tuple[list[dict], list[dict]]:
    """Fetch latest tier list + top usage data for prompt context.

    Filters usage data by the team's format to avoid mixing doubles/singles stats.
    """
    # Latest tier snapshots
    tier_rows: list[dict] = []
    for fmt in ("singles", "doubles", "megas"):
        result = (
            supabase.table("meta_snapshots")
            .select("format, tier_data")
            .eq("format", fmt)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        rows: list[dict] = result.data  # type: ignore[assignment]
        if rows:
            tier_rows.append(rows[0])

    # Top usage data -- filtered by team format
    usage_result = (
        supabase.table("pokemon_usage")
        .select("pokemon_name, usage_percent, moves, items, abilities, teammates")
        .eq("format", team_format)
        .order("usage_percent", desc=True)
        .limit(15)
        .execute()
    )
    usage_rows: list[dict] = usage_result.data  # type: ignore[assignment]

    return tier_rows, usage_rows


# ═══════════════════════════════════════════════════════════════════
# Pre-calculation
# ═══════════════════════════════════════════════════════════════════


def _classify_move(
    move_name: str,
    pokemon_types: list[str],
    move_types: dict[str, str],
) -> str:
    """Classify a move as stab, priority, or utility."""
    if move_name in PRIORITY_MOVES:
        return "priority"
    move_type = move_types.get(move_name, "")
    if move_type in pokemon_types:
        return "stab"
    return "utility"


def _format_stat_points(sp: dict | None) -> str | None:
    if not sp:
        return None
    parts = []
    for key in ("hp", "attack", "defense", "sp_attack", "sp_defense", "speed"):
        val = sp.get(key, 0)
        if val and val > 0:
            parts.append(f"{val} {SP_LABEL[key]}")
    return " / ".join(parts) if parts else None


def _build_roster(
    team_pokemon_ids: list[int],
    pokemon_data: dict[int, dict],
    user_builds: dict[int, dict],
    item_names: dict[int, str],
    move_types: dict[str, str],
    mega_pokemon_id: int | None,
) -> list[RosterEntry]:
    roster: list[RosterEntry] = []
    for pid in team_pokemon_ids:
        poke = pokemon_data.get(pid)
        if not poke:
            continue
        build = user_builds.get(pid, {})
        build_moves: list[str] = build.get("moves") or []
        types: list[str] = poke.get("types") or []

        moves = [
            CheatsheetMove(
                name=m,
                category=_classify_move(m, types, move_types),
            )
            for m in build_moves
        ]

        item_id = build.get("item_id")
        item_name = item_names.get(item_id) if item_id else None

        is_mega = ("mega" in poke["name"].lower() and poke["name"].lower() != "meganium") or (
            mega_pokemon_id is not None and pid == mega_pokemon_id
        )

        roster.append(
            RosterEntry(
                name=poke["name"],
                types=types,
                item=item_name,
                ability=build.get("ability"),
                nature=build.get("nature"),
                stat_points=_format_stat_points(build.get("stat_points")),
                moves=moves,
                is_mega=is_mega,
            )
        )
    return roster


def _build_speed_tiers(
    team_pokemon_ids: list[int],
    pokemon_data: dict[int, dict],
    user_builds: dict[int, dict],
) -> list[SpeedTier]:
    tiers: list[SpeedTier] = []

    for pid in team_pokemon_ids:
        poke = pokemon_data.get(pid)
        if not poke:
            continue
        base_stats: dict = poke.get("base_stats") or {}
        base_speed = base_stats.get("speed", 0)
        build = user_builds.get(pid, {})
        ability = build.get("ability", "")

        tiers.append(SpeedTier(pokemon=poke["name"], speed=base_speed))

        # Add conditional speed entry for doubling abilities
        if ability in SPEED_DOUBLE_ABILITIES:
            tiers.append(
                SpeedTier(
                    pokemon=poke["name"],
                    speed=base_speed * 2,
                    note=f"x{ability} ({SPEED_DOUBLE_ABILITIES[ability]})",
                )
            )

    tiers.sort(key=lambda t: t.speed, reverse=True)
    return tiers


# ═══════════════════════════════════════════════════════════════════
# Caching
# ═══════════════════════════════════════════════════════════════════


def _make_cache_key(roster: list[RosterEntry]) -> str:
    key_data = json.dumps([r.model_dump(mode="json") for r in roster], sort_keys=True)
    return "cheatsheet:" + hashlib.sha256(key_data.encode()).hexdigest()


def _check_cache(request_hash: str) -> dict | None:
    result = (
        supabase.table("ai_analyses")
        .select("response_json, expires_at")
        .eq("request_hash", request_hash)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        return None

    row: dict = result.data  # type: ignore[assignment]
    expires = row.get("expires_at")
    if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
        supabase.table("ai_analyses").delete().eq("request_hash", request_hash).execute()
        return None

    response: dict = row["response_json"]
    return response


def _save_cache(request_hash: str, response: CheatsheetResponse) -> None:
    supabase.table("ai_analyses").upsert(
        {
            "request_hash": request_hash,
            "opponent_team": [],
            "my_team": {"type": "cheatsheet"},
            "response_json": response.model_dump(mode="json"),
            "expires_at": (datetime.now(timezone.utc) + timedelta(days=CACHE_TTL_DAYS)).isoformat(),
        },
        on_conflict="request_hash",
    ).execute()


# ═══════════════════════════════════════════════════════════════════
# Prompt
# ═══════════════════════════════════════════════════════════════════


def _build_prompt(
    team_name: str,
    team_format: str,
    roster: list[RosterEntry],
    speed_tiers: list[SpeedTier],
    tier_data: list[dict],
    usage_data: list[dict],
) -> str:
    # ── Team section ──
    team_lines = []
    for r in roster:
        move_str = ", ".join(f"{m.name} [{m.category}]" for m in r.moves)
        mega = " [MEGA]" if r.is_mega else ""
        team_lines.append(
            f"- {r.name}{mega} ({'/'.join(r.types)})\n"
            f"  Ability: {r.ability or '?'} | Item: {r.item or '?'} "
            f"| Nature: {r.nature or '?'}\n"
            f"  Stat Points: {r.stat_points or 'unknown'}\n"
            f"  Moves: {move_str}"
        )

    # ── Speed section ──
    speed_lines = [
        f"- {t.pokemon}: {t.speed}{f'  ({t.note})' if t.note else ''}" for t in speed_tiers
    ]

    # ── Meta tier list ──
    tier_lines = []
    for t in tier_data:
        fmt = t.get("format", "?")
        tiers: dict = t.get("tier_data", {})
        s_tier = ", ".join(tiers.get("S", []))
        a_plus = ", ".join(tiers.get("A+", []))
        if s_tier or a_plus:
            tier_lines.append(f"  {fmt}: S=[{s_tier}] A+=[{a_plus}]")

    # ── Usage data ──
    usage_lines = []
    for u in usage_data:
        name = u.get("pokemon_name", "?")
        pct = u.get("usage_percent", 0)
        moves_list: list[dict] = u.get("moves") or []
        items_list: list[dict] = u.get("items") or []
        teammates_list: list[dict] = u.get("teammates") or []

        top_moves = ", ".join(m["name"] for m in moves_list[:4])
        top_items = ", ".join(i["name"] for i in items_list[:2])
        top_mates = ", ".join(t["name"] for t in teammates_list[:3])

        usage_lines.append(
            f"- {name} ({pct}%): Moves=[{top_moves}] Items=[{top_items}] Teammates=[{top_mates}]"
        )

    return f"""\
You are an expert Pokemon Champions VGC doubles analyst creating a \
pre-match cheat sheet for a competitive team.

## My Team: <team_name>{team_name}</team_name> ({team_format} format)
{chr(10).join(team_lines)}

## Speed Tiers (base stats, sorted)
{chr(10).join(speed_lines)}

## Current Meta — Top Tiers
{chr(10).join(tier_lines) if tier_lines else "  No tier data available."}

## Current Meta — Top 15 Usage
{chr(10).join(usage_lines) if usage_lines else "  No usage data available."}

## Task
Generate a comprehensive pre-match cheat sheet. Return ONLY valid JSON \
with exactly this structure:

{{
  "team_title": "SHORT PUNCHY NAME (2-3 words, e.g. GENGAR OFFENSE)",
  "archetype": "Team archetype (e.g. Trap / Offense, Rain Hyper Offense)",
  "game_plan": [
    {{"step": 1, "title": "verb phrase", "description": "2-3 sentences"}},
    {{"step": 2, "title": "verb phrase", "description": "2-3 sentences"}},
    {{"step": 3, "title": "verb phrase", "description": "2-3 sentences"}}
  ],
  "key_rules": [
    {{"title": "imperative rule", "description": "why and when"}},
    ... (3-5 rules)
  ],
  "lead_matchups": [
    {{
      "archetype": "archetype name",
      "example": "Pokemon + Pokemon",
      "threat_tier": "S-TIER or A-TIER or MOST COMMON or HIGHEST WR",
      "lead": ["Pokemon1", "Pokemon2"],
      "back": ["Pokemon3", "Pokemon4"],
      "note": "specific tactical instructions"
    }},
    ... (4-6 matchups)
  ],
  "weaknesses": [
    {{"title": "concise threat name", "description": "what to watch for and how to mitigate"}},
    ... (3-5 weaknesses)
  ]
}}

## Quality requirements
- game_plan: describe the team's actual win condition and how the 6 \
Pokemon work together. Be specific about ability interactions, move \
synergies, and turn-by-turn sequencing.
- key_rules: team-specific operational rules a player must remember \
mid-match. Not generic advice — rules that emerge from THIS team's \
composition (e.g. ability triggers, item consumption order, move \
restrictions).
- lead_matchups: recommend specific bring-4 and lead pairs against \
the most common meta archetypes based on the usage data above. Every \
lead/back choice must be justified in the note. Reference specific \
moves and type interactions.
- weaknesses: not just "weak to type X" — contextual warnings about \
specific meta threats, type combos that compromise multiple team \
members, and abilities/moves that bypass the team's strategy. Include \
mitigation for each.
- Use Title Case for all Pokemon names.
- lead and back arrays must contain exactly 2 Pokemon names each, \
drawn from the team roster.

Return ONLY the JSON object, no markdown fences or explanation.

{_get_strategy_section(team_format)}"""


def _get_strategy_section(team_format: str) -> str:
    from app.services.strategy_context import fetch_strategy_context

    ctx = fetch_strategy_context(format=team_format)
    return ctx if ctx else ""


# ═══════════════════════════════════════════════════════════════════
# Endpoint
# ═══════════════════════════════════════════════════════════════════


@router.get("/all")
def list_cheatsheets(user_id: str = Depends(get_current_user)):
    """Fetch all saved cheatsheets for the current user."""
    try:
        result = (
            supabase.table("team_cheatsheets")
            .select("id, team_id, cheatsheet_json, is_public, created_at, updated_at")
            .eq("user_id", user_id)
            .order("updated_at", desc=True)
            .execute()
        )
        rows: list[dict] = result.data  # type: ignore[assignment]
        return rows
    except Exception:
        return []


@router.patch("/{team_id}/visibility")
def toggle_visibility(team_id: str, user_id: str = Depends(get_current_user)):
    """Toggle a cheatsheet's public visibility."""
    # Fetch current state
    result = (
        supabase.table("team_cheatsheets")
        .select("id, is_public")
        .eq("team_id", team_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if result is None or not result.data:
        raise HTTPException(status_code=404, detail="Cheatsheet not found")

    new_value = not result.data.get("is_public", False)
    supabase.table("team_cheatsheets").update(
        {"is_public": new_value}
    ).eq("id", result.data["id"]).execute()

    return {"team_id": team_id, "is_public": new_value}


@router.get("/status")
def cheatsheet_status(
    team_ids: str = "",
    user_id: str = Depends(get_current_user),
):
    """Check which teams have saved cheatsheets. Returns dict of team_id -> updated_at."""
    if not team_ids:
        return {}
    ids = [t.strip() for t in team_ids.split(",") if t.strip()]
    if not ids:
        return {}
    try:
        result = (
            supabase.table("team_cheatsheets")
            .select("team_id, updated_at")
            .eq("user_id", user_id)
            .in_("team_id", ids)
            .execute()
        )
        rows: list[dict] = result.data  # type: ignore[assignment]
        return {r["team_id"]: r["updated_at"] for r in rows}
    except Exception:
        return {}


@router.get("/{team_id}")
def get_saved_cheatsheet(
    team_id: str,
    user_id: str = Depends(get_current_user),
):
    """Fetch a previously saved cheatsheet for a team."""
    saved = _fetch_saved_cheatsheet(team_id, user_id)
    if not saved:
        raise HTTPException(status_code=404, detail="No saved cheatsheet for this team")
    data: dict = saved["cheatsheet_json"]
    data["cached"] = True
    data["estimated_cost_usd"] = 0.0
    return data


@router.post("/{team_id}", response_model=CheatsheetResponse)
@limiter.limit("5/minute")
def generate_cheatsheet(
    request: Request,
    team_id: str,
    model: str = Query(DEFAULT_MODEL, pattern=r"^claude-"),
    user_id: str = Depends(get_current_user),
):
    """Generate an AI-powered pre-match cheat sheet for a team."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is not configured")

    # Validate model choice
    available = get_available_models(user_id)
    if model not in available:
        model = HAIKU_MODEL

    # 1. Fetch team
    team = _fetch_team(team_id, user_id)
    roster_ids: list[str] = team["pokemon_ids"]  # UUIDs of user_pokemon rows
    mega_roster_id: str | None = team.get("mega_pokemon_id")  # UUID or None

    # 1b. Resolve user_pokemon UUIDs to species IDs
    roster_result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    roster_rows: list[dict] = roster_result.data  # type: ignore[assignment]
    uuid_to_species = {r["id"]: r["pokemon_id"] for r in roster_rows}
    pokemon_ids = [uuid_to_species[rid] for rid in roster_ids if rid in uuid_to_species]
    mega_id_int = uuid_to_species.get(mega_roster_id) if mega_roster_id else None

    # 2. Fetch base data + builds
    pokemon_data = _fetch_pokemon_data(pokemon_ids)
    user_builds = _fetch_user_builds(pokemon_ids, user_id)

    # 3. Resolve item names
    item_ids = [b["item_id"] for b in user_builds.values() if b.get("item_id")]
    item_names = _fetch_item_names(item_ids)

    # 4. Resolve move types for STAB classification
    all_move_names: list[str] = []
    for b in user_builds.values():
        all_move_names.extend(b.get("moves") or [])
    move_types = _fetch_move_types(list(set(all_move_names)))

    # 5. Pre-calculate roster + speed tiers
    roster = _build_roster(
        pokemon_ids,
        pokemon_data,
        user_builds,
        item_names,
        move_types,
        mega_id_int,
    )
    speed_tiers = _build_speed_tiers(pokemon_ids, pokemon_data, user_builds)

    # 6. Check cache
    cache_key = _make_cache_key(roster)
    cached = _check_cache(cache_key)
    if cached:
        # Re-inject live roster/speed data (may have changed)
        cached["roster"] = [r.model_dump(mode="json") for r in roster]
        cached["speed_tiers"] = [s.model_dump(mode="json") for s in speed_tiers]
        cached["cached"] = True
        cached["estimated_cost_usd"] = 0.0
        log_ai_usage(user_id, "cheatsheet", model, 0, 0, cached=True)
        cached_response = CheatsheetResponse.model_validate(cached)
        # Ensure persistent copy exists
        _save_cheatsheet(team_id, user_id, cached_response)
        return cached_response

    # 6b. Check daily quota (non-cached requests only) -- Haiku bypasses
    if model != HAIKU_MODEL:
        check_ai_quota(user_id)

    # 7. Fetch meta context (filtered by team's format)
    tier_data, usage_data = _fetch_meta_context(team["format"])

    # 8. Build prompt and call Claude
    prompt = _build_prompt(
        team["name"],
        team["format"],
        roster,
        speed_tiers,
        tier_data,
        usage_data,
    )

    ai = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = ai.messages.create(
        model=model,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )

    block = message.content[0]
    if block.type != "text":
        raise HTTPException(status_code=500, detail="Unexpected Claude response type")

    text = block.text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Claude response: {e}",
        )

    # 9. Assemble full response
    response = CheatsheetResponse(
        team_id=team_id,
        team_name=team["name"],
        team_title=raw.get("team_title", team["name"]),
        archetype=raw.get("archetype", ""),
        format=team["format"],
        roster=roster,
        speed_tiers=speed_tiers,
        game_plan=[GamePlanStep.model_validate(s) for s in raw.get("game_plan", [])],
        key_rules=[KeyRule.model_validate(r) for r in raw.get("key_rules", [])],
        lead_matchups=[LeadMatchup.model_validate(m) for m in raw.get("lead_matchups", [])],
        weaknesses=[Weakness.model_validate(w) for w in raw.get("weaknesses", [])],
        cached=False,
        estimated_cost_usd=estimate_cost(
            message.usage.input_tokens, message.usage.output_tokens, model
        ),
    )

    # 10. Cache + log usage + persist
    _save_cache(cache_key, response)
    _save_cheatsheet(team_id, user_id, response)
    log_ai_usage(
        user_id,
        "cheatsheet",
        model,
        message.usage.input_tokens,
        message.usage.output_tokens,
    )

    return response
