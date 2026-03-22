# chess2D

Browser-based MMO chess game. Players explore a top-down overworld and challenge each other to chess matches.

## Architecture

- **Monorepo** with three packages: `client/`, `server/`, `shared/`
- **Client**: Phaser 3 + Vite + TypeScript (vector art only, no spritesheets)
- **Server**: Colyseus 0.15.x (real-time multiplayer) + Express + TypeScript (tsx)
- **Shared**: Protocol types, world config, chess types used by both client and server
- **Database/Auth**: Supabase (PostgreSQL + Auth)
- **Chess Logic**: chess.js (server-authoritative, client for preview only)

## Key Conventions

- All tunables (speeds, sizes, colors, world dimensions) live in `client/src/constants.ts` or `server/src/constants.ts`
- Render depths defined in `client/src/layers.ts`
- `pointerdown` for all interactions (not `click`)
- `useHandCursor: true` on interactive objects
- No Arcade Physics — manual position tweening and bounds checking
- Tween-based animations via `scene.tweens.add()`
- `controls` (not `input`) for custom input fields on scenes
- DOM overlays for text input (chat, auth forms) — better mobile keyboard support
- Server is authoritative for all game state (positions, chess moves)
- Path alias: `@/` = `client/src/`
- No spaces in usernames or passwords

## Known Colyseus Gotchas

- **Server tsconfig must have `useDefineForClassFields: false`** — otherwise TS class field initializers shadow `@colyseus/schema` getter/setter descriptors and change tracking silently breaks (encodeAll returns 0 bytes).
- **Client does NOT pass a schema class to `joinOrCreate`** — instead relies on Colyseus `Reflection.decode` from the server handshake. This avoids dual-module issues where Vite bundles a different `@colyseus/schema` instance than what `colyseus.js` uses internally.
- **Vite alias forces `@colyseus/schema` to the CJS build** (`build/cjs/index.js`) so all imports resolve to the same module instance.
- **`colyseus.js` v0.15 WebSocket bug** — passes `{ headers, protocols }` object as 2nd arg to browser `WebSocket` constructor. Patched in `client/src/network/patchColyseus.ts`.
- **Server env vars**: `dotenv` loads from project root `.env`. Supabase client is lazy-initialized (`getSupabaseAdmin()`) to avoid import-time crashes before dotenv runs.
- **Server does not use `"type": "module"`** in package.json — Colyseus 0.15.x CJS exports don't work with ESM resolution.

## Scenes

- **BootScene**: Initial loading
- **AuthScene**: Sign-up / Log-in forms
- **OverworldScene**: MMO world with player movement, other players
- **ChessScene**: Chess match board and pieces
- **UIScene**: Persistent overlay (version label, minimap, chat)

## Running

```bash
npm install          # install all workspaces
npm run dev          # starts both client (port 3000) and server (port 2567)
npm run dev:client   # client only
npm run dev:server   # server only
```

## Database Setup

Run `supabase-setup.sql` in the Supabase SQL Editor. Disable email confirmation in Supabase Auth settings (we use placeholder emails derived from usernames).

## Version

Current: `0.1.0-pre-alpha` — stored in root `package.json` and displayed in-game (bottom-right).
