# Chess2D

Browser-based MMO chess game. Players explore a top-down overworld and challenge each other to chess matches.

## Architecture

- **Monorepo** with three packages: `client/`, `server/`, `shared/`
- **Client**: Phaser 3 + Vite + TypeScript (vector art only, no spritesheets)
- **Server**: Colyseus (real-time multiplayer) + Express + TypeScript
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

## Version

Current: `0.1.0-pre-alpha` — stored in root `package.json` and displayed in-game (bottom-right).
