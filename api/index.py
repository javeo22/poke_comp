"""Vercel serverless function entry point.

Wraps the FastAPI app with prefix stripping so routes defined as
/pokemon, /teams, etc. work when served under /api/* by Vercel.
"""

from app.main import app as fastapi_app


class _StripApiPrefix:
    """ASGI middleware that strips /api prefix from request paths."""

    def __init__(self, app):  # noqa: N803
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/api"):
                scope = dict(scope, path=path[4:] or "/")
        await self.app(scope, receive, send)


app = _StripApiPrefix(fastapi_app)
