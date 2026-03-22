import Phaser from "phaser";
import { Player } from "@/entities/Player.js";
import { RemotePlayer } from "@/entities/RemotePlayer.js";
import { ClickMarker } from "@/entities/ClickMarker.js";
import { MovementControls } from "@/input/MovementControls.js";
import { CameraControls } from "@/input/CameraControls.js";
import { colyseusClient } from "@/network/colyseusClient.js";
import { MSG } from "chess2d-shared/protocol.js";
import {
  WORLD_WIDTH,
  WORLD_HEIGHT,
  WORLD_SQUARE_SIZE,
  WORLD_GRID,
  FENCE_THICKNESS,
  SPAWN_X,
  SPAWN_Y,
} from "chess2d-shared/worldConfig.js";
import {
  BATTLE_REQUEST_RANGE,
  DEFAULT_SHAPES,
} from "@/constants.js";
import { LAYER } from "@/layers.js";
import type { Room } from "colyseus.js";

/** Convert a hue (0-360) to a Phaser hex color at full saturation/70% lightness. */
function hueToColor(hue: number): number {
  const h = hue / 360;
  const s = 1;
  const l = 0.6;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const r = Math.round(hue2rgb(p, q, h + 1 / 3) * 255);
  const g = Math.round(hue2rgb(p, q, h) * 255);
  const b = Math.round(hue2rgb(p, q, h - 1 / 3) * 255);
  return (r << 16) | (g << 8) | b;
}

export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private remotePlayers = new Map<string, RemotePlayer>();
  private clickMarker!: ClickMarker;
  private controls!: MovementControls;
  private cameraControls!: CameraControls;
  private room: Room | null = null;
  private username = "";
  private chatEnabled = true;
  private followTarget: { remote: RemotePlayer; startTime: number } | null = null;
  private playerHue = 200;
  private hueResolved = false;
  private currentBattleNpcSessionId: string | null = null;
  private availableShapes: string[] = [...DEFAULT_SHAPES];
  private hueFallbackTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    super({ key: "OverworldScene" });
  }

  init(data: { username: string }): void {
    this.username = data.username;
  }

  create(): void {
    this.drawWorld();

    this.player = new Player(this, SPAWN_X, SPAWN_Y, this.username);
    this.clickMarker = new ClickMarker(this);
    this.controls = new MovementControls(this);
    this.cameraControls = new CameraControls(this);

    // No camera bounds — centerOn keeps player centered at any zoom level

    // Click/tap to move — also supports hold-and-drag
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (!this.chatEnabled) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (!this.isInsideWorld(worldPoint.x, worldPoint.y)) return;
      this.followTarget = null; // cancel follow on ground click
      const tx = this.controls.clampX(worldPoint.x);
      const ty = this.controls.clampY(worldPoint.y);
      this.player.setTarget(tx, ty);
      this.clickMarker.show(tx, ty);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.chatEnabled) return;
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      if (!this.isInsideWorld(worldPoint.x, worldPoint.y)) return;
      this.followTarget = null;
      const tx = this.controls.clampX(worldPoint.x);
      const ty = this.controls.clampY(worldPoint.y);
      this.player.setTarget(tx, ty);
      this.clickMarker.show(tx, ty);
    });

    this.connectToServer();

    // Fall back to default blue after 5s if hue hasn't arrived from server
    const HUE_FALLBACK_MS = 5_000;
    const DEFAULT_HUE = 200;
    this.hueFallbackTimer = setTimeout(() => {
      if (!this.hueResolved) {
        this.hueResolved = true;
        this.playerHue = DEFAULT_HUE;
        this.player.setColor(hueToColor(DEFAULT_HUE));
      }
    }, HUE_FALLBACK_MS);
  }

  update(_time: number, delta: number): void {
    // Keyboard movement overrides click target and cancels follow
    if (this.controls.isMoving()) {
      this.followTarget = null;
    }
    this.controls.applyKeyboardMovement(this.player, delta);
    this.updateFollowTarget();
    this.player.update(delta);
    this.player.redraw();

    // Clamp position inside fence
    this.player.x = this.controls.clampX(this.player.x);
    this.player.y = this.controls.clampY(this.player.y);

    this.cameraControls.followTarget(this.player.x, this.player.y);

    // Interpolate remote players
    for (const remote of this.remotePlayers.values()) {
      remote.update();
    }

    // Send position to server
    if (this.room) {
      this.room.send(MSG.PLAYER_MOVE, { x: this.player.x, y: this.player.y });
    }

    // Update UIScene with player data — emit on our own events; UIScene listens on overworld.events
    this.events.emit("updatePlayerData", {
      localPlayer: { x: this.player.x, y: this.player.y },
      remotePlayers: Array.from(this.remotePlayers.values()).map((rp) => ({
        x: rp.x,
        y: rp.y,
        isNpc: rp.isNpc,
      })),
      localHue: this.playerHue,
    });
  }

  private drawWorld(): void {
    const g = this.add.graphics();
    g.setDepth(LAYER.GROUND);

    // Chessboard-style tiled ground (8x8)
    const light = 0x222222;
    const dark = 0x111111;

    for (let row = 0; row < WORLD_GRID; row++) {
      for (let col = 0; col < WORLD_GRID; col++) {
        g.fillStyle((row + col) % 2 === 0 ? light : dark, 1);
        g.fillRect(col * WORLD_SQUARE_SIZE, row * WORLD_SQUARE_SIZE, WORLD_SQUARE_SIZE, WORLD_SQUARE_SIZE);
      }
    }

    // Fence — white border
    const fence = this.add.graphics();
    fence.setDepth(LAYER.FENCE);
    fence.lineStyle(FENCE_THICKNESS, 0xffffff, 0.4);
    fence.strokeRect(
      FENCE_THICKNESS / 2,
      FENCE_THICKNESS / 2,
      WORLD_WIDTH - FENCE_THICKNESS,
      WORLD_HEIGHT - FENCE_THICKNESS
    );
  }

  private async connectToServer(retries = 3): Promise<void> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        this.room = await colyseusClient.joinOrCreate("overworld", {
          username: this.username,
        });
        console.log(`[overworld] connected as ${this.room.sessionId}`);

      this.room.onLeave((code: number) => {
        console.warn(`[overworld] disconnected from server (code ${code})`);
        // 1000 = normal close, 4000 = consented leave — anything else is unexpected
        if (code !== 1000 && code !== 4000) {
          this.handleDisconnect("lost connection to server.");
        }
      });

      this.room.onError((code: number, message?: string) => {
        console.error(`[overworld] room error: ${code} ${message}`);
        this.handleDisconnect("server error. please try again.");
      });

      this.setupStateListeners();

      // Chat messages — emit to UIScene and show bubble above speaker
      this.room.onMessage(MSG.CHAT, (message: { username: string; text: string }) => {
        this.events.emit("chatMessage", message);
        this.showChatBubbleForUser(message.username, message.text);
      });

      // Battle request received
      this.room.onMessage(MSG.BATTLE_REQUEST, (data: { requesterSessionId: string; requesterUsername: string }) => {
        this.showBattleRequestDialog(data.requesterSessionId, data.requesterUsername);
      });

      // Battle start
      this.room.onMessage(MSG.BATTLE_START, (data: {
        roomId: string;
        color: string;
        opponentUsername: string;
        isNpc?: boolean;
        npcId?: string;
        fen?: string;
      }) => {
        this.currentBattleNpcSessionId = data.isNpc && data.npcId ? `npc_${data.npcId}` : null;
        const uiScene = this.scene.get("UIScene") as any;
        uiScene?.hidePublicChat?.();
        this.scene.launch("ChessScene", {
          roomId: data.roomId,
          color: data.color,
          opponentUsername: data.opponentUsername,
          username: this.username,
          isNpc: data.isNpc ?? false,
          npcId: data.npcId,
          fen: data.fen,
        });
        this.scene.pause();
      });

      // Battle declined
      this.room.onMessage(MSG.BATTLE_RESPONSE, (data: { accepted: boolean; username: string }) => {
        if (!data.accepted) {
          this.showNotification(`${data.username} declined your battle request`);
        }
      });
      return; // success — exit the retry loop
    } catch (err) {
      console.warn(`[overworld] connection attempt ${attempt}/${retries} failed:`, err);
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      } else {
        console.error("[overworld] all connection attempts failed");
        this.handleDisconnect("could not connect to server.");
      }
    }
    } // end for
  }

  private setupStateListeners(): void {
    if (!this.room) return;

    const tryAttach = () => {
      if (!this.room?.state?.players) return false;

      this.room.state.players.onAdd((playerState: any, sessionId: string) => {
        if (sessionId === this.room!.sessionId) {
          console.log("[overworld] local player state hue:", playerState.hue, "keys:", Object.keys(playerState));
          // Resolve hue from server — cancel fallback timer
          this.resolveHue(playerState.hue ?? 200);
          this.player.setShape(playerState.shape ?? "circle");
          this.player.setAdmin(playerState.isAdmin ?? false);
          this.updateAvailableShapes(playerState.unlockedShapes ?? "");
          // Listen for subsequent hue/shape updates
          playerState.listen("hue", (value: number) => {
            console.log("[overworld] hue listen fired:", value);
            this.resolveHue(value);
          });
          playerState.listen("shape", (value: string) => {
            this.player.setShape(value);
          });
          playerState.listen("unlockedShapes", (value: string) => {
            this.updateAvailableShapes(value);
          });
          return;
        }
        const remote = new RemotePlayer(
          this,
          sessionId,
          playerState.x,
          playerState.y,
          playerState.username,
          hueToColor(playerState.hue ?? 200),
          playerState.isNpc ?? false,
          playerState.isScenario ?? false,
          playerState.isAdmin ?? false
        );
        this.remotePlayers.set(sessionId, remote);

        playerState.listen("x", (value: number) => {
          remote.updateServerPosition(value, remote.serverY);
        });
        playerState.listen("y", (value: number) => {
          remote.updateServerPosition(remote.serverX, value);
        });
        playerState.listen("inBattle", (value: boolean) => {
          remote.inBattle = value;
        });
        playerState.listen("hue", (value: number) => {
          remote.setColor(hueToColor(value));
        });
        playerState.listen("shape", (value: string) => {
          remote.setShape(value);
        });

        remote.graphics.on("pointerdown", (pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.showBattleMenu(remote);
        });
      });

      this.room.state.players.onRemove((_playerState: any, sessionId: string) => {
        const remote = this.remotePlayers.get(sessionId);
        if (remote) {
          remote.destroy();
          this.remotePlayers.delete(sessionId);
        }
      });

      return true;
    };

    // Try immediately; if players isn't ready yet, wait for first state change
    if (!tryAttach()) {
      const stateChange = this.room.onStateChange(() => {
        if (tryAttach()) {
          stateChange.clear();
        }
      });
    }
  }

  private isInsideWorld(x: number, y: number): boolean {
    return x >= 0 && x <= WORLD_WIDTH && y >= 0 && y <= WORLD_HEIGHT;
  }

  private showBattleMenu(remote: RemotePlayer): void {
    if (remote.inBattle) {
      this.showNotification(remote.isNpc
        ? "this NPC is busy right now."
        : "that player is in a battle. spectating coming soon!");
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, remote.x, remote.y
    );

    if (dist <= BATTLE_REQUEST_RANGE) {
      this.followTarget = null;
      if (remote.isNpc) {
        this.showNpcChallengeDialog(remote);
      } else {
        this.showBattleConfirmDialog(remote);
      }
    } else {
      // Start following the target
      this.followTarget = { remote, startTime: Date.now() };
      this.player.setTarget(remote.x, remote.y);
    }
  }

  private updateFollowTarget(): void {
    if (!this.followTarget) return;

    const { remote, startTime } = this.followTarget;
    const elapsed = Date.now() - startTime;
    const FOLLOW_TIMEOUT = 10_000;

    // Check if target was removed
    if (!this.remotePlayers.has(remote.sessionId)) {
      this.followTarget = null;
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.player.x, this.player.y, remote.x, remote.y
    );

    if (dist <= BATTLE_REQUEST_RANGE) {
      this.followTarget = null;
      this.player.clearTarget();
      if (remote.inBattle) {
        this.showNotification(remote.isNpc
          ? "this NPC is busy right now."
          : "that player is in a battle. spectating coming soon!");
      } else if (remote.isNpc) {
        this.showNpcChallengeDialog(remote);
      } else {
        this.showBattleConfirmDialog(remote);
      }
      return;
    }

    if (elapsed > FOLLOW_TIMEOUT) {
      this.followTarget = null;
      this.player.clearTarget();
      this.showNotification("too far away to battle!");
      return;
    }

    // Keep following — update target position
    this.player.setTarget(remote.x, remote.y);
  }

  private showNpcChallengeDialog(remote: RemotePlayer): void {
    const promptText = remote.isScenario
      ? `start challenge round with <strong>${remote.username}</strong>?`
      : `challenge <strong>${remote.username}</strong> to chess?`;
    const buttonText = remote.isScenario ? "start challenge" : "challenge";
    const borderColor = remote.isScenario ? "#ff9933" : "#ffcc00";

    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(1.5)",
      background: "#1a1a2e",
      border: `2px solid ${borderColor}`,
      borderRadius: "12px",
      padding: "24px 32px",
      color: "#fff",
      fontFamily: "'Foxwhelp', sans-serif",
      zIndex: "20",
      textAlign: "center",
    });
    container.innerHTML = `
      <p style="font-family:'Foxwhelp',sans-serif;font-size:22px;margin-bottom:16px;">${promptText}</p>
      <button id="npc-yes" style="background:#fff;color:#000;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;margin-right:12px;">${buttonText}</button>
      <button id="npc-no" style="background:transparent;color:#fff;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;">cancel</button>
    `;
    document.getElementById("game-container")!.appendChild(container);

    container.querySelector("#npc-yes")!.addEventListener("pointerdown", () => {
      if (this.room) {
        this.room.send(MSG.BATTLE_REQUEST, { targetSessionId: remote.sessionId });
      }
      container.remove();
    });
    container.querySelector("#npc-no")!.addEventListener("pointerdown", () => {
      container.remove();
    });
  }

  private showBattleConfirmDialog(remote: RemotePlayer): void {
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(1.5)",
      background: "#1a1a2e",
      border: "2px solid #3399ff",
      borderRadius: "12px",
      padding: "24px 32px",
      color: "#fff",
      fontFamily: "'Foxwhelp', sans-serif",
      zIndex: "20",
      textAlign: "center",
    });
    container.innerHTML = `
      <p style="font-family:'Foxwhelp',sans-serif;font-size:22px;margin-bottom:16px;">challenge <strong>${remote.username}</strong> to chess?</p>
      <button id="battle-yes" style="background:#fff;color:#000;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;margin-right:12px;">request battle</button>
      <button id="battle-no" style="background:transparent;color:#fff;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;">cancel</button>
    `;
    document.getElementById("game-container")!.appendChild(container);

    document.getElementById("battle-yes")!.addEventListener("pointerdown", () => {
      if (this.room) {
        this.room.send(MSG.BATTLE_REQUEST, { targetSessionId: remote.sessionId });
      }
      container.remove();
    });
    document.getElementById("battle-no")!.addEventListener("pointerdown", () => {
      container.remove();
    });
  }

  private showBattleRequestDialog(requesterSessionId: string, requesterUsername: string): void {
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(1.5)",
      background: "#1a1a2e",
      border: "2px solid #ff9933",
      borderRadius: "12px",
      padding: "24px 32px",
      color: "#fff",
      fontFamily: "'Foxwhelp', sans-serif",
      zIndex: "20",
      textAlign: "center",
    });
    container.innerHTML = `
      <p style="font-family:'Foxwhelp',sans-serif;font-size:22px;margin-bottom:16px;"><strong>${requesterUsername}</strong> wants to play chess!</p>
      <button id="accept-battle" style="background:#fff;color:#000;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;margin-right:12px;">accept</button>
      <button id="decline-battle" style="background:transparent;color:#fff;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;">decline</button>
    `;
    document.getElementById("game-container")!.appendChild(container);

    document.getElementById("accept-battle")!.addEventListener("pointerdown", () => {
      if (this.room) {
        this.room.send(MSG.BATTLE_RESPONSE, { requesterSessionId, accepted: true });
      }
      container.remove();
    });
    document.getElementById("decline-battle")!.addEventListener("pointerdown", () => {
      if (this.room) {
        this.room.send(MSG.BATTLE_RESPONSE, { requesterSessionId, accepted: false });
      }
      container.remove();
    });
  }

  private showNotification(text: string): void {
    const el = document.createElement("div");
    Object.assign(el.style, {
      position: "absolute",
      top: "20%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#1a1a2e",
      border: "1px solid #555",
      borderRadius: "8px",
      padding: "16px 24px",
      color: "#fff",
      fontFamily: "'Foxwhelp', sans-serif",
      zIndex: "20",
      textAlign: "center",
      fontSize: "22px",
    });
    el.textContent = text;
    document.getElementById("game-container")!.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  private showChatBubbleForUser(username: string, text: string): void {
    if (username === this.username) {
      this.player.showChatBubble(text, hueToColor(this.playerHue));
      return;
    }
    for (const remote of this.remotePlayers.values()) {
      if (remote.username === username) {
        remote.showChatBubble(text);
        return;
      }
    }
  }

  private resolveHue(hue: number): void {
    if (this.hueFallbackTimer) {
      clearTimeout(this.hueFallbackTimer);
      this.hueFallbackTimer = null;
    }
    this.hueResolved = true;
    this.playerHue = hue;
    this.player.setColor(hueToColor(hue));
    this.events.emit("hueResolved", hue);
  }

  setPlayerHue(hue: number): void {
    this.playerHue = hue;
    this.player.setColor(hueToColor(hue));
    this.room?.send(MSG.HUE_CHANGE, { hue });
  }

  getPlayerHue(): number {
    return this.playerHue;
  }

  private updateAvailableShapes(unlockedCsv: string): void {
    const unlocked = unlockedCsv ? unlockedCsv.split(",") : [];
    this.availableShapes = [...new Set([...DEFAULT_SHAPES, ...unlocked])];
    this.events.emit("shapesUpdated", this.availableShapes);
  }

  getAvailableShapes(): string[] {
    return this.availableShapes;
  }

  setPlayerShape(shape: string): void {
    this.player.setShape(shape);
    this.room?.send(MSG.SHAPE_CHANGE, { shape });
  }

  movePlayerTo(worldX: number, worldY: number): void {
    this.followTarget = null;
    const tx = this.controls.clampX(worldX);
    const ty = this.controls.clampY(worldY);
    this.player.setTarget(tx, ty);
    this.clickMarker.show(tx, ty);
  }

  sendChat(text: string): void {
    if (this.room && text.trim()) {
      this.room.send(MSG.CHAT, { text: text.trim() });
    }
  }

  resumeFromChess(reward?: { type: string; name: string } | null): void {
    this.scene.resume();
    this.chatEnabled = true;
    const uiScene = this.scene.get("UIScene") as any;
    uiScene?.showPublicChat?.();

    // Notify server that battle is over (clears inBattle on player and NPC)
    if (this.room) {
      this.room.send(MSG.BATTLE_END, {
        npcSessionId: this.currentBattleNpcSessionId ?? undefined,
        unlockedShape: reward?.type === "shape" ? reward.name : undefined,
      });
    }
    this.currentBattleNpcSessionId = null;
  }

  private handleDisconnect(reason: string): void {
    this.room = null;
    this.scene.stop("UIScene");
    this.scene.stop("ChessScene");
    this.scene.start("AuthScene", { error: reason });
  }

  async logout(): Promise<void> {
    this.room?.leave();
    this.room = null;
    const { supabase } = await import("@/utils/supabaseClient.js");
    await supabase.auth.signOut();
    this.scene.stop("UIScene");
    this.scene.start("AuthScene");
  }
}
