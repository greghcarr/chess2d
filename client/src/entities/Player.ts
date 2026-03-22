import Phaser from "phaser";
import {
  PLAYER_SPEED,
  PLAYER_NAME_OFFSET_Y,
  CHAT_BUBBLE_OFFSET_Y,
  CHAT_BUBBLE_DURATION,
} from "@/constants.js";
import { LAYER } from "@/layers.js";
import { drawPlayerShape } from "@/entities/drawPlayerShape.js";

export class Player {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly nameText: Phaser.GameObjects.Text;
  x: number;
  y: number;
  targetX: number | null = null;
  targetY: number | null = null;
  readonly username: string;
  private color: number;
  private alpha: number;
  private shape: string;
  private chatBubble: Phaser.GameObjects.Text | null = null;
  private chatBubbleTimer: Phaser.Time.TimerEvent | null = null;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number, username: string, color: number = 0x000000, alpha: number = 0.5) {
    this.x = x;
    this.y = y;
    this.username = username;
    this.color = color;
    this.alpha = alpha;
    this.shape = "circle";
    this.scene = scene;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYER.LOCAL_PLAYER);

    this.nameText = scene.add
      .text(x, y + PLAYER_NAME_OFFSET_Y, username, {
        fontSize: "13px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setDepth(LAYER.PLAYER_NAMES);

    this.draw();
  }

  setTarget(tx: number, ty: number): void {
    this.targetX = tx;
    this.targetY = ty;
  }

  clearTarget(): void {
    this.targetX = null;
    this.targetY = null;
  }

  update(delta: number): void {
    if (this.targetX === null || this.targetY === null) return;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const step = PLAYER_SPEED * (delta / 1000);

    if (dist <= step) {
      this.x = this.targetX;
      this.y = this.targetY;
      this.clearTarget();
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
    }

    this.draw();
  }

  setColor(color: number, alpha: number = 1): void {
    this.color = color;
    this.alpha = alpha;
    this.draw();
  }

  setShape(shape: string): void {
    this.shape = shape;
    this.draw();
  }

  setAdmin(isAdmin: boolean): void {
    if (isAdmin) {
      this.nameText.setText(`[Admin] ${this.username}`);
      this.nameText.setColor("#ff4444");
    }
  }

  redraw(): void {
    this.draw();
  }

  private draw(): void {
    this.graphics.clear();
    drawPlayerShape(this.graphics, this.x, this.y, this.shape, this.color, this.alpha);
    this.nameText.setPosition(this.x, this.y + PLAYER_NAME_OFFSET_Y);
    this.chatBubble?.setPosition(this.x, this.y + CHAT_BUBBLE_OFFSET_Y);
  }

  showChatBubble(text: string, color: number): void {
    this.chatBubble?.destroy();
    this.chatBubbleTimer?.remove();

    const cssColor = `#${color.toString(16).padStart(6, "0")}`;
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
