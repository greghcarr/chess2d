import { Room, Client } from "colyseus";
import { OverworldState } from "../schema/OverworldState";
import { PlayerState } from "../schema/PlayerState";
import { PATCH_RATE_MS, ADMIN_USERNAMES } from "../constants";
import { WORLD_WIDTH, WORLD_HEIGHT, FENCE_THICKNESS, SPAWN_X, SPAWN_Y } from "chess2d-shared/worldConfig";
import { MSG } from "chess2d-shared/protocol";
import { censorText, containsBannedWord } from "chess2d-shared/wordFilter";
import { getSupabaseAdmin } from "../db/supabaseAdmin";
import { NPC_LIST, type NpcDefinition } from "../npc/npcData";

const VALID_SHAPES = ["circle", "diamond", "star", "triangle", "square", "bishop"];
const NPC_WANDER_INTERVAL_MS = 2000;
const NPC_WANDER_STEP = 40; // max pixels per wander tick

export class OverworldRoom extends Room<OverworldState> {
  private battleRequests = new Map<string, string>(); // requester -> target
  private npcSpawns = new Map<string, { x: number; y: number; wanderRadius: number }>();
  private npcWanderTimer: ReturnType<typeof setInterval> | null = null;

  onCreate(): void {
    this.setState(new OverworldState());
    this.setPatchRate(PATCH_RATE_MS);
    this.setPrivate(false);
    this.maxClients = 100;
    this.setSeatReservationTime(30);

    this.spawnNpcs();
    this.startNpcWander();

    this.onMessage(MSG.PLAYER_MOVE, (client, data: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.inBattle) return;

      player.x = this.clamp(data.x, FENCE_THICKNESS, WORLD_WIDTH - FENCE_THICKNESS);
      player.y = this.clamp(data.y, FENCE_THICKNESS, WORLD_HEIGHT - FENCE_THICKNESS);
    });

    this.onMessage(MSG.CHAT, (client, data: { text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const text = censorText(data.text.substring(0, 200));
      this.broadcast(MSG.CHAT, { username: player.username, text });
    });

    this.onMessage(MSG.BATTLE_END, async (client, data: { npcSessionId?: string; unlockedShape?: string }) => {
      console.log(`[overworld] BATTLE_END from ${client.sessionId}`, data);
      const player = this.state.players.get(client.sessionId);
      if (player) {
        player.inBattle = false;
        // Try to refresh unlocked shapes from DB
        try {
          const { data: profile } = await getSupabaseAdmin()
            .from("profiles")
            .select("unlocked_shapes")
            .eq("username", player.username)
            .single();
          if (profile) {
            player.unlockedShapes = (profile.unlocked_shapes ?? []).join(",");
            console.log(`[overworld] loaded unlocked shapes from DB: ${player.unlockedShapes}`);
          }
        } catch { /* non-critical — fall through to client-reported unlock */ }

        // If DB didn't have the unlock (e.g. dev user with no profile), trust the client
        if (data?.unlockedShape) {
          const current = player.unlockedShapes ? player.unlockedShapes.split(",").filter(Boolean) : [];
          if (VALID_SHAPES.includes(data.unlockedShape) && !current.includes(data.unlockedShape)) {
            current.push(data.unlockedShape);
            player.unlockedShapes = current.join(",");
            console.log(`[overworld] applied client-reported unlock: ${data.unlockedShape}, shapes now: ${player.unlockedShapes}`);
          }
        }
      }
      // NPC battle flag is no longer set — NPCs stay available for all players
    });

    this.onMessage(MSG.HUE_CHANGE, (client, data: { hue: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.hue = Math.max(0, Math.min(360, Math.round(data.hue)));
    });

    this.onMessage(MSG.SHAPE_CHANGE, (client, data: { shape: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (VALID_SHAPES.includes(data.shape)) {
        player.shape = data.shape;
      }
    });

    this.onMessage(MSG.BATTLE_REQUEST, (client, data: { targetSessionId: string }) => {
      const requester = this.state.players.get(client.sessionId);
      const target = this.state.players.get(data.targetSessionId);
      if (!requester || !target) return;
      if (requester.inBattle) return;

      // NPC target — auto-accept (NPCs can fight multiple players at once)
      if (data.targetSessionId.startsWith("npc_")) {
        this.startNpcBattle(client, requester, target, data.targetSessionId);
        return;
      }

      if (target.inBattle) return;

      this.battleRequests.set(client.sessionId, data.targetSessionId);

      // Notify the target
      const targetClient = this.clients.find((c) => c.sessionId === data.targetSessionId);
      if (targetClient) {
        targetClient.send(MSG.BATTLE_REQUEST, {
          requesterSessionId: client.sessionId,
          requesterUsername: requester.username,
        });
      }
    });

    this.onMessage(MSG.BATTLE_RESPONSE, (client, data: { requesterSessionId: string; accepted: boolean }) => {
      const requesterClient = this.clients.find((c) => c.sessionId === data.requesterSessionId);
      if (!requesterClient) return;

      if (!data.accepted) {
        const responder = this.state.players.get(client.sessionId);
        requesterClient.send(MSG.BATTLE_RESPONSE, {
          accepted: false,
          username: responder?.username || "Unknown",
        });
        this.battleRequests.delete(data.requesterSessionId);
        return;
      }

      // Accepted — start a chess match
      const requesterPlayer = this.state.players.get(data.requesterSessionId);
      const responderPlayer = this.state.players.get(client.sessionId);
      if (!requesterPlayer || !responderPlayer) return;

      requesterPlayer.inBattle = true;
      responderPlayer.inBattle = true;

      // Randomly assign colors
      const requesterIsWhite = Math.random() < 0.5;
      const roomId = `chess_${Date.now()}`;

      requesterClient.send(MSG.BATTLE_START, {
        roomId,
        color: requesterIsWhite ? "w" : "b",
        opponentUsername: responderPlayer.username,
      });
      client.send(MSG.BATTLE_START, {
        roomId,
        color: requesterIsWhite ? "b" : "w",
        opponentUsername: requesterPlayer.username,
      });

      this.battleRequests.delete(data.requesterSessionId);
    });
  }

  async onJoin(client: Client, options: { username?: string }): Promise<void> {
    const rawName = options.username || `Player_${client.sessionId.substring(0, 4)}`;
    const username = containsBannedWord(rawName) ? `Player_${client.sessionId.substring(0, 4)}` : rawName;

    // Load saved position from database
    let startX = SPAWN_X;
    let startY = SPAWN_Y;
    let hue = 200;
    let shape = "circle";
    let unlockedShapes: string[] = [];
    try {
      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from("profiles")
        .select("pos_x, pos_y, hue, shape, unlocked_shapes")
        .eq("username", username)
        .single();
      if (data) {
        startX = data.pos_x ?? SPAWN_X;
        startY = data.pos_y ?? SPAWN_Y;
        hue = data.hue ?? 200;
        shape = data.shape ?? "circle";
        unlockedShapes = data.unlocked_shapes ?? [];
      } else {
        // No profile row — create one (dev/test accounts have null id)
        await sb.from("profiles")
          .upsert({ username }, { onConflict: "username", ignoreDuplicates: true })
          .then(({ error: upsertErr }) => {
            if (upsertErr) console.warn(`[overworld] failed to create profile for ${username}:`, upsertErr.message);
            else console.log(`[overworld] created profile for ${username}`);
          });
      }
    } catch (err) {
      console.error(`Failed to load profile for ${username}:`, err);
    }

    const player = new PlayerState();
    player.x = startX;
    player.y = startY;
    player.hue = hue;
    player.shape = shape;
    player.username = username;
    player.isAdmin = ADMIN_USERNAMES.has(username);
    player.unlockedShapes = unlockedShapes.join(",");
    this.state.players.set(client.sessionId, player);
    const npcCount = NPC_LIST.length;
    const playerCount = this.state.players.size - npcCount;
    console.log(`${player.username} joined at (${player.x}, ${player.y}) hue=${player.hue} (total players: ${playerCount}, total NPCs: ${npcCount})`);
  }

  async onLeave(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);
    if (player && !player.isNpc) {
      console.log(`${player.username} left the overworld (hue=${player.hue})`);
      // Save position to database
      try {
        const sb = getSupabaseAdmin();
        await sb
          .from("profiles")
          .update({ pos_x: player.x, pos_y: player.y, hue: player.hue, shape: player.shape })
          .eq("username", player.username);
      } catch (err) {
        console.error(`Failed to save position for ${player.username}:`, err);
      }
      this.state.players.delete(client.sessionId);
    }
    this.battleRequests.delete(client.sessionId);
  }

  onDispose(): void {
    if (this.npcWanderTimer) {
      clearInterval(this.npcWanderTimer);
    }
  }

  private spawnNpcs(): void {
    for (const npc of NPC_LIST) {
      const key = `npc_${npc.id}`;
      const player = new PlayerState();
      player.x = npc.x;
      player.y = npc.y;
      player.hue = npc.hue;
      player.username = npc.username;
      player.isNpc = true;
      player.isScenario = npc.isScenario;
      player.shape = npc.shape ?? "circle";
      this.state.players.set(key, player);
      this.npcSpawns.set(key, { x: npc.x, y: npc.y, wanderRadius: npc.wanderRadius });
      console.log(`[npc] spawned ${npc.username} at (${npc.x}, ${npc.y})`);
    }
  }

  private startNpcWander(): void {
    this.npcWanderTimer = setInterval(() => {
      for (const [key, spawn] of this.npcSpawns) {
        const npc = this.state.players.get(key);
        if (!npc || npc.inBattle) continue;

        const angle = Math.random() * Math.PI * 2;
        const step = Math.random() * NPC_WANDER_STEP;
        const nx = npc.x + Math.cos(angle) * step;
        const ny = npc.y + Math.sin(angle) * step;

        // Clamp to wander radius around spawn
        const dx = nx - spawn.x;
        const dy = ny - spawn.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= spawn.wanderRadius) {
          npc.x = this.clamp(nx, FENCE_THICKNESS, WORLD_WIDTH - FENCE_THICKNESS);
          npc.y = this.clamp(ny, FENCE_THICKNESS, WORLD_HEIGHT - FENCE_THICKNESS);
        }
      }
    }, NPC_WANDER_INTERVAL_MS);
  }

  private startNpcBattle(client: Client, requester: PlayerState, npcPlayer: PlayerState, npcSessionId: string): void {
    const npcId = npcSessionId.replace("npc_", "");
    const npcDef = NPC_LIST.find((n) => n.id === npcId);
    if (!npcDef) return;

    requester.inBattle = true;
    // NPC stays available for other players — don't set npcPlayer.inBattle

    // Player is always white for regular NPCs, scenario NPCs use the FEN's turn
    const playerColor = "w";
    const roomId = `chess_npc_${Date.now()}`;

    client.send(MSG.BATTLE_START, {
      roomId,
      color: playerColor,
      opponentUsername: npcPlayer.username,
      isNpc: true,
      npcId,
      fen: npcDef.scenarioFen,
    });

    // Release the NPC from battle after a delay (room will handle game state)
    // The NPC becomes available again when the chess room ends
    // We listen for the player to return from chess and clear inBattle
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
