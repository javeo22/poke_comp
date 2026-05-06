import pytest
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from app.ai_quota import (
    check_ai_quota,
    estimate_cost,
    FREE_DAILY_LIMIT,
    SUPPORTER_DAILY_LIMIT,
    SUPPORTER_MONTHLY_SOFT_CAP,
    DEFAULT_MODEL
)

@pytest.fixture
def mock_supabase():
    with patch("app.ai_quota.supabase") as mock:
        yield mock

@pytest.fixture
def mock_settings():
    with patch("app.ai_quota.settings") as mock:
        mock.admin_user_ids = "admin-123"
        yield mock

def test_estimate_cost():
    # Sonnet: 3/1M input, 15/1M output
    # 1000 input, 1000 output -> 0.003 + 0.015 = 0.018
    cost = estimate_cost(1000, 1000, "claude-sonnet-4-6")
    assert cost == 0.018

    # Haiku: 0.8/1M input, 4/1M output
    # 1000 input, 1000 output -> 0.0008 + 0.004 = 0.0048
    cost = estimate_cost(1000, 1000, "claude-haiku-4-5-20251001")
    assert cost == 0.0048

def test_check_ai_quota_admin(mock_supabase, mock_settings):
    result = check_ai_quota("admin-123")
    assert result["unlimited"] is True
    assert result["limit"] == -1
    # Should not call supabase for admin
    assert not mock_supabase.table.called

def test_check_ai_quota_free_user(mock_supabase, mock_settings):
    # Setup mocks
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None # Not a supporter
    
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value.count = 1
    mock_supabase.table.return_value = mock_query
    
    result = check_ai_quota("user-456")
    assert result["used"] == 1
    assert result["limit"] == FREE_DAILY_LIMIT
    assert result["remaining"] == FREE_DAILY_LIMIT - 1

def test_check_ai_quota_exceeded(mock_supabase, mock_settings):
    # Mock not a supporter
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = None
    
    # Mock used 3
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value.count = FREE_DAILY_LIMIT
    mock_supabase.table.return_value = mock_query
    
    with pytest.raises(HTTPException) as excinfo:
        check_ai_quota("user-456")
    assert excinfo.value.status_code == 429

def test_check_ai_quota_supporter(mock_supabase, mock_settings):
    # Mock supporter
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value.execute.return_value.data = {"supporter": True}
    
    # Mock daily count
    mock_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.gte.return_value.execute.return_value.count = 5
    
    with patch("app.ai_quota._get_monthly_usage") as mock_monthly:
        mock_monthly.return_value = 100
        result = check_ai_quota("supporter-789")
        assert result["used"] == 5
        assert result["limit"] == SUPPORTER_DAILY_LIMIT
