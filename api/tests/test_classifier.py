import pytest
from unittest.mock import AsyncMock, MagicMock
from app.services.classifier import TournamentClassifier

@pytest.mark.asyncio
async def test_classify_champions():
    classifier = TournamentClassifier(api_key="fake_key")
    
    # Mock response
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text='{"category": "CHAMPIONS", "confidence": 0.95, "reason": "Mentions no tera and mega evolution"}')]
    classifier._client = AsyncMock()
    classifier._client.messages.create.return_value = mock_message
    
    result = await classifier.classify("Champions Cup S1", "VGC with Mega Evolutions and no Terastallization.")
    
    assert result["category"] == "CHAMPIONS"
    assert result["confidence"] == 0.95
    assert "no tera" in result["reason"].lower()

@pytest.mark.asyncio
async def test_classify_vgc_standard():
    classifier = TournamentClassifier(api_key="fake_key")
    
    # Mock response
    mock_message = MagicMock()
    mock_message.content = [MagicMock(text='{"category": "VGC_STANDARD", "confidence": 0.9, "reason": "Regulation G official tournament"}')]
    classifier._client = AsyncMock()
    classifier._client.messages.create.return_value = mock_message
    
    result = await classifier.classify("Regional Championships", "Official VGC Regulation G.")
    
    assert result["category"] == "VGC_STANDARD"
    assert result["confidence"] == 0.9

@pytest.mark.asyncio
async def test_classify_error_handling():
    classifier = TournamentClassifier(api_key="fake_key")
    
    # Mock exception
    classifier._client = AsyncMock()
    classifier._client.messages.create.side_effect = Exception("API Error")
    
    result = await classifier.classify("Broken Tournament")
    
    assert result["category"] == "OTHER"
    assert result["confidence"] == 0.0
    assert "Error" in result["reason"]
