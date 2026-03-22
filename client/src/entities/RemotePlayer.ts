import Phaser from "phaser";
import {
  PLAYER_RADIUS,
  PLAYER_NAME_OFFSET_Y,
  CHAT_BUBBLE_OFFSET_Y,
  CHAT_BUBBLE_DURATION,
  INTERPOLATION_SPEED,
} from "@/constants.js";
import { LAYER } from "@/layers.js";
import { drawPlayerShape } from "@/entities/drawPlayerShape.js";

export class RemotePlayer {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly nameText: Phaser.GameObjects.Text;
  x: number;
  y: number;
  serverX: number;
  serverY: number;
  readonly username: string;
  readonly sessionId: string;
  inBattle = false;
  readonly isNpc: boolean;
  readonly isScenario: boolean;
  private color: number;
  private shape: string;
  private chatBubble: Phaser.GameObjects.Text | null = null;
  private chatBubbleTimer: Phaser.Time.TimerEvent | null = null;
  private scene: Phaser.Scene;

  constructor(
    scene: Phaser.Scene,
    sessionId: string,
    x: number,
    y: number,
    username: string,
    color: number = 0x3399ff,
    isNpc: boolean = false,
    isScenario: boolean = false,
    isAdmin: boolean = false
  ) {
    this.sessionId = sessionId;
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.username = username;
    this.color = color;
    this.shape = "circle";
    this.isNpc = isNpc;
    this.isScenario = isScenario;
    this.scene = scene;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYER.REMOTE_PLAYERS);
    this.graphics.setInteractive(
      new Phaser.Geom.Circle(0, 0, PLAYER_RADIUS * 1.5),
      Phaser.Geom.Circle.Contains
    );
    this.graphics.input!.cursor = "pointer";

    const displayName = isAdmin ? `[Admin] ${username}` : username;
    const nameColor = isNpc ? "#ffcc00" : isAdmin ? "#ff4444" : "#cccccc";
    this.nameText = scene.add
      .text(x, y + PLAYER_NAME_OFFSET_Y, displayName, {
        fontSize: "13px",
        color: nameColor,
        fontFamily: "monospace",
        align: "center",
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(LAYER.PLAYER_NAMES);

    this.draw();
  }

  updateServerPosition(sx: number, sy: number): void {
    this.serverX = sx;
    this.serverY = sy;
  }

  update(): void {
    this.x += (this.serverX - this.x) * INTERPOLATION_SPEED;
    this.y += (this.serverY - this.y) * INTERPOLATION_SPEED;
    this.draw();
  }

  setColor(color: number): void {
    this.color = color;
  }

  setShape(shape: string): void {
    this.shape = shape;
  }

  private draw(): void {
    this.graphics.clear();
    drawPlayerShape(this.graphics, this.x, this.y, this.shape, this.color);

    // Battle indicator — crossed swords above player (not shown on NPCs)
    if (this.inBattle && !this.isNpc) {
      const sx = this.x;
      const sy = this.y - PLAYER_RADIUS * 1.8;
      this.graphics.lineStyle(2, 0xff4444, 0.9);
      // Left sword: top-right to bottom-left
      this.graphics.lineBetween(sx - 5, sy - 6, sx + 5, sy + 6);
      // Right sword: top-left to bottom-right
      this.graphics.lineBetween(sx + 5, sy - 6, sx - 5, sy + 6);
      // Small circle at the cross
      this.graphics.strokeCircle(sx, sy, 3);
    }

    // Update interactive hitarea position
    this.graphics.input!.hitArea = new Phaser.Geom.Circle(
      this.x,
      this.y,
      PLAYER_RADIUS * 1.5
    );
    this.nameText.setPosition(this.x, this.y + PLAYER_NAME_OFFSET_Y);
    this.chatBubble?.setPosition(this.x, this.y + CHAT_BUBBLE_OFFSET_Y);
  }

  showChatBubble(text: string): void {
    this.chatBubble?.destroy();
    this.chatBubbleTimer?.remove();

    const cssColor = `#${this.color.toString(16).padStart(6, "0")}`;
    this.chatBubble = this.scene.add
      .text(this.x, this.y + CHAT_BUBBLE_OFFSET_Y, text, {
        fontSize: "12px",
        color: cssColor,
        fontFamily: "monospace",
        align: "center",
        wordWrap: { width: 160 },
      })
      .setOrigin(0.5, 1)
      .setDepth(LAYER.PLAYER_NAMES);

    this.chatBubbleTimer = this.scene.time.delayedCall(CHAT_BUBBLE_DURATION, () => {
      this.chatBubble?.destroy();
      this.chatBubble = null;
    });
  }

  destroy(): void {
    this.graphics.destroy();
    this.nameText.destroy();
    this.chatBubble?.destroy();
    this.chatBubbleTimer?.remove();
  }
}
