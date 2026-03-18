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

Copy `.env.example` to `.env` and fill in:
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` — client-side Supabase access
- `VITE_COLYSEUS_URL` — client connects here (use `http://`, not `ws://`; Colyseus handles upgrade)
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — server-side Supabase admin access
- `COLYSEUS_PORT` — server listen port (default 2567)

## Supabase Setup

1. Run `supabase-setup.sql` in the Supabase SQL Editor
2. Disable "Confirm email" in Auth > Settings > Email Auth (we use placeholder `username@chess2d.local` emails)

Tables:
- `profiles` — username, wins, losses, draws (linked to auth.users via RLS)
- `game_results` — white/black player, result, PGN, end reason

RPC functions: `increment_wins`, `increment_losses`, `increment_draws` (called by server via service role key)
