"""Seed user_pokemon roster from Notion database snapshot.

Usage:
    uv run python -m scripts.seed_roster_from_notion

Data sourced from Notion "Pokemon Champions Roster" database on 2026-04-12.
Maps Notion Status values: Built -> built, Planned -> training, Owned -> wishlist.
Safe to re-run (deletes existing roster for dev user, then inserts).
"""

import time

from supabase import create_client

from app.config import settings

# fmt: off
ROSTER: list[dict] = [
    # ══════════════════════════════════════════
    # SUN TEAM (Built)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 6, "name": "Charizard",
        "ability": "Drought", "item_id": 717, "nature": "Modest",
        "stat_points": {"sp_attack": 32, "speed": 32, "hp": 2},
        "moves": ["Heat Wave", "Solar Beam", "Air Slash", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "Mega Y. Win condition. Drought stacks with Torkoal.",
    },
    {
        "pokemon_id": 324, "name": "Torkoal",
        "ability": "Drought", "item_id": 226, "nature": "Quiet",
        "stat_points": {"hp": 32, "sp_attack": 32, "sp_defense": 2},
        "moves": ["Eruption", "Heat Wave", "Earth Power", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "Sun setter. Quiet synergizes with Hatterene TR flip.",
    },
    {
        "pokemon_id": 71, "name": "Victreebel",
        "ability": "Chlorophyll", "item_id": 252, "nature": "Modest",
        "stat_points": {"sp_attack": 32, "speed": 32, "hp": 2},
        "moves": ["Solar Beam", "Sludge Bomb", "Weather Ball", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "Chlorophyll sweeper. Weather Ball = 100 BP Fire in Sun.",
    },
    {
        "pokemon_id": 637, "name": "Volcarona",
        "ability": "Flame Body", "item_id": 135, "nature": "Timid",
        "stat_points": {"sp_attack": 32, "speed": 32, "hp": 2},
        "moves": ["Fiery Dance", "Bug Buzz", "Quiver Dance", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "Setup sweeper. Fiery Dance + Quiver Dance compound.",
    },
    {
        "pokemon_id": 858, "name": "Hatterene",
        "ability": "Magic Bounce", "item_id": 196, "nature": "Quiet",
        "stat_points": {"hp": 32, "sp_attack": 32, "defense": 2},
        "moves": ["Dazzling Gleam", "Psychic", "Trick Room", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "TR flip. Magic Bounce reflects status moves.",
    },
    {
        "pokemon_id": 701, "name": "Hawlucha",
        "ability": "Unburden", "item_id": 135, "nature": "Adamant",
        "stat_points": {"attack": 32, "speed": 32, "hp": 2},
        "moves": ["Acrobatics", "Close Combat", "Rock Slide", "Protect"],
        "build_status": "built", "vp_spent": 0,
        "notes": "Unburden sweeper. Sitrus consumed -> Acrobatics 110 BP.",
    },
    # ══════════════════════════════════════════
    # SAND TEAM (Planned)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 450, "name": "Hippowdon",
        "ability": "Sand Stream", "item_id": 283, "nature": "Impish",
        "stat_points": {"hp": 32, "defense": 32, "sp_defense": 2},
        "moves": ["Earthquake", "Rock Slide", "Stealth Rock", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Sand setter for Team A.",
    },
    {
        "pokemon_id": 445, "name": "Garchomp",
        "ability": "Sand Force", "item_id": 722, "nature": "Jolly",
        "stat_points": {"attack": 32, "speed": 32, "sp_defense": 2},
        "moves": ["Earthquake", "Rock Slide", "Dragon Claw", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Mega Garchomp. Sand Force boosts Ground/Rock/Steel.",
    },
    {
        "pokemon_id": 530, "name": "Excadrill",
        "ability": "Sand Rush", "item_id": 252, "nature": "Adamant",
        "stat_points": {"attack": 32, "speed": 32, "hp": 2},
        "moves": ["Earthquake", "Iron Head", "Rock Slide", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Sand Rush doubles speed in sand. Physical sweeper.",
    },
    {
        "pokemon_id": 681, "name": "Aegislash",
        "ability": "Stance Change", "item_id": 289, "nature": "Quiet",
        "stat_points": {"defense": 32, "sp_attack": 32, "sp_defense": 2},
        "moves": ["Shadow Ball", "Sacred Sword", "King's Shield", "Flash Cannon"],
        "build_status": "training", "vp_spent": 0,
        "notes": "WP activates then King's Shield cycles.",
    },
    {
        "pokemon_id": 823, "name": "Corviknight",
        "ability": "Mirror Armor", "item_id": 134, "nature": "Impish",
        "stat_points": {"hp": 32, "defense": 32, "sp_defense": 2},
        "moves": ["Tailwind", "Iron Head", "Brave Bird", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Tailwind setter and physical wall for Team A.",
    },
    # ══════════════════════════════════════════
    # RAIN TEAM (Planned)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 279, "name": "Pelipper",
        "ability": "Drizzle", "item_id": 282, "nature": "Modest",
        "stat_points": {"defense": 2, "sp_attack": 32, "speed": 32},
        "moves": ["Hurricane", "Scald", "Wide Guard", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Rain setter. Wide Guard blocks spread moves.",
    },
    {
        "pokemon_id": 149, "name": "Dragonite",
        "ability": "Multiscale", "item_id": 134, "nature": "Modest",
        "stat_points": {"defense": 2, "sp_attack": 32, "speed": 32},
        "moves": ["Hurricane", "Thunder", "Dragon Pulse", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Rain abuser. Hurricane + Thunder 100% in rain.",
    },
    {
        "pokemon_id": 9, "name": "Blastoise",
        "ability": "Mega Launcher", "item_id": 700, "nature": "Modest",
        "stat_points": {"defense": 2, "sp_attack": 32, "speed": 32},
        "moves": ["Water Spout", "Aura Sphere", "Ice Beam", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Mega Blastoise. Mega Launcher boosts pulse/ball.",
    },
    {
        "pokemon_id": 902, "name": "Basculegion",
        "ability": "Swift Swim", "item_id": 135, "nature": "Adamant",
        "stat_points": {"attack": 32, "speed": 32, "hp": 2},
        "moves": ["Last Respects", "Wave Crash", "Shadow Ball", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Swift Swim in rain. Last Respects snowballs.",
    },
    # ══════════════════════════════════════════
    # TRAP TEAM (Planned)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 94, "name": "Gengar",
        "ability": "Shadow Tag", "item_id": 695, "nature": "Timid",
        "stat_points": {"defense": 2, "sp_attack": 32, "speed": 32},
        "moves": ["Perish Song", "Shadow Ball", "Sludge Bomb", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Mega Gengar. Shadow Tag + Perish Song.",
    },
    {
        "pokemon_id": 547, "name": "Whimsicott",
        "ability": "Prankster", "item_id": 196, "nature": "Timid",
        "stat_points": {"hp": 32, "sp_defense": 32, "speed": 2},
        "moves": ["Tailwind", "Encore", "Helping Hand", "Moonblast"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Prankster Tailwind + Encore. Mental Herb blocks Taunt.",
    },
    {
        "pokemon_id": 887, "name": "Dragapult",
        "ability": "Clear Body", "item_id": 264, "nature": "Jolly",
        "stat_points": {"attack": 32, "speed": 32, "hp": 2},
        "moves": ["Dragon Darts", "Phantom Force", "U-Turn", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Fast revenge killer and pivot for Trap team.",
    },
    {
        "pokemon_id": 784, "name": "Kommo-o",
        "ability": "Soundproof", "item_id": 191, "nature": "Timid",
        "stat_points": {"defense": 2, "sp_attack": 32, "speed": 32},
        "moves": ["Clangorous Soul", "Clanging Scales", "Focus Blast", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Soundproof = immune to Perish Song. White Herb.",
    },
    # ══════════════════════════════════════════
    # MULTI-TEAM SUPPORT (Planned)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 727, "name": "Incineroar",
        "ability": "Intimidate", "item_id": 135, "nature": "Careful",
        "stat_points": {"hp": 32, "sp_defense": 32, "speed": 2},
        "moves": ["Fake Out", "Parting Shot", "Flare Blitz", "Snarl"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Universal support. Sand, Rain, and Trap teams.",
    },
    {
        "pokemon_id": 983, "name": "Kingambit",
        "ability": "Supreme Overlord", "item_id": 2109, "nature": "Adamant",
        "stat_points": {"attack": 32, "defense": 32, "hp": 2},
        "moves": ["Kowtow Cleave", "Iron Head", "Sucker Punch", "Protect"],
        "build_status": "training", "vp_spent": 0,
        "notes": "Endgame cleaner on Rain and Trap teams.",
    },
    {
        "pokemon_id": 530, "name": "Excadrill (2)",
        "ability": "Sand Rush", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "training", "vp_spent": 0,
        "notes": "Duplicate entry. See main Excadrill.",
    },
    # ══════════════════════════════════════════
    # OWNED (not yet built)
    # ══════════════════════════════════════════
    {
        "pokemon_id": 350, "name": "Milotic",
        "ability": "Marvel Scale", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Bulky special attacker or defensive pivot.",
    },
    {
        "pokemon_id": 130, "name": "Gyarados",
        "ability": "Intimidate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Physical pivot. Could sub into Rain team.",
    },
    {
        "pokemon_id": 130, "name": "Gyarados (2)",
        "ability": "Intimidate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Mega Gyarados is Dark/Water with Mold Breaker.",
    },
    {
        "pokemon_id": 3, "name": "Venusaur",
        "ability": "Chlorophyll", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Could replace Victreebel on Sun team.",
    },
    {
        "pokemon_id": 59, "name": "Arcanine",
        "ability": "Intimidate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Intimidate support. Extreme Speed priority.",
    },
    {
        "pokemon_id": 903, "name": "Sneasler",
        "ability": "Unburden", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Fast physical attacker.",
    },
    {
        "pokemon_id": 903, "name": "Sneasler (2)",
        "ability": "Unburden", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Different role from first copy.",
    },
    {
        "pokemon_id": 208, "name": "Steelix",
        "ability": "Sturdy", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Mega can Sandstorm and wall.",
    },
    {
        "pokemon_id": 121, "name": "Starmie",
        "ability": "Natural Cure", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Fast special attacker. Rain or general use.",
    },
    {
        "pokemon_id": 663, "name": "Talonflame",
        "ability": "Gale Wings", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Tailwind user or fast attacker.",
    },
    {
        "pokemon_id": 10239, "name": "Hisuian Zoroark",
        "ability": "Illusion", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Normal/Ghost. Illusion mindgames.",
    },
    {
        "pokemon_id": 115, "name": "Kangaskhan",
        "ability": "Scrappy", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Mega Kangaskhan. Parental Bond for doubles.",
    },
    {
        "pokemon_id": 500, "name": "Emboar",
        "ability": "Reckless", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Reckless attacker.",
    },
    {
        "pokemon_id": 186, "name": "Politoed",
        "ability": "Drizzle", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Backup rain setter. Pelipper fills this slot.",
    },
    {
        "pokemon_id": 310, "name": "Manectric",
        "ability": "Lightning Rod", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Lightning Rod support for Rain team.",
    },
    {
        "pokemon_id": 914, "name": "Quaquaval",
        "ability": "Moxie", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Water/Fighting. Moxie sweeper.",
    },
    {
        "pokemon_id": 478, "name": "Froslass",
        "ability": "Cursed Body", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Ice/Ghost. Fast TR setter or support.",
    },
    {
        "pokemon_id": 908, "name": "Meowscarada",
        "ability": "Protean", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Grass/Dark. Flower Trick fast attacker.",
    },
    {
        "pokemon_id": 956, "name": "Espathra",
        "ability": "Opportunist", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Psychic. Feather Dance or Speed Boost sweeper.",
    },
    {
        "pokemon_id": 968, "name": "Orthworm",
        "ability": "Shed Skin", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Steel/Ground defensive wall option.",
    },
    {
        "pokemon_id": 10230, "name": "Hisuian Arcanine",
        "ability": "Intimidate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Fire/Rock. Intimidate support.",
    },
    {
        "pokemon_id": 635, "name": "Hydreigon",
        "ability": "Levitate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Dark/Dragon special attacker. Wide coverage.",
    },
    {
        "pokemon_id": 10242, "name": "Hisuian Goodra",
        "ability": "Sap Sipper", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Steel/Dragon. Bulky special attacker.",
    },
    {
        "pokemon_id": 936, "name": "Armarouge",
        "ability": "Flash Fire", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Fire/Psychic. Special attacker.",
    },
    {
        "pokemon_id": 479, "name": "Rotom-Frost",
        "ability": "Levitate", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Electric/Ice. Blizzard spreader.",
    },
    {
        "pokemon_id": 10104, "name": "Alolan Ninetales",
        "ability": "Snow Warning", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Ice/Fairy. Aurora Veil setter.",
    },
    {
        "pokemon_id": 900, "name": "Kleavor",
        "ability": "Sheer Force", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Bug/Rock physical attacker.",
    },
    {
        "pokemon_id": 464, "name": "Rhyperior",
        "ability": "Lightning Rod", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Ground/Rock. Lightning Rod redirect.",
    },
    {
        "pokemon_id": 142, "name": "Aerodactyl",
        "ability": "Rock Head", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Rock/Flying. Fast physical attacker.",
    },
    {
        "pokemon_id": 534, "name": "Conkeldurr",
        "ability": "Guts", "item_id": None, "nature": None,
        "stat_points": None, "moves": None,
        "build_status": "wishlist", "vp_spent": 0,
        "notes": "Fighting. Guts attacker.",
    },
]
# fmt: on


def main() -> None:
    print("=== Seed Roster from Notion (52 Pokemon) ===\n")
    start = time.time()

    sb = create_client(settings.supabase_url, settings.supabase_service_key)
    user_id = settings.dev_user_id

    # Clear existing roster for dev user
    existing = sb.table("user_pokemon").select("id").eq("user_id", user_id).execute()
    if existing.data:
        print(f"  Deleting {len(existing.data)} existing roster entries...")
        sb.table("user_pokemon").delete().eq("user_id", user_id).execute()

    # Insert all roster entries
    inserted = 0
    for entry in ROSTER:
        row = {
            "user_id": user_id,
            "pokemon_id": entry["pokemon_id"],
            "ability": entry["ability"],
            "nature": entry.get("nature"),
            "build_status": entry["build_status"],
            "vp_spent": entry.get("vp_spent", 0),
            "notes": entry.get("notes"),
        }

        if entry.get("item_id"):
            row["item_id"] = entry["item_id"]
        if entry.get("stat_points"):
            row["stat_points"] = entry["stat_points"]
        if entry.get("moves"):
            row["moves"] = entry["moves"]

        result = sb.table("user_pokemon").insert(row).execute()
        if result.data:
            inserted += 1
            status = entry["build_status"]
            name = entry["name"]
            print(f"  [{status:8s}] {name}")
        else:
            print(f"  FAILED: {entry['name']}")

    elapsed = time.time() - start
    built = sum(1 for e in ROSTER if e["build_status"] == "built")
    training = sum(1 for e in ROSTER if e["build_status"] == "training")
    wishlist = sum(1 for e in ROSTER if e["build_status"] == "wishlist")
    print(f"\nInserted {inserted}/{len(ROSTER)} Pokemon")
    print(f"  Built: {built} | Training: {training} | Wishlist: {wishlist}")
    print(f"Done in {elapsed:.1f}s")


if __name__ == "__main__":
    main()
