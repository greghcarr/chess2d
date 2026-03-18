import Phaser from "phaser";
import { Player } from "@/entities/Player.js";
import { PLAYER_SPEED } from "@/constants.js";
import { WORLD_WIDTH, WORLD_HEIGHT, FENCE_THICKNESS } from "chess2d-shared/worldConfig.js";

export class MovementControls {
  private wasd: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };
  private arrows: Phaser.Types.Input.Keyboard.CursorKeys;

  constructor(scene: Phaser.Scene) {
    this.wasd = {
      W: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.arrows = scene.input.keyboard!.createCursorKeys();
  }

  getDirection(): { dx: number; dy: number } {
    let dx = 0;
    let dy = 0;

    if (this.wasd.A.isDown || this.arrows.left.isDown) dx -= 1;
    if (this.wasd.D.isDown || this.arrows.right.isDown) dx += 1;
    if (this.wasd.W.isDown || this.arrows.up.isDown) dy -= 1;
    if (this.wasd.S.isDown || this.arrows.down.isDown) dy += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const len = Math.sqrt(dx * dx + dy * dy);
      dx /= len;
      dy /= len;
    }

    return { dx, dy };
  }

  isMoving(): boolean {
    const { dx, dy } = this.getDirection();
    return dx !== 0 || dy !== 0;
  }

  applyKeyboardMovement(player: Player, delta: number): void {
    const { dx, dy } = this.getDirection();
    if (dx === 0 && dy === 0) return;

    player.clearTarget(); // keyboard overrides click target
    const step = PLAYER_SPEED * (delta / 1000);
    player.x = this.clampX(player.x + dx * step);
    player.y = this.clampY(player.y + dy * step);
  }

  clampX(x: number): number {
    const min = FENCE_THICKNESS;
    const max = WORLD_WIDTH - FENCE_THICKNESS;
    return Math.max(min, Math.min(max, x));
  }

  clampY(y: number): number {
    const min = FENCE_THICKNESS;
    const max = WORLD_HEIGHT - FENCE_THICKNESS;
    return Math.max(min, Math.min(max, y));
  }
}
