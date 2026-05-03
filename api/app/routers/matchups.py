from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.types import CountMethod

from app.auth import get_current_user
from app.database import supabase
from app.models.matchup import (
    MatchupCreate,
    MatchupList,
    MatchupResponse,
    MatchupStats,
    MatchupUpdate,
    WinRateStat,
)

router = APIRouter(prefix="/matchups", tags=["matchups"])


@router.get("", response_model=MatchupList)
def list_matchups(
    outcome: str | None = Query(None, description="Filter: win or loss"),
    my_team_id: str | None = Query(None, description="Filter by team UUID"),
    opponent_pokemon: str | None = Query(
        None, description="Filter by opponent Pokemon name (partial match)"
    ),
    format: str | None = Query(
        None,
        description="Filter by format: ladder | bo1 | bo3 | tournament | friendly",
    ),
    tag: str | None = Query(None, description="Filter by a single archetype tag"),
    limit: int = Query(50, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
):
    query = (
        supabase.table("matchup_log").select("*", count=CountMethod.exact).eq("user_id", user_id)
    )

    if outcome:
        query = query.eq("outcome", outcome)
    if my_team_id:
        query = query.eq("my_team_id", my_team_id)
    if format:
        query = query.eq("format", format)
    if tag:
        # Postgres array-contains via PostgREST 'cs' (contains) operator.
        query = query.contains("tags", [tag])

    result = query.order("played_at", desc=True).range(offset, offset + limit - 1).execute()

    rows: list[dict] = result.data  # type: ignore[assignment]

    # Client-side filter for opponent Pokemon (JSONB containment)
    if opponent_pokemon:
        search = opponent_pokemon.lower()
        rows = [
            r
            for r in rows
            if r.get("opponent_team_data")
            and any(search in p.get("name", "").lower() for p in r["opponent_team_data"])
        ]

    return MatchupList(
        data=[MatchupResponse.model_validate(r) for r in rows],
        count=result.count or len(rows),
    )


@router.get("/stats", response_model=MatchupStats)
def get_stats(user_id: str = Depends(get_current_user)):
    """Win rate analytics: overall, by team, by opponent Pokemon, by format, by tag."""
    result = (
        supabase.table("matchup_log")
        .select("outcome, my_team_id, opponent_team_data, format, tags")
        .eq("user_id", user_id)
        .execute()
    )
    all_rows: list[dict] = result.data  # type: ignore[assignment]

    if not all_rows:
        empty = WinRateStat(label="Overall", wins=0, losses=0, total=0, win_rate=0.0)
        return MatchupStats(
            overall=empty,
            by_team=[],
            by_opponent_pokemon=[],
            by_format=[],
            by_tag=[],
        )

    # Overall
    wins = sum(1 for r in all_rows if r["outcome"] == "win")
    losses = len(all_rows) - wins
    total = len(all_rows)
    overall = WinRateStat(
        label="Overall",
        wins=wins,
        losses=losses,
        total=total,
        win_rate=round(wins / total * 100, 1) if total else 0.0,
    )

    # By team
    team_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    for r in all_rows:
        tid = r.get("my_team_id") or "Unknown"
        if r["outcome"] == "win":
            team_stats[tid]["wins"] += 1
        else:
            team_stats[tid]["losses"] += 1

    # Resolve team names
    team_ids = [tid for tid in team_stats if tid != "Unknown"]
    team_names: dict[str, str] = {}
    if team_ids:
        teams_result = supabase.table("teams").select("id, name").in_("id", team_ids).execute()
        team_rows: list[dict] = teams_result.data  # type: ignore[assignment]
        team_names = {t["id"]: t["name"] for t in team_rows}

    by_team = []
    for tid, counts in team_stats.items():
        wins = counts["wins"]
        losses = counts["losses"]
        total = wins + losses
        by_team.append(
            WinRateStat(
                label=team_names.get(tid, tid),
                wins=wins,
                losses=losses,
                total=total,
                win_rate=round(wins / total * 100, 1) if total else 0.0,
            )
        )
    by_team.sort(key=lambda s: s.total, reverse=True)

    # By opponent Pokemon
    opp_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    for r in all_rows:
        opp_team = r.get("opponent_team_data") or []
        for p in opp_team:
            name = p.get("name", "Unknown")
            if r["outcome"] == "win":
                opp_stats[name]["wins"] += 1
            else:
                opp_stats[name]["losses"] += 1

    by_opp = []
    for name, counts in opp_stats.items():
        wins = counts["wins"]
        losses = counts["losses"]
        total = wins + losses
        by_opp.append(
            WinRateStat(
                label=name,
                wins=wins,
                losses=losses,
                total=total,
                win_rate=round(wins / total * 100, 1) if total else 0.0,
            )
        )
    by_opp.sort(key=lambda s: s.total, reverse=True)

    # By format (ladder/bo1/bo3/tournament/friendly)
    fmt_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    for r in all_rows:
        fmt = r.get("format")
        if not fmt:
            continue
        if r["outcome"] == "win":
            fmt_stats[fmt]["wins"] += 1
        else:
            fmt_stats[fmt]["losses"] += 1

    by_format = []
    for fmt, counts in fmt_stats.items():
        wins = counts["wins"]
        losses = counts["losses"]
        total = wins + losses
        by_format.append(
            WinRateStat(
                label=fmt,
                wins=wins,
                losses=losses,
                total=total,
                win_rate=round(wins / total * 100, 1) if total else 0.0,
            )
        )
    by_format.sort(key=lambda s: s.total, reverse=True)

    # By tag (archetype labels users apply to matches)
    tag_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    for r in all_rows:
        tags = r.get("tags") or []
        for tag in tags:
            if r["outcome"] == "win":
                tag_stats[tag]["wins"] += 1
            else:
                tag_stats[tag]["losses"] += 1

    by_tag = []
    for tag, counts in tag_stats.items():
        wins = counts["wins"]
        losses = counts["losses"]
        total = wins + losses
        by_tag.append(
            WinRateStat(
                label=tag,
                wins=wins,
                losses=losses,
                total=total,
                win_rate=round(wins / total * 100, 1) if total else 0.0,
            )
        )
    by_tag.sort(key=lambda s: s.total, reverse=True)

    return MatchupStats(
        overall=overall,
        by_team=by_team,
        by_opponent_pokemon=by_opp[:20],
        by_format=by_format,
        by_tag=by_tag[:20],
    )


@router.get("/{matchup_id}", response_model=MatchupResponse)
def get_matchup(matchup_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("matchup_log")
        .select("*")
        .eq("id", matchup_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return MatchupResponse.model_validate(result.data)


@router.post("", response_model=MatchupResponse, status_code=201)
def create_matchup(body: MatchupCreate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True, mode="json")
    data["user_id"] = user_id

    result = supabase.table("matchup_log").insert(data).execute()
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=400, detail="Failed to log matchup")
    return MatchupResponse.model_validate(rows[0])


@router.put("/{matchup_id}", response_model=MatchupResponse)
def update_matchup(matchup_id: str, body: MatchupUpdate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True, mode="json")
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("matchup_log")
        .update(data)
        .eq("id", matchup_id)
        .eq("user_id", user_id)
        .execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Matchup not found")
    return MatchupResponse.model_validate(rows[0])


@router.delete("/{matchup_id}", status_code=204)
def delete_matchup(matchup_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("matchup_log").delete().eq("id", matchup_id).eq("user_id", user_id).execute()
    )
    rows: list[dict] = result.data  # type: ignore[assignment]
    if not rows:
        raise HTTPException(status_code=404, detail="Matchup not found")
