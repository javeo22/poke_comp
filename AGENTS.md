# Repository Guidelines

## Project Structure & Module Organization

PokeComp is split into a FastAPI backend, a Next.js frontend, and Supabase database assets.

- `api/app/`: Python application code. Keep route handlers in `routers/`, Pydantic schemas in `models/`, and reusable business logic in `services/`.
- `api/tests/`: Pytest test suite, with files named `test_*.py`.
- `api/scripts/`: Data import, validation, benchmark, and admin utilities.
- `web/src/app/`: Next.js App Router pages and layouts.
- `web/src/components/`: Shared React components, grouped by feature or `ui/`.
- `web/src/lib/`, `web/src/types/`, `web/src/utils/`: API clients, types, and utilities.
- `supabase/migrations/`: Ordered SQL migrations. Use timestamped filenames.
- `design/` and root `*.md` files: product notes, architecture docs, and design artifacts.

## Build, Test, and Development Commands

Install with `cd api && uv sync --extra dev` and `cd web && pnpm install`.

- `cd api && uv run uvicorn app.main:app --reload`: run the API locally.
- `cd api && uv run pytest`: run backend tests.
- `cd api && uv run ruff check app/ scripts/`: lint Python.
- `cd api && uv run pyright app/ scripts/`: type-check Python.
- `cd web && pnpm dev`: run the frontend locally.
- `cd web && pnpm lint`: run ESLint.
- `cd web && pnpm exec tsc --noEmit`: type-check TypeScript.
- `cd web && pnpm build`: build the frontend.

## Coding Style & Naming Conventions

Python targets 3.12 and uses Ruff with 100-character lines. Keep imports sorted, use `snake_case`, and prefer typed helpers over router-level business logic.

Frontend code uses TypeScript, React 19, Next.js App Router, Tailwind CSS, and ESLint. Use `kebab-case` filenames such as `team-card.tsx`, `PascalCase` components, and keep API-facing types in `web/src/types/`.

## Testing Guidelines

Add or update `api/tests/test_*.py` for backend behavior changes, especially services, route logic, quota checks, cache behavior, and data validation. Use focused fixtures and mock Supabase or external APIs. Frontend changes should pass lint and TypeScript checks.

## Commit & Pull Request Guidelines

Git history follows Conventional Commits, often with a scope: `fix(api): reorder meta routes`, `feat(08-02): update meta trends`, `docs(08): finalize documentation`.

PRs should include a short description, verification commands, linked issues or docs, screenshots for UI changes, and notes for migrations, env vars, or ingestion side effects.

## Security & Configuration Tips

Do not commit `.env`, `.env.local`, service-role keys, Anthropic keys, or Supabase JWT secrets. Keep web public config limited to `NEXT_PUBLIC_*` values and use API-side environment variables for privileged operations.
