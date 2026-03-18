import Phaser from "phaser";
import { BASE_WIDTH, BASE_HEIGHT } from "@/constants.js";
import { BootScene } from "@/scenes/BootScene.js";
import { AuthScene } from "@/scenes/AuthScene.js";
import { OverworldScene } from "@/scenes/OverworldScene.js";
import { ChessScene } from "@/scenes/ChessScene.js";
import { UIScene } from "@/scenes/UIScene.js";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "game-container",
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  backgroundColor: "#000000",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  scene: [BootScene, AuthScene, OverworldScene, ChessScene, UIScene],
};

new Phaser.Game(config);
