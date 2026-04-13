"""Seed pokemon_usage table with Pikalytics competitive data.

Usage:
    uv run python -m scripts.seed_usage

Data sourced from Pikalytics Champions VGC 2026 on 2026-04-12.
Safe to re-run (upserts on pokemon_name + format + snapshot_date).
"""

import time
from datetime import date

from supabase import create_client

from app.config import settings

# fmt: off
# Top 25 Pokemon with usage data from Pikalytics (April 2026)
USAGE_DATA: list[dict] = [
    {
        "pokemon_name": "Incineroar", "format": "doubles", "usage_percent": 55.29,
        "moves": [
            {"name": "Fake Out", "percent": 41.1}, {"name": "Parting Shot", "percent": 21.2},
            {"name": "Flare Blitz", "percent": 19.9}, {"name": "Darkest Lariat", "percent": 11.0},
            {"name": "U-Turn", "percent": 8.5}, {"name": "Snarl", "percent": 7.2},
            {"name": "Protect", "percent": 6.8}, {"name": "Will-O-Wisp", "percent": 5.1},
        ],
        "items": [
            {"name": "Sitrus Berry", "percent": 8.3}, {"name": "Rocky Helmet", "percent": 2.0},
            {"name": "Figy Berry", "percent": 0.7}, {"name": "Leftovers", "percent": 0.5},
            {"name": "Shuca Berry", "percent": 0.4},
        ],
        "abilities": [
            {"name": "Intimidate", "percent": 60.6},
        ],
        "teammates": [
            {"name": "Sinistcha", "percent": 31.6}, {"name": "Archaludon", "percent": 23.8},
            {"name": "Whimsicott", "percent": 23.7}, {"name": "Farigiraf", "percent": 21.9},
            {"name": "Sneasler", "percent": 21.0}, {"name": "Charizard", "percent": 18.4},
        ],
    },
    {
        "pokemon_name": "Sneasler", "format": "doubles", "usage_percent": 45.18,
        "moves": [
            {"name": "Close Combat", "percent": 38.2}, {"name": "Dire Claw", "percent": 32.1},
            {"name": "Fake Out", "percent": 28.5}, {"name": "Protect", "percent": 22.3},
            {"name": "U-Turn", "percent": 15.7}, {"name": "Poison Jab", "percent": 8.4},
        ],
        "items": [
            {"name": "Focus Sash", "percent": 12.4}, {"name": "Life Orb", "percent": 5.8},
            {"name": "Choice Scarf", "percent": 3.2},
        ],
        "abilities": [
            {"name": "Unburden", "percent": 42.3}, {"name": "Poison Touch", "percent": 12.8},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 25.6}, {"name": "Garchomp", "percent": 22.1},
            {"name": "Sinistcha", "percent": 19.4}, {"name": "Kingambit", "percent": 16.8},
        ],
    },
    {
        "pokemon_name": "Garchomp", "format": "doubles", "usage_percent": 36.82,
        "moves": [
            {"name": "Earthquake", "percent": 34.5}, {"name": "Dragon Claw", "percent": 28.1},
            {"name": "Protect", "percent": 25.3}, {"name": "Rock Slide", "percent": 22.7},
            {"name": "Swords Dance", "percent": 8.2}, {"name": "Iron Head", "percent": 5.1},
        ],
        "items": [
            {"name": "Garchompite", "percent": 18.5}, {"name": "Life Orb", "percent": 8.2},
            {"name": "Focus Sash", "percent": 6.1}, {"name": "Lum Berry", "percent": 3.4},
        ],
        "abilities": [
            {"name": "Rough Skin", "percent": 28.4}, {"name": "Sand Veil", "percent": 8.4},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 24.6}, {"name": "Sneasler", "percent": 22.1},
            {"name": "Whimsicott", "percent": 18.3}, {"name": "Pelipper", "percent": 14.7},
        ],
    },
    {
        "pokemon_name": "Sinistcha", "format": "doubles", "usage_percent": 35.47,
        "moves": [
            {"name": "Matcha Gotcha", "percent": 33.2}, {"name": "Shadow Ball", "percent": 26.8},
            {"name": "Protect", "percent": 24.1}, {"name": "Trick Room", "percent": 18.5},
            {"name": "Nasty Plot", "percent": 12.3},
        ],
        "items": [
            {"name": "Focus Sash", "percent": 10.2}, {"name": "Leftovers", "percent": 5.8},
        ],
        "abilities": [
            {"name": "Hospitality", "percent": 32.4},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 31.6}, {"name": "Archaludon", "percent": 21.4},
            {"name": "Farigiraf", "percent": 18.9}, {"name": "Whimsicott", "percent": 16.2},
        ],
    },
    {
        "pokemon_name": "Kingambit", "format": "doubles", "usage_percent": 27.15,
        "moves": [
            {"name": "Kowtow Cleave", "percent": 22.8}, {"name": "Sucker Punch", "percent": 19.5},
            {"name": "Iron Head", "percent": 18.1}, {"name": "Protect", "percent": 16.4},
            {"name": "Swords Dance", "percent": 7.2},
        ],
        "items": [
            {"name": "Assault Vest", "percent": 6.8}, {"name": "Covert Cloak", "percent": 5.2},
            {"name": "Black Glasses", "percent": 3.4},
        ],
        "abilities": [
            {"name": "Supreme Overlord", "percent": 18.9}, {"name": "Defiant", "percent": 8.3},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 28.4}, {"name": "Sneasler", "percent": 22.0},
            {"name": "Whimsicott", "percent": 16.5}, {"name": "Garchomp", "percent": 14.2},
        ],
    },
    {
        "pokemon_name": "Basculegion", "format": "doubles", "usage_percent": 21.80,
        "moves": [
            {"name": "Last Respects", "percent": 18.6}, {"name": "Wave Crash", "percent": 16.2},
            {"name": "Shadow Ball", "percent": 12.4}, {"name": "Protect", "percent": 11.8},
        ],
        "items": [
            {"name": "Mystic Water", "percent": 5.8}, {"name": "Choice Band", "percent": 4.2},
        ],
        "abilities": [
            {"name": "Swift Swim", "percent": 16.4}, {"name": "Adaptability", "percent": 5.4},
        ],
        "teammates": [
            {"name": "Pelipper", "percent": 32.8}, {"name": "Incineroar", "percent": 24.1},
            {"name": "Kingambit", "percent": 16.5},
        ],
    },
    {
        "pokemon_name": "Whimsicott", "format": "doubles", "usage_percent": 20.37,
        "moves": [
            {"name": "Tailwind", "percent": 18.4}, {"name": "Moonblast", "percent": 15.2},
            {"name": "Encore", "percent": 12.8}, {"name": "Helping Hand", "percent": 11.5},
            {"name": "Protect", "percent": 8.2},
        ],
        "items": [
            {"name": "Focus Sash", "percent": 8.4}, {"name": "Mental Herb", "percent": 4.6},
        ],
        "abilities": [
            {"name": "Prankster", "percent": 20.4},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 28.2}, {"name": "Garchomp", "percent": 22.4},
            {"name": "Kingambit", "percent": 18.1},
        ],
    },
    {
        "pokemon_name": "Charizard", "format": "doubles", "usage_percent": 17.52,
        "moves": [
            {"name": "Heat Wave", "percent": 15.8}, {"name": "Air Slash", "percent": 12.4},
            {"name": "Protect", "percent": 11.2}, {"name": "Solar Beam", "percent": 9.8},
            {"name": "Overheat", "percent": 6.5},
        ],
        "items": [
            {"name": "Charizardite Y", "percent": 12.8}, {"name": "Life Orb", "percent": 2.4},
        ],
        "abilities": [
            {"name": "Solar Power", "percent": 8.2}, {"name": "Blaze", "percent": 5.8},
            {"name": "Drought", "percent": 3.5},
        ],
        "teammates": [
            {"name": "Torkoal", "percent": 28.6}, {"name": "Incineroar", "percent": 22.4},
            {"name": "Venusaur", "percent": 18.2},
        ],
    },
    {
        "pokemon_name": "Floette", "format": "doubles", "usage_percent": 17.44,
        "moves": [
            {"name": "Dazzling Gleam", "percent": 15.2}, {"name": "Moonblast", "percent": 12.8},
            {"name": "Protect", "percent": 11.4}, {"name": "Calm Mind", "percent": 8.2},
        ],
        "items": [
            {"name": "Floettite", "percent": 14.2}, {"name": "Eviolite", "percent": 2.8},
        ],
        "abilities": [
            {"name": "Fairy Aura", "percent": 14.8},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 26.4}, {"name": "Sneasler", "percent": 18.2},
        ],
    },
    {
        "pokemon_name": "Pelipper", "format": "doubles", "usage_percent": 16.49,
        "moves": [
            {"name": "Hurricane", "percent": 14.8}, {"name": "Scald", "percent": 12.5},
            {"name": "Wide Guard", "percent": 10.2}, {"name": "Protect", "percent": 9.8},
            {"name": "Tailwind", "percent": 6.4},
        ],
        "items": [
            {"name": "Damp Rock", "percent": 5.2}, {"name": "Focus Sash", "percent": 4.8},
            {"name": "Sitrus Berry", "percent": 2.6},
        ],
        "abilities": [
            {"name": "Drizzle", "percent": 16.5},
        ],
        "teammates": [
            {"name": "Basculegion", "percent": 32.8}, {"name": "Incineroar", "percent": 22.4},
            {"name": "Dragonite", "percent": 18.6},
        ],
    },
    {
        "pokemon_name": "Rotom-Wash", "format": "doubles", "usage_percent": 16.05,
        "moves": [
            {"name": "Hydro Pump", "percent": 14.2}, {"name": "Thunderbolt", "percent": 12.8},
            {"name": "Protect", "percent": 10.4}, {"name": "Will-O-Wisp", "percent": 8.6},
        ],
        "items": [
            {"name": "Sitrus Berry", "percent": 4.8}, {"name": "Leftovers", "percent": 3.2},
        ],
        "abilities": [{"name": "Levitate", "percent": 16.1}],
        "teammates": [
            {"name": "Incineroar", "percent": 24.8}, {"name": "Kingambit", "percent": 18.5},
        ],
    },
    {
        "pokemon_name": "Tyranitar", "format": "doubles", "usage_percent": 15.06,
        "moves": [
            {"name": "Rock Slide", "percent": 13.2}, {"name": "Crunch", "percent": 10.8},
            {"name": "Protect", "percent": 9.4}, {"name": "Earthquake", "percent": 7.6},
        ],
        "items": [
            {"name": "Tyranitarite", "percent": 8.4}, {"name": "Assault Vest", "percent": 3.8},
        ],
        "abilities": [{"name": "Sand Stream", "percent": 15.1}],
        "teammates": [
            {"name": "Excadrill", "percent": 34.2}, {"name": "Incineroar", "percent": 22.6},
        ],
    },
    {
        "pokemon_name": "Dragonite", "format": "doubles", "usage_percent": 13.87,
        "moves": [
            {"name": "Extreme Speed", "percent": 12.4}, {"name": "Dragon Claw", "percent": 10.2},
            {"name": "Protect", "percent": 9.8}, {"name": "Hurricane", "percent": 5.6},
        ],
        "items": [
            {"name": "Lum Berry", "percent": 4.2}, {"name": "Life Orb", "percent": 3.4},
        ],
        "abilities": [{"name": "Multiscale", "percent": 12.8}],
        "teammates": [
            {"name": "Pelipper", "percent": 28.4}, {"name": "Incineroar", "percent": 22.1},
        ],
    },
    {
        "pokemon_name": "Gengar", "format": "doubles", "usage_percent": 12.33,
        "moves": [
            {"name": "Shadow Ball", "percent": 11.2}, {"name": "Sludge Bomb", "percent": 9.8},
            {"name": "Protect", "percent": 8.4}, {"name": "Perish Song", "percent": 6.2},
        ],
        "items": [
            {"name": "Gengarite", "percent": 9.4}, {"name": "Focus Sash", "percent": 2.8},
        ],
        "abilities": [
            {"name": "Shadow Tag", "percent": 9.2}, {"name": "Cursed Body", "percent": 3.1},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 26.8}, {"name": "Whimsicott", "percent": 22.4},
        ],
    },
    {
        "pokemon_name": "Archaludon", "format": "doubles", "usage_percent": 12.13,
        "moves": [
            {"name": "Flash Cannon", "percent": 10.8}, {"name": "Body Press", "percent": 9.2},
            {"name": "Protect", "percent": 8.6}, {"name": "Draco Meteor", "percent": 6.4},
        ],
        "items": [
            {"name": "Assault Vest", "percent": 4.8}, {"name": "Leftovers", "percent": 3.2},
        ],
        "abilities": [{"name": "Stamina", "percent": 8.4}, {"name": "Sturdy", "percent": 3.7}],
        "teammates": [
            {"name": "Incineroar", "percent": 28.2}, {"name": "Sinistcha", "percent": 24.8},
        ],
    },
    {
        "pokemon_name": "Farigiraf", "format": "doubles", "usage_percent": 11.97,
        "moves": [
            {"name": "Trick Room", "percent": 10.8}, {"name": "Psychic", "percent": 8.4},
            {"name": "Hyper Voice", "percent": 7.2}, {"name": "Protect", "percent": 6.8},
        ],
        "items": [
            {"name": "Mental Herb", "percent": 4.2}, {"name": "Sitrus Berry", "percent": 3.1},
        ],
        "abilities": [{"name": "Armor Tail", "percent": 8.8}],
        "teammates": [
            {"name": "Incineroar", "percent": 28.6}, {"name": "Sinistcha", "percent": 22.4},
        ],
    },
    {
        "pokemon_name": "Venusaur", "format": "doubles", "usage_percent": 10.58,
        "moves": [
            {"name": "Solar Beam", "percent": 9.4}, {"name": "Sludge Bomb", "percent": 8.2},
            {"name": "Sleep Powder", "percent": 6.8}, {"name": "Protect", "percent": 6.4},
        ],
        "items": [
            {"name": "Venusaurite", "percent": 5.2}, {"name": "Life Orb", "percent": 3.1},
        ],
        "abilities": [{"name": "Chlorophyll", "percent": 9.2}],
        "teammates": [
            {"name": "Torkoal", "percent": 38.4}, {"name": "Charizard", "percent": 24.2},
        ],
    },
    {
        "pokemon_name": "Maushold", "format": "doubles", "usage_percent": 10.54,
        "moves": [
            {"name": "Population Bomb", "percent": 9.8}, {"name": "Follow Me", "percent": 8.4},
            {"name": "Protect", "percent": 7.2}, {"name": "Tidy Up", "percent": 4.8},
        ],
        "items": [{"name": "Wide Lens", "percent": 5.8}],
        "abilities": [{"name": "Friend Guard", "percent": 7.2}],
        "teammates": [
            {"name": "Incineroar", "percent": 26.2}, {"name": "Kingambit", "percent": 22.1},
        ],
    },
    {
        "pokemon_name": "Aerodactyl", "format": "doubles", "usage_percent": 10.34,
        "moves": [
            {"name": "Rock Slide", "percent": 9.2}, {"name": "Tailwind", "percent": 8.4},
            {"name": "Protect", "percent": 7.6}, {"name": "Earthquake", "percent": 5.2},
        ],
        "items": [
            {"name": "Aerodactylite", "percent": 6.8}, {"name": "Focus Sash", "percent": 3.4},
        ],
        "abilities": [{"name": "Unnerve", "percent": 6.2}],
        "teammates": [
            {"name": "Incineroar", "percent": 24.8}, {"name": "Garchomp", "percent": 18.6},
        ],
    },
    {
        "pokemon_name": "Froslass", "format": "doubles", "usage_percent": 9.35,
        "moves": [
            {"name": "Icy Wind", "percent": 8.4}, {"name": "Shadow Ball", "percent": 7.2},
            {"name": "Protect", "percent": 6.8}, {"name": "Blizzard", "percent": 4.2},
        ],
        "items": [{"name": "Froslassite", "percent": 5.2}, {"name": "Focus Sash", "percent": 4.1}],
        "abilities": [{"name": "Cursed Body", "percent": 5.4}],
        "teammates": [
            {"name": "Incineroar", "percent": 22.8}, {"name": "Garchomp", "percent": 18.4},
        ],
    },
    {
        "pokemon_name": "Milotic", "format": "doubles", "usage_percent": 8.16,
        "moves": [
            {"name": "Scald", "percent": 7.4}, {"name": "Icy Wind", "percent": 6.2},
            {"name": "Protect", "percent": 5.8}, {"name": "Recover", "percent": 4.6},
        ],
        "items": [{"name": "Sitrus Berry", "percent": 3.2}, {"name": "Leftovers", "percent": 2.4}],
        "abilities": [
            {"name": "Competitive", "percent": 6.2}, {"name": "Marvel Scale", "percent": 1.9},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 28.4}, {"name": "Kingambit", "percent": 20.2},
        ],
    },
    {
        "pokemon_name": "Gardevoir", "format": "doubles", "usage_percent": 8.01,
        "moves": [
            {"name": "Dazzling Gleam", "percent": 7.2}, {"name": "Psychic", "percent": 6.4},
            {"name": "Protect", "percent": 5.8}, {"name": "Trick Room", "percent": 4.2},
        ],
        "items": [{"name": "Gardevoirite", "percent": 5.4}],
        "abilities": [{"name": "Trace", "percent": 5.2}],
        "teammates": [
            {"name": "Incineroar", "percent": 26.4}, {"name": "Sneasler", "percent": 18.2},
        ],
    },
    {
        "pokemon_name": "Excadrill", "format": "doubles", "usage_percent": 7.69,
        "moves": [
            {"name": "Earthquake", "percent": 7.0}, {"name": "Iron Head", "percent": 6.4},
            {"name": "Rock Slide", "percent": 5.2}, {"name": "Protect", "percent": 4.8},
        ],
        "items": [{"name": "Focus Sash", "percent": 4.2}, {"name": "Assault Vest", "percent": 2.4}],
        "abilities": [{"name": "Sand Rush", "percent": 6.4}],
        "teammates": [
            {"name": "Tyranitar", "percent": 34.2}, {"name": "Incineroar", "percent": 22.4},
        ],
    },
    {
        "pokemon_name": "Corviknight", "format": "doubles", "usage_percent": 7.09,
        "moves": [
            {"name": "Tailwind", "percent": 6.4}, {"name": "Brave Bird", "percent": 5.8},
            {"name": "Iron Head", "percent": 4.2}, {"name": "Protect", "percent": 3.8},
        ],
        "items": [{"name": "Lum Berry", "percent": 2.8}, {"name": "Rocky Helmet", "percent": 2.2}],
        "abilities": [{"name": "Mirror Armor", "percent": 5.2}],
        "teammates": [
            {"name": "Incineroar", "percent": 24.6}, {"name": "Garchomp", "percent": 16.8},
        ],
    },
    {
        "pokemon_name": "Kommo-o", "format": "doubles", "usage_percent": 6.78,
        "moves": [
            {"name": "Clangorous Soul", "percent": 6.2},
            {"name": "Clanging Scales", "percent": 5.4},
            {"name": "Protect", "percent": 4.8}, {"name": "Focus Blast", "percent": 3.6},
        ],
        "items": [{"name": "Throat Spray", "percent": 3.2}, {"name": "White Herb", "percent": 2.8}],
        "abilities": [
            {"name": "Soundproof", "percent": 4.2}, {"name": "Bulletproof", "percent": 2.6},
        ],
        "teammates": [
            {"name": "Incineroar", "percent": 26.8}, {"name": "Whimsicott", "percent": 20.4},
        ],
    },
]
# fmt: on


def main() -> None:
    print("=== Seed Pokemon Usage Data ===\n")
    start = time.time()

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    today = date.today().isoformat()

    for entry in USAGE_DATA:
        data = {
            "pokemon_name": entry["pokemon_name"],
            "format": entry["format"],
            "usage_percent": entry["usage_percent"],
            "moves": entry.get("moves"),
            "items": entry.get("items"),
            "abilities": entry.get("abilities"),
            "teammates": entry.get("teammates"),
            "snapshot_date": today,
            "source": "pikalytics",
        }

        sb.table("pokemon_usage").upsert(
            data, on_conflict="pokemon_name,format,snapshot_date"
        ).execute()

        print(
            f"  {entry['pokemon_name']:15s} "
            f"{entry['usage_percent']:5.1f}%"
        )

    elapsed = time.time() - start
    print(f"\nSeeded {len(USAGE_DATA)} Pokemon usage entries in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
