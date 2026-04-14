from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.limiter import limiter
from app.routers import (
    abilities,
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
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


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


@app.get("/health")
def health():
    return {"status": "ok"}
