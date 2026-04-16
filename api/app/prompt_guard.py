"""Prompt injection protection for user-supplied text flowing into AI prompts."""

import re

# Max length for user-supplied notes embedded in prompts
MAX_NOTE_LENGTH = 500

# Patterns that indicate prompt injection attempts
_INJECTION_PATTERNS = [
    re.compile(
        r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?|context)",
        re.IGNORECASE,
    ),
    re.compile(r"you\s+are\s+now\s+", re.IGNORECASE),
    re.compile(r"new\s+instructions?\s*:", re.IGNORECASE),
    re.compile(r"system\s*:\s*", re.IGNORECASE),
    re.compile(r"<\s*system\s*>", re.IGNORECASE),
    re.compile(r"<\s*/?\s*prompt\s*>", re.IGNORECASE),
    re.compile(r"forget\s+(everything|all|your)\s+", re.IGNORECASE),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)", re.IGNORECASE),
    re.compile(r"override\s+(your\s+)?instructions?", re.IGNORECASE),
]


def sanitize_user_text(text: str, max_length: int = MAX_NOTE_LENGTH) -> str:
    """Sanitize user-supplied text before embedding in AI prompts.

    - Truncates to max_length
    - Strips known injection patterns
    - Removes XML-like tags that could confuse the model
    """
    if not text:
        return ""

    # Truncate
    text = text[:max_length]

    # Strip injection patterns
    for pattern in _INJECTION_PATTERNS:
        text = pattern.sub("[filtered]", text)

    # Remove XML-like tags
    text = re.sub(r"<[^>]{1,50}>", "", text)

    return text.strip()
