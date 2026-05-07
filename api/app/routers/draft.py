import hashlib
import json
import logging
from datetime import datetime, timedelta, timezone

import anthropic
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.ai_quota import (
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
from app.models.draft import DraftAnalysis, DraftRequest, DraftResponse
from app.prompt_guard import sanitize_user_text
from app.services.ai_verifier import verify_draft_analysis
from app.services.cache_utils import (
    CACHE_VERSION,
    cache_hash_v2,
    normalize_opponent_names,
)
from app.services.damage_calc import (
    CalcMove,
    calculate_damage,
    format_damage_string,
    from_base_stats,
)
from app.services.data_freshness import (
    STALE_USAGE_THRESHOLD_DAYS,
    is_stale,
    snapshot_age_days,
)
from app.services.retrieval import (
    fetch_personal_context,
    fetch_personal_win_rates,
    fetch_tournament_context,
)
from app.services.strategy_context import fetch_strategy_context

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/draft", tags=["draft"])


CACHE_TTL_HOURS = 168  # 7 days


def _make_hash_v2(opponent: list[str], my_pokemon_ids: list[str]) -> str:
    return cache_hash_v2(
        {
            "kind": "draft",
            "opponent": normalize_opponent_names(opponent),
            "my_team": sorted(str(pid) for pid in my_pokemon_ids),
        }
    )


def _make_hash_v1(opponent: list[str], my_pokemon_ids: list[str]) -> str:
    """Legacy hash format (pre-normalization) kept for the 14-day grace window."""
    key = json.dumps(
        {
            "opponent": sorted(n.lower().strip() for n in opponent),
            "my_team": sorted(my_pokemon_ids),
        },
        sort_keys=True,
    )
    return hashlib.sha256(key.encode()).hexdigest()


def _check_cache(
    opponent: list[str],
    my_pokemon_ids: list[str],
    snapshot_floor: str | None = None,
) -> DraftAnalysis | None:
    """Try v2 key first, fall back to legacy v1 during grace window.

    ``snapshot_floor`` evicts cached rows whose ``created_at`` predates the
    latest ``pokemon_usage`` snapshot for the team's format -- a meta
    refresh invalidates downstream draft analyses.
    """
    for request_hash, is_legacy in (
        (_make_hash_v2(opponent, my_pokemon_ids), False),
        (_make_hash_v1(opponent, my_pokemon_ids), True),
    ):
        result = (
            supabase.table("ai_analyses")
            .select("response_json, expires_at, created_at")
            .eq("request_hash", request_hash)
            .maybe_single()
            .execute()
        )
        if result is None or not result.data:
            continue

        row: dict = result.data  # type: ignore[assignment]
        expires = row.get("expires_at")
        if expires and datetime.fromisoformat(expires) < datetime.now(timezone.utc):
            supabase.table("ai_analyses").delete().eq("request_hash", request_hash).execute()
            continue

        if snapshot_floor:
            created = row.get("created_at")
            if created and created[:10] < snapshot_floor[:10]:
                logger.info(
                    "draft cache evicted: cached_at=%s < snapshot=%s",
                    created[:10],
                    snapshot_floor[:10],
                )
                supabase.table("ai_analyses").delete().eq("request_hash", request_hash).execute()
                continue

        if is_legacy:
            logger.info("draft cache v1 hit (grace window): %s", request_hash[:12])
        return DraftAnalysis.model_validate(row["response_json"])
    return None


def _save_cache(
    opponent: list[str],
    my_pokemon_ids: list[str],
    opponent_team: list[str],
    my_team: dict,
    analysis: DraftAnalysis,
) -> None:
    request_hash = _make_hash_v2(opponent, my_pokemon_ids)
    supabase.table("ai_analyses").upsert(
        {
            "request_hash": request_hash,
            "opponent_team": opponent_team,
            "my_team": my_team,
            "response_json": analysis.model_dump(),
            "cache_version": CACHE_VERSION,
            "expires_at": (
                datetime.now(timezone.utc) + timedelta(hours=CACHE_TTL_HOURS)
            ).isoformat(),
        },
        on_conflict="request_hash",
    ).execute()


def _fetch_team_pokemon(team_id: str, user_id: str) -> dict:
    """Fetch team + its Pokemon details."""
    team = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    if team is None or not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    team_row: dict = team.data  # type: ignore[assignment]
    roster_ids: list[str] = team_row["pokemon_ids"]  # UUIDs of user_pokemon rows

    # Resolve user_pokemon UUIDs to builds + species IDs
    user_builds = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id, ability, moves, item_id, stat_points, nature")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    build_rows: list[dict] = user_builds.data  # type: ignore[assignment]
    builds_by_species = {b["pokemon_id"]: b for b in build_rows}
    species_ids = list({b["pokemon_id"] for b in build_rows})

    # Fetch base Pokemon data by species IDs
    pokemon_rows = (
        supabase.table("pokemon")
        .select("id, name, types, base_stats, abilities, movepool, sprite_url")
        .in_("id", species_ids)
        .execute()
    )

    pokemon_list = []
    poke_rows: list[dict] = pokemon_rows.data  # type: ignore[assignment]
    for p in poke_rows:
        build = builds_by_species.get(p["id"], {})
        pokemon_list.append(
            {
                "name": p["name"],
                "types": p["types"],
                "base_stats": p["base_stats"],
                "abilities": p["abilities"],
                "movepool": p["movepool"][:20],  # trim for token budget
                "build": {
                    "ability": build.get("ability"),
                    "moves": build.get("moves"),
                    "item": build.get("item_id"),
                    "nature": build.get("nature"),
                    "stat_points": build.get("stat_points"),
                }
                if build
                else None,
            }
        )

    return {
        "team_name": team_row["name"],
        "format": team_row["format"],
        "mega_pokemon_id": team_row.get("mega_pokemon_id"),
        "pokemon": pokemon_list,
    }


def _fetch_usage_context(pokemon_names: list[str], format_key: str = "doubles") -> list[dict]:
    """Fetch competitive usage data for a list of Pokemon names.

    Filters by Champions format (defaults to doubles -- the VGC format).
    """
    usage_rows: list[dict] = []
    for name in pokemon_names:
        result = (
            supabase.table("pokemon_usage")
            .select("pokemon_name, usage_percent, moves, items, abilities, teammates")
            .ilike("pokemon_name", name.strip())
            .eq("format", format_key)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            row: dict = result.data[0]  # type: ignore[assignment]
            usage_rows.append(row)
    return usage_rows


def _fetch_personal_context(user_id: str, opponent_names: list[str]) -> str:
    """Fetch user's matchup history using the retrieval service.

    Part of the Dual RAG pipeline: personal context stream.
    Formatted as <user_personal_context> XML block.
    """
    if not opponent_names:
        return ""

    matchups = fetch_personal_context(user_id, opponent_names)
    if not matchups:
        return ""

    lines = []
    for m in matchups:
        opp_team = m.get("opponent_team_data") or []
        opp_names_str = ", ".join(p.get("name", "?") for p in opp_team[:6])
        outcome = (m.get("outcome") or "unknown").upper()
        leads = m.get("lead_pair") or []
        lead_str = f" (led: {', '.join(leads)})" if leads else ""
        notes = sanitize_user_text(m.get("notes") or "")
        note_str = f' -- Notes: "{notes}"' if notes else ""
        lines.append(f"- {outcome} vs [{opp_names_str}]{lead_str}{note_str}")

    content = "\n".join(lines)
    return (
        "\n\n## Your Personal History\n"
        "<user_personal_context>\n"
        "Your past results against similar team compositions:\n"
        f"{content}\n"
        "</user_personal_context>"
    )


def _fetch_tournament_context(pokemon_ids: list[int]) -> str:
    """Fetch tournament archetypes using the retrieval service.

    Part of the Dual RAG pipeline: tournament context stream.
    Formatted as <limitless_pro_context> XML block.
    """
    if not pokemon_ids:
        return ""

    teams = fetch_tournament_context(pokemon_ids)
    if not teams:
        return ""

    lines = []
    for t in teams:
        placement = t.get("placement")
        tournament = t.get("tournament_name")
        archetype = t.get("archetype")
        player = t.get("player_name") or "Unknown Player"
        lines.append(f"- {archetype} ({placement} place at {tournament}) by {player}")

    content = "\n".join(lines)
    return (
        "\n\n## Tournament Context\n"
        "<limitless_pro_context>\n"
        "Similar successful tournament teams:\n"
        f"{content}\n"
        "</limitless_pro_context>"
    )


def _compute_damage_calcs(
    analysis: DraftAnalysis,
    my_pokemon: list[dict],
    opp_pokemon: list[dict],
) -> None:
    """Replace AI-generated `estimated_damage` strings with deterministic
    engine output. The AI proposes scenarios (attacker, move, defender, note);
    we compute the actual damage range from the formula. Mutates `analysis`.

    If a calc references a Pokemon or move we can't resolve, we leave
    `estimated_damage=""` and let the verifier flag it as a hallucination.
    """
    if not analysis.damage_calcs:
        return

    # Index Pokemon by normalized name. Handles both teams.
    def _key(s: str) -> str:
        return s.strip().lower().replace("-", " ").replace("_", " ")

    poke_index: dict[str, dict] = {}
    for p in my_pokemon:
        poke_index[_key(p["name"])] = p
    for p in opp_pokemon:
        poke_index[_key(p["name"])] = p

    # Batch-fetch every move name referenced by the calcs in one query.
    move_names = list({calc.move for calc in analysis.damage_calcs})
    moves_result = (
        supabase.table("moves")
        .select("name, type, category, power, target")
        .in_("name", move_names)
        .execute()
    )
    move_rows: list[dict] = moves_result.data or []  # type: ignore[assignment]
    move_index: dict[str, dict] = {_key(m["name"]): m for m in move_rows}

    for calc in analysis.damage_calcs:
        attacker_row = poke_index.get(_key(calc.attacker))
        defender_row = poke_index.get(_key(calc.defender))
        move_row = move_index.get(_key(calc.move))

        if not attacker_row or not defender_row or not move_row:
            # Verifier will surface the missing reference as a warning.
            continue

        # Use build-specific stats if available (typical for my_pokemon).
        atk_build = attacker_row.get("build") or {}
        def_build = defender_row.get("build") or {}

        atk = from_base_stats(
            attacker_row["name"],
            attacker_row.get("types", []),
            attacker_row.get("base_stats", {}),
            stat_points=atk_build.get("stat_points"),
            nature=atk_build.get("nature"),
        )
        defn = from_base_stats(
            defender_row["name"],
            defender_row.get("types", []),
            defender_row.get("base_stats", {}),
            stat_points=def_build.get("stat_points"),
            nature=def_build.get("nature"),
        )
        move = CalcMove(
            name=move_row["name"],
            type=(move_row.get("type") or "").lower(),
            category=(move_row.get("category") or "").lower(),
            power=move_row.get("power") or 0,
            target=move_row.get("target") or "selected-pokemon",
        )
        result = calculate_damage(atk, move, defn, is_doubles=True)
        calc.estimated_damage = format_damage_string(result)

        # Append a short annotation so the user understands modifiers
        # without reading the formula. Skip for already-skipped calcs.
        if not result["skipped_reason"]:
            tags: list[str] = []
            te = result["type_effectiveness"]
            if te >= 4:
                tags.append("4x SE")
            elif te == 2:
                tags.append("2x SE")
            elif te == 0.5:
                tags.append("0.5x resisted")
            elif te == 0.25:
                tags.append("0.25x resisted")
            if result["stab"]:
                tags.append("STAB")
            if tags:
                calc.note = (calc.note + f" [{', '.join(tags)}]").strip()


def _fetch_opponent_pokemon(names: list[str]) -> list[dict]:
    """Fetch base data for opponent Pokemon by name."""
    pokemon_list = []
    for name in names:
        result = (
            supabase.table("pokemon")
            .select("id, name, types, base_stats, abilities")
            .ilike("name", name.strip().replace(" ", "-"))
            .limit(1)
            .execute()
        )
        if not result.data:
            # Fallback for exact name
            result = (
                supabase.table("pokemon")
                .select("id, name, types, base_stats, abilities")
                .ilike("name", name.strip())
                .limit(1)
                .execute()
            )
        rows: list[dict] = result.data  # type: ignore[assignment]
        if rows:
            pokemon_list.append(rows[0])
        else:
            pokemon_list.append(
                {
                    "id": 0,
                    "name": name,
                    "types": [],
                    "base_stats": {},
                    "abilities": [],
                }
            )
    return pokemon_list


def _build_prompt(
    my_team: dict,
    opponent_pokemon: list[dict],
    opponent_usage: list[dict],
    my_usage: list[dict],
    tournament_context: str = "",
    personal_context: str = "",
    usage_snapshot_date: str | None = None,
    usage_age_days: int | None = None,
    personal_win_rates: dict[str, dict] | None = None,
) -> str:
    # Format my team
    my_lines = []
    for p in my_team["pokemon"]:
        build_info = ""
        if p.get("build") and p["build"].get("moves"):
            build_info = (
                f"  Build: {p['build'].get('ability', '?')} | "
                f"{', '.join(p['build']['moves'])} | "
                f"Nature: {p['build'].get('nature', '?')}"
            )
        my_lines.append(
            f"- {p['name']} ({'/'.join(p['types'])}) "
            f"HP:{p['base_stats'].get('hp', 0)} Atk:{p['base_stats'].get('attack', 0)} "
            f"Def:{p['base_stats'].get('defense', 0)} SpA:{p['base_stats'].get('sp_attack', 0)} "
            f"SpD:{p['base_stats'].get('sp_defense', 0)} Spe:{p['base_stats'].get('speed', 0)}"
            f"\n{build_info}"
            if build_info
            else f"- {p['name']} ({'/'.join(p['types'])}) "
            f"HP:{p['base_stats'].get('hp', 0)} Atk:{p['base_stats'].get('attack', 0)} "
            f"Def:{p['base_stats'].get('defense', 0)} SpA:{p['base_stats'].get('sp_attack', 0)} "
            f"SpD:{p['base_stats'].get('sp_defense', 0)} Spe:{p['base_stats'].get('speed', 0)}"
        )

    # Format opponent team
    opp_lines = []
    for p in opponent_pokemon:
        stats = p.get("base_stats", {})
        opp_lines.append(
            f"- {p['name']} ({'/'.join(p.get('types', []))}) "
            f"HP:{stats.get('hp', 0)} Atk:{stats.get('attack', 0)} "
            f"Def:{stats.get('defense', 0)} SpA:{stats.get('sp_attack', 0)} "
            f"SpD:{stats.get('sp_defense', 0)} Spe:{stats.get('speed', 0)}"
        )

    # Format usage context
    usage_context = ""
    if opponent_usage:
        usage_lines = []
        for u in opponent_usage:
            name = u.get("pokemon_name", "Unknown")
            moves_list: list[dict] = u.get("moves") or []
            items_list: list[dict] = u.get("items") or []

            moves = ", ".join(f"{m['name']} ({m['percent']}%)" for m in moves_list[:4])
            items = ", ".join(f"{i['name']} ({i['percent']}%)" for i in items_list[:3])

            usage_lines.append(
                f"- {name} (usage: {u.get('usage_percent', 0)}%)\n"
                f"  Common moves: {moves}\n"
                f"  Common items: {items}"
            )
        usage_context = "\n\n## Competitive Usage Data\n" + "\n".join(usage_lines)

    # Format personal win rates
    win_rate_context = ""
    if personal_win_rates:
        wr_lines = []
        for name, stats in personal_win_rates.items():
            wr_lines.append(
                f"- {name}: {stats['wins']}W-{stats['losses']}L "
                f"({round(stats['win_rate'] * 100, 1)}% win rate over {stats['total']} games)"
            )
        win_rate_context = "\n\n## Historical Performance Against These Species\n" + "\n".join(
            wr_lines
        )

    mega_note = ""
    if my_team.get("mega_pokemon_id"):
        mega_note = f"\nMy designated Mega: Pokemon ID {my_team['mega_pokemon_id']}"

    if usage_age_days is None:
        freshness_line = (
            "DATA FRESHNESS: No usage snapshot available. Recommend conservatively "
            "and flag uncertainty.\n\n"
        )
    elif usage_age_days <= 1:
        freshness_line = (
            f"DATA FRESHNESS: Usage data is current "
            f"(snapshot {usage_snapshot_date}, {usage_age_days} day(s) old).\n\n"
        )
    else:
        freshness_line = (
            f"DATA FRESHNESS: Usage data is {usage_age_days} day(s) old "
            f"(snapshot {usage_snapshot_date}). Caveat any usage-derived claims "
            "if the metagame may have shifted.\n\n"
        )

    header = (
        freshness_line + "You are a competitive Pokemon Champions VGC doubles analyst. "
        "Analyze this team preview matchup.\n\n"
        "RAG CONTEXT:\n"
        "- If <limitless_pro_context> is provided, it contains recent high-placing tournament "
        "teams similar to the opponent's. Use this to infer their likely archetypes and sets.\n"
        "- If <user_personal_context> is provided, it contains your own match history against "
        "similar teams. Use this to avoid past mistakes and double down on winning strategies.\n\n"
        "CRITICAL ACCURACY RULES:\n"
        "- Only reference Pokemon that appear in 'My Team' or 'Opponent's Team' below.\n"
        "- Only reference moves that appear in the provided movepools OR in the "
        "competitive usage data. Do not invent moves.\n"
        "- For `lead_pair`, both leads MUST be chosen from your `bring_four`.\n"
        "- For `damage_calcs`, attacker must be in my team and defender must "
        "be in the opponent team.\n"
        "- DO NOT estimate damage numbers yourself -- the backend computes them "
        "deterministically from the formula. For each calc, only propose the "
        "scenario (attacker, move, defender) and use `note` for set "
        "assumptions like 'assumes Choice Specs, no defensive investment'.\n"
        "- For speed tiers, base them on the HP/Atk/.../Spe numbers provided. "
        "Do not claim speed orders you can't verify from the stat lines.\n"
        "- If usage data for an opponent Pokemon is missing, say so rather than "
        "guessing their set.\n"
    )
    team_name = my_team["team_name"]
    my_pokemon_block = chr(10).join(my_lines)
    my_team_section = (
        f"## My Team (<team_name>{team_name}</team_name>)\n{my_pokemon_block}{mega_note}"
    )
    opp_section = (
        "## Opponent's Team (6 shown in team preview)\n"
        f"{chr(10).join(opp_lines)}"
        f"{usage_context}"
        f"{tournament_context}"
        f"{personal_context}"
        f"{win_rate_context}"
    )
    task_section = """\
## Task
This is VGC doubles format. I see the opponent's 6 in team preview \
and need to pick 4 to bring.

Provide your analysis as a JSON object with exactly this structure:
{
  "summary": "1-2 sentence matchup overview",
  "bring_four": [
    {"pokemon": "Name", "role": "role", "reason": "why"}
  ],
  "lead_pair": ["Name1", "Name2"],
  "threats": [
    {
      "pokemon": "Name",
      "threat_level": "high/medium/low",
      "reason": "why this threatens my team",
      "likely_set": "e.g. Choice Specs special attacker",
      "key_moves": ["Move1", "Move2"]
    }
  ],
  "damage_calcs": [
    {
      "attacker": "Name",
      "move": "MoveName",
      "defender": "Name",
      "note": "scenario assumptions, e.g. 'Choice Specs, 0 SpD investment'"
    }
  ],
  "game_plan": "Turn 1 plan and general strategy."
}

Focus on:
- Which 4 of my 6 counter the opponent best
- Speed tiers and who outspeeds whom
- Key damage calculations (include 4-6 relevant calcs)
- What sets the opponent is most likely running based on usage data
- Specific threats and how to handle them

Return ONLY the JSON object, no markdown fences or explanation."""

    # Strategy notes enrichment
    strategy_ctx = fetch_strategy_context(format=my_team.get("format", "vgc2026"))
    strategy_section = f"\n\n{strategy_ctx}" if strategy_ctx else ""

    return f"{header}\n\n{my_team_section}\n\n{opp_section}{strategy_section}\n\n{task_section}"


def _fetch_selection_pokemon(roster_ids: list[str], user_id: str) -> dict:
    """Fetch species + build details for a session selection of roster IDs."""
    # Resolve user_pokemon UUIDs to builds + species IDs
    user_builds = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id, ability, moves, item_id, stat_points, nature")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    build_rows: list[dict] = user_builds.data  # type: ignore[assignment]
    builds_by_species = {b["pokemon_id"]: b for b in build_rows}
    species_ids = list({b["pokemon_id"] for b in build_rows})

    # Fetch base Pokemon data by species IDs
    pokemon_rows = (
        supabase.table("pokemon")
        .select("id, name, types, base_stats, abilities, movepool, sprite_url")
        .in_("id", species_ids)
        .execute()
    )

    pokemon_list = []
    poke_rows: list[dict] = pokemon_rows.data  # type: ignore[assignment]
    for p in poke_rows:
        build = builds_by_species.get(p["id"], {})
        pokemon_list.append(
            {
                "name": p["name"],
                "types": p["types"],
                "base_stats": p["base_stats"],
                "abilities": p["abilities"],
                "movepool": p["movepool"][:20],  # trim for token budget
                "build": {
                    "ability": build.get("ability"),
                    "moves": build.get("moves"),
                    "item": build.get("item_id"),
                    "nature": build.get("nature"),
                    "stat_points": build.get("stat_points"),
                }
                if build
                else None,
            }
        )

    return {
        "team_name": "Session Selection",
        "format": "doubles",
        "pokemon": pokemon_list,
    }


@router.post("/analyze", response_model=DraftResponse)
@limiter.limit("5/minute")
def analyze_draft(
    request: Request,
    body: DraftRequest,
    model: str = Query(HAIKU_MODEL, pattern=r"^claude-"),
    user_id: str = Depends(get_current_user),
):
    """Analyze a team preview matchup and recommend bring-4 + leads."""
    if not settings.anthropic_api_key:
        raise HTTPException(status_code=400, detail="ANTHROPIC_API_KEY is not configured")

    if not body.my_team_id and not body.my_selection:
        raise HTTPException(
            status_code=400, detail="Must provide either my_team_id or my_selection"
        )

    # Validate model choice
    available = get_available_models(user_id)
    if model not in available:
        model = HAIKU_MODEL  # fallback to Haiku if Sonnet quota exhausted

    # Fetch my team data
    if body.my_team_id:
        my_team = _fetch_team_pokemon(body.my_team_id, user_id)
    else:
        my_team = _fetch_selection_pokemon(body.my_selection or [], user_id)

    team_format = my_team.get("format", "doubles")

    # Hard-block on stale usage data.
    snapshot_date, age_days = snapshot_age_days(team_format)
    if is_stale(age_days):
        raise HTTPException(
            status_code=503,
            detail={
                "error": "stale_data",
                "format": team_format,
                "snapshot_date": snapshot_date,
                "age_days": age_days,
                "threshold_days": STALE_USAGE_THRESHOLD_DAYS,
                "message": (
                    "Pokemon usage data is stale. Draft analysis is paused "
                    "until the next ingest run completes."
                ),
            },
        )

    # Build cache key
    my_pokemon_ids = [str(p["name"]) for p in my_team["pokemon"]]

    # Check cache (tries v2 first, falls back to v1 during grace window).
    cached = _check_cache(body.opponent_team, my_pokemon_ids, snapshot_floor=snapshot_date)
    if cached:
        log_ai_usage(user_id, "draft", model, 0, 0, cached=True)
        return DraftResponse(analysis=cached, cached=True, estimated_cost_usd=0.0)

    # Check daily quota (non-cached requests only) -- Haiku bypasses quota
    if model != HAIKU_MODEL:
        check_ai_quota(user_id)

    # Enrich with data
    opponent_pokemon = _fetch_opponent_pokemon(body.opponent_team)
    opponent_names = [p["name"] for p in opponent_pokemon]
    opponent_ids = [p["id"] for p in opponent_pokemon if p.get("id", 0) > 0]

    opponent_usage = _fetch_usage_context(opponent_names, team_format)
    my_usage: list[dict] = []

    tournament_context = _fetch_tournament_context(opponent_ids)
    personal_context = _fetch_personal_context(user_id, opponent_names)
    personal_win_rates = fetch_personal_win_rates(user_id, opponent_names)

    # Build prompt and call Claude
    prompt = _build_prompt(
        my_team,
        opponent_pokemon,
        opponent_usage,
        my_usage,
        tournament_context,
        personal_context,
        usage_snapshot_date=snapshot_date,
        usage_age_days=age_days,
        personal_win_rates=personal_win_rates,
    )

    ai = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    message = ai.messages.create(
        model=model,
        max_tokens=3000,
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
        analysis = DraftAnalysis.model_validate(raw)
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Claude response: {e}",
        )

    # Replace AI-guessed `estimated_damage` strings with deterministic engine
    # output.
    _compute_damage_calcs(analysis, my_team["pokemon"], opponent_pokemon)

    # Cross-check AI claims against the DB.
    my_team_names = [p["name"] for p in my_team["pokemon"]]
    analysis = verify_draft_analysis(
        analysis,
        my_team_names=my_team_names,
        opponent_team_names=body.opponent_team,
    )

    # Cache the result (v2 key + cache_version=2)
    _save_cache(
        body.opponent_team,
        my_pokemon_ids,
        body.opponent_team,
        {"team_id": body.my_team_id, "selection": body.my_selection, "pokemon": my_pokemon_ids},
        analysis,
    )

    # Log usage with real token counts
    in_tok = message.usage.input_tokens
    out_tok = message.usage.output_tokens
    estimated_cost = estimate_cost(in_tok, out_tok, model)
    log_ai_usage(user_id, "draft", model, in_tok, out_tok)

    return DraftResponse(analysis=analysis, cached=False, estimated_cost_usd=estimated_cost)
