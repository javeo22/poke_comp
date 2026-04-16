from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.routers import (
    abilities,
    admin,
    cheatsheet,
    draft,
    items,
    matchups,
    meta,
    moves,
    pokemon,
    teams,
    usage,
    user_pokemon,
)

app = FastAPI(title="Pokemon Champions Companion API", version="0.1.0")

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={
            "detail": (
                "Rate limit reached. AI analysis is limited to 5 requests "
                "per minute. Please wait and try again."
            )
        },
    )


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(pokemon.router)
app.include_router(moves.router)
app.include_router(items.router)
app.include_router(abilities.router)
app.include_router(user_pokemon.router)
app.include_router(teams.router)
app.include_router(meta.router)
app.include_router(usage.router)
app.include_router(draft.router)
app.include_router(cheatsheet.router)
app.include_router(matchups.router)
app.include_router(admin.router)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "jwt_secret_configured": bool(settings.supabase_jwt_secret),
        "jwt_secret_length": len(settings.supabase_jwt_secret),
        "supabase_url_configured": bool(settings.supabase_url),
    }


@app.get("/debug-auth")
def debug_auth(request: Request):
    """Temporary debug endpoint -- remove after fixing auth."""
    import jwt as pyjwt

    auth_header = request.headers.get("authorization", "")
    has_token = bool(auth_header)
    token_preview = ""
    decode_error = None
    token_segments = 0

    if auth_header.startswith("Bearer "):
        raw_token = auth_header[7:]
        token_preview = raw_token[:20] + "..." if len(raw_token) > 20 else raw_token
        token_segments = raw_token.count(".") + 1
        try:
            payload = pyjwt.decode(
                raw_token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                options={"verify_aud": False},
            )
            decode_error = None
            return {
                "has_token": True,
                "token_segments": token_segments,
                "decode": "success",
                "role": payload.get("role"),
                "sub": payload.get("sub", "")[:8] + "...",
            }
        except Exception as e:
            decode_error = f"{type(e).__name__}: {e}"

    return {
        "has_token": has_token,
        "token_preview": token_preview,
        "token_segments": token_segments,
        "jwt_secret_length": len(settings.supabase_jwt_secret),
        "decode_error": decode_error,
    }
