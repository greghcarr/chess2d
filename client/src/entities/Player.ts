import Phaser from "phaser";
import {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  PLAYER_NAME_OFFSET_Y,
  COLOR_PLAYER,
} from "@/constants.js";
import { LAYER } from "@/layers.js";

export class Player {
  readonly graphics: Phaser.GameObjects.Graphics;
  readonly nameText: Phaser.GameObjects.Text;
  x: number;
  y: number;
  targetX: number | null = null;
  targetY: number | null = null;
  readonly username: string;

  constructor(scene: Phaser.Scene, x: number, y: number, username: string) {
    this.x = x;
    this.y = y;
    this.username = username;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYER.LOCAL_PLAYER);
    this.draw();

    this.nameText = scene.add
      .text(x, y + PLAYER_NAME_OFFSET_Y, username, {
        fontSize: "13px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 1)
      .setDepth(LAYER.PLAYER_NAMES);
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

  private draw(): void {
    this.graphics.clear();
    this.graphics.fillStyle(COLOR_PLAYER, 1);
    this.graphics.fillCircle(this.x, this.y, PLAYER_RADIUS);
    // Simple body: small rectangle below circle
    this.graphics.fillRoundedRect(
      this.x - PLAYER_RADIUS * 0.6,
      this.y + PLAYER_RADIUS * 0.4,
      PLAYER_RADIUS * 1.2,
      PLAYER_RADIUS * 1.0,
      4
    );
    this.nameText.setPosition(this.x, this.y + PLAYER_NAME_OFFSET_Y);
  }

  destroy(): void {
    this.graphics.destroy();
    this.nameText.destroy();
  }
}
