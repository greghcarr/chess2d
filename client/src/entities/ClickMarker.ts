import Phaser from "phaser";
import { CLICK_MARKER_SIZE, CLICK_MARKER_DURATION, COLOR_CLICK_MARKER } from "@/constants.js";
import { LAYER } from "@/layers.js";

export class ClickMarker {
  private graphics: Phaser.GameObjects.Graphics;
  private scene: Phaser.Scene;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(LAYER.CLICK_MARKER);
    this.graphics.setVisible(false);
  }

  show(x: number, y: number): void {
    const s = CLICK_MARKER_SIZE;
    this.graphics.clear();
    this.graphics.lineStyle(2, COLOR_CLICK_MARKER, 1);
    // Draw an X
    this.graphics.lineBetween(x - s, y - s, x + s, y + s);
    this.graphics.lineBetween(x + s, y - s, x - s, y + s);
    this.graphics.setVisible(true);
    this.graphics.setAlpha(1);

    this.scene.tweens.add({
      targets: this.graphics,
      alpha: 0,
      duration: CLICK_MARKER_DURATION,
      ease: "Power2",
      onComplete: () => {
        this.graphics.setVisible(false);
      },
    });
  }
}
