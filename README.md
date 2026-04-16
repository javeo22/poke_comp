# PokeComp -- Pokemon Champions Companion

AI-powered competitive Pokemon Champions companion. Live at [pokecomp.app](https://pokecomp.app).

Roster tracking, team builder, AI draft analysis, cheatsheets, meta insights, and match logging for competitive Pokemon Champions (VGC doubles).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), Tailwind CSS v4 |
| Backend | Python FastAPI |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| AI | Anthropic Claude API (Sonnet + Haiku) |
| Deployment | Vercel (web + API as Python function) |
| Package managers | uv (Python), pnpm (JavaScript) |

## Features

- **Pokedex** -- Browse Champions-eligible Pokemon with stats, movepools, abilities, and usage data
- **Roster Manager** -- Track your Pokemon builds (items, abilities, natures, stat points, moves)
- **Team Builder** -- Build teams of 6 with type coverage analysis, mega validation, Showdown import/export
- **AI Draft Helper** -- Paste opponent team preview, get bring-4 recommendations, lead pairs, damage calcs, and game plan
- **AI Cheatsheet** -- Generate printable pre-match reference cards with roster, speed tiers, game plan, lead matchups, weaknesses
- **Meta Tracker** -- Tier lists and usage stats from Smogon, Pikalytics, and Limitless tournament data
- **Match Log** -- Record matches, track win rates by team and opponent, view performance trends
- **Public Profiles** -- Set a username, share cheatsheets at `/u/{username}`
- **Admin Panel** -- Dashboard, data managers, strategy content editor, AI cost tracking

## Prerequisites

- Python 3.11+ with [uv](https://docs.astral.sh/uv/)
- Node.js 20+ with pnpm
- Supabase project (free tier works)
- Anthropic API key (for AI features)

## Setup

### 1. Clone and install

```bash
git clone https://github.com/javeo22/poke_comp.git
cd poke_comp

# API
cd api
uv sync
cp .env.example .env  # then fill in values

# Web
cd ../web
pnpm install
cp .env.example .env.local  # then fill in values
```

### 2. Environment variables

**API (`api/.env`):**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key
SUPABASE_JWT_SECRET=your-jwt-secret
ADMIN_USER_IDS=your-supabase-user-uuid
```

**Web (`web/.env.local`):**

```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database

Apply all migrations to your Supabase project:

```bash
npx supabase db push
```

### 4. Seed data

```bash
cd api

# Import Pokemon, moves, abilities from PokeAPI
uv run python -m scripts.import_pokeapi

# Seed Champions roster flags, items, mega links
uv run python -m scripts.seed_champions

# Import Champions-verified data from Serebii
uv run python -m scripts.ingest.serebii_static

# Import usage data from Pikalytics
uv run python -m scripts.ingest.pikalytics_usage

# Import usage data from Smogon
uv run python -m scripts.ingest.smogon_meta

# Import tournament teams from Limitless
uv run python -m scripts.ingest.limitless_teams

# Validate data integrity
uv run python -m scripts.validate_data
```

### 5. Run

```bash
# Terminal 1: API
cd api && uv run uvicorn app.main:app --reload

# Terminal 2: Web
cd web && pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Project Structure

```
poke_comp/
  api/               Python FastAPI backend
    app/
      routers/       API route handlers
      models/        Pydantic models
      services/      Shared services (AI quota, name resolver, strategy context)
    scripts/
      ingest/        Data ingestion scripts (Smogon, Pikalytics, Limitless, Serebii)
  web/               Next.js frontend
    src/app/         App Router pages
    src/components/  React components
    src/lib/         API client, utilities
    src/types/       TypeScript interfaces
  supabase/
    migrations/      SQL migration files
```

## Data Sources

| Source | Method | Data |
|--------|--------|------|
| [PokeAPI](https://pokeapi.co) | Public REST API | Pokemon, moves, abilities, sprites |
| [Pikalytics](https://pikalytics.com) | HTML scraping (1.5s delay) | Tournament usage stats |
| [Smogon/pkmn](https://pkmn.github.io) | Public JSON API | Competitive usage data |
| [Limitless VGC](https://play.limitlesstcg.com) | Public REST API | Tournament teams |
| [Serebii](https://serebii.net) | HTML scraping (one-time) | Champions-verified movepools, abilities |

## Commands

```bash
# API
cd api && uv run uvicorn app.main:app --reload    # Dev server
cd api && uv run ruff check app/ scripts/          # Lint
cd api && uv run pyright app/ scripts/             # Type check
cd api && uv run python -m scripts.validate_data   # Data validation
cd api && uv run python -m scripts.smoke_test      # Smoke test

# Web
cd web && pnpm dev      # Dev server
cd web && pnpm lint     # Lint
cd web && pnpm build    # Production build
```

## Disclaimer

PokeComp is a fan project. Not affiliated with or endorsed by The Pokemon Company, Nintendo, or Game Freak. Pokemon names and data are trademarks of their respective owners. AI analysis is provided for entertainment and competitive improvement purposes only.

## License

MIT License. See [LICENSE](LICENSE).
