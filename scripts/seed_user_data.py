"""
Seed script: creates the admin user (jav22vega@gmail.com) and populates
roster entries + teams from the Notion roster database.

Run:  cd api && uv run python -m scripts.seed_user_data
"""

import os
import uuid

from dotenv import load_dotenv
from supabase import create_client, Client

# Try api/.env first (when run from project root), then .env (when run from api/)
_env_path = os.path.join(os.path.dirname(__file__), "..", "api", ".env")
if not os.path.exists(_env_path):
    _env_path = os.path.join(os.path.dirname(__file__), "..", ".env")
load_dotenv(_env_path)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_SERVICE_KEY")

if not url or not key:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

# ── Admin user ──────────────────────────────────────────────────────
USER_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
USER_EMAIL = "jav22vega@gmail.com"
USER_PASSWORD = "Champions2026!"


def ensure_user() -> str:
    """Create or fetch the admin user, return user_id."""
    try:
        user = supabase.auth.admin.get_user_by_id(USER_UUID)
        print(f"User already exists: {user.user.email}")
        # Update email if it changed
        if user.user.email != USER_EMAIL:
            supabase.auth.admin.update_user_by_id(
                USER_UUID, {"email": USER_EMAIL, "email_confirm": True}
            )
            print(f"  Updated email to {USER_EMAIL}")
        return USER_UUID
    except Exception:
        print(f"Creating user {USER_EMAIL}...")
        res = supabase.auth.admin.create_user(
            {
                "id": USER_UUID,
                "email": USER_EMAIL,
                "password": USER_PASSWORD,
                "email_confirm": True,
            }
        )
        print(f"Created user {res.user.email} with id {res.user.id}")
        return USER_UUID


# ── Pokemon name -> ID lookup ───────────────────────────────────────
# Name aliases: Notion name -> DB name
NAME_ALIASES = {
    "Aegislash": "Aegislash Shield",
    "Basculegion": "Basculegion Male",
    "Kommo-o": "Kommo O",
    "Hisuian Goodra": "Goodra",
    "Alolan Ninetales": "Ninetales",
    "Rotom-Frost": "Rotom",
    "Hisuian Arcanine": "Arcanine",
}


def resolve_name(name: str) -> str:
    """Resolve Notion name to DB name."""
    return NAME_ALIASES.get(name, name)


def build_pokemon_lookup() -> dict[str, int]:
    """Fetch all champions-eligible pokemon and build name -> id map."""
    result = (
        supabase.table("pokemon")
        .select("id, name")
        .eq("champions_eligible", True)
        .execute()
    )
    lookup = {}
    for row in result.data:
        lookup[row["name"]] = row["id"]
    print(f"Loaded {len(lookup)} Champions pokemon for lookup")
    return lookup


def build_item_lookup() -> dict[str, int]:
    """Fetch all items and build name -> id map."""
    result = supabase.table("items").select("id, name").execute()
    lookup = {}
    for row in result.data:
        lookup[row["name"]] = row["id"]
    print(f"Loaded {len(lookup)} items for lookup")
    return lookup


# ── Notion roster data (extracted from Notion DB) ───────────────────
# Status mapping: Notion "Built" -> "built", "Planned" -> "training", "Owned" -> "wishlist"
STATUS_MAP = {
    "Built": "built",
    "Planned": "training",
    "Owned": "wishlist",
}


def parse_stat_points(raw: str) -> dict[str, int] | None:
    """Parse '32 Atk / 32 Spd / 2 HP' into stat_points dict."""
    if not raw or not raw.strip():
        return None
    stat_map = {
        "HP": "hp",
        "Atk": "attack",
        "Def": "defense",
        "SpAtk": "sp_attack",
        "SpDef": "sp_defense",
        "Spd": "speed",
    }
    points = {"hp": 0, "attack": 0, "defense": 0, "sp_attack": 0, "sp_defense": 0, "speed": 0}
    parts = [p.strip() for p in raw.split("/")]
    for part in parts:
        tokens = part.strip().split()
        if len(tokens) >= 2:
            val = int(tokens[0])
            stat_key = stat_map.get(tokens[1])
            if stat_key:
                points[stat_key] = val
    return points if any(v > 0 for v in points.values()) else None


def parse_moves(raw: str) -> list[str] | None:
    """Parse 'Earthquake, Rock Slide, Dragon Claw, Protect' into list."""
    if not raw or not raw.strip():
        return None
    moves = [m.strip() for m in raw.split(",") if m.strip()]
    return moves if len(moves) == 4 else None


# All roster entries from Notion (deduplicated, skipping the empty duplicate Excadrill)
ROSTER_ENTRIES = [
    # ── Sun Team (Built) ──
    {
        "name": "Charizard",
        "ability": "Drought (Mega Y)",
        "item": "Charizardite Y",
        "moves": "Heat Wave, Solar Beam, Air Slash, Protect",
        "nature": "Modest",
        "stat_points": "32 SpAtk / 32 Spd / 2 HP",
        "status": "Built",
        "teams": ["Sun"],
        "notes": "Mega Y. Win condition. Drought stacks with Torkoal for sun insurance.",
    },
    {
        "name": "Torkoal",
        "ability": "Drought",
        "item": "Charcoal",
        "moves": "Eruption, Heat Wave, Earth Power, Protect",
        "nature": "Quiet",
        "stat_points": "32 HP / 32 SpAtk / 2 SpDef",
        "status": "Built",
        "teams": ["Sun"],
        "notes": "Sun setter. Charcoal boosts Fire moves. Quiet nature synergizes with TR flip.",
    },
    {
        "name": "Hatterene",
        "ability": "Magic Bounce",
        "item": "Mental Herb",
        "moves": "Dazzling Gleam, Psychic, Trick Room, Protect",
        "nature": "Quiet",
        "stat_points": "32 HP / 32 SpAtk / 2 Def",
        "status": "Built",
        "teams": ["Sun"],
        "notes": "Trick Room flip. Magic Bounce reflects status moves back.",
    },
    {
        "name": "Victreebel",
        "ability": "Chlorophyll",
        "item": "Focus Sash",
        "moves": "Solar Beam, Sludge Bomb, Weather Ball, Protect",
        "nature": "Modest",
        "stat_points": "32 SpAtk / 32 Spd / 2 HP",
        "status": "Built",
        "teams": ["Sun"],
        "notes": "Chlorophyll sweeper. Weather Ball becomes 100 BP Fire in Sun.",
    },
    # ── Sand Team (Planned/Training) ──
    {
        "name": "Hippowdon",
        "ability": "Sand Stream",
        "item": "Smooth Rock",
        "moves": "Earthquake, Rock Slide, Stealth Rock, Protect",
        "nature": "Impish",
        "stat_points": "32 HP / 32 Def / 2 SpDef",
        "status": "Planned",
        "teams": ["Sand"],
        "notes": "Sand setter for Team A. Spreads EQ alongside Mega Garchomp.",
    },
    {
        "name": "Garchomp",
        "ability": "Sand Force (Mega)",
        "item": "Garchompite",
        "moves": "Earthquake, Rock Slide, Dragon Claw, Protect",
        "nature": "Jolly",
        "stat_points": "32 Atk / 32 Spd / 2 SpDef",
        "status": "Planned",
        "teams": ["Sand"],
        "notes": "Mega Garchomp. Sand Force boosts Ground/Rock/Steel moves in sand.",
    },
    {
        "name": "Excadrill",
        "ability": "Sand Rush",
        "item": "Focus Sash",
        "moves": "Earthquake, Iron Head, Rock Slide, Protect",
        "nature": "Adamant",
        "stat_points": "32 Atk / 32 Spd / 2 HP",
        "status": "Planned",
        "teams": ["Sand"],
        "notes": "Sand Rush doubles speed in sand. Physical sweeper for Team A.",
    },
    {
        "name": "Aegislash",
        "ability": "Stance Change",
        "item": "Weakness Policy",
        "moves": "Shadow Ball, Sacred Sword, King's Shield, Flash Cannon",
        "nature": "Quiet",
        "stat_points": "32 Def / 32 SpAtk / 2 SpDef",
        "status": "Planned",
        "teams": ["Sand"],
        "notes": "Team A flex slot. WP activates then King's Shield cycles.",
    },
    # ── Rain Team (Planned/Training) ──
    {
        "name": "Pelipper",
        "ability": "Drizzle",
        "item": "Focus Sash",
        "moves": "Hurricane, Wide Guard, Roost, Protect",
        "nature": "Timid",
        "stat_points": "2 Def / 32 SpAtk / 32 Spd",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Rain setter. Wide Guard blocks spread moves. Roost for longevity.",
    },
    {
        "name": "Blastoise",
        "ability": "Mega Launcher (Mega)",
        "item": "Blastoisinite",
        "moves": "Water Spout, Aura Sphere, Ice Beam, Protect",
        "nature": "Modest",
        "stat_points": "2 Def / 32 SpAtk / 32 Spd",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Mega Launcher rain win condition. Water Spout at full HP is the primary nuke.",
    },
    {
        "name": "Basculegion",
        "ability": "Swift Swim",
        "item": "Mystic Water",
        "moves": "Last Respects, Wave Crash, Aqua Jet, Protect",
        "nature": "Adamant",
        "stat_points": "32 Atk / 32 Spd / 2 HP",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Swift Swim doubles Speed in rain. Last Respects scales with every KO.",
    },
    {
        "name": "Incineroar",
        "ability": "Intimidate",
        "item": "Sitrus Berry",
        "moves": "Fake Out, Parting Shot, Snarl, Flare Blitz",
        "nature": "Careful",
        "stat_points": "32 HP / 32 SpDef / 2 Spd",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Fake Out buys Blastoise a safe full-HP Water Spout. Parting Shot pivots.",
    },
    {
        "name": "Kingambit",
        "ability": "Supreme Overlord",
        "item": "Chople Berry",
        "moves": "Kowtow Cleave, Iron Head, Sucker Punch, Protect",
        "nature": "Adamant",
        "stat_points": "32 Atk / 32 Def / 2 HP",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Supreme Overlord gains 10% Atk per fainted ally. Endgame cleaner.",
    },
    {
        "name": "Dragonite",
        "ability": "Multiscale",
        "item": "Lum Berry",
        "moves": "Hurricane, Thunder, Dragon Pulse, Protect",
        "nature": "Modest",
        "stat_points": "2 Def / 32 SpAtk / 32 Spd",
        "status": "Planned",
        "teams": ["Rain"],
        "notes": "Hurricane and Thunder both 100% accurate in rain. Multiscale halves first hit.",
    },
    # ── Trap Team (Planned/Training) ──
    {
        "name": "Gengar",
        "ability": "Shadow Tag (Mega)",
        "item": "Gengarite",
        "moves": "Perish Song, Shadow Ball, Sludge Bomb, Protect",
        "nature": "Timid",
        "stat_points": "2 Def / 32 SpAtk / 32 Spd",
        "status": "Planned",
        "teams": ["Trap"],
        "notes": "Mega Gengar. Shadow Tag traps targets for Perish Song countdown.",
    },
    {
        "name": "Kommo-o",
        "ability": "Soundproof",
        "item": "White Herb",
        "moves": "Clangorous Soul, Clanging Scales, Focus Blast, Protect",
        "nature": "Timid",
        "stat_points": "2 Def / 32 SpAtk / 32 Spd",
        "status": "Planned",
        "teams": ["Trap"],
        "notes": "Soundproof immune to Perish Song. Sets up freely under Shadow Tag.",
    },
    {
        "name": "Dragapult",
        "ability": "Clear Body",
        "item": "Choice Scarf",
        "moves": "Dragon Darts, Phantom Force, U-Turn, Protect",
        "nature": "Jolly",
        "stat_points": "32 Atk / 32 Spd / 2 HP",
        "status": "Planned",
        "teams": ["Trap"],
        "notes": "Dragon Darts hits both opponents in doubles. Fast revenge killer.",
    },
    # ── Owned (wishlist -- no full builds yet) ──
    {"name": "Conkeldurr", "ability": "Guts", "status": "Owned", "notes": "Fighting. Guts attacker with Facade or Mach Punch."},
    {"name": "Hisuian Goodra", "ability": "Sap Sipper", "status": "Owned", "notes": "Steel/Dragon. Bulky special attacker."},
    {"name": "Aerodactyl", "ability": "Rock Head", "status": "Owned", "notes": "Rock/Flying. Fast physical attacker."},
    {"name": "Alolan Ninetales", "ability": "Snow Warning", "status": "Owned", "notes": "Ice/Fairy. Aurora Veil setter under hail."},
    {"name": "Kleavor", "ability": "Sheer Force", "status": "Owned", "notes": "Bug/Rock physical attacker."},
    {"name": "Armarouge", "ability": "Flash Fire", "status": "Owned", "notes": "Fire/Psychic. Special attacker. Wide movepool."},
    {"name": "Meowscarada", "ability": "Protean", "status": "Owned", "notes": "Grass/Dark. Fast attacker with Flower Trick."},
    {"name": "Rotom-Frost", "ability": "Levitate", "status": "Owned", "notes": "Electric/Ice. Levitate avoids Ground. Blizzard spreader."},
    {"name": "Hisuian Arcanine", "ability": "Intimidate", "status": "Owned", "notes": "Fire/Rock. Intimidate support with strong coverage."},
    {"name": "Rhyperior", "ability": "Lightning Rod", "status": "Owned", "notes": "Ground/Rock. Lightning Rod redirect support."},
    {"name": "Hydreigon", "ability": "Levitate", "status": "Owned", "notes": "Dark/Dragon special attacker. Wide coverage."},
    {"name": "Orthworm", "ability": "Earth Eater", "status": "Owned", "notes": "Steel. Sturdy defensive wall option."},
    {"name": "Espathra", "ability": "Opportunist", "status": "Owned", "notes": "Psychic. Speed Boost sweeper."},
    {"name": "Quaquaval", "ability": "Moxie", "status": "Owned", "notes": "Water/Fighting. Moxie sweeper."},
    {"name": "Politoed", "ability": "Drizzle", "status": "Owned", "notes": "Backup rain setter. Not used in current builds."},
    {"name": "Venusaur", "ability": "Chlorophyll", "status": "Owned", "notes": "Grass/Poison. Chlorophyll Sun abuser alternative."},
    {"name": "Starmie", "ability": "Analytic", "status": "Owned", "notes": "Fast special attacker. Rain or general use option."},
    {"name": "Gyarados", "ability": "Intimidate", "status": "Owned", "notes": "Physical pivot/attacker. Could sub into Rain team."},
    {"name": "Manectric", "ability": "Lightning Rod", "status": "Owned", "notes": "Electric. Lightning Rod support option for Rain team."},
]

# Team compositions (reference roster entry names)
TEAMS = [
    {
        "name": "Solar Vortex",
        "format": "megas",
        "archetype_tag": "sun",
        "notes": "Charizard Y sun team with Trick Room flip via Hatterene. Torkoal sun insurance.",
        "members": ["Charizard", "Torkoal", "Hatterene", "Victreebel"],
        "mega": "Charizard",
    },
    {
        "name": "Sandstorm Crush",
        "format": "megas",
        "archetype_tag": "sand",
        "notes": "Mega Garchomp + Sand Rush Excadrill. Hippowdon sets sand, Aegislash flexes.",
        "members": ["Hippowdon", "Garchomp", "Excadrill", "Aegislash"],
        "mega": "Garchomp",
    },
    {
        "name": "Monsoon Protocol",
        "format": "megas",
        "archetype_tag": "rain",
        "notes": "Mega Blastoise rain with Pelipper setter. Incineroar Fake Out support for safe Water Spout. Kingambit endgame. Dragonite 100% Hurricane/Thunder.",
        "members": ["Pelipper", "Blastoise", "Basculegion", "Incineroar", "Kingambit", "Dragonite"],
        "mega": "Blastoise",
    },
    {
        "name": "Perish Trap",
        "format": "megas",
        "archetype_tag": "trap",
        "notes": "Mega Gengar Shadow Tag + Perish Song. Kommo-o Soundproof sweeper. Dragapult fast pivot.",
        "members": ["Gengar", "Kommo-o", "Dragapult"],
        "mega": "Gengar",
    },
]


def seed_roster(user_id: str, pokemon_lookup: dict, item_lookup: dict) -> dict[str, str]:
    """Insert roster entries and return name -> roster_entry_id map."""
    # Clear existing entries for this user
    supabase.table("user_pokemon").delete().eq("user_id", user_id).execute()
    print("Cleared existing roster entries")

    entry_map: dict[str, str] = {}  # pokemon name -> user_pokemon UUID

    for entry in ROSTER_ENTRIES:
        name = entry["name"]
        db_name = resolve_name(name)
        pokemon_id = pokemon_lookup.get(db_name)
        if not pokemon_id:
            print(f"  WARN: '{name}' not found in pokemon table, skipping")
            continue

        item_name = entry.get("item", "")
        item_id = item_lookup.get(item_name) if item_name else None

        moves = parse_moves(entry.get("moves", ""))
        stat_points = parse_stat_points(entry.get("stat_points", ""))
        status = STATUS_MAP.get(entry.get("status", "Owned"), "wishlist")

        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "pokemon_id": pokemon_id,
            "ability": entry.get("ability") or None,
            "nature": entry.get("nature") or None,
            "item_id": item_id,
            "moves": moves,
            "stat_points": stat_points,
            "build_status": status,
            "vp_spent": 0,
            "notes": entry.get("notes") or None,
        }

        result = supabase.table("user_pokemon").insert(row).execute()
        entry_map[name] = result.data[0]["id"]
        status_icon = {"built": "+", "training": "~", "wishlist": "."}
        print(f"  [{status_icon.get(status, '?')}] {name}")

    print(f"Seeded {len(entry_map)} roster entries")
    return entry_map


def seed_teams(user_id: str, entry_map: dict[str, str]):
    """Insert teams referencing roster entry UUIDs."""
    # Clear existing teams for this user
    supabase.table("teams").delete().eq("user_id", user_id).execute()
    print("Cleared existing teams")

    for team in TEAMS:
        pokemon_ids = []
        mega_id = None
        for member_name in team["members"]:
            roster_id = entry_map.get(member_name)
            if roster_id:
                pokemon_ids.append(roster_id)
                if member_name == team.get("mega"):
                    mega_id = roster_id
            else:
                print(f"  WARN: '{member_name}' not in roster, skipping from team")

        if not pokemon_ids:
            print(f"  SKIP: Team '{team['name']}' has no valid members")
            continue

        row = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "name": team["name"],
            "format": team["format"],
            "pokemon_ids": pokemon_ids,
            "mega_pokemon_id": mega_id,
            "archetype_tag": team.get("archetype_tag"),
            "notes": team.get("notes"),
        }

        supabase.table("teams").insert(row).execute()
        print(f"  Team '{team['name']}' ({len(pokemon_ids)} members)")

    print(f"Seeded {len(TEAMS)} teams")


def main():
    print("=== PokeComp User Data Seed ===\n")

    user_id = ensure_user()
    print()

    pokemon_lookup = build_pokemon_lookup()
    item_lookup = build_item_lookup()
    print()

    print("--- Seeding Roster ---")
    entry_map = seed_roster(user_id, pokemon_lookup, item_lookup)
    print()

    print("--- Seeding Teams ---")
    seed_teams(user_id, entry_map)
    print()

    print("=== Done! ===")
    print(f"User: {USER_EMAIL}")
    print(f"Password: {USER_PASSWORD}")
    print(f"Roster: {len(entry_map)} entries")
    print(f"Teams: {len(TEAMS)}")


if __name__ == "__main__":
    main()
