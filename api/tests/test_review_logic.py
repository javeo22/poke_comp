import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.review_service import ReviewService


@pytest.fixture
def mock_supabase():
    with patch("app.services.review_service.supabase") as mock:
        yield mock

@pytest.mark.asyncio
async def test_stage_item(mock_supabase):
    mock_supabase.table.return_value.insert.return_value.execute.return_value.data = [
        {"id": "test-uuid", "source": "limitless", "status": "PENDING"}
    ]

    result = await ReviewService.stage_item(
        source="limitless",
        payload={"tournament_name": "Test Tournament"},
        external_id="ext-123"
    )

    assert result["id"] == "test-uuid"
    assert result["status"] == "PENDING"
    mock_supabase.table.assert_called_with("scraper_review_queue")

@pytest.mark.asyncio
async def test_approve_limitless_item(mock_supabase):
    admin_id = str(uuid.uuid4())
    review_id = str(uuid.uuid4())
    payload = {
        "tournament_name": "Regional",
        "placement": 1,
        "pokemon_ids": [1, 2, 3, 4, 5, 6]
    }

    # Mock fetching the item
    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": review_id,
            "source": "limitless",
            "payload": payload,
            "status": "PENDING"
        }
    ]

    # Mock production upsert
    mock_query.upsert.return_value.execute.return_value.data = [payload]

    # Mock queue update
    mock_query.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": review_id, "status": "APPROVED"}
    ]

    mock_supabase.table.side_effect = lambda table: mock_query

    result = await ReviewService.approve_item(review_id, admin_id)

    assert result["status"] == "APPROVED"
    # Verify production upsert with the duplicate-safe conflict target.
    mock_query.upsert.assert_called_with(payload, on_conflict="tournament_name,placement")
    # Verify queue update
    mock_query.update.assert_called()

@pytest.mark.asyncio
async def test_approve_pikalytics_item(mock_supabase):
    admin_id = str(uuid.uuid4())
    review_id = str(uuid.uuid4())
    payload = {
        "pokemon_name": "Pikachu",
        "format": "doubles",
        "usage_percent": 10.5
    }

    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": review_id,
            "source": "pikalytics",
            "payload": payload,
            "status": "PENDING"
        }
    ]

    # Mock production upsert
    mock_query.upsert.return_value.execute.return_value.data = [payload]

    mock_query.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": review_id, "status": "APPROVED"}
    ]

    mock_supabase.table.side_effect = lambda table: mock_query

    result = await ReviewService.approve_item(review_id, admin_id)

    assert result["status"] == "APPROVED"
    # Verify production upsert with the duplicate-safe conflict target.
    mock_query.upsert.assert_called_with(
        payload,
        on_conflict="pokemon_name,format,snapshot_date",
    )

@pytest.mark.asyncio
async def test_reject_item(mock_supabase):
    admin_id = str(uuid.uuid4())
    review_id = str(uuid.uuid4())

    mock_query = MagicMock()
    mock_query.update.return_value.eq.return_value.execute.return_value.data = [
        {"id": review_id, "status": "REJECTED"}
    ]
    mock_supabase.table.return_value = mock_query

    result = await ReviewService.reject_item(review_id, admin_id)

    assert result["status"] == "REJECTED"
    mock_query.update.assert_called()

@pytest.mark.asyncio
async def test_approve_already_approved_fails(mock_supabase):
    review_id = str(uuid.uuid4())

    mock_query = MagicMock()
    mock_query.select.return_value.eq.return_value.execute.return_value.data = [
        {
            "id": review_id,
            "source": "limitless",
            "status": "APPROVED"
        }
    ]
    mock_supabase.table.return_value = mock_query

    with pytest.raises(ValueError, match="already APPROVED"):
        await ReviewService.approve_item(review_id, "admin-1")
