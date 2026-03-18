# Development Guide

## Branching

- `main` — production/deploy branch
- `dev` — daily work branch

All feature work happens on `dev` or feature branches off `dev`. Merge to `main` for releases.

## Versioning

Format: `MAJOR.MINOR.PATCH[-pre-alpha|-alpha|-beta]`

Version is stored in:
- `package.json` (root)
- Displayed in-game via `VersionLabel` (bottom-right corner)

Bump on meaningful player-visible changes, not every commit.

## Environment

Copy `.env.example` to `.env` and fill in your Supabase credentials. The server needs the `SUPABASE_SERVICE_ROLE_KEY` for admin operations.

## Supabase Setup

Tables required:
- `profiles` — username, wins, losses, draws (linked to auth.users)
- `game_results` — white/black player, result, PGN, end reason
