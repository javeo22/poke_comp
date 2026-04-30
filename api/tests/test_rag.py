import pytest
import uuid
from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.auth import get_current_user

# Mock user for authentication
MOCK_USER_ID = str(uuid.uuid4())

def override_get_current_user():
    return MOCK_USER_ID

app.dependency_overrides[get_current_user] = override_get_current_user

client = TestClient(app)

@patch("app.routers.draft.settings")
@patch("app.routers.draft.supabase")
@patch("app.ai_quota.supabase")
@patch("app.services.ai_verifier.supabase")
@patch("app.routers.draft.anthropic.Anthropic")
@patch("app.routers.draft.fetch_tournament_context")
@patch("app.routers.draft.fetch_personal_context")
@patch("app.routers.draft.fetch_strategy_context")
@patch("app.routers.draft.snapshot_age_days")
def test_analyze_draft_rag_injection(
    mock_snapshot_age,
    mock_strategy,
    mock_personal,
    mock_tournament,
    mock_anthropic,
    mock_verifier_supabase,
    mock_ai_quota_supabase,
    mock_draft_supabase,
    mock_settings
):
    # Setup mocks
    mock_settings.anthropic_api_key = "fake-key"
    mock_snapshot_age.return_value = ("2026-06-01", 1)
    mock_strategy.return_value = "=== Expert Strategy Notes ===\n[GENERAL] Test Note\nTest content"
    
    # Mock my team fetch (teams table)
    mock_team_query = MagicMock()
    mock_team_query.select.return_value.eq.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {
        "id": "team-123",
        "name": "Test Team",
        "format": "doubles",
        "pokemon_ids": ["p1-uuid", "p2-uuid", "p3-uuid", "p4-uuid"]
    }
    
    # Mock user_pokemon table
    mock_user_poke_query = MagicMock()
    mock_user_poke_query.select.return_value.eq.return_value.in_.return_value.execute.return_value.data = [
        {"id": "p1-uuid", "pokemon_id": 1, "ability": "A", "moves": ["M1"], "item_id": "I1", "stat_points": {}, "nature": "N"},
        {"id": "p2-uuid", "pokemon_id": 2, "ability": "A", "moves": ["M1"], "item_id": "I1", "stat_points": {}, "nature": "N"},
        {"id": "p3-uuid", "pokemon_id": 3, "ability": "A", "moves": ["M1"], "item_id": "I1", "stat_points": {}, "nature": "N"},
        {"id": "p4-uuid", "pokemon_id": 4, "ability": "A", "moves": ["M1"], "item_id": "I1", "stat_points": {}, "nature": "N"}
    ]
    
    # Mock pokemon table
    mock_poke_query = MagicMock()
    mock_poke_query.select.return_value.in_.return_value.execute.return_value.data = [
        {"id": 1, "name": "P1", "types": ["T1"], "base_stats": {"hp": 100}, "abilities": ["A"], "movepool": ["M1"]},
        {"id": 2, "name": "P2", "types": ["T1"], "base_stats": {"hp": 100}, "abilities": ["A"], "movepool": ["M1"]},
        {"id": 3, "name": "P3", "types": ["T1"], "base_stats": {"hp": 100}, "abilities": ["A"], "movepool": ["M1"]},
        {"id": 4, "name": "P4", "types": ["T1"], "base_stats": {"hp": 100}, "abilities": ["A"], "movepool": ["M1"]}
    ]
    mock_poke_query.select.return_value.ilike.return_value.limit.return_value.execute.return_value.data = [
        {"id": 5, "name": "Garchomp", "types": ["dragon"], "base_stats": {"hp": 100}, "abilities": ["Rough Skin"]}
    ]

    # Mock pokemon_usage table
    mock_usage_query = MagicMock()
    mock_usage_query.select.return_value.ilike.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value.data = []

    # Mock ai_analyses table (cache)
    mock_cache_query = MagicMock()
    mock_cache_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    
    # Mock moves table
    mock_moves_query = MagicMock()
    mock_moves_query.select.return_value.in_.return_value.execute.return_value.data = []
    # For verifier _load_known_moves
    mock_moves_query.select.return_value.execute.return_value.data = [{"name": "M1"}]

    def draft_table_side_effect(table_name):
        if table_name == "teams": return mock_team_query
        if table_name == "user_pokemon": return mock_user_poke_query
        if table_name == "pokemon": return mock_poke_query
        if table_name == "pokemon_usage": return mock_usage_query
        if table_name == "ai_analyses": return mock_cache_query
        if table_name == "moves": return mock_moves_query
        return MagicMock()

    mock_draft_supabase.table.side_effect = draft_table_side_effect
    mock_verifier_supabase.table.side_effect = draft_table_side_effect
    
    # Mock ai_quota supabase
    mock_ai_quota_query = MagicMock()
    mock_ai_quota_query.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value.count = 0
    mock_ai_quota_query.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    mock_ai_quota_supabase.table.return_value = mock_ai_quota_query

    # Mock RAG contexts
    mock_tournament.return_value = [
        {"tournament_name": "Regional A", "placement": 1, "archetype": "Big 6", "player_name": "Champion"}
    ]
    mock_personal.return_value = [
        {"opponent_team_data": [{"name": "Garchomp"}], "outcome": "win", "notes": "Focused Garchomp early"}
    ]
    
    # Mock Claude response with valid schema
    mock_json = {
        "summary": "Matchup looks good.",
        "bring_four": [
            {"pokemon": "P1", "role": "Lead", "reason": "Test"},
            {"pokemon": "P2", "role": "Lead", "reason": "Test"},
            {"pokemon": "P3", "role": "Back", "reason": "Test"},
            {"pokemon": "P4", "role": "Back", "reason": "Test"}
        ],
        "lead_pair": ["P1", "P2"],
        "threats": [],
        "damage_calcs": [],
        "game_plan": "Turn 1: Win."
    }
    import json
    mock_message = MagicMock()
    mock_message.content = [MagicMock(type="text", text=json.dumps(mock_json))]
    mock_message.usage.input_tokens = 100
    mock_message.usage.output_tokens = 50
    mock_anthropic.return_value.messages.create.return_value = mock_message
    
    # Mock cost calculation
    with patch("app.routers.draft.estimate_cost") as mock_cost:
        mock_cost.return_value = 0.01
        response = client.post(
            "/draft/analyze",
            json={
                "my_team_id": "team-123",
                "opponent_team": ["Garchomp"]
            }
        )
    
    if response.status_code != 200:
        print(f"Error Response: {response.json()}")
        
    assert response.status_code == 200
    
    # Verify RAG context injection in prompt
    args, kwargs = mock_anthropic.return_value.messages.create.call_args
    prompt = kwargs["messages"][0]["content"]
    
    assert "<limitless_pro_context>" in prompt
    assert "Regional A" in prompt
    assert "Big 6" in prompt
    
    assert "<user_personal_context>" in prompt
    assert "Focused Garchomp early" in prompt
    assert "WIN" in prompt
