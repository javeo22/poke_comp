import json
from datetime import date

import anthropic
import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from postgrest.types import CountMethod
from pydantic import BaseModel

from app.ai_quota import check_ai_quota, estimate_cost, log_ai_usage
from app.auth import get_current_user
from app.config import settings
from app.database import supabase
from app.limiter import limiter
from app.models.meta import MetaSnapshotCreate, MetaSnapshotList, MetaSnapshotResponse

router = APIRouter(prefix="/meta", tags=["meta"])


@router.get("", response_model=MetaSnapshotList)
def list_snapshots(
    format: str | None = Query(None, description="Filter by format (singles, doubles, megas)"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = supabase.table("meta_snapshots").select("*", count=CountMethod.exact)

    if format:
        query = query.eq("format", format)

    result = query.order("snapshot_date", desc=True).range(offset, offset + limit - 1).execute()
    return MetaSnapshotList(
        data=[MetaSnapshotResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/latest", response_model=list[MetaSnapshotResponse])
def get_latest_snapshots():
    """Return the most recent snapshot for each format."""
    formats = ["singles", "doubles", "megas"]
    results: list[MetaSnapshotResponse] = []

    for fmt in formats:
        result = (
            supabase.table("meta_snapshots")
            .select("*")
            .eq("format", fmt)
            .order("snapshot_date", desc=True)
            .limit(1)
            .execute()
        )
        if result.data:
            results.append(MetaSnapshotResponse.model_validate(result.data[0]))

    return results


@router.get("/{snapshot_id}", response_model=MetaSnapshotResponse)
def get_snapshot(snapshot_id: int):
    result = supabase.table("meta_snapshots").select("*").eq("id", snapshot_id).single().execute()
    return MetaSnapshotResponse.model_validate(result.data)


@router.post("", response_model=MetaSnapshotResponse, status_code=201)
def create_snapshot(body: MetaSnapshotCreate):
    data = body.model_dump(exclude_none=True, mode="json")

    result = supabase.table("meta_snapshots").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create meta snapshot")
    return MetaSnapshotResponse.model_validate(result.data[0])


@router.delete("/{snapshot_id}", status_code=204)
def delete_snapshot(snapshot_id: int):
    result = supabase.table("meta_snapshots").delete().eq("id", snapshot_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Meta snapshot not found")


# ── Scrape trigger ──

GAME8_URLS: dict[str, str] = {
    "singles": "https://game8.co/games/Pokemon-Champions/archives/592465",
    "doubles": "https://game8.co/games/Pokemon-Champions/archives/593883",
    "megas": "https://game8.co/games/Pokemon-Champions/archives/593897",
}

VALID_TIERS = {"S", "A+", "A", "B", "C"}

SCRAPE_HEADERS = {
    "User-Agent": ("PokemonChampionsCompanion/0.1 (personal-tool; +github.com/javeo22/poke_comp)"),
    "Accept": "text/html",
}


class ScrapeResult(BaseModel):
    format: str
    pokemon_count: int
    status: str


class ScrapeResponse(BaseModel):
    results: list[ScrapeResult]
    estimated_cost_usd: float


def _fetch_page(url: str) -> str:
    resp = httpx.get(url, headers=SCRAPE_HEADERS, timeout=30, follow_redirects=True)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    article = soup.find("article") or soup.find("div", class_="archive-style-wrapper")
    if article:
        return article.get_text(separator="\n", strip=True)[:8000]
    return soup.get_text(separator="\n", strip=True)[:8000]


def _parse_with_claude(
    client: anthropic.Anthropic, page_text: str, format_name: str
) -> tuple[dict[str, list[str]], int, int]:
    prompt = (
        f"Extract the Pokemon tier list from this Game8 page for {format_name}.\n\n"
        "Return ONLY a JSON object mapping tier names to arrays of Pokemon names.\n"
        'Use these exact tier keys: "S", "A+", "A", "B", "C"\n'
        'Use Title Case for Pokemon names (e.g. "Garchomp", "Wash Rotom").\n'
        "If a tier has no Pokemon, include it as an empty array.\n"
        "Do not include any explanation, just the JSON.\n\n"
        f"Page content:\n{page_text}"
    )
    message = client.messages.create(
        model="claude-sonnet-4-6-20250514",
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )
    block = message.content[0]
    if block.type != "text":
        raise ValueError(f"Unexpected response block type: {block.type}")
    text = block.text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1])

    tier_data: dict[str, list[str]] = json.loads(text)
    for tier in VALID_TIERS:
        if tier not in tier_data:
            tier_data[tier] = []
    filtered = {k: v for k, v in tier_data.items() if k in VALID_TIERS}
    return filtered, message.usage.input_tokens, message.usage.output_tokens


def _upsert_snapshot(format_name: str, tier_data: dict[str, list[str]], source_url: str) -> None:
    supabase.table("meta_snapshots").upsert(
        {
            "snapshot_date": date.today().isoformat(),
            "format": format_name,
            "tier_data": tier_data,
            "source_url": source_url,
            "source": "game8",
        },
        on_conflict="snapshot_date,format",
    ).execute()


@router.post("/scrape", response_model=ScrapeResponse)
@limiter.limit("5/minute")
def scrape_game8(request: Request, user_id: str = Depends(get_current_user)):
    """Scrape Game8 tier lists and upsert into meta_snapshots."""
    if not settings.anthropic_api_key:
        raise HTTPException(
            status_code=400,
            detail="ANTHROPIC_API_KEY is not configured",
        )

    check_ai_quota(user_id)

    ai = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    results: list[ScrapeResult] = []
    total_cost = 0.0

    for format_name, url in GAME8_URLS.items():
        try:
            page_text = _fetch_page(url)
            tier_data, in_tok, out_tok = _parse_with_claude(ai, page_text, format_name)
            _upsert_snapshot(format_name, tier_data, url)
            total = sum(len(v) for v in tier_data.values())
            call_cost = estimate_cost(in_tok, out_tok)
            total_cost += call_cost
            log_ai_usage(user_id, "meta_scrape", "claude-sonnet-4-6-20250514", in_tok, out_tok)
            results.append(ScrapeResult(format=format_name, pokemon_count=total, status="ok"))
        except httpx.HTTPStatusError as e:
            results.append(
                ScrapeResult(
                    format=format_name,
                    pokemon_count=0,
                    status=f"HTTP {e.response.status_code}",
                )
            )
        except (json.JSONDecodeError, ValueError) as e:
            results.append(
                ScrapeResult(
                    format=format_name,
                    pokemon_count=0,
                    status=f"Parse error: {e}",
                )
            )
        except anthropic.APIError as e:
            results.append(
                ScrapeResult(
                    format=format_name,
                    pokemon_count=0,
                    status=f"Claude API error: {e}",
                )
            )

    return ScrapeResponse(results=results, estimated_cost_usd=total_cost)
