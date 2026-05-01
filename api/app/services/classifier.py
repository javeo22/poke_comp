import json
import logging
from typing import Literal, TypedDict

import anthropic

from app.config import settings

logger = logging.getLogger(__name__)

TournamentCategory = Literal["CHAMPIONS", "VGC_STANDARD", "OTHER"]


class ClassificationResult(TypedDict):
    category: TournamentCategory
    confidence: float
    reason: str


CLASSIFIER_PROMPT = """
Categorize the following tournament into one of: [CHAMPIONS, VGC_STANDARD, OTHER].

Rules for CHAMPIONS format:
- No Terastallization allowed.
- Restricted Movepool (e.g. no Spore, no Follow Me, no Rage Powder on certain mons).
- Mega Evolutions ARE allowed.
- Often referred to as "Champions League", "Champions Format", or specifically mentions "No Tera".

Rules for VGC_STANDARD:
- Official Scarlet/Violet regulations (Regulation G, H, etc.).
- Terastallization IS allowed.
- No Mega Evolutions.

Rules for OTHER:
- Non-competitive, unrelated games (TCG, Unite), or generic VGC without enough info to confirm it's Champions.

Tournament Name: {name}
Description: {description}

Return ONLY a JSON object: {{"category": "...", "confidence": 0.0, "reason": "..."}}
"""


class TournamentClassifier:
    def __init__(self, api_key: str | None = None):
        self.api_key = api_key or settings.anthropic_api_key
        if not self.api_key:
            # We don't raise here to allow for partial initialization in dev
            # but classify() will fail if called without a key.
            pass
        self._client: anthropic.AsyncAnthropic | None = None

    @property
    def client(self) -> anthropic.AsyncAnthropic:
        if self._client is None:
            if not self.api_key:
                raise ValueError("Anthropic API key is not configured")
            self._client = anthropic.AsyncAnthropic(api_key=self.api_key)
        return self._client

    async def classify(self, name: str, description: str | None = None) -> ClassificationResult:
        description = description or "No description provided."
        prompt = CLASSIFIER_PROMPT.format(name=name, description=description)

        try:
            message = await self.client.messages.create(
                model="claude-3-5-sonnet-20240620",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}],
            )

            block = message.content[0]
            if not hasattr(block, "text"):
                raise ValueError("Unexpected Claude response format: no text block")

            text = block.text.strip()  # type: ignore[attr-defined]
            # Handle potential markdown fences
            if text.startswith("```json"):
                text = text.split("```json")[1].split("```")[0].strip()
            elif text.startswith("```"):
                text = text.split("```")[1].split("```")[0].strip()

            result = json.loads(text)
            return {
                "category": result.get("category", "OTHER"),
                "confidence": float(result.get("confidence", 0.0)),
                "reason": result.get("reason", "No reason provided"),
            }
        except Exception as e:
            logger.error(f"Classification failed for {name}: {e}")
            return {
                "category": "OTHER",
                "confidence": 0.0,
                "reason": f"Error during classification: {str(e)}",
            }
