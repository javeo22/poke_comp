import unittest
from unittest.mock import patch, MagicMock
from app.services.alerting import send_alert
from app.config import settings

class TestAlerting(unittest.TestCase):
    @patch("app.services.alerting.httpx.post")
    def test_alerting_payload_normalization_slack(self, mock_post):
        settings.slack_webhook_url = "https://hooks.slack.com/services/test"
        send_alert("hello")
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"], {"text": "hello"})

    @patch("app.services.alerting.httpx.post")
    def test_alerting_payload_normalization_discord(self, mock_post):
        settings.slack_webhook_url = "https://discord.com/api/webhooks/test"
        send_alert("hello")
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"], {"content": "hello"})

    @patch("app.services.alerting.httpx.post")
    def test_alerting_payload_normalization_generic(self, mock_post):
        settings.slack_webhook_url = "https://generic.com/webhook"
        send_alert("hello")
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        self.assertEqual(kwargs["json"], {"message": "hello"})

    @patch("app.services.alerting.httpx.post")
    def test_alerting_truncation(self, mock_post):
        settings.slack_webhook_url = "https://hooks.slack.com/services/test"
        long_message = "A" * 1100
        send_alert(long_message)
        
        mock_post.assert_called_once()
        args, kwargs = mock_post.call_args
        payload = kwargs["json"]["text"]
        self.assertEqual(len(payload), 1003) # 1000 + "..."
        self.assertTrue(payload.endswith("..."))

    @patch("app.services.alerting.httpx.post")
    def test_alerting_no_url(self, mock_post):
        settings.slack_webhook_url = ""
        send_alert("hello")
        mock_post.assert_not_called()

    @patch("app.services.alerting.httpx.post")
    def test_alerting_failure_handled(self, mock_post):
        settings.slack_webhook_url = "https://hooks.slack.com/services/test"
        mock_post.side_effect = Exception("Network error")
        
        # Should not raise exception
        send_alert("hello")
        mock_post.assert_called_once()
