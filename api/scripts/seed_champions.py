"""Seed Champions-specific data: eligible roster, items, mega evolutions, meta.

Usage:
    uv run python -m scripts.seed_champions

Run this AFTER import_pokeapi.py. This script:
1. Flags champions_eligible on Pokemon in the actual Champions roster
2. Fetches and inserts classic mega evolution Pokemon from PokeAPI
3. Creates new Champions/Z-A mega Pokemon records
4. Sets mega_evolution_id relationships
5. Upserts Champions shop items (held items, berries, mega stones)
6. Seeds initial meta snapshot with tier data

Data sourced from serebii.net and game8.co on 2026-04-10 (launch week).
"""

import sys
import time

import httpx
from supabase import Client, create_client

from app.config import settings

POKEAPI_BASE = "https://pokeapi.co/api/v2"

STAT_NAME_MAP = {
    "hp": "hp",
    "attack": "attack",
    "defense": "defense",
    "special-attack": "sp_attack",
    "special-defense": "sp_defense",
    "speed": "speed",
}

# =============================================================================
# CHAMPIONS ROSTER - PokeAPI national dex IDs (186 base Pokemon)
# Source: serebii.net/pokemonchampions/pokemon.shtml
# Only final evolutions + Pikachu. No legendaries/mythicals at launch.
# =============================================================================
CHAMPIONS_ROSTER: list[int] = [
    # --- Gen 1 (28) ---
    3, 6, 9, 15, 18, 24, 25, 26, 36, 38, 59, 65, 68, 71, 80,
    94, 115, 121, 127, 128, 130, 132, 134, 135, 136, 142, 143, 149,
    # --- Gen 2 (17) ---
    154, 157, 160, 168, 181, 184, 186, 196, 197, 199, 205, 208,
    212, 214, 227, 229, 248,
    # --- Gen 3 (16) ---
    279, 282, 302, 306, 308, 310, 319, 323, 324, 334, 350, 351,
    354, 358, 359, 362,
    # --- Gen 4 (23) ---
    389, 392, 395, 405, 407, 409, 411, 428, 442, 445, 448, 450,
    454, 460, 461, 464, 470, 471, 472, 473, 475, 478, 479,
    # --- Gen 5 (25) ---
    497, 500, 503, 505, 510, 512, 514, 516, 530, 531, 534, 547,
    553, 563, 569, 571, 579, 584, 587, 609, 614, 618, 623, 635, 637,
    # --- Gen 6 (27) ---
    652, 655, 658, 660, 663, 666, 670, 671, 675, 676, 678, 681,
    683, 685, 693, 695, 697, 699, 700, 701, 702, 706, 707, 709,
    711, 713, 715,
    # --- Gen 7 (16) ---
    724, 727, 730, 733, 740, 745, 748, 750, 752, 758, 763, 765,
    766, 778, 780, 784,
    # --- Gen 8 (15) ---
    823, 841, 842, 844, 855, 858, 866, 867, 869, 877, 887, 899,
    900, 902, 903,
    # --- Gen 9 (19) ---
    908, 911, 914, 925, 934, 936, 937, 939, 952, 956, 959, 964,
    968, 970, 981, 983, 1013, 1018, 1019,
]

# =============================================================================
# CLASSIC MEGA EVOLUTIONS - exist in PokeAPI as separate Pokemon entries
# (base_pokemon_id, pokeapi_slug)
# =============================================================================
CLASSIC_MEGA_SLUGS: list[tuple[int, str]] = [
    (3, "venusaur-mega"), (6, "charizard-mega-x"), (6, "charizard-mega-y"),
    (9, "blastoise-mega"), (15, "beedrill-mega"), (18, "pidgeot-mega"),
    (65, "alakazam-mega"), (80, "slowbro-mega"), (94, "gengar-mega"),
    (115, "kangaskhan-mega"), (127, "pinsir-mega"), (130, "gyarados-mega"),
    (142, "aerodactyl-mega"), (181, "ampharos-mega"), (208, "steelix-mega"),
    (212, "scizor-mega"), (214, "heracross-mega"), (229, "houndoom-mega"),
    (248, "tyranitar-mega"), (282, "gardevoir-mega"), (302, "sableye-mega"),
    (306, "aggron-mega"), (308, "medicham-mega"), (310, "manectric-mega"),
    (319, "sharpedo-mega"), (323, "camerupt-mega"), (334, "altaria-mega"),
    (354, "banette-mega"), (359, "absol-mega"), (362, "glalie-mega"),
    (428, "lopunny-mega"), (445, "garchomp-mega"), (448, "lucario-mega"),
    (460, "abomasnow-mega"), (475, "gallade-mega"), (531, "audino-mega"),
]

# =============================================================================
# NEW MEGA EVOLUTIONS - Champions / Legends Z-A exclusive (not in PokeAPI)
# IDs 20001+. Types and abilities from game8.co mega evolutions guide.
# Stats and abilities verified via community datamine (April 10, 2026).
# =============================================================================
NEW_MEGAS: list[dict] = [
    {"id": 20001, "base_id": 36, "name": "Mega Clefable",
     "types": ["fairy", "flying"], "ability": "Magic Bounce",
     "stats": {"hp": 95, "attack": 80, "defense": 93, "sp_attack": 135, "sp_defense": 110, "speed": 70}},
    {"id": 20002, "base_id": 71, "name": "Mega Victreebel",
     "types": ["grass", "poison"], "ability": "Innards Out",
     "stats": {"hp": 80, "attack": 115, "defense": 105, "sp_attack": 120, "sp_defense": 90, "speed": 80}},
    {"id": 20003, "base_id": 121, "name": "Mega Starmie",
     "types": ["water", "psychic"], "ability": "Huge Power",
     "stats": {"hp": 60, "attack": 145, "defense": 105, "sp_attack": 155, "sp_defense": 100, "speed": 155}},
    {"id": 20004, "base_id": 149, "name": "Mega Dragonite",
     "types": ["dragon", "flying"], "ability": "Multiscale",
     "stats": {"hp": 91, "attack": 124, "defense": 115, "sp_attack": 145, "sp_defense": 125, "speed": 100}},
    {"id": 20005, "base_id": 154, "name": "Mega Meganium",
     "types": ["grass", "fairy"], "ability": "Mega Sol",
     "stats": {"hp": 80, "attack": 92, "defense": 115, "sp_attack": 143, "sp_defense": 115, "speed": 80}},
    {"id": 20006, "base_id": 160, "name": "Mega Feraligatr",
     "types": ["water", "dragon"], "ability": "Dragonize",
     "stats": {"hp": 85, "attack": 160, "defense": 125, "sp_attack": 89, "sp_defense": 93, "speed": 78}},
    {"id": 20007, "base_id": 227, "name": "Mega Skarmory",
     "types": ["steel", "flying"], "ability": "Stalwart",
     "stats": {"hp": 65, "attack": 140, "defense": 110, "sp_attack": 40, "sp_defense": 100, "speed": 110}},
    {"id": 20008, "base_id": 358, "name": "Mega Chimecho",
     "types": ["psychic", "steel"], "ability": "Levitate",
     "stats": {"hp": 75, "attack": 50, "defense": 110, "sp_attack": 135, "sp_defense": 120, "speed": 65}},
    {"id": 20009, "base_id": 478, "name": "Mega Froslass",
     "types": ["ice", "ghost"], "ability": "Snow Warning",
     "stats": {"hp": 70, "attack": 80, "defense": 70, "sp_attack": 140, "sp_defense": 100, "speed": 120}},
    {"id": 20010, "base_id": 500, "name": "Mega Emboar",
     "types": ["fire", "fighting"], "ability": "Mold Breaker",
     "stats": {"hp": 110, "attack": 153, "defense": 95, "sp_attack": 110, "sp_defense": 95, "speed": 65}},
    {"id": 20011, "base_id": 530, "name": "Mega Excadrill",
     "types": ["ground", "steel"], "ability": "Piercing Drill",
     "stats": {"hp": 110, "attack": 165, "defense": 100, "sp_attack": 65, "sp_defense": 65, "speed": 103}},
    {"id": 20012, "base_id": 609, "name": "Mega Chandelure",
     "types": ["ghost", "fire"], "ability": "Infiltrator",
     "stats": {"hp": 60, "attack": 75, "defense": 110, "sp_attack": 175, "sp_defense": 110, "speed": 90}},
    {"id": 20013, "base_id": 623, "name": "Mega Golurk",
     "types": ["ground", "ghost"], "ability": "Unseen Fist",
     "stats": {"hp": 89, "attack": 164, "defense": 110, "sp_attack": 55, "sp_defense": 110, "speed": 55}},
    {"id": 20014, "base_id": 652, "name": "Mega Chesnaught",
     "types": ["grass", "fighting"], "ability": "Bulletproof",
     "stats": {"hp": 88, "attack": 137, "defense": 172, "sp_attack": 74, "sp_defense": 115, "speed": 44}},
    {"id": 20015, "base_id": 655, "name": "Mega Delphox",
     "types": ["fire", "psychic"], "ability": "Levitate",
     "stats": {"hp": 75, "attack": 69, "defense": 72, "sp_attack": 159, "sp_defense": 125, "speed": 134}},
    {"id": 20016, "base_id": 658, "name": "Mega Greninja",
     "types": ["water", "dark"], "ability": "Protean",
     "stats": {"hp": 72, "attack": 125, "defense": 77, "sp_attack": 133, "sp_defense": 81, "speed": 142}},
    {"id": 20017, "base_id": 670, "name": "Mega Floette",
     "types": ["fairy"], "ability": "Fairy Aura",
     "stats": {"hp": 74, "attack": 85, "defense": 87, "sp_attack": 155, "sp_defense": 148, "speed": 102}},
    {"id": 20018, "base_id": 678, "name": "Mega Meowstic",
     "types": ["psychic"], "ability": "Trace",
     "stats": {"hp": 74, "attack": 48, "defense": 96, "sp_attack": 123, "sp_defense": 101, "speed": 124}},
    {"id": 20019, "base_id": 701, "name": "Mega Hawlucha",
     "types": ["fighting", "flying"], "ability": "No Guard",
     "stats": {"hp": 78, "attack": 122, "defense": 95, "sp_attack": 84, "sp_defense": 73, "speed": 148}},
    {"id": 20020, "base_id": 740, "name": "Mega Crabominable",
     "types": ["fighting", "ice"], "ability": "Iron Fist",
     "stats": {"hp": 97, "attack": 172, "defense": 117, "sp_attack": 62, "sp_defense": 87, "speed": 43}},
    {"id": 20021, "base_id": 780, "name": "Mega Drampa",
     "types": ["normal", "dragon"], "ability": "Berserk",
     "stats": {"hp": 78, "attack": 85, "defense": 110, "sp_attack": 160, "sp_defense": 116, "speed": 36}},
    {"id": 20022, "base_id": 952, "name": "Mega Scovillain",
     "types": ["grass", "fire"], "ability": "Spicy Spray",
     "stats": {"hp": 65, "attack": 128, "defense": 85, "sp_attack": 128, "sp_defense": 85, "speed": 95}},
    {"id": 20023, "base_id": 970, "name": "Mega Glimmora",
     "types": ["rock", "poison"], "ability": "Adaptability",
     "stats": {"hp": 83, "attack": 90, "defense": 105, "sp_attack": 150, "sp_defense": 96, "speed": 101}},
]

# =============================================================================
# CHAMPIONS ITEMS
# Source: serebii.net/pokemonchampions/items.shtml
# (name, pokeapi_slug, category, vp_cost_or_None)
# vp_cost=None means starter/free item
# =============================================================================
HELD_ITEMS: list[tuple[str, str, str, int | None]] = [
    ("Black Belt", "black-belt", "type-boost", 700),
    ("Black Glasses", "black-glasses", "type-boost", 700),
    ("Bright Powder", "bright-powder", "held", None),
    ("Charcoal", "charcoal", "type-boost", 700),
    ("Choice Scarf", "choice-scarf", "held", None),
    ("Dragon Fang", "dragon-fang", "type-boost", 700),
    ("Fairy Feather", "fairy-feather", "type-boost", 700),
    ("Focus Band", "focus-band", "held", None),
    ("Focus Sash", "focus-sash", "held", None),
    ("Hard Stone", "hard-stone", "type-boost", 700),
    ("King's Rock", "kings-rock", "held", None),
    ("Leftovers", "leftovers", "held", None),
    ("Light Ball", "light-ball", "held", 1000),
    ("Magnet", "magnet", "type-boost", 700),
    ("Mental Herb", "mental-herb", "held", 1000),
    ("Metal Coat", "metal-coat", "type-boost", 700),
    ("Miracle Seed", "miracle-seed", "type-boost", 700),
    ("Mystic Water", "mystic-water", "type-boost", 700),
    ("Never-Melt Ice", "never-melt-ice", "type-boost", 700),
    ("Poison Barb", "poison-barb", "type-boost", 700),
    ("Quick Claw", "quick-claw", "held", None),
    ("Scope Lens", "scope-lens", "held", 1000),
    ("Sharp Beak", "sharp-beak", "type-boost", 700),
    ("Shell Bell", "shell-bell", "held", 700),
    ("Silk Scarf", "silk-scarf", "type-boost", 700),
    ("Silver Powder", "silver-powder", "type-boost", 700),
    ("Soft Sand", "soft-sand", "type-boost", 700),
    ("Spell Tag", "spell-tag", "type-boost", 700),
    ("Twisted Spoon", "twisted-spoon", "type-boost", 700),
    ("White Herb", "white-herb", "held", None),
]

BERRIES: list[tuple[str, str, int | None]] = [
    ("Aspear Berry", "aspear-berry", 400),
    ("Babiri Berry", "babiri-berry", 400),
    ("Charti Berry", "charti-berry", 400),
    ("Cheri Berry", "cheri-berry", 400),
    ("Chesto Berry", "chesto-berry", 400),
    ("Chilan Berry", "chilan-berry", 400),
    ("Chople Berry", "chople-berry", 400),
    ("Coba Berry", "coba-berry", 400),
    ("Colbur Berry", "colbur-berry", 400),
    ("Haban Berry", "haban-berry", 400),
    ("Kasib Berry", "kasib-berry", 400),
    ("Kebia Berry", "kebia-berry", 400),
    ("Leppa Berry", "leppa-berry", 400),
    ("Lum Berry", "lum-berry", None),
    ("Occa Berry", "occa-berry", 400),
    ("Oran Berry", "oran-berry", 400),
    ("Passho Berry", "passho-berry", 400),
    ("Payapa Berry", "payapa-berry", 400),
    ("Pecha Berry", "pecha-berry", 400),
    ("Persim Berry", "persim-berry", 400),
    ("Rawst Berry", "rawst-berry", 400),
    ("Rindo Berry", "rindo-berry", 400),
    ("Roseli Berry", "roseli-berry", 400),
    ("Shuca Berry", "shuca-berry", 400),
    ("Sitrus Berry", "sitrus-berry", None),
    ("Tanga Berry", "tanga-berry", 400),
    ("Wacan Berry", "wacan-berry", 400),
    ("Yache Berry", "yache-berry", 400),
]

MEGA_STONES: list[tuple[str, str, int]] = [
    ("Abomasite", "abomasite", 2000),
    ("Absolite", "absolite", 2000),
    ("Aerodactylite", "aerodactylite", 2000),
    ("Aggronite", "aggronite", 2000),
    ("Alakazite", "alakazite", 2000),
    ("Altarianite", "altarianite", 2000),
    ("Ampharosite", "ampharosite", 2000),
    ("Audinite", "audinite", 2000),
    ("Banettite", "banettite", 2000),
    ("Beedrillite", "beedrillite", 2000),
    ("Blastoisinite", "blastoisinite", 2000),
    ("Cameruptite", "cameruptite", 2000),
    ("Chandelurite", "chandelurite", 2000),
    ("Charizardite X", "charizardite-x", 2000),
    ("Charizardite Y", "charizardite-y", 2000),
    ("Chesnaughtite", "chesnaughtite", 2000),
    ("Chimechite", "chimechite", 2000),
    ("Clefablite", "clefablite", 2000),
    ("Crabominite", "crabominite", 2000),
    ("Delphoxite", "delphoxite", 2000),
    ("Dragoninite", "dragoninite", 2000),
    ("Drampanite", "drampanite", 2000),
    ("Emboarite", "emboarite", 2000),
    ("Excadrite", "excadrite", 2000),
    ("Feraligite", "feraligite", 2000),
    ("Floettite", "floettite", 2000),
    ("Froslassite", "froslassite", 2000),
    ("Galladite", "galladite", 2000),
    ("Garchompite", "garchompite", 2000),
    ("Gardevoirite", "gardevoirite", 2000),
    ("Gengarite", "gengarite", 2000),
    ("Glalitite", "glalitite", 2000),
    ("Glimmoranite", "glimmoranite", 2000),
    ("Golurkite", "golurkite", 2000),
    ("Greninjite", "greninjite", 2000),
    ("Gyaradosite", "gyaradosite", 2000),
    ("Hawluchanite", "hawluchanite", 2000),
    ("Heracronite", "heracronite", 2000),
    ("Houndoominite", "houndoominite", 2000),
    ("Kangaskhanite", "kangaskhanite", 2000),
    ("Lopunnite", "lopunnite", 2000),
    ("Lucarionite", "lucarionite", 2000),
    ("Manectite", "manectite", 2000),
    ("Medichamite", "medichamite", 2000),
    ("Meganiumite", "meganiumite", 2000),
    ("Meowsticite", "meowsticite", 2000),
    ("Pidgeotite", "pidgeotite", 2000),
    ("Pinsirite", "pinsirite", 2000),
    ("Sablenite", "sablenite", 2000),
    ("Scizorite", "scizorite", 2000),
    ("Scovillainite", "scovillainite", 2000),
    ("Sharpedonite", "sharpedonite", 2000),
    ("Skarmorite", "skarmorite", 2000),
    ("Slowbronite", "slowbronite", 2000),
    ("Starminite", "starminite", 2000),
    ("Steelixite", "steelixite", 2000),
    ("Tyranitarite", "tyranitarite", 2000),
    ("Venusaurite", "venusaurite", 2000),
    ("Victreebelite", "victreebelite", 2000),
]

# =============================================================================
# INITIAL META TIER DATA
# Source: game8.co/games/Pokemon-Champions/archives/592465 (2026-04-10)
# =============================================================================
INITIAL_TIER_DATA: dict[str, dict] = {
    "singles": {
        "S": ["Hippowdon", "Garchomp"],
        "A+": ["Meowscarada", "Archaludon", "Hydreigon", "Mimikyu", "Greninja"],
        "A": [
            "Corviknight", "Wash Rotom", "Kingambit", "Primarina",
            "Dragapult", "Basculegion", "Volcarona",
        ],
        "B": [
            "Whimsicott", "Scizor", "Snorlax", "Umbreon", "Alolan Ninetales",
            "Tyranitar", "Espathra", "Sylveon", "Dragonite", "Heat Rotom",
            "Sneasler", "Excadrill",
        ],
        "C": [
            "Mow Rotom", "Serperior", "Gallade", "Ceruledge", "Vivillon",
            "Vaporeon", "Politoed", "Palafin", "Gengar", "Skeledirge",
            "Fan Rotom", "Frost Rotom", "Tinkaton", "Garganacl", "Skarmory",
            "Leafeon",
        ],
    },
    "doubles": {
        "S": ["Incineroar", "Kingambit"],
        "A+": ["Garchomp", "Dragonite", "Glimmora", "Torkoal", "Sinistcha"],
        "A": [
            "Espathra", "Primarina", "Farigiraf", "Archaludon", "Whimsicott",
            "Pelipper", "Sneasler", "Tyranitar", "Maushold", "Hatterene",
            "Excadrill",
        ],
        "B": [
            "Arcanine", "Palafin", "Dragapult", "Sylveon", "Ceruledge",
            "Armarouge", "Meganium", "Corviknight",
        ],
    },
    "megas": {
        "S": ["Mega Delphox", "Mega Greninja", "Mega Floette", "Mega Gengar"],
        "A+": ["Mega Charizard Y", "Mega Hawlucha"],
        "A": [
            "Mega Scizor", "Mega Feraligatr", "Mega Froslass", "Mega Venusaur",
            "Mega Blastoise", "Mega Kangaskhan", "Mega Gyarados",
        ],
        "B": [
            "Mega Charizard X", "Mega Clefable", "Mega Crabominable",
            "Mega Glimmora", "Mega Heracross", "Mega Lucario",
            "Mega Meganium", "Mega Emboar",
        ],
    },
}


# =============================================================================
# HELPERS
# =============================================================================

def format_name(name: str) -> str:
    """Convert PokeAPI kebab-case to Title Case."""
    return name.replace("-", " ").title()


def format_mega_name(raw_name: str) -> str:
    """Format mega Pokemon name: 'charizard-mega-x' -> 'Mega Charizard X'."""
    parts = raw_name.replace("-", " ").title().split()
    if "Mega" in parts:
        parts.remove("Mega")
        return "Mega " + " ".join(parts)
    return " ".join(parts)


def fetch_pokemon_from_pokeapi(slug: str) -> dict | None:
    """Fetch a single Pokemon from PokeAPI (synchronous)."""
    try:
        resp = httpx.get(f"{POKEAPI_BASE}/pokemon/{slug}", timeout=15)
        if resp.status_code != 200:
            return None
        data = resp.json()
        stats = {}
        for s in data["stats"]:
            key = STAT_NAME_MAP.get(s["stat"]["name"])
            if key:
                stats[key] = s["base_stat"]
        return {
            "id": data["id"],
            "name": format_mega_name(data["name"]),
            "types": [t["type"]["name"] for t in data["types"]],
            "base_stats": stats,
            "abilities": [format_name(a["ability"]["name"]) for a in data["abilities"]],
            "movepool": [format_name(m["move"]["name"]) for m in data["moves"]],
            "champions_eligible": True,
            "sprite_url": data.get("sprites", {}).get("front_default"),
        }
    except Exception as e:
        print(f"  Warning: Failed to fetch {slug}: {e}")
        return None


def resolve_item_id(slug: str) -> int | None:
    """Look up a PokeAPI item ID by slug."""
    try:
        resp = httpx.get(f"{POKEAPI_BASE}/item/{slug}", timeout=10)
        if resp.status_code == 200:
            return resp.json()["id"]
    except Exception:
        pass
    return None


# =============================================================================
# SEED FUNCTIONS
# =============================================================================

def seed_champions_roster(supabase: Client) -> None:
    """Flag Champions-eligible Pokemon in bulk."""
    print(f"Flagging {len(CHAMPIONS_ROSTER)} Pokemon as champions_eligible...")

    # Reset all to False
    supabase.table("pokemon").update(
        {"champions_eligible": False}
    ).neq("id", -1).execute()

    # Flag eligible Pokemon
    for pid in CHAMPIONS_ROSTER:
        supabase.table("pokemon").update(
            {"champions_eligible": True}
        ).eq("id", pid).execute()

    print(f"  Done. {len(CHAMPIONS_ROSTER)} Pokemon flagged.")


def seed_classic_megas(supabase: Client) -> None:
    """Fetch classic mega Pokemon from PokeAPI and insert into pokemon table."""
    print(f"Importing {len(CLASSIC_MEGA_SLUGS)} classic mega Pokemon from PokeAPI...")
    imported = 0

    for base_id, slug in CLASSIC_MEGA_SLUGS:
        data = fetch_pokemon_from_pokeapi(slug)
        if data:
            supabase.table("pokemon").upsert(data).execute()
            imported += 1
        time.sleep(0.1)

    print(f"  Imported {imported}/{len(CLASSIC_MEGA_SLUGS)} classic megas.")


def seed_new_megas(supabase: Client) -> None:
    """Create new Champions/Z-A mega Pokemon records using base Pokemon data."""
    print(f"Creating {len(NEW_MEGAS)} new mega Pokemon records...")

    for mega in NEW_MEGAS:
        # Copy stats and movepool from the base Pokemon
        result = supabase.table("pokemon").select(
            "base_stats, movepool, generation"
        ).eq("id", mega["base_id"]).single().execute()

        if not result.data:
            print(f"  Warning: base Pokemon {mega['base_id']} not found, skipping {mega['name']}")
            continue

        record = {
            "id": mega["id"],
            "name": mega["name"],
            "types": mega["types"],
            "base_stats": mega["stats"],
            "abilities": [mega["ability"]],
            "movepool": result.data["movepool"],
            "champions_eligible": True,
            "generation": result.data.get("generation"),
            "sprite_url": None,
        }
        supabase.table("pokemon").upsert(record).execute()

    print("  Done.")


def seed_mega_links(supabase: Client) -> None:
    """Set mega_evolution_id on base Pokemon for all megas."""
    print("Linking mega evolutions to base Pokemon...")
    linked = 0

    # Classic megas: look up the mega's PokeAPI ID from the pokemon table
    for base_id, slug in CLASSIC_MEGA_SLUGS:
        mega_name = format_mega_name(slug)
        result = supabase.table("pokemon").select("id").eq(
            "name", mega_name
        ).maybe_single().execute()
        if result.data:
            supabase.table("pokemon").update(
                {"mega_evolution_id": result.data["id"]}
            ).eq("id", base_id).execute()
            linked += 1

    # New megas: ID is known directly
    for mega in NEW_MEGAS:
        supabase.table("pokemon").update(
            {"mega_evolution_id": mega["id"]}
        ).eq("id", mega["base_id"]).execute()
        linked += 1

    print(f"  Linked {linked} mega evolutions.")


def seed_items(supabase: Client) -> None:
    """Seed all Champions items, resolving PokeAPI IDs where possible."""
    all_items: list[dict] = []
    next_fallback_id = 10001

    # Held items
    print(f"Resolving {len(HELD_ITEMS)} held item IDs from PokeAPI...")
    for name, slug, category, vp_cost in HELD_ITEMS:
        item_id = resolve_item_id(slug)
        if item_id is None:
            item_id = next_fallback_id
            next_fallback_id += 1
            print(f"  Fallback ID {item_id} for {name}")
        all_items.append({
            "id": item_id, "name": name, "category": category,
            "vp_cost": vp_cost, "champions_shop_available": True,
        })

    # Berries
    print(f"Resolving {len(BERRIES)} berry IDs from PokeAPI...")
    for name, slug, vp_cost in BERRIES:
        item_id = resolve_item_id(slug)
        if item_id is None:
            item_id = next_fallback_id
            next_fallback_id += 1
            print(f"  Fallback ID {item_id} for {name}")
        all_items.append({
            "id": item_id, "name": name, "category": "berry",
            "vp_cost": vp_cost, "champions_shop_available": True,
        })

    # Mega stones
    print(f"Resolving {len(MEGA_STONES)} mega stone IDs from PokeAPI...")
    for name, slug, vp_cost in MEGA_STONES:
        item_id = resolve_item_id(slug)
        if item_id is None:
            item_id = next_fallback_id
            next_fallback_id += 1
        all_items.append({
            "id": item_id, "name": name, "category": "mega-stone",
            "vp_cost": vp_cost, "champions_shop_available": True,
        })

    print(f"Upserting {len(all_items)} items...")
    batch_size = 50
    for i in range(0, len(all_items), batch_size):
        supabase.table("items").upsert(all_items[i : i + batch_size]).execute()
    print("  Done.")


def seed_initial_meta(supabase: Client) -> None:
    """Seed the first meta snapshot with Game8 tier data."""
    print("Seeding initial meta snapshot...")

    for format_key, tiers in INITIAL_TIER_DATA.items():
        supabase.table("meta_snapshots").upsert(
            {
                "snapshot_date": "2026-04-10",
                "format": format_key,
                "tier_data": tiers,
                "source_url": "https://game8.co/games/Pokemon-Champions/archives/592465",
                "source": "Game8",
            },
            on_conflict="snapshot_date,format",
        ).execute()

    print(f"  Done. {len(INITIAL_TIER_DATA)} format snapshots created.")


def main() -> None:
    db = create_client(settings.supabase_url, settings.supabase_service_key)

    seed_champions_roster(db)
    seed_classic_megas(db)
    seed_new_megas(db)
    seed_mega_links(db)
    seed_items(db)
    seed_initial_meta(db)

    print("\nChampions seed complete.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nInterrupted.")
        sys.exit(1)
