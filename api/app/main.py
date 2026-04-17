from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.routers import (
    abilities,
    admin,
    admin_cron,
    ai_usage,
    cheatsheet,
    draft,
    items,
    matchups,
    meta,
    moves,
    pokemon,
    profile,
    public,
    strategy,
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
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
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
app.include_router(ai_usage.router)
app.include_router(profile.router)
app.include_router(admin.router)
app.include_router(admin_cron.router)
app.include_router(public.router)
app.include_router(strategy.router)


@app.get("/health")
def health():
    return {"status": "ok"}
