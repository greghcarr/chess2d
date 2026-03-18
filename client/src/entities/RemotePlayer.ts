import Phaser from "phaser";
import {
  PLAYER_RADIUS,
  PLAYER_NAME_OFFSET_Y,
  COLOR_REMOTE_PLAYER,
  INTERPOLATION_SPEED,
} from "@/constants.js";
import { LAYER } from "@/layers.js";

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

  constructor(
    scene: Phaser.Scene,
    sessionId: string,
    x: number,
    y: number,
    username: string
  ) {
    this.sessionId = sessionId;
    this.x = x;
    this.y = y;
    this.serverX = x;
    this.serverY = y;
    this.username = username;

    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYER.REMOTE_PLAYERS);
    this.graphics.setInteractive(
      new Phaser.Geom.Circle(0, 0, PLAYER_RADIUS * 1.5),
      Phaser.Geom.Circle.Contains
    );
    this.graphics.input!.cursor = "pointer";

    this.nameText = scene.add
      .text(x, y + PLAYER_NAME_OFFSET_Y, username, {
        fontSize: "13px",
        color: "#cccccc",
        fontFamily: "monospace",
        align: "center",
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

  private draw(): void {
    this.graphics.clear();
    this.graphics.fillStyle(COLOR_REMOTE_PLAYER, 1);
    this.graphics.fillCircle(this.x, this.y, PLAYER_RADIUS);
    this.graphics.fillRoundedRect(
      this.x - PLAYER_RADIUS * 0.6,
      this.y + PLAYER_RADIUS * 0.4,
      PLAYER_RADIUS * 1.2,
      PLAYER_RADIUS * 1.0,
      4
    );
    // Update interactive hitarea position
    this.graphics.input!.hitArea = new Phaser.Geom.Circle(
      this.x,
      this.y,
      PLAYER_RADIUS * 1.5
    );
    this.nameText.setPosition(this.x, this.y + PLAYER_NAME_OFFSET_Y);
  }

  destroy(): void {
    this.graphics.destroy();
    this.nameText.destroy();
  }
}
