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
  FENCE_THICKNESS,
  SPAWN_X,
  SPAWN_Y,
} from "chess2d-shared/worldConfig.js";
import {
  COLOR_GROUND,
  COLOR_FENCE,
  BATTLE_REQUEST_RANGE,
} from "@/constants.js";
import { LAYER } from "@/layers.js";
import type { Room } from "colyseus.js";

export class OverworldScene extends Phaser.Scene {
  private player!: Player;
  private remotePlayers = new Map<string, RemotePlayer>();
  private clickMarker!: ClickMarker;
  private controls!: MovementControls;
  private cameraControls!: CameraControls;
  private room: Room | null = null;
  private username = "";
  private chatEnabled = true;

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

    this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Click/tap to move
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      // Don't move when clicking UI or during chat focus
      if (!this.chatEnabled) return;

      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tx = this.controls.clampX(worldPoint.x);
      const ty = this.controls.clampY(worldPoint.y);
      this.player.setTarget(tx, ty);
      this.clickMarker.show(tx, ty);
    });

    this.connectToServer();
  }

  update(_time: number, delta: number): void {
    // Keyboard movement overrides click target
    this.controls.applyKeyboardMovement(this.player, delta);
    this.player.update(delta);

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

    // Update UIScene with player data
    const uiScene = this.scene.get("UIScene");
    if (uiScene) {
      uiScene.events.emit("updatePlayerData", {
        localPlayer: { x: this.player.x, y: this.player.y },
        remotePlayers: Array.from(this.remotePlayers.values()).map((rp) => ({
          x: rp.x,
          y: rp.y,
        })),
      });
    }
  }

  private drawWorld(): void {
    // Ground
    const ground = this.add.graphics();
    ground.setDepth(LAYER.GROUND);
    ground.fillStyle(COLOR_GROUND, 1);
    ground.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Fence
    const fence = this.add.graphics();
    fence.setDepth(LAYER.FENCE);
    fence.lineStyle(FENCE_THICKNESS, COLOR_FENCE, 1);
    fence.strokeRect(
      FENCE_THICKNESS / 2,
      FENCE_THICKNESS / 2,
      WORLD_WIDTH - FENCE_THICKNESS,
      WORLD_HEIGHT - FENCE_THICKNESS
    );
  }

  private async connectToServer(): Promise<void> {
    try {
      this.room = await colyseusClient.joinOrCreate("overworld", {
        username: this.username,
      });

      // Listen for state changes on all players
      this.room.state.players.onAdd((playerState: any, sessionId: string) => {
        if (sessionId === this.room!.sessionId) return;
        const remote = new RemotePlayer(
          this,
          sessionId,
          playerState.x,
          playerState.y,
          playerState.username
        );
        this.remotePlayers.set(sessionId, remote);

        playerState.onChange(() => {
          remote.updateServerPosition(playerState.x, playerState.y);
          remote.inBattle = playerState.inBattle;
        });

        // Click on remote player to request battle
        remote.graphics.on("pointerdown", () => {
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

      // Chat messages
      this.room.onMessage(MSG.CHAT, (message: { username: string; text: string }) => {
        const uiScene = this.scene.get("UIScene");
        if (uiScene) {
          uiScene.events.emit("chatMessage", message);
        }
      });

      // Battle request received
      this.room.onMessage(MSG.BATTLE_REQUEST, (data: { requesterSessionId: string; requesterUsername: string }) => {
        this.showBattleRequestDialog(data.requesterSessionId, data.requesterUsername);
      });

      // Battle start
      this.room.onMessage(MSG.BATTLE_START, (data: { roomId: string; color: string; opponentUsername: string }) => {
        this.scene.launch("ChessScene", {
          roomId: data.roomId,
          color: data.color,
          opponentUsername: data.opponentUsername,
          username: this.username,
        });
        this.scene.pause();
      });

      // Battle declined
      this.room.onMessage(MSG.BATTLE_RESPONSE, (data: { accepted: boolean; username: string }) => {
        if (!data.accepted) {
          this.showNotification(`${data.username} declined your battle request.`);
        }
      });
    } catch (err) {
      console.error("Failed to connect to server:", err);
    }
  }

  private showBattleMenu(remote: RemotePlayer): void {
    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      remote.x,
      remote.y
    );

    if (dist > BATTLE_REQUEST_RANGE) {
      this.showNotification("Too far away to battle!");
      return;
    }

    if (remote.inBattle) {
      // Offer to spectate instead
      this.showNotification("That player is in a battle. Spectating coming soon!");
      return;
    }

    this.showBattleConfirmDialog(remote);
  }

  private showBattleConfirmDialog(remote: RemotePlayer): void {
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      background: "#1a1a2e",
      border: "2px solid #3399ff",
      borderRadius: "12px",
      padding: "24px 32px",
      color: "#fff",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      zIndex: "20",
      textAlign: "center",
    });
    container.innerHTML = `
      <p style="font-size:18px;margin-bottom:16px;">Challenge <strong>${remote.username}</strong> to chess?</p>
      <button id="battle-yes" style="background:#3399ff;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:16px;margin-right:12px;">Request Battle</button>
      <button id="battle-no" style="background:#444;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Cancel</button>
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
      transform: "translate(-50%, -50%)",
      background: "#1a1a2e",
      border: "2px solid #ff9933",
      borderRadius: "12px",
      padding: "24px 32px",
      color: "#fff",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      zIndex: "20",
      textAlign: "center",
    });
    container.innerHTML = `
      <p style="font-size:18px;margin-bottom:16px;"><strong>${requesterUsername}</strong> wants to play chess!</p>
      <button id="accept-battle" style="background:#4caf50;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:16px;margin-right:12px;">Accept</button>
      <button id="decline-battle" style="background:#f44336;color:#fff;border:none;padding:10px 24px;border-radius:6px;cursor:pointer;font-size:16px;">Decline</button>
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
      fontFamily: "'Segoe UI', Arial, sans-serif",
      zIndex: "20",
      textAlign: "center",
      fontSize: "16px",
    });
    el.textContent = text;
    document.getElementById("game-container")!.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  sendChat(text: string): void {
    if (this.room && text.trim()) {
      this.room.send(MSG.CHAT, { text: text.trim() });
    }
  }

  resumeFromChess(): void {
    this.scene.resume();
    this.chatEnabled = true;
  }
}
