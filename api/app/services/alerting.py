import sys

import httpx

from ..config import settings


def send_alert(message: str) -> None:
    """
    Sends an alert message to a configured Slack or Discord webhook.
    Truncates message to 1000 characters and handles failures gracefully.
    """
    if not settings.slack_webhook_url:
        return

    # Truncate to 1000 characters
    truncated_message = message[:1000]
    if len(message) > 1000:
        truncated_message += "..."

    # Determine payload format based on webhook URL
    url = settings.slack_webhook_url
    if "slack.com" in url:
        payload = {"text": truncated_message}
    elif "discord.com" in url:
        payload = {"content": truncated_message}
    else:
        payload = {"message": truncated_message}

    try:
        response = httpx.post(url, json=payload, timeout=10.0)
        response.raise_for_status()
    except Exception as e:
        print(f"Failed to send alert: {e}", file=sys.stderr)
