"""Vercel serverless function entry point.

Wraps the FastAPI app with prefix stripping so routes defined as
/pokemon, /teams, etc. work when served under /api/* by Vercel.
"""

import sys
from pathlib import Path

# Ensure the api/ directory is on sys.path so `app` package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.main import app as fastapi_app


class _StripApiPrefix:
    """ASGI middleware that strips /api prefix from request paths."""

    def __init__(self, app):  # noqa: N803
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api"):
                stripped = path[4:] or "/"
                scope = dict(scope, path=stripped, raw_path=stripped.encode())
        await self.app(scope, receive, send)


app = _StripApiPrefix(fastapi_app)
