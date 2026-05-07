from unittest.mock import MagicMock, patch

# Mock Supabase before app import
with patch("supabase.create_client") as mock_create:
    mock_create.return_value = MagicMock()
    from app.main import app

from fastapi.testclient import TestClient

client = TestClient(app)

@patch("app.routers.meta.supabase")
def test_get_meta_trends_endpoint_exists(mock_supabase):
    # Setup mock RPC response
    mock_rpc_result = MagicMock()
    mock_rpc_result.data = [
        {
            "id": 445,
            "pokemon_name": "Garchomp",
            "usage_percent": 25.5,
            "previous_usage": 20.0,
            "swing": 5.5,
            "up": True,
            "top_moves": [{"name": "Earthquake", "percent": 90}],
            "top_items": [{"name": "Life Orb", "percent": 40}],
            "top_abilities": [{"name": "Rough Skin", "percent": 100}]
        },
        {
            "id": 959,
            "pokemon_name": "Tinkaton",
            "usage_percent": 15.0,
            "previous_usage": 18.0,
            "swing": -3.0,
            "up": False,
            "top_moves": [{"value": {"name": "Gigaton Hammer", "percent": 100}}],
            "top_items": [{"value": {"name": "Leftovers", "percent": 50}}],
            "top_abilities": [{"value": {"name": "Mold Breaker", "percent": 80}}]
        }
    ]
    mock_supabase.rpc.return_value.execute.return_value = mock_rpc_result

    response = client.get("/meta/trends")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) == 2

    assert data[0]["pokemon_name"] == "Garchomp"
    assert data[0]["usage_percent"] == 25.5
    assert data[0]["swing"] == 5.5
    assert data[0]["up"] is True
    assert len(data[0]["top_moves"]) == 1
    assert data[0]["top_moves"][0]["name"] == "Earthquake"

    assert data[1]["pokemon_name"] == "Tinkaton"
    assert data[1]["up"] is False
    assert data[1]["top_moves"][0]["name"] == "Gigaton Hammer"
    assert data[1]["top_items"][0]["name"] == "Leftovers"
