from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse
from postgrest.types import CountMethod
from pydantic import BaseModel, Field

from app.auth import get_current_user
from app.database import supabase
from app.models.team import (
    TeamBenchmarkAnswer,
    TeamBenchmarkCalc,
    TeamBenchmarkCoverageGap,
    TeamBenchmarkResponse,
    TeamBenchmarkSpeedIssue,
    TeamCreate,
    TeamList,
    TeamResponse,
    TeamUpdate,
)
from app.services.damage_calc import (
    CalcMove,
    calculate_damage,
    format_damage_string,
    from_base_stats,
)
from app.services.showdown_parser import (
    export_showdown_paste,
    parse_showdown_paste,
    resolve_pokemon_ids,
)
from app.validators import validate_champions_pokemon_batch

router = APIRouter(prefix="/teams", tags=["teams"])


def _norm_name(name: str) -> str:
    return name.lower().replace("-", "").replace(" ", "")


def _usage_entries(data: list | dict | None, limit: int) -> list[str]:
    if isinstance(data, list):
        return [
            str(entry["name"] if isinstance(entry, dict) else entry)
            for entry in data[:limit]
            if (isinstance(entry, dict) and entry.get("name")) or (isinstance(entry, str) and entry)
        ]
    if isinstance(data, dict):
        return [str(name) for name in list(data.keys())[:limit]]
    return []


def _severity(max_pct: float) -> str:
    if max_pct >= 100:
        return "ohko"
    if max_pct >= 70:
        return "danger"
    if max_pct >= 45:
        return "chip"
    return "low"


def _reliability(max_pct: float) -> str:
    if max_pct >= 100:
        return "ko"
    if max_pct >= 70:
        return "strong"
    if max_pct >= 45:
        return "chip"
    return "weak"


def _fetch_team_builds(team_id: str, user_id: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
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

    team_row: dict[str, Any] = team.data  # type: ignore[assignment]
    roster_ids: list[str] = team_row.get("pokemon_ids") or []
    if not roster_ids:
        raise HTTPException(status_code=400, detail="Team has no Pokemon")

    build_result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id, ability, moves, item_id, stat_points, nature")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    build_rows: list[dict[str, Any]] = build_result.data or []  # type: ignore[assignment]
    build_by_id = {row["id"]: row for row in build_rows}
    species_ids = [row["pokemon_id"] for row in build_rows if row.get("pokemon_id")]

    pokemon_result = (
        supabase.table("pokemon")
        .select("id, name, types, base_stats")
        .in_("id", species_ids)
        .execute()
    )
    pokemon_rows: list[dict[str, Any]] = pokemon_result.data or []  # type: ignore[assignment]
    pokemon_by_id = {row["id"]: row for row in pokemon_rows}

    members: list[dict[str, Any]] = []
    for roster_id in roster_ids:
        build = build_by_id.get(roster_id)
        if not build:
            continue
        pokemon = pokemon_by_id.get(build.get("pokemon_id"))
        if not pokemon:
            continue
        members.append(
            {
                **pokemon,
                "build": build,
                "calc": from_base_stats(
                    str(pokemon["name"]),
                    pokemon.get("types") or [],
                    pokemon.get("base_stats") or {},
                    stat_points=build.get("stat_points"),
                    nature=build.get("nature"),
                ),
            }
        )

    if not members:
        raise HTTPException(status_code=400, detail="Team Pokemon could not be resolved")
    return team_row, members


def _fetch_latest_usage_rows(
    format_key: str, limit: int
) -> tuple[list[dict[str, Any]], str | None]:
    latest = (
        supabase.table("pokemon_usage")
        .select("snapshot_date")
        .eq("format", format_key)
        .order("snapshot_date", desc=True)
        .limit(1)
        .execute()
    )
    latest_rows: list[dict[str, Any]] = latest.data or []  # type: ignore[assignment]
    if not latest_rows:
        return [], None

    snapshot_date = str(latest_rows[0]["snapshot_date"])
    rows_result = (
        supabase.table("pokemon_usage")
        .select("pokemon_name, usage_percent, moves, snapshot_date")
        .eq("format", format_key)
        .eq("snapshot_date", snapshot_date)
        .order("usage_percent", desc=True)
        .execute()
    )
    rows: list[dict[str, Any]] = rows_result.data or []  # type: ignore[assignment]
    by_name: dict[str, dict[str, Any]] = {}
    for row in rows:
        name = str(row.get("pokemon_name") or "")
        if not name:
            continue
        current = by_name.get(_norm_name(name))
        if current is None or float(row.get("usage_percent") or 0) > float(
            current.get("usage_percent") or 0
        ):
            by_name[_norm_name(name)] = row
    deduped = sorted(
        by_name.values(),
        key=lambda row: float(row.get("usage_percent") or 0),
        reverse=True,
    )
    return deduped[:limit], snapshot_date


def _fetch_pokemon_by_names(names: list[str]) -> dict[str, dict[str, Any]]:
    if not names:
        return {}
    rows: list[dict[str, Any]] = (
        supabase.table("pokemon")
        .select("id, name, types, base_stats")
        .in_("name", names)
        .execute()
        .data
        or []
    )  # type: ignore[assignment]
    found = {_norm_name(str(row["name"])): row for row in rows}
    missing = [name for name in names if _norm_name(name) not in found]
    for name in missing:
        result = (
            supabase.table("pokemon")
            .select("id, name, types, base_stats")
            .ilike("name", name)
            .limit(1)
            .execute()
        )
        fallback_rows: list[dict[str, Any]] = result.data or []  # type: ignore[assignment]
        if fallback_rows:
            found[_norm_name(name)] = fallback_rows[0]
    return found


def _fetch_moves_by_names(names: list[str]) -> dict[str, dict[str, Any]]:
    if not names:
        return {}
    rows: list[dict[str, Any]] = (
        supabase.table("moves")
        .select("id, name, type, category, power, target")
        .in_("name", names)
        .execute()
        .data
        or []
    )  # type: ignore[assignment]
    return {_norm_name(str(row["name"])): row for row in rows}


@router.get("", response_model=TeamList)
def list_teams(
    format: str | None = Query(None, description="Filter by format (singles, doubles)"),
    archetype_tag: str | None = Query(None, description="Filter by archetype tag"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
):
    query = supabase.table("teams").select("*", count=CountMethod.exact).eq("user_id", user_id)

    if format:
        query = query.eq("format", format)
    if archetype_tag:
        query = query.ilike("archetype_tag", f"%{archetype_tag}%")

    result = query.order("updated_at", desc=True).range(offset, offset + limit - 1).execute()
    return TeamList(
        data=[TeamResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{team_id}", response_model=TeamResponse)
def get_team(team_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return TeamResponse.model_validate(result.data)


@router.get("/{team_id}/benchmark", response_model=TeamBenchmarkResponse)
def benchmark_team(
    team_id: str,
    format: str = Query("doubles", pattern=r"^(singles|doubles)$"),
    limit: int = Query(12, ge=3, le=30),
    user_id: str = Depends(get_current_user),
):
    """Benchmark a saved team against current top usage threats.

    Uses the deterministic damage calculator with saved user spreads for the
    user's side and usage top moves for the meta-threat side. This is a fast,
    non-AI read of danger, answers, speed issues, and coverage gaps.
    """
    team, members = _fetch_team_builds(team_id, user_id)
    usage_rows, snapshot_date = _fetch_latest_usage_rows(format, limit)
    if not usage_rows:
        raise HTTPException(status_code=404, detail="No usage data available for benchmark")

    is_doubles = format == "doubles"
    threat_names = [str(row["pokemon_name"]) for row in usage_rows if row.get("pokemon_name")]
    threat_pokemon_by_name = _fetch_pokemon_by_names(threat_names)

    move_names: set[str] = set()
    for member in members:
        move_names.update(str(move) for move in (member.get("build", {}).get("moves") or []))
    for row in usage_rows:
        move_names.update(_usage_entries(row.get("moves"), 4))
    move_by_name = _fetch_moves_by_names(sorted(move_names))

    defensive_dangers: list[TeamBenchmarkCalc] = []
    offensive_answers: list[TeamBenchmarkAnswer] = []
    speed_issues: list[TeamBenchmarkSpeedIssue] = []
    coverage_gaps: list[TeamBenchmarkCoverageGap] = []

    fastest_member = max(members, key=lambda member: int(member["calc"].speed))
    fastest_speed = int(fastest_member["calc"].speed)

    for usage in usage_rows:
        usage_name = str(usage.get("pokemon_name") or "")
        threat_row = threat_pokemon_by_name.get(_norm_name(usage_name))
        if not threat_row:
            continue
        threat_calc = from_base_stats(
            str(threat_row["name"]),
            threat_row.get("types") or [],
            threat_row.get("base_stats") or {},
        )
        threat_usage = float(usage.get("usage_percent") or 0)
        threat_moves = [
            move_by_name[_norm_name(name)]
            for name in _usage_entries(usage.get("moves"), 4)
            if _norm_name(name) in move_by_name
        ]

        best_danger: tuple[dict[str, Any] | None, dict[str, Any] | None, dict | None] = (
            None,
            None,
            None,
        )
        for move_row in threat_moves:
            move = CalcMove(
                name=str(move_row["name"]),
                type=str(move_row.get("type") or "").lower(),
                category=str(move_row.get("category") or "physical").lower(),
                power=int(move_row.get("power") or 0),
                target=str(move_row.get("target") or "selected-pokemon"),
            )
            for member in members:
                result = calculate_damage(threat_calc, move, member["calc"], is_doubles=is_doubles)
                if result["skipped_reason"]:
                    continue
                if best_danger[2] is None or result["max_pct"] > best_danger[2]["max_pct"]:
                    best_danger = (move_row, member, result)

        if best_danger[0] is not None and best_danger[1] is not None and best_danger[2] is not None:
            move_row, member, result = best_danger
            defensive_dangers.append(
                TeamBenchmarkCalc(
                    pokemon_name=str(threat_row["name"]),
                    pokemon_id=int(threat_row["id"]),
                    usage_percent=threat_usage,
                    move=str(move_row["name"]),
                    damage_text=format_damage_string(result),
                    damage_percent=float(result["max_pct"]),
                    target_name=str(member["name"]),
                    severity=_severity(float(result["max_pct"])),
                )
            )

        best_answer: tuple[dict[str, Any] | None, dict[str, Any] | None, dict | None] = (
            None,
            None,
            None,
        )
        for member in members:
            for move_name in member.get("build", {}).get("moves") or []:
                move_row = move_by_name.get(_norm_name(str(move_name)))
                if not move_row:
                    continue
                move = CalcMove(
                    name=str(move_row["name"]),
                    type=str(move_row.get("type") or "").lower(),
                    category=str(move_row.get("category") or "physical").lower(),
                    power=int(move_row.get("power") or 0),
                    target=str(move_row.get("target") or "selected-pokemon"),
                )
                result = calculate_damage(member["calc"], move, threat_calc, is_doubles=is_doubles)
                if result["skipped_reason"]:
                    continue
                if best_answer[2] is None or result["max_pct"] > best_answer[2]["max_pct"]:
                    best_answer = (move_row, member, result)

        if best_answer[0] is not None and best_answer[1] is not None and best_answer[2] is not None:
            move_row, member, result = best_answer
            offensive_answers.append(
                TeamBenchmarkAnswer(
                    pokemon_name=str(threat_row["name"]),
                    pokemon_id=int(threat_row["id"]),
                    usage_percent=threat_usage,
                    answer_pokemon=str(member["name"]),
                    move=str(move_row["name"]),
                    damage_text=format_damage_string(result),
                    damage_percent=float(result["max_pct"]),
                    reliability=_reliability(float(result["max_pct"])),
                )
            )
            if float(result["max_pct"]) < 45:
                coverage_gaps.append(
                    TeamBenchmarkCoverageGap(
                        pokemon_name=str(threat_row["name"]),
                        pokemon_id=int(threat_row["id"]),
                        usage_percent=threat_usage,
                        best_damage_percent=float(result["max_pct"]),
                        best_answer=str(member["name"]),
                        note="No saved move reaches 45% max damage in the deterministic calc.",
                    )
                )
        else:
            coverage_gaps.append(
                TeamBenchmarkCoverageGap(
                    pokemon_name=str(threat_row["name"]),
                    pokemon_id=int(threat_row["id"]),
                    usage_percent=threat_usage,
                    best_damage_percent=0,
                    best_answer=None,
                    note="No saved attacking move could be benchmarked.",
                )
            )

        if threat_calc.speed > fastest_speed:
            speed_issues.append(
                TeamBenchmarkSpeedIssue(
                    pokemon_name=str(threat_row["name"]),
                    pokemon_id=int(threat_row["id"]),
                    usage_percent=threat_usage,
                    threat_speed=int(threat_calc.speed),
                    fastest_team_member=str(fastest_member["name"]),
                    fastest_team_speed=fastest_speed,
                    note="Threat outspeeds your fastest saved build before speed control.",
                )
            )

    defensive_dangers.sort(key=lambda row: row.damage_percent, reverse=True)
    offensive_answers.sort(key=lambda row: row.usage_percent, reverse=True)
    speed_issues.sort(key=lambda row: row.threat_speed - row.fastest_team_speed, reverse=True)
    coverage_gaps.sort(key=lambda row: (row.best_damage_percent, -row.usage_percent))

    unresolved_threats = len([gap for gap in coverage_gaps if gap.best_answer is None])

    return TeamBenchmarkResponse(
        team_id=str(team["id"]),
        team_name=str(team["name"]),
        format=format,
        generated_at=datetime.now(UTC),
        meta_snapshot_date=snapshot_date,
        threat_count=len(offensive_answers) + unresolved_threats,
        defensive_dangers=defensive_dangers[:limit],
        offensive_answers=offensive_answers[:limit],
        speed_issues=speed_issues[:limit],
        coverage_gaps=coverage_gaps[:limit],
    )


def _resolve_roster_pokemon_ids(user_id: str, roster_ids: list[str]) -> list[int]:
    """Resolve user_pokemon UUIDs to pokemon species IDs for validation.

    Verifies that all roster entries exist and belong to the user.
    """
    result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    found = {row["id"]: row["pokemon_id"] for row in rows}

    missing = set(roster_ids) - set(found.keys())
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Roster entries not found: {sorted(missing)}",
        )

    return [found[rid] for rid in roster_ids]


def _normalize_mega_ids(
    mega_pokemon_id: str | None,
    mega_pokemon_ids: list[str] | None,
) -> list[str]:
    if mega_pokemon_ids is not None:
        return [mega_id for mega_id in mega_pokemon_ids if mega_id]
    return [mega_pokemon_id] if mega_pokemon_id else []


def _normalize_mega_form_ids(
    mega_form_pokemon_id: int | None,
    mega_form_pokemon_ids: list[int] | None,
) -> list[int]:
    if mega_form_pokemon_ids is not None:
        return [form_id for form_id in mega_form_pokemon_ids if form_id]
    return [mega_form_pokemon_id] if mega_form_pokemon_id else []


def _validate_mega(pokemon_ids: list[str], mega_pokemon_ids: list[str]) -> None:
    """Validate designated Mega roster entries. Champions teams may prep up to two."""
    if len(mega_pokemon_ids) > 2:
        raise HTTPException(status_code=400, detail="Teams can designate at most two Mega Pokemon")
    if len(set(mega_pokemon_ids)) != len(mega_pokemon_ids):
        raise HTTPException(status_code=400, detail="Mega Pokemon selections must be unique")

    missing = [mega_id for mega_id in mega_pokemon_ids if mega_id not in pokemon_ids]
    if missing:
        raise HTTPException(
            status_code=400,
            detail="Mega Pokemon must be a member of the team",
        )


def _is_missing_dual_mega_column_error(err: Exception) -> bool:
    message = str(err).lower()
    mentions_dual_mega = "mega_pokemon_ids" in message or "mega_form_pokemon_ids" in message
    return mentions_dual_mega and ("column" in message or "schema cache" in message)


def _drop_dual_mega_columns_for_legacy_db(
    data: dict[str, Any],
    mega_ids: list[str],
) -> dict[str, Any]:
    if len(mega_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Two Mega options require the pending team dual-Mega database migration",
        )

    legacy_data = data.copy()
    legacy_data.pop("mega_pokemon_ids", None)
    legacy_data.pop("mega_form_pokemon_ids", None)
    return legacy_data


@router.post("", response_model=TeamResponse, status_code=201)
def create_team(body: TeamCreate, user_id: str = Depends(get_current_user)):
    species_ids = _resolve_roster_pokemon_ids(user_id, body.pokemon_ids)
    validate_champions_pokemon_batch(species_ids)
    mega_ids = _normalize_mega_ids(body.mega_pokemon_id, body.mega_pokemon_ids)
    mega_form_ids = _normalize_mega_form_ids(body.mega_form_pokemon_id, body.mega_form_pokemon_ids)
    if mega_form_ids and len(mega_form_ids) != len(mega_ids):
        raise HTTPException(status_code=400, detail="Mega form selections must match Mega Pokemon")
    _validate_mega(body.pokemon_ids, mega_ids)

    data = body.model_dump(exclude_none=True)
    data["mega_pokemon_ids"] = mega_ids
    data["mega_form_pokemon_ids"] = mega_form_ids
    data["mega_pokemon_id"] = mega_ids[0] if mega_ids else None
    data["mega_form_pokemon_id"] = mega_form_ids[0] if mega_form_ids else None
    data["user_id"] = user_id

    try:
        result = supabase.table("teams").insert(data).execute()
    except Exception as err:
        if not _is_missing_dual_mega_column_error(err):
            raise
        legacy_data = _drop_dual_mega_columns_for_legacy_db(data, mega_ids)
        result = supabase.table("teams").insert(legacy_data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create team")
    return TeamResponse.model_validate(result.data[0])


@router.put("/{team_id}", response_model=TeamResponse)
def update_team(team_id: str, body: TeamUpdate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    # Validate Champions eligibility when pokemon_ids change
    if body.pokemon_ids is not None:
        species_ids = _resolve_roster_pokemon_ids(user_id, body.pokemon_ids)
        validate_champions_pokemon_batch(species_ids)

    mega_fields = {
        "mega_pokemon_id",
        "mega_form_pokemon_id",
        "mega_pokemon_ids",
        "mega_form_pokemon_ids",
    }
    if body.pokemon_ids is not None or (body.model_fields_set & mega_fields):
        current = (
            supabase.table("teams")
            .select("*")
            .eq("id", team_id)
            .eq("user_id", user_id)
            .single()
            .execute()
        )
        current_row: dict = current.data  # type: ignore[assignment]
        ids = body.pokemon_ids if body.pokemon_ids is not None else current_row["pokemon_ids"]
        mega_ids = _normalize_mega_ids(
            body.mega_pokemon_id
            if "mega_pokemon_id" in body.model_fields_set
            else current_row.get("mega_pokemon_id"),
            body.mega_pokemon_ids
            if "mega_pokemon_ids" in body.model_fields_set
            else current_row.get("mega_pokemon_ids"),
        )
        mega_form_ids = _normalize_mega_form_ids(
            body.mega_form_pokemon_id
            if "mega_form_pokemon_id" in body.model_fields_set
            else current_row.get("mega_form_pokemon_id"),
            body.mega_form_pokemon_ids
            if "mega_form_pokemon_ids" in body.model_fields_set
            else current_row.get("mega_form_pokemon_ids"),
        )
        if mega_form_ids and len(mega_form_ids) != len(mega_ids):
            raise HTTPException(
                status_code=400, detail="Mega form selections must match Mega Pokemon"
            )
        _validate_mega(list(ids), mega_ids)
        data["mega_pokemon_ids"] = mega_ids
        data["mega_form_pokemon_ids"] = mega_form_ids
        data["mega_pokemon_id"] = mega_ids[0] if mega_ids else None
        data["mega_form_pokemon_id"] = mega_form_ids[0] if mega_form_ids else None

    try:
        result = (
            supabase.table("teams").update(data).eq("id", team_id).eq("user_id", user_id).execute()
        )
    except Exception as err:
        if not _is_missing_dual_mega_column_error(err):
            raise
        legacy_data = _drop_dual_mega_columns_for_legacy_db(data, mega_ids)
        result = (
            supabase.table("teams")
            .update(legacy_data)
            .eq("id", team_id)
            .eq("user_id", user_id)
            .execute()
        )
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")
    return TeamResponse.model_validate(result.data[0])


@router.delete("/{team_id}", status_code=204)
def delete_team(team_id: str, user_id: str = Depends(get_current_user)):
    result = supabase.table("teams").delete().eq("id", team_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Team not found")


# ── Showdown Import / Export ─────────────────────────────────────────────


class ImportRequest(BaseModel):
    paste: str = Field(description="Showdown paste text")
    team_name: str | None = Field(default=None, description="Name for the imported team")
    format: str = Field(pattern=r"^(singles|doubles)$")


class PreviewRequest(BaseModel):
    paste: str = Field(description="Showdown paste text")


class PreviewPokemon(BaseModel):
    name: str
    pokemon_id: int | None = None
    item: str | None = None
    item_id: int | None = None
    ability: str | None = None
    nature: str | None = None
    stat_points: dict[str, int] | None = None
    moves: list[str] = []
    resolved: bool = False


class PreviewResponse(BaseModel):
    pokemon: list[PreviewPokemon]
    warnings: list[str]


class ImportResponse(BaseModel):
    team: TeamResponse
    pokemon_created: int
    warnings: list[str]


def _suggest_team_name(parsed_names: list[str]) -> str:
    if not parsed_names:
        return "Imported Team"
    first = parsed_names[0]
    second = parsed_names[1] if len(parsed_names) > 1 else ""
    return f"{first} {second} Core".strip()


@router.post("/import/preview", response_model=PreviewResponse)
def preview_import(body: PreviewRequest, _user_id: str = Depends(get_current_user)):
    """Preview a Showdown paste without creating any data.

    Parses and resolves names to IDs so the user can review before confirming.
    """
    parsed = parse_showdown_paste(body.paste)
    if not parsed.pokemon:
        raise HTTPException(
            status_code=400,
            detail="No Pokemon found in paste. Check the format.",
        )

    parsed = resolve_pokemon_ids(parsed)

    preview_pokemon = [
        PreviewPokemon(
            name=p.name,
            pokemon_id=p.pokemon_id,
            item=p.item,
            item_id=p.item_id,
            ability=p.ability,
            nature=p.nature,
            stat_points=p.stat_points,
            moves=p.moves,
            resolved=p.pokemon_id is not None,
        )
        for p in parsed.pokemon
    ]

    return PreviewResponse(pokemon=preview_pokemon, warnings=parsed.warnings)


@router.post("/import", response_model=ImportResponse, status_code=201)
def import_team(body: ImportRequest, user_id: str = Depends(get_current_user)):
    """Import a team from Showdown paste format.

    Parses the paste, resolves Pokemon/item names to DB IDs,
    creates user_pokemon entries, and assembles a team.
    """
    parsed = parse_showdown_paste(body.paste)
    if not parsed.pokemon:
        raise HTTPException(
            status_code=400,
            detail="No Pokemon found in paste. Check the format.",
        )

    # Resolve names to IDs
    parsed = resolve_pokemon_ids(parsed)

    # Filter to Pokemon that resolved successfully
    resolved = [p for p in parsed.pokemon if p.pokemon_id is not None]
    if not resolved:
        raise HTTPException(
            status_code=400,
            detail=f"No Pokemon could be resolved. Warnings: {parsed.warnings}",
        )

    # Validate Champions eligibility (batch)
    pokemon_ids = [p.pokemon_id for p in resolved if p.pokemon_id]
    validate_champions_pokemon_batch(pokemon_ids)

    # Create user_pokemon entries — store their UUIDs for the team
    created_roster_ids: list[str] = []
    for p in resolved:
        row: dict[str, Any] = {
            "user_id": user_id,
            "pokemon_id": p.pokemon_id,
            "ability": p.ability,
            "nature": p.nature,
            "stat_points": p.stat_points,
            "moves": p.moves if len(p.moves) == 4 else None,
            "item_id": p.item_id,
            "build_status": "built",
            "vp_spent": 0,
        }
        result = supabase.table("user_pokemon").insert(row).execute()
        rows: list[dict[str, Any]] = result.data  # type: ignore[assignment]
        if rows:
            created_roster_ids.append(rows[0]["id"])

    # Create the team
    team_name = (body.team_name or "").strip() or _suggest_team_name([p.name for p in resolved])
    team_data: dict[str, Any] = {
        "user_id": user_id,
        "name": team_name,
        "format": body.format,
        "pokemon_ids": created_roster_ids[:6],
    }
    team_result = supabase.table("teams").insert(team_data).execute()
    team_rows: list[dict[str, Any]] = team_result.data  # type: ignore[assignment]
    if not team_rows:
        raise HTTPException(status_code=500, detail="Failed to create team")

    return ImportResponse(
        team=TeamResponse.model_validate(team_rows[0]),
        pokemon_created=len(created_roster_ids),
        warnings=parsed.warnings,
    )


@router.get("/{team_id}/export", response_class=PlainTextResponse)
def export_team(team_id: str, user_id: str = Depends(get_current_user)):
    """Export a team in Showdown paste format."""
    # Fetch team
    team = (
        supabase.table("teams")
        .select("*")
        .eq("id", team_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not team.data:
        raise HTTPException(status_code=404, detail="Team not found")

    team_row: dict[str, Any] = team.data  # type: ignore[assignment]
    roster_ids: list[str] = team_row["pokemon_ids"]

    # Fetch user_pokemon entries (roster builds) by their UUIDs
    builds_result = (
        supabase.table("user_pokemon")
        .select("id, pokemon_id, ability, nature, stat_points, moves, item_id")
        .eq("user_id", user_id)
        .in_("id", roster_ids)
        .execute()
    )
    builds: list[dict[str, Any]] = builds_result.data  # type: ignore[assignment]
    build_map = {b["id"]: b for b in builds}

    # Fetch Pokemon base data for names
    species_ids = list({b["pokemon_id"] for b in builds})
    poke_result = supabase.table("pokemon").select("id, name").in_("id", species_ids).execute()
    poke_rows: list[dict[str, Any]] = poke_result.data  # type: ignore[assignment]
    poke_map = {r["id"]: r["name"] for r in poke_rows}

    # Fetch item names
    item_ids = [b["item_id"] for b in builds if b.get("item_id")]
    item_map: dict[int, str] = {}
    if item_ids:
        items_result = supabase.table("items").select("id, name").in_("id", item_ids).execute()
        item_rows: list[dict[str, Any]] = items_result.data  # type: ignore[assignment]
        item_map = {r["id"]: r["name"] for r in item_rows}

    # Assemble export data in team order
    export_data: list[dict[str, Any]] = []
    for rid in roster_ids:
        build = build_map.get(rid, {})
        pokemon_id = build.get("pokemon_id")
        name = poke_map.get(pokemon_id, f"Pokemon #{pokemon_id}") if pokemon_id else "Unknown"
        item_name = item_map.get(build.get("item_id", 0))
        export_data.append(
            {
                "name": name,
                "item_name": item_name,
                "ability": build.get("ability"),
                "nature": build.get("nature"),
                "stat_points": build.get("stat_points"),
                "moves": build.get("moves") or [],
            }
        )

    return export_showdown_paste(export_data)
