from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import abilities, items, moves, pokemon

app = FastAPI(title="Pokemon Champions Companion API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(pokemon.router)
app.include_router(moves.router)
app.include_router(items.router)
app.include_router(abilities.router)


@app.get("/health")
def health():
    return {"status": "ok"}
