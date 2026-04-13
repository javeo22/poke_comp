"""Seed meta snapshots with known tier data (no API credits needed).

Usage:
    uv run python -m scripts.seed_meta

Data sourced from Game8 tier lists on 2026-04-11.
Safe to re-run (upserts on snapshot_date + format).
"""

import time
from datetime import date

from supabase import create_client

from app.config import settings

# Game8 tier lists as of 2026-04-11
TIER_DATA: dict[str, dict[str, list[str]]] = {
    "singles": {
        "S": ["Garchomp", "Primarina"],
        "A+": [
            "Hippowdon", "Corviknight", "Archaludon", "Kingambit",
            "Mimikyu", "Gengar", "Hydreigon", "Meowscarada",
        ],
        "A": [
            "Aegislash", "Wash Rotom", "Scizor", "Dragonite", "Dragapult",
        ],
        "B": [
            "Greninja", "Excadrill", "Basculegion", "Sneasler",
            "Tyranitar", "Whimsicott", "Snorlax", "Umbreon",
            "Heat Rotom", "Alolan Ninetales", "Sylveon",
        ],
        "C": [
            "Volcarona", "Espathra", "Azumarill", "Serperior",
            "Gallade", "Ceruledge", "Vivillon", "Vaporeon",
            "Politoed", "Palafin", "Skeledirge", "Fan Rotom",
            "Frost Rotom", "Tinkaton", "Garganacl", "Skarmory", "Leafeon",
        ],
    },
    "doubles": {
        "S": ["Incineroar", "Sneasler", "Garchomp"],
        "A+": [
            "Kingambit", "Sinistcha", "Whimsicott", "Charizard",
            "Gengar", "Eternal Flower Floette", "Tyranitar", "Wash Rotom",
        ],
        "A": [
            "Pelipper", "Archaludon", "Excadrill", "Froslass",
            "Dragonite", "Basculegion", "Farigiraf", "Aerodactyl",
            "Primarina",
        ],
        "B": [
            "Maushold", "Venusaur", "Milotic", "Gardevoir",
            "Talonflame", "Corviknight", "Delphox", "Sylveon", "Hatterene",
        ],
        "C": [
            "Glimmora", "Kommo-o", "Torkoal", "Gyarados",
            "Aegislash", "Meganium", "Politoed", "Dragapult",
            "Beartic", "Meowstic", "Orthworm", "Espathra",
        ],
    },
    "megas": {
        "S": [
            "Mega Delphox", "Mega Greninja", "Mega Floette", "Mega Gengar",
        ],
        "A+": ["Mega Charizard Y", "Mega Hawlucha"],
        "A": [
            "Mega Scizor", "Mega Feraligatr", "Mega Froslass",
            "Mega Venusaur", "Mega Blastoise", "Mega Kangaskhan",
            "Mega Gyarados",
        ],
        "B": [
            "Mega Charizard X", "Mega Clefable", "Mega Crabominable",
            "Mega Glimmora", "Mega Heracross", "Mega Lucario",
            "Mega Meganium", "Mega Emboar", "Mega Dragonite",
        ],
        "C": [
            "Mega Excadrill", "Mega Chimecho", "Mega Golurk",
            "Mega Meowstic", "Mega Altaria", "Mega Aggron",
            "Mega Lopunny", "Mega Gallade", "Mega Alakazam",
            "Mega Slowbro", "Mega Tyranitar", "Mega Chesnaught",
            "Mega Gardevoir", "Mega Victreebel", "Mega Chandelure",
            "Mega Skarmory", "Mega Drampa", "Mega Pidgeot",
            "Mega Pinsir", "Mega Aerodactyl", "Mega Sableye",
            "Mega Sharpedo", "Mega Camerupt", "Mega Banette",
            "Mega Scovillain", "Mega Ampharos", "Mega Steelix",
            "Mega Houndoom", "Mega Manectric", "Mega Absol",
            "Mega Audino", "Mega Starmie", "Mega Beedrill",
            "Mega Medicham", "Mega Abomasnow", "Mega Garchomp",
        ],
    },
}

GAME8_URLS: dict[str, str] = {
    "singles": "https://game8.co/games/Pokemon-Champions/archives/592465",
    "doubles": "https://game8.co/games/Pokemon-Champions/archives/593883",
    "megas": "https://game8.co/games/Pokemon-Champions/archives/593897",
}


def main() -> None:
    print("=== Seed Meta Snapshots ===\n")
    start = time.time()

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    today = date.today().isoformat()

    for format_name, tier_data in TIER_DATA.items():
        total = sum(len(v) for v in tier_data.values())
        data = {
            "snapshot_date": today,
            "format": format_name,
            "tier_data": tier_data,
            "source_url": GAME8_URLS[format_name],
            "source": "game8",
        }

        sb.table("meta_snapshots").upsert(
            data, on_conflict="snapshot_date,format"
        ).execute()

        print(f"  {format_name}: {total} Pokemon across 5 tiers")

    elapsed = time.time() - start
    print(f"\nDone in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
