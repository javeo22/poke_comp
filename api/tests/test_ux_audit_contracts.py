from unittest.mock import MagicMock, patch

import pytest

with patch("supabase.create_client") as mock_create:
    mock_create.return_value = MagicMock()
    from app.main import app

from fastapi.testclient import TestClient

from app.auth import get_current_user
from app.models.draft import DraftAnalysis
from app.models.matchup import MatchupCreate
from app.models.team import TeamBenchmarkResponse, TeamCreate, TeamResponse

client = TestClient(app)


class _Response:
    def __init__(self, data, count=None):
        self.data = data
        self.count = count


class _Query:
    def __init__(self, response):
        self.response = response

    def select(self, *args, **kwargs):
        return self

    def eq(self, *args, **kwargs):
        return self

    def in_(self, *args, **kwargs):
        return self

    def order(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def execute(self):
        return self.response


class _FakeSupabase:
    def __init__(self, responses):
        self.responses = {key: list(value) for key, value in responses.items()}

    def table(self, name):
        return _Query(self.responses[name].pop(0))


@patch("app.routers.pokemon.supabase")
def test_resolve_names_endpoint_handles_aliases(mock_supabase):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [
        {"id": 479, "name": "Rotom-Wash"},
        {"id": 983, "name": "Kingambit"},
        {"id": 59, "name": "Arcanine-Hisui"},
    ]
    mock_supabase.table.return_value = query

    response = client.post(
        "/pokemon/resolve-names",
        json={"names": ["Rotom-W", "Gambit", "H-Arcanine", "Missingno"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert [row["name"] for row in body["resolved"]] == [
        "Rotom-Wash",
        "Kingambit",
        "Arcanine-Hisui",
    ]
    assert body["unresolved"] == ["Missingno"]


@patch("app.routers.pokemon.supabase")
def test_resolve_names_falls_back_to_base_form_when_form_is_not_stored(mock_supabase):
    query = MagicMock()
    query.select.return_value = query
    query.eq.return_value = query
    query.execute.return_value.data = [
        {"id": 479, "name": "Rotom"},
    ]
    mock_supabase.table.return_value = query

    response = client.post("/pokemon/resolve-names", json={"names": ["Rotom-W"]})

    assert response.status_code == 200
    assert response.json()["resolved"] == [
        {"input": "Rotom-W", "name": "Rotom", "pokemon_id": 479, "confidence": 0.9}
    ]


@patch("app.routers.usage.supabase")
def test_usage_lists_latest_snapshot_without_duplicate_names(mock_supabase):
    mock_supabase.table.side_effect = _FakeSupabase(
        {
            "pokemon_usage": [
                _Response([{"snapshot_date": "2026-05-07"}]),
                _Response(
                    [
                        {
                            "id": 1,
                            "pokemon_name": "Incineroar",
                            "format": "doubles",
                            "usage_percent": 60.0,
                            "moves": [],
                            "items": [],
                            "abilities": [],
                            "teammates": [],
                            "snapshot_date": "2026-05-07",
                            "source": "pikalytics",
                        },
                        {
                            "id": 2,
                            "pokemon_name": "Incineroar",
                            "format": "doubles",
                            "usage_percent": 55.0,
                            "moves": [],
                            "items": [],
                            "abilities": [],
                            "teammates": [],
                            "snapshot_date": "2026-05-07",
                            "source": "smogon",
                        },
                        {
                            "id": 3,
                            "pokemon_name": "Kingambit",
                            "format": "doubles",
                            "usage_percent": 42.0,
                            "moves": [],
                            "items": [],
                            "abilities": [],
                            "teammates": [],
                            "snapshot_date": "2026-05-07",
                            "source": "pikalytics",
                        },
                    ],
                    count=3,
                ),
            ],
            "pokemon": [
                _Response(
                    [
                        {"name": "Incineroar", "sprite_url": "incineroar.png"},
                        {"name": "Kingambit", "sprite_url": "kingambit.png"},
                    ]
                )
            ],
        }
    ).table

    response = client.get("/usage?format=doubles&limit=50")

    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    assert [row["pokemon_name"] for row in body["data"]] == ["Incineroar", "Kingambit"]
    assert body["data"][0]["source"] == "pikalytics"
    assert body["data"][0]["sprite_url"] == "incineroar.png"


def test_draft_analysis_accepts_optional_team_preview_fields():
    analysis = DraftAnalysis.model_validate(
        {
            "summary": "Stable matchup.",
            "bring_four": [
                {"pokemon": "Incineroar", "role": "pivot", "reason": "Fake Out"},
                {"pokemon": "Garchomp", "role": "damage", "reason": "Ground pressure"},
                {"pokemon": "Kingambit", "role": "closer", "reason": "Priority"},
                {"pokemon": "Sinistcha", "role": "support", "reason": "Redirection"},
            ],
            "lead_pair": ["Incineroar", "Garchomp"],
            "opponent_likely_bring_four": ["Rotom-Wash", "Kingambit"],
            "opponent_likely_leads": [["Rotom-Wash", "Arcanine-Hisui"]],
            "lead_matchups": [
                {
                    "my_lead": ["Incineroar", "Garchomp"],
                    "opponent_lead": ["Rotom-Wash", "Arcanine-Hisui"],
                    "note": "Protect Garchomp turn one.",
                    "favorability": "favored",
                }
            ],
            "threats": [],
            "damage_calcs": [],
            "game_plan": "Pivot first.",
        }
    )

    assert analysis.opponent_likely_bring_four == ["Rotom-Wash", "Kingambit"]
    assert analysis.lead_matchups and analysis.lead_matchups[0].favorability == "favored"


def test_matchup_create_allows_quick_pick_actual_lineup_without_saved_team():
    body = MatchupCreate.model_validate(
        {
            "my_team_actual": ["Incineroar", "Garchomp", "Kingambit", "Sinistcha"],
            "opponent_team_data": [{"name": "Rotom-Wash"}],
            "outcome": "win",
            "replay_url": "https://example.com/replay",
            "opponent_selected_four": ["Rotom-Wash", "Kingambit"],
        }
    )

    assert body.my_team_id is None
    assert body.my_team_actual == ["Incineroar", "Garchomp", "Kingambit", "Sinistcha"]


def test_matchup_create_requires_saved_or_actual_team():
    with pytest.raises(ValueError):
        MatchupCreate.model_validate(
            {
                "opponent_team_data": [{"name": "Rotom-Wash"}],
                "outcome": "loss",
            }
        )


@patch("app.routers.matchups.supabase")
def test_matchup_insights_returns_deterministic_prep_notes(mock_supabase):
    app.dependency_overrides[get_current_user] = lambda: "user-1"
    mock_supabase.table.side_effect = _FakeSupabase(
        {
            "matchup_log": [
                _Response(
                    [
                        {
                            "outcome": "loss",
                            "my_team_id": "team-1",
                            "opponent_team_data": [{"name": "Rotom-Wash"}, {"name": "Kingambit"}],
                            "tags": ["rain"],
                            "loss_reason": "speed control",
                            "played_at": "2026-05-07T10:00:00Z",
                        },
                        {
                            "outcome": "loss",
                            "my_team_id": "team-1",
                            "opponent_team_data": [{"name": "Rotom-Wash"}],
                            "tags": ["rain"],
                            "loss_reason": "speed control",
                            "played_at": "2026-05-06T10:00:00Z",
                        },
                        {
                            "outcome": "win",
                            "my_team_id": "team-2",
                            "opponent_team_data": [{"name": "Kingambit"}],
                            "tags": [],
                            "loss_reason": None,
                            "played_at": "2026-05-05T10:00:00Z",
                        },
                    ]
                )
            ],
            "teams": [_Response([{"id": "team-1", "name": "Rain Check"}])],
        }
    ).table

    try:
        response = client.get("/matchups/insights")
    finally:
        app.dependency_overrides.pop(get_current_user, None)

    assert response.status_code == 200
    body = response.json()
    assert body["total_matches"] == 3
    assert body["recent"]["wins"] == 1
    assert body["worst_opponents"][0]["label"] == "Rotom-Wash"
    assert body["underperforming_teams"][0]["label"] == "Rain Check"
    assert body["common_loss_reasons"][0] == {"label": "speed control", "count": 2}
    assert body["prep_actions"][0]["action"] == "benchmark_team"


def test_team_benchmark_response_accepts_competitive_sections():
    response = TeamBenchmarkResponse.model_validate(
        {
            "team_id": "team-1",
            "team_name": "Balance",
            "format": "doubles",
            "generated_at": "2026-05-07T00:00:00Z",
            "meta_snapshot_date": "2026-05-07",
            "threat_count": 1,
            "defensive_dangers": [
                {
                    "pokemon_name": "Garchomp",
                    "pokemon_id": 445,
                    "usage_percent": 31.5,
                    "move": "Earthquake",
                    "damage_text": "62.0-74.0%",
                    "damage_percent": 74,
                    "target_name": "Kingambit",
                    "severity": "danger",
                }
            ],
            "offensive_answers": [
                {
                    "pokemon_name": "Kingambit",
                    "pokemon_id": 983,
                    "usage_percent": 42.1,
                    "answer_pokemon": "Garchomp",
                    "move": "Earthquake",
                    "damage_text": "70.0-84.0%",
                    "damage_percent": 84,
                    "reliability": "strong",
                }
            ],
            "speed_issues": [
                {
                    "pokemon_name": "Dragapult",
                    "pokemon_id": 887,
                    "usage_percent": 12.3,
                    "threat_speed": 213,
                    "fastest_team_member": "Garchomp",
                    "fastest_team_speed": 169,
                    "note": "Threat outspeeds your fastest saved build.",
                }
            ],
            "coverage_gaps": [
                {
                    "pokemon_name": "Rotom-Wash",
                    "pokemon_id": 479,
                    "usage_percent": 28.4,
                    "best_damage_percent": 38,
                    "best_answer": "Garchomp",
                    "note": "No saved move reaches 45% max damage.",
                }
            ],
        }
    )

    assert response.threat_count == 1
    assert response.defensive_dangers[0].severity == "danger"
    assert response.offensive_answers[0].reliability == "strong"


def test_team_models_support_two_mega_options_with_legacy_defaults():
    create = TeamCreate.model_validate(
        {
            "name": "Double Mega Prep",
            "format": "doubles",
            "pokemon_ids": ["slot-a", "slot-b", "slot-c"],
            "mega_pokemon_ids": ["slot-a", "slot-b"],
            "mega_form_pokemon_ids": [10034, 10058],
        }
    )
    assert create.mega_pokemon_ids == ["slot-a", "slot-b"]
    assert create.mega_form_pokemon_ids == [10034, 10058]

    response = TeamResponse.model_validate(
        {
            "id": "team-1",
            "user_id": "user-1",
            "name": "Legacy Team",
            "format": "doubles",
            "pokemon_ids": ["slot-a"],
            "mega_pokemon_id": "slot-a",
            "mega_form_pokemon_id": 10034,
            "created_at": "2026-05-14T00:00:00Z",
            "updated_at": "2026-05-14T00:00:00Z",
        }
    )
    assert response.mega_pokemon_ids == []
    assert response.mega_form_pokemon_ids == []
