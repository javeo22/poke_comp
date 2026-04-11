"""Seed Champions-specific data: eligible roster, available moves, items.

Usage:
    uv run python -m scripts.seed_champions

Run this AFTER import_pokeapi.py. This script:
1. Flags champions_eligible on Pokemon in the CHAMPIONS_ROSTER list
2. Flags champions_available on moves in the CHAMPIONS_MOVES list
3. Upserts Champions shop items into the items table
4. Sets mega_evolution_id relationships

Edit the data lists below as the Champions roster is confirmed.
Lists use PokeAPI IDs for Pokemon/moves, or names where noted.
"""

import sys

from supabase import Client, create_client

from app.config import settings

# =============================================================================
# CHAMPIONS ROSTER - PokeAPI national dex IDs
# Update this list as the roster is confirmed. These are EXAMPLES.
# =============================================================================
CHAMPIONS_ROSTER: list[int] = [
    # Gen 1 starters + evolutions
    1, 2, 3,        # Bulbasaur line
    4, 5, 6,        # Charmander line
    7, 8, 9,        # Squirtle line
    # Popular competitive Pokemon (placeholder - replace with actual roster)
    25,              # Pikachu
    59,              # Arcanine
    65,              # Alakazam
    94,              # Gengar
    112,             # Rhydon
    130,             # Gyarados
    131,             # Lapras
    134, 135, 136,   # Eeveelutions (gen 1)
    143,             # Snorlax
    149,             # Dragonite
    # Gen 2
    196, 197,        # Espeon, Umbreon
    212,             # Scizor
    248,             # Tyranitar
    # Gen 3
    257,             # Blaziken
    282,             # Gardevoir
    373,             # Salamence
    376,             # Metagross
    # Gen 4
    445,             # Garchomp
    448,             # Lucario
    # Gen 5
    609,             # Chandelure
    # Gen 6
    681,             # Aegislash
    # Gen 7
    785,             # Tapu Koko
    # Gen 8
    812,             # Rillaboom
    # Gen 9
    923,             # Pawmot
]

# =============================================================================
# MEGA EVOLUTIONS - (base_pokemon_id, mega_pokemon_id)
# PokeAPI stores megas as IDs > 10000. Update with actual Champions megas.
# Run import for these mega IDs first if needed.
# =============================================================================
MEGA_EVOLUTIONS: list[tuple[int, int]] = [
    # (6, 10034),    # Charizard -> Mega Charizard X
    # (6, 10035),    # Charizard -> Mega Charizard Y
    # (282, 10051),  # Gardevoir -> Mega Gardevoir
    # (376, 10058),  # Metagross -> Mega Metagross
    # (448, 10060),  # Lucario -> Mega Lucario
]

# =============================================================================
# CHAMPIONS MOVES - PokeAPI move IDs
# Moves available in Champions. Empty = skip flagging (flag manually later).
# If empty, all moves stay champions_available=False until you populate this.
# =============================================================================
CHAMPIONS_MOVES: list[int] = [
    # Leave empty for now -- populate as Champions movepool is documented
    # Example: 89 = Earthquake, 394 = Flare Blitz, 585 = Moonblast
]

# =============================================================================
# CHAMPIONS ITEMS - inserted/upserted directly
# These won't exist in PokeAPI import since we skipped items.
# Use PokeAPI IDs where they match, or start at 10001+ for Champions-only items.
# =============================================================================
CHAMPIONS_ITEMS: list[dict] = [
    # Staple competitive held items (PokeAPI IDs)
    {"id": 197, "name": "Choice Band", "category": "held", "champions_shop_available": True},
    {"id": 198, "name": "Choice Specs", "category": "held", "champions_shop_available": True},
    {"id": 287, "name": "Choice Scarf", "category": "held", "champions_shop_available": True},
    {"id": 234, "name": "Leftovers", "category": "held", "champions_shop_available": True},
    {"id": 247, "name": "Life Orb", "category": "held", "champions_shop_available": True},
    {"id": 249, "name": "Focus Sash", "category": "held", "champions_shop_available": True},
    {"id": 297, "name": "Assault Vest", "category": "held", "champions_shop_available": True},
    {"id": 583, "name": "Rocky Helmet", "category": "held", "champions_shop_available": True},
    {"id": 581, "name": "Eject Button", "category": "held", "champions_shop_available": True},
    {"id": 290, "name": "Safety Goggles", "category": "held", "champions_shop_available": True},
    {"id": 586, "name": "Weakness Policy", "category": "held", "champions_shop_available": True},
    {"id": 683, "name": "Clear Amulet", "category": "held", "champions_shop_available": True},
    {"id": 225, "name": "Sitrus Berry", "category": "berry", "champions_shop_available": True},
    {"id": 223, "name": "Lum Berry", "category": "berry", "champions_shop_available": True},
    # Mega stones - Champions-only IDs (placeholder)
    # {"id": 10001, "name": "Charizardite X", "category": "mega-stone",
    #  "vp_cost": 500, "champions_shop_available": True},
]


def seed_champions_roster(supabase: Client) -> None:
    if not CHAMPIONS_ROSTER:
        print("No Champions roster defined, skipping.")
        return

    print(f"Flagging {len(CHAMPIONS_ROSTER)} Pokemon as champions_eligible...")

    # Reset all to False first
    supabase.table("pokemon").update({"champions_eligible": False}).neq("id", -1).execute()

    # Flag eligible Pokemon in batches
    batch_size = 50
    for i in range(0, len(CHAMPIONS_ROSTER), batch_size):
        batch = CHAMPIONS_ROSTER[i : i + batch_size]
        for pid in batch:
            supabase.table("pokemon").update({"champions_eligible": True}).eq("id", pid).execute()

    print(f"  Done. {len(CHAMPIONS_ROSTER)} Pokemon flagged.")


def seed_mega_evolutions(supabase: Client) -> None:
    if not MEGA_EVOLUTIONS:
        print("No mega evolutions defined, skipping.")
        return

    print(f"Setting {len(MEGA_EVOLUTIONS)} mega evolution links...")
    for base_id, mega_id in MEGA_EVOLUTIONS:
        supabase.table("pokemon").update({"mega_evolution_id": mega_id}).eq(
            "id", base_id
        ).execute()
    print("  Done.")


def seed_champions_moves(supabase: Client) -> None:
    if not CHAMPIONS_MOVES:
        print("No Champions moves defined, skipping.")
        return

    print(f"Flagging {len(CHAMPIONS_MOVES)} moves as champions_available...")

    # Reset all to False first
    supabase.table("moves").update({"champions_available": False}).neq("id", -1).execute()

    for mid in CHAMPIONS_MOVES:
        supabase.table("moves").update({"champions_available": True}).eq("id", mid).execute()

    print(f"  Done. {len(CHAMPIONS_MOVES)} moves flagged.")


def seed_champions_items(supabase: Client) -> None:
    if not CHAMPIONS_ITEMS:
        print("No Champions items defined, skipping.")
        return

    print(f"Upserting {len(CHAMPIONS_ITEMS)} Champions items...")
    supabase.table("items").upsert(CHAMPIONS_ITEMS).execute()
    print("  Done.")


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)

    seed_champions_roster(db)
    seed_mega_evolutions(db)
    seed_champions_moves(db)
    seed_champions_items(db)

    print("\nChampions seed complete.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
