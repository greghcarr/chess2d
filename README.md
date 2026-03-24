# chess2D

A browser-based MMO chess game where players explore a top-down overworld, chat with each other, and challenge opponents to real-time chess matches. All art is vector — no sprites, no pixel art.

Built with Phaser 3, Colyseus, TypeScript, and Vite. Server-authoritative game state with Supabase for persistence and auth.

---

## Features

| Feature | Description |
|---------|-------------|
| **Overworld** | Explore a shared top-down world. See other players move in real time, walk up to them, and start a match. |
| **Chess** | Full chess rules powered by chess.js. Server validates every move — no client-side cheating. |
| **Chat** | Send messages that appear as speech bubbles above your player. |
| **NPCs** | Computer-controlled players roam the overworld. |
| **Accounts** | Sign up and log in. Your username follows you across sessions. |

## Controls

| Input | Action |
|-------|--------|
| Click / tap | Move to target |
| Arrow keys / WASD | Move |
| Enter | Open chat |
| Mouse wheel | Zoom in / out |

## Development

### Prerequisites
- Node.js 20+
- npm
- A Supabase project (see [Database Setup](#database-setup))

### Setup
```bash
npm install
```

### Run
```bash
npm run dev
# Client at http://localhost:3000, server at http://localhost:2567
```

```bash
npm run dev:client   # client only
npm run dev:server   # server only
```

### Build
```bash
npm run build
```

### Database Setup

Run `supabase-setup.sql` in the Supabase SQL Editor. Disable email confirmation in Supabase Auth settings (the app uses placeholder emails derived from usernames).

Create a `.env` file in the project root:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
```

## Architecture

Monorepo with three workspaces:

| Package | Role |
|---------|------|
| `client/` | Phaser 3 game client (Vite + TypeScript) |
| `server/` | Colyseus 0.15.x real-time server (Express + TypeScript) |
| `shared/` | Protocol types, world config, and chess types used by both sides |

## Project Docs

- [DEVELOPMENT.md](DEVELOPMENT.md) — branching workflow and versioning guidelines

## Status

**v0.1.0-pre-alpha** — actively in development. Feedback welcome.
