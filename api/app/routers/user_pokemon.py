from fastapi import APIRouter, HTTPException, Query
from postgrest.types import CountMethod

from app.config import settings
from app.database import supabase
from app.models.user_pokemon import (
    UserPokemonCreate,
    UserPokemonList,
    UserPokemonResponse,
    UserPokemonUpdate,
)

router = APIRouter(prefix="/user-pokemon", tags=["user_pokemon"])

# TODO: Replace with real auth user extraction
USER_ID = settings.dev_user_id


@router.get("", response_model=UserPokemonList)
def list_user_pokemon(
    build_status: str | None = Query(None, description="Filter by build status"),
    pokemon_id: int | None = Query(None, description="Filter by pokemon"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    query = (
        supabase.table("user_pokemon")
        .select("*", count=CountMethod.exact)
        .eq("user_id", USER_ID)
    )

    if build_status:
        query = query.eq("build_status", build_status)
    if pokemon_id is not None:
        query = query.eq("pokemon_id", pokemon_id)

    result = query.order("created_at", desc=True).range(offset, offset + limit - 1).execute()
    return UserPokemonList(
        data=[UserPokemonResponse.model_validate(row) for row in result.data],
        count=result.count or len(result.data),
    )


@router.get("/{user_pokemon_id}", response_model=UserPokemonResponse)
def get_user_pokemon(user_pokemon_id: str):
    result = (
        supabase.table("user_pokemon")
        .select("*")
        .eq("id", user_pokemon_id)
        .eq("user_id", USER_ID)
        .single()
        .execute()
    )
    return UserPokemonResponse.model_validate(result.data)


@router.post("", response_model=UserPokemonResponse, status_code=201)
def create_user_pokemon(body: UserPokemonCreate):
    data = body.model_dump(exclude_none=True)
    data["user_id"] = USER_ID

    result = supabase.table("user_pokemon").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create user pokemon")
    return UserPokemonResponse.model_validate(result.data[0])


@router.put("/{user_pokemon_id}", response_model=UserPokemonResponse)
def update_user_pokemon(user_pokemon_id: str, body: UserPokemonUpdate):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("user_pokemon")
        .update(data)
        .eq("id", user_pokemon_id)
        .eq("user_id", USER_ID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User pokemon not found")
    return UserPokemonResponse.model_validate(result.data[0])


@router.delete("/{user_pokemon_id}", status_code=204)
def delete_user_pokemon(user_pokemon_id: str):
    result = (
        supabase.table("user_pokemon")
        .delete()
        .eq("id", user_pokemon_id)
        .eq("user_id", USER_ID)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User pokemon not found")
