from unittest.mock import MagicMock, patch

from app.routers.strategy import _tournament_suggestions, _usage_suggestions


def test_usage_suggestions_summarize_latest_online_rows():
    usage_query = MagicMock()
    usage_execute = (
        usage_query.select.return_value.eq.return_value.order.return_value.limit.return_value.execute
    )
    usage_execute.return_value.data = [
        {
            "pokemon_name": "Garchomp",
            "format": "doubles",
            "snapshot_date": "2026-05-12",
            "usage_percent": 19.4,
            "moves": [{"name": "Earthquake"}, {"name": "Protect"}],
            "items": [{"name": "Choice Scarf"}],
            "teammates": [{"name": "Talonflame"}],
            "source": "pikalytics",
        },
        {
            "pokemon_name": "Older",
            "format": "doubles",
            "snapshot_date": "2026-04-01",
            "usage_percent": 99,
            "source": "pikalytics",
        },
    ]

    with patch("app.routers.strategy.supabase") as mock_supabase:
        mock_supabase.table.return_value = usage_query
        suggestions = _usage_suggestions("vgc2026", "doubles")

    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion.format == "vgc2026"
    assert suggestion.source_label == "Pikalytics"
    assert "Garchomp at 19.4%" in suggestion.title
    assert "Earthquake" in suggestion.content
    assert "agent" in suggestion.tags


def test_tournament_suggestions_summarize_recent_archetypes():
    teams_query = MagicMock()
    teams_execute = teams_query.select.return_value.order.return_value.limit.return_value.execute
    teams_execute.return_value.data = [
        {
            "tournament_name": "Regional",
            "placement": 1,
            "pokemon_ids": [1, 2, 3, 4, 5, 6],
            "archetype": "rain",
            "source": "Limitless",
            "created_at": "2026-05-12T10:00:00Z",
        },
        {
            "tournament_name": "Regional",
            "placement": 2,
            "pokemon_ids": [1, 2, 3, 4, 5, 6],
            "archetype": "rain",
            "source": "Limitless",
            "created_at": "2026-05-12T09:00:00Z",
        },
        {
            "tournament_name": "Regional",
            "placement": 3,
            "pokemon_ids": [1, 2, 3, 4, 5, 6],
            "archetype": "sun",
            "source": "Limitless",
            "created_at": "2026-05-12T08:00:00Z",
        },
    ]

    with patch("app.routers.strategy.supabase") as mock_supabase:
        mock_supabase.table.return_value = teams_query
        suggestions = _tournament_suggestions("vgc2026")

    assert len(suggestions) == 1
    suggestion = suggestions[0]
    assert suggestion.format == "vgc2026"
    assert "rain leads" in suggestion.title
    assert "rain (2)" in suggestion.content
    assert "sun (1)" in suggestion.content
