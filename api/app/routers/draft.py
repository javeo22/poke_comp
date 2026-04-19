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


def _check_cache(opponent: list[str], my_pokemon_ids: list[str]) -> DraftAnalysis | None:
    """Try v2 key first, fall back to legacy v1 during grace window."""
    for request_hash, is_legacy in (
        (_make_hash_v2(opponent, my_pokemon_ids), False),
        (_make_hash_v1(opponent, my_pokemon_ids), True),
    ):
        result = (
            supabase.table("ai_analyses")
            .select("response_json, expires_at")
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
    """Fetch user's matchup history against teams containing similar Pokemon.

    Part of the Dual RAG pipeline: personal context stream.
    """
    if not opponent_names:
        return ""

    result = (
        supabase.table("matchup_log")
        .select("outcome, opponent_team_data, lead_pair, notes, played_at")
        .eq("user_id", user_id)
        .order("played_at", desc=True)
        .limit(50)
        .execute()
    )
    if not result.data:
        return ""

    rows: list[dict] = result.data  # type: ignore[assignment]
    opp_set = {n.lower().strip() for n in opponent_names}

    # Find matches where opponent team overlaps with current opponent
    relevant: list[dict] = []
    for row in rows:
        opp_team = row.get("opponent_team_data") or []
        opp_names_in_match = {p.get("name", "").lower() for p in opp_team}
        overlap = opp_set & opp_names_in_match
        if len(overlap) >= 2:
            relevant.append({**row, "overlap": len(overlap)})

    if not relevant:
        return ""

    # Sort by overlap count (most similar first), take top 5
    relevant.sort(key=lambda r: r["overlap"], reverse=True)
    relevant = relevant[:5]

    wins = sum(1 for r in relevant if r["outcome"] == "win")
    losses = len(relevant) - wins
    total = len(relevant)
    win_rate = round(wins / total * 100, 1) if total else 0

    lines = [f"- Your record vs similar teams: {wins}W {losses}L ({win_rate}% win rate)"]
    for r in relevant:
        opp_team = r.get("opponent_team_data") or []
        opp_names_str = ", ".join(p.get("name", "?") for p in opp_team[:6])
        outcome = r["outcome"].upper()
        leads = r.get("lead_pair") or []
        lead_str = f" (led: {', '.join(leads)})" if leads else ""
        notes = sanitize_user_text(r.get("notes") or "")
        note_str = f' -- Notes: "{notes}"' if notes else ""
        lines.append(f"- {outcome} vs [{opp_names_str}]{lead_str}{note_str}")

    return (
        "\n\n## Your Personal History\n"
        "Your past results against similar team compositions:\n" + "\n".join(lines)
    )


def _fetch_tournament_context(pokemon_ids: list[int]) -> str:
    """Fetch tournament archetype if this exact team combination has placed recently."""
    if len(pokemon_ids) < 4:
        return ""

    result = (
        supabase.table("tournament_teams")
        .select("archetype, tournament_name, placement")
        .lte("placement", 8)
        .order("created_at", desc=True)
        .limit(10)
        .execute()
    )

    if result.data:
        arch: dict = result.data[0]  # type: ignore[assignment]
        placement = arch["placement"]
        tournament = arch["tournament_name"]
        archetype = arch["archetype"]
        return (
            f"\n\n## Tournament Context\n"
            f"A similar team recently placed {placement} in "
            f"{tournament}, classified as the '{archetype}' "
            f"archetype. Keep this in mind for the opponent's strategy."
        )

    return ""


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

        atk = from_base_stats(
            attacker_row["name"],
            attacker_row.get("types", []),
            attacker_row.get("base_stats", {}),
        )
        defn = from_base_stats(
            defender_row["name"],
            defender_row.get("types", []),
            defender_row.get("base_stats", {}),
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

    mega_note = ""
    if my_team.get("mega_pokemon_id"):
        mega_note = f"\nMy designated Mega: Pokemon ID {my_team['mega_pokemon_id']}"

    header = (
        "You are a competitive Pokemon Champions VGC doubles analyst. "
        "Analyze this team preview matchup.\n\n"
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
    from app.services.strategy_context import fetch_strategy_context

    strategy_ctx = fetch_strategy_context(format=my_team.get("format", "vgc2026"))
    strategy_section = f"\n\n{strategy_ctx}" if strategy_ctx else ""

    return f"{header}\n\n{my_team_section}\n\n{opp_section}{strategy_section}\n\n{task_section}"


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

    # Validate model choice
    available = get_available_models(user_id)
    if model not in available:
        model = HAIKU_MODEL  # fallback to Haiku if Sonnet quota exhausted

    # Fetch my team data
    my_team = _fetch_team_pokemon(body.my_team_id, user_id)

    # Build cache key
    my_pokemon_ids = [str(p["name"]) for p in my_team["pokemon"]]

    # Check cache (tries v2 first, falls back to v1 during grace window)
    cached = _check_cache(body.opponent_team, my_pokemon_ids)
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

    team_format = my_team.get("format", "doubles")
    opponent_usage = _fetch_usage_context(opponent_names, team_format)
    my_usage: list[dict] = []

    tournament_context = _fetch_tournament_context(opponent_ids)
    personal_context = _fetch_personal_context(user_id, opponent_names)

    # Build prompt and call Claude
    prompt = _build_prompt(
        my_team,
        opponent_pokemon,
        opponent_usage,
        my_usage,
        tournament_context,
        personal_context,
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
    # output. Runs before the verifier so any unresolvable scenario is flagged
    # consistently as a warning.
    _compute_damage_calcs(analysis, my_team["pokemon"], opponent_pokemon)

    # Cross-check AI claims against the DB. Annotates each threat/calc/bring
    # with `verified` + `verification_note`, and populates `analysis.warnings`.
    # Runs before caching so the stored analysis carries the same warnings on
    # future cache hits (no need to re-verify).
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
        {"team_id": body.my_team_id, "pokemon": my_pokemon_ids},
        analysis,
    )

    # Log usage with real token counts
    in_tok = message.usage.input_tokens
    out_tok = message.usage.output_tokens
    estimated_cost = estimate_cost(in_tok, out_tok, model)
    log_ai_usage(user_id, "draft", model, in_tok, out_tok)

    return DraftResponse(analysis=analysis, cached=False, estimated_cost_usd=estimated_cost)
