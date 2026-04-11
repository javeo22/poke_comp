# PRD: Pokemon Champions Trainer Companion

**Version:** 1.0
**Date:** April 10, 2026
**Status:** Draft - personal side project
**Owner:** Solo developer

---

## 1. Problem Statement

Pokemon Champions launched April 8, 2026 as a competitive battling platform with restricted movepools vs mainline games, item availability differences, no Terastallization at launch, and an evolving meta. Existing tools (Game8, Pikalytics, Pokepaste) are either too generic, slow to update for Champions-specific data, or scattered across multiple sites. There is no single tool that combines personal roster tracking, Champions-specific build data, AI-powered matchup analysis, and a draft helper for team preview.

## 2. Goals

**Primary:** Build a personal companion app that helps a competitive Pokemon Champions player make better decisions during team building and ranked battles.

**Secondary:** Demonstrate AI Product Builder skills with a working portfolio piece. Open source after MVP for community feedback.

**Non-goals:**
- Automated battle bot
- Tournament management system
- Mainline VGC support
- Mobile-first design
- Multi-user accounts at MVP

## 3. Success Metrics

- Personal usage at least 3x per week
- Reduces "what should I draft against this team" decision time from minutes to seconds
- Maintains meta data that is no more than 7 days stale
- Becomes the only Champions tool I open during play

## 4. User Personas

**Primary:** Solo competitive Champions doubles player, mid-ladder, building 2-3 teams.

**Secondary (post-MVP):** Other competitive Champions players who want personal roster tracking with AI assistance.

## 5. Core Features (MVP)

### F1: Personal Roster Manager
- CRUD Pokemon I own (species, item, ability, nature, stat points, moves)
- Filter by type, role, tier
- Mark Pokemon as built/training/wishlist
- Track VP spent per Pokemon

### F2: Team Builder
- Drag-and-drop 6 Pokemon into a team
- Auto-validate one Mega per team rule
- Show team type coverage and weaknesses
- Save multiple teams with notes and tags
- Quick clone and modify

### F3: Static Reference Database
- Pokemon list with Champions roster filter
- Move details (power, accuracy, type, category, target)
- Item descriptions and shop availability flag
- Ability descriptions
- Type chart with damage multipliers

### F4: Meta Tracker
- Current tier list (singles, doubles, megas)
- Top archetypes with example teams
- Meta Pokemon usage rates when available
- Updated via manual script run weekly

### F5: AI Draft Helper (killer feature)
- Paste opponent's 6 Pokemon (text input at MVP, OCR later)
- Select my team
- Claude API call returns: lead pair recommendation, back pair recommendation, turn 1 plan, key threats, win probability estimate
- Save outcomes to build a personal matchup log

### F6: Matchup Log
- Record each ranked match: my team, opponent team, lead chosen, outcome, notes
- Filter past matches by archetype, win/loss, opponent Pokemon
- Personal win rate per archetype

## 6. Stretch Features (Phase 2+)

- F7: Damage calculator with Champions stat point inputs
- F8: Sprite display using PokeAPI sprite URLs
- F9: VP cost calculator for full team builds
- F10: Counter-team builder ("build me a team that beats rain stall")
- F11: Tournament team scraping from Limitless VGC when Champions data appears
- F12: Screenshot OCR for opponent team preview
- F13: Public read-only mode for sharing teams via URL
- F14: Discord bot integration for matchup queries
- F15: Push notification when meta tier list updates

## 7. Data Model

```sql
-- Static reference data
pokemon (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  types TEXT[] NOT NULL,
  base_stats JSONB NOT NULL,
  abilities TEXT[] NOT NULL,
  movepool TEXT[] NOT NULL,
  champions_eligible BOOLEAN DEFAULT FALSE,
  generation INT,
  mega_evolution_id INT REFERENCES pokemon(id),
  sprite_url TEXT
)

moves (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  power INT,
  accuracy INT,
  target TEXT,
  effect_text TEXT,
  champions_available BOOLEAN DEFAULT FALSE
)

items (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  effect_text TEXT,
  category TEXT,
  vp_cost INT,
  champions_shop_available BOOLEAN DEFAULT FALSE,
  last_verified TIMESTAMPTZ
)

abilities (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  effect_text TEXT
)

-- Personal data (user-scoped via RLS)
user_pokemon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pokemon_id INT REFERENCES pokemon(id),
  item_id INT REFERENCES items(id),
  ability TEXT,
  nature TEXT,
  stat_points JSONB,
  moves TEXT[] CHECK (array_length(moves, 1) = 4),
  notes TEXT,
  build_status TEXT,
  vp_spent INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  format TEXT NOT NULL,
  pokemon_ids UUID[] NOT NULL,
  mega_pokemon_id UUID,
  notes TEXT,
  archetype_tag TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
)

-- Meta and analytics
meta_snapshots (
  id SERIAL PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  format TEXT NOT NULL,
  tier_data JSONB NOT NULL,
  source_url TEXT,
  source TEXT
)

matchup_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  my_team_id UUID REFERENCES teams(id),
  opponent_team_data JSONB,
  lead_pair JSONB,
  outcome TEXT,
  notes TEXT,
  played_at TIMESTAMPTZ DEFAULT NOW()
)

ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_hash TEXT UNIQUE NOT NULL,
  opponent_team JSONB,
  my_team JSONB,
  response_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
)
```

## 8. Architecture

- **Frontend:** Next.js 14 with App Router and Tailwind CSS
- **Backend:** Python FastAPI on Cloud Run
- **Database:** Supabase (PostgreSQL) with Row Level Security
- **AI:** Anthropic Claude API (claude-sonnet-4-6)
- **Static assets:** Supabase Storage for sprite cache
- **Scheduled jobs:** Cloud Scheduler triggering Python scrapers weekly
- **Package managers:** `uv` for Python, `pnpm` for JavaScript

## 9. Data Source Strategy

**One-time bulk import:**
- PokeAPI (https://pokeapi.co) for base Pokemon data, moves, abilities, sprites
- Bulbapedia scrape for movepool details
- Manual seed of Champions roster from Serebii Champions page

**Weekly automated:**
- Game8 tier list scrape (singles, doubles, megas)
- Pikalytics Champions usage data when available

**Manual periodic:**
- Game8 per-Pokemon build pages via prompt-based extraction
- Item shop verification
- New Mega ability additions

**On-demand AI extraction:**
- Paste YouTube transcript or article URL into prompt, Claude returns structured team data, reviewed and saved to DB

## 10. Phasing

**Phase 0 (Week 1):** Database schema, Supabase setup, PokeAPI bulk import. Static reference data working end-to-end.

**Phase 1 (Weeks 2-3):** Personal roster CRUD, Team Builder UI, basic team coverage analysis. Input real teams.

**Phase 2 (Weeks 4-5):** Meta tracker with manual update scripts. Game8 tier list scraper. First version of AI draft helper.

**Phase 3 (Weeks 6-7):** Matchup log, win rate analytics, refined AI prompts from real usage. Polish.

**Phase 4 (Week 8+):** Stretch features as time allows. Open source release.

## 11. Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Meta data goes stale faster than scraping can keep up | Build manual update workflow first. Use Claude API for robust page parsing instead of brittle CSS selectors. |
| Game8 HTML structure changes break scraper | Use Claude API to parse pages instead of CSS selectors. Costs cents per update but resilient. |
| Scope creep kills the project | Strict 8-week MVP timebox. Anything not in F1-F6 goes to backlog. |
| Champions patches break data assumptions | Version meta snapshots with dates. Build update flows from day one. |
| Audience too small for business case | Treat as personal tool + portfolio piece. Do not optimize monetization until 100+ active users. |

## 12. Open Questions

1. Streamlit vs Next.js for MVP frontend? (Next.js chosen for long-term polish)
2. AI analysis caching strategy? (Hash by team composition, 24-hour TTL)
3. Open source license? (MIT or Apache 2.0)
4. Public landing page at MVP or personal-only? (Personal-only first)

## 13. Week 1 Concrete Tasks

- **Day 1:** Create Supabase project, define schema in SQL, run migrations
- **Day 2:** PokeAPI bulk import script, populate pokemon/moves/abilities tables
- **Day 3:** Champions roster manual seed, items table from Serebii
- **Day 4:** FastAPI skeleton with Pokemon read endpoints
- **Day 5:** Next.js frontend with Pokemon search and filter page
- **Day 6:** User Pokemon CRUD endpoints and UI
- **Day 7:** Deploy to Cloud Run, end-to-end test

**Definition of done for Week 1:** Can add 35 personal Pokemon to database via UI, see them in a searchable list, and have the data persist across deployments.

---

*End of PRD v1.0*
