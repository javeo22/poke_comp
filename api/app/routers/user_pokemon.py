from fastapi import APIRouter, Depends, HTTPException, Query
from postgrest.types import CountMethod

from app.auth import get_current_user
from app.config import settings
from app.database import supabase
from app.models.user_pokemon import (
    UserPokemonCreate,
    UserPokemonList,
    UserPokemonResponse,
    UserPokemonUpdate,
)

router = APIRouter(prefix="/user-pokemon", tags=["user_pokemon"])


@router.get("", response_model=UserPokemonList)
def list_user_pokemon(
    build_status: str | None = Query(None, description="Filter by build status"),
    pokemon_id: int | None = Query(None, description="Filter by pokemon"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    user_id: str = Depends(get_current_user),
):
    query = (
        supabase.table("user_pokemon").select("*", count=CountMethod.exact).eq("user_id", user_id)
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
def get_user_pokemon(user_pokemon_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("user_pokemon")
        .select("*")
        .eq("id", user_pokemon_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    return UserPokemonResponse.model_validate(result.data)


@router.post("", response_model=UserPokemonResponse, status_code=201)
def create_user_pokemon(body: UserPokemonCreate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    data["user_id"] = user_id

    result = supabase.table("user_pokemon").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=400, detail="Failed to create user pokemon")
    return UserPokemonResponse.model_validate(result.data[0])


@router.put("/{user_pokemon_id}", response_model=UserPokemonResponse)
def update_user_pokemon(user_pokemon_id: str, body: UserPokemonUpdate, user_id: str = Depends(get_current_user)):
    data = body.model_dump(exclude_none=True)
    if not data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = (
        supabase.table("user_pokemon")
        .update(data)
        .eq("id", user_pokemon_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User pokemon not found")
    return UserPokemonResponse.model_validate(result.data[0])


@router.delete("/{user_pokemon_id}", status_code=204)
def delete_user_pokemon(user_pokemon_id: str, user_id: str = Depends(get_current_user)):
    result = (
        supabase.table("user_pokemon")
        .delete()
        .eq("id", user_pokemon_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="User pokemon not found")
