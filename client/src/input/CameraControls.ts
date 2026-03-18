import Phaser from "phaser";
import {
  ZOOM_DEFAULT,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_STEP,
  ZOOM_TWEEN_DURATION,
} from "@/constants.js";

export class CameraControls {
  private scene: Phaser.Scene;
  private camera: Phaser.Cameras.Scene2D.Camera;
  private targetZoom: number;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;
    this.targetZoom = ZOOM_DEFAULT;
    this.camera.setZoom(ZOOM_DEFAULT);

    // Scroll wheel zoom
    scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _gos: unknown[], _dx: number, dy: number) => {
      this.adjustZoom(dy > 0 ? -ZOOM_STEP : ZOOM_STEP);
    });

    // +/- keys
    scene.input.keyboard!.on("keydown-PLUS", () => this.adjustZoom(ZOOM_STEP));
    scene.input.keyboard!.on("keydown-MINUS", () => this.adjustZoom(-ZOOM_STEP));
    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_ADD).on("down", () =>
      this.adjustZoom(ZOOM_STEP)
    );
    scene.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.NUMPAD_SUBTRACT).on("down", () =>
      this.adjustZoom(-ZOOM_STEP)
    );

    // Pinch to zoom
    this.setupPinchZoom();
  }

  private adjustZoom(delta: number): void {
    this.targetZoom = Phaser.Math.Clamp(this.targetZoom + delta, ZOOM_MIN, ZOOM_MAX);
    this.scene.tweens.add({
      targets: this.camera,
      zoom: this.targetZoom,
      duration: ZOOM_TWEEN_DURATION,
      ease: "Sine.easeOut",
    });
  }

  private setupPinchZoom(): void {
    let initialDistance = 0;
    let initialZoom = ZOOM_DEFAULT;

    this.scene.input.on("pointerdown", (_pointer: Phaser.Input.Pointer) => {
      const pointers = this.scene.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length === 2) {
        const [p1, p2] = pointers;
        initialDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        initialZoom = this.camera.zoom;
      }
    });

    this.scene.input.on("pointermove", () => {
      const pointers = this.scene.input.manager.pointers.filter((p) => p.isDown);
      if (pointers.length === 2 && initialDistance > 0) {
        const [p1, p2] = pointers;
        const currentDistance = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
        const scale = currentDistance / initialDistance;
        this.targetZoom = Phaser.Math.Clamp(initialZoom * scale, ZOOM_MIN, ZOOM_MAX);
        this.camera.setZoom(this.targetZoom);
      }
    });

    this.scene.input.on("pointerup", () => {
      initialDistance = 0;
    });
  }

  followTarget(x: number, y: number): void {
    this.camera.centerOn(x, y);
  }
}
