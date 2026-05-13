from collections import Counter, defaultdict

from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.types import CountMethod

from app.auth import get_current_user
from app.database import supabase
from app.models.matchup import (
    FrequencyStat,
    MatchupCreate,
    MatchupInsights,
    MatchupList,
    MatchupResponse,
    MatchupStats,
    MatchupUpdate,
    PrepAction,
    WinRateStat,
)

router = APIRouter(prefix="/matchups", tags=["matchups"])

_INSIGHT_MIN_SAMPLE = 2


def _win_rate_stat(label: str, wins: int, losses: int) -> WinRateStat:
    total = wins + losses
    return WinRateStat(
        label=label,
        wins=wins,
        losses=losses,
        total=total,
        win_rate=round(wins / total * 100, 1) if total else 0.0,
    )


def _top_frequencies(counter: Counter[str], limit: int = 5) -> list[FrequencyStat]:
    return [
        FrequencyStat(label=label, count=count)
        for label, count in sorted(counter.items(), key=lambda item: (-item[1], item[0]))[:limit]
    ]


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


@router.get("/insights", response_model=MatchupInsights)
def get_insights(user_id: str = Depends(get_current_user)):
    """Deterministic prep notes from the user's match log."""
    result = (
        supabase.table("matchup_log")
        .select(
            "outcome, my_team_id, opponent_team_data, tags, loss_reason, "
            "adjustment_note, played_at"
        )
        .eq("user_id", user_id)
        .order("played_at", desc=True)
        .execute()
    )
    rows: list[dict] = result.data or []  # type: ignore[assignment]

    empty = _win_rate_stat("Last 10", 0, 0)
    if not rows:
        return MatchupInsights(
            total_matches=0,
            recent=empty,
            worst_opponents=[],
            underperforming_teams=[],
            common_loss_reasons=[],
            common_loss_tags=[],
            prep_actions=[
                PrepAction(
                    label="Log your first match",
                    detail="Record outcomes after games to unlock matchup-specific prep notes.",
                    action="log_match",
                )
            ],
        )

    recent_rows = rows[:10]
    recent_wins = sum(1 for row in recent_rows if row.get("outcome") == "win")
    recent_losses = len(recent_rows) - recent_wins
    recent = _win_rate_stat("Last 10", recent_wins, recent_losses)

    team_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    opponent_stats: dict[str, dict[str, int]] = defaultdict(lambda: {"wins": 0, "losses": 0})
    loss_reasons: Counter[str] = Counter()
    loss_tags: Counter[str] = Counter()

    for row in rows:
        outcome = row.get("outcome")
        is_win = outcome == "win"

        team_id = row.get("my_team_id") or "Ad-hoc team"
        if is_win:
            team_stats[str(team_id)]["wins"] += 1
        else:
            team_stats[str(team_id)]["losses"] += 1

        for pokemon in row.get("opponent_team_data") or []:
            if not isinstance(pokemon, dict):
                continue
            name = str(pokemon.get("name") or "").strip()
            if not name:
                continue
            if is_win:
                opponent_stats[name]["wins"] += 1
            else:
                opponent_stats[name]["losses"] += 1

        if not is_win:
            reason = str(row.get("loss_reason") or "").strip()
            if reason:
                loss_reasons[reason] += 1
            for tag in row.get("tags") or []:
                label = str(tag).strip()
                if label:
                    loss_tags[label] += 1

    team_ids = [team_id for team_id in team_stats if team_id != "Ad-hoc team"]
    team_names: dict[str, str] = {}
    if team_ids:
        teams_result = supabase.table("teams").select("id, name").in_("id", team_ids).execute()
        team_rows: list[dict] = teams_result.data or []  # type: ignore[assignment]
        team_names = {str(team["id"]): str(team["name"]) for team in team_rows if team.get("id")}

    worst_opponents = [
        _win_rate_stat(name, counts["wins"], counts["losses"])
        for name, counts in opponent_stats.items()
        if counts["wins"] + counts["losses"] >= _INSIGHT_MIN_SAMPLE and counts["losses"] > 0
    ]
    worst_opponents.sort(key=lambda stat: (stat.win_rate, -stat.losses, -stat.total, stat.label))

    if not worst_opponents:
        worst_opponents = [
            _win_rate_stat(name, counts["wins"], counts["losses"])
            for name, counts in opponent_stats.items()
            if counts["losses"] > 0
        ]
        worst_opponents.sort(key=lambda stat: (-stat.losses, stat.win_rate, stat.label))

    underperforming_teams = [
        _win_rate_stat(team_names.get(team_id, team_id), counts["wins"], counts["losses"])
        for team_id, counts in team_stats.items()
        if counts["wins"] + counts["losses"] >= _INSIGHT_MIN_SAMPLE and counts["losses"] > 0
    ]
    underperforming_teams.sort(key=lambda stat: (stat.win_rate, -stat.losses, -stat.total))

    common_loss_reasons = _top_frequencies(loss_reasons)
    common_loss_tags = _top_frequencies(loss_tags)
    prep_actions: list[PrepAction] = []

    if worst_opponents:
        top = worst_opponents[0]
        prep_actions.append(
            PrepAction(
                label=f"Prep into {top.label}",
                detail=f"{top.wins}-{top.losses} record across {top.total} logged appearances.",
                action="benchmark_team",
            )
        )
    if underperforming_teams:
        top_team = underperforming_teams[0]
        prep_actions.append(
            PrepAction(
                label=f"Audit {top_team.label}",
                detail=f"{top_team.win_rate:.1f}% win rate across {top_team.total} logged matches.",
                action="review_team",
            )
        )
    if common_loss_reasons:
        reason = common_loss_reasons[0]
        prep_actions.append(
            PrepAction(
                label=f"Address {reason.label}",
                detail=f"Tagged in {reason.count} logged losses.",
                action="review_losses",
            )
        )
    elif common_loss_tags:
        tag = common_loss_tags[0]
        prep_actions.append(
            PrepAction(
                label=f"Review {tag.label} matchups",
                detail=f"Appears on {tag.count} logged losses.",
                action="review_losses",
            )
        )

    if not prep_actions:
        prep_actions.append(
            PrepAction(
                label="Keep logging outcomes",
                detail="More structured match data will unlock matchup-specific prep notes.",
                action="log_match",
            )
        )

    return MatchupInsights(
        total_matches=len(rows),
        recent=recent,
        worst_opponents=worst_opponents[:5],
        underperforming_teams=underperforming_teams[:5],
        common_loss_reasons=common_loss_reasons,
        common_loss_tags=common_loss_tags,
        prep_actions=prep_actions[:4],
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
