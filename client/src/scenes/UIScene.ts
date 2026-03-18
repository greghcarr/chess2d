import Phaser from "phaser";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  VERSION,
  MINIMAP_SIZE,
  MINIMAP_MARGIN,
  MINIMAP_DOT_RADIUS,
  CHAT_WIDTH,
  CHAT_HEIGHT,
  CHAT_MARGIN,
  CHAT_MAX_MESSAGES,
  CHAT_FONT_SIZE,
  COLOR_MINIMAP_BG,
  COLOR_MINIMAP_SELF,
  COLOR_MINIMAP_OTHER,
  COLOR_VERSION_TEXT,
} from "@/constants.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "chess2d-shared/worldConfig.js";
import { LAYER } from "@/layers.js";

interface PlayerData {
  localPlayer: { x: number; y: number };
  remotePlayers: { x: number; y: number }[];
}

export class UIScene extends Phaser.Scene {
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private chatMessages: string[] = [];
  private chatTextObj!: Phaser.GameObjects.Text;
  private chatInput!: HTMLInputElement;
  private username = "";

  constructor() {
    super({ key: "UIScene" });
  }

  init(data: { username: string }): void {
    this.username = data.username;
  }

  create(): void {
    // Version label — bottom right
    this.add
      .text(BASE_WIDTH - 16, BASE_HEIGHT - 16, `v${VERSION}`, {
        fontSize: "14px",
        color: `#${COLOR_VERSION_TEXT.toString(16)}`,
        fontFamily: "monospace",
      })
      .setOrigin(1, 1)
      .setDepth(LAYER.VERSION_LABEL)
      .setScrollFactor(0);

    // Minimap background
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setDepth(LAYER.MINIMAP);
    this.minimapGraphics.setScrollFactor(0);

    // Chat text display
    this.chatTextObj = this.add
      .text(CHAT_MARGIN, BASE_HEIGHT - CHAT_HEIGHT - 60, "", {
        fontSize: `${CHAT_FONT_SIZE}px`,
        color: "#ffffff",
        fontFamily: "monospace",
        wordWrap: { width: CHAT_WIDTH - 16 },
        lineSpacing: 4,
      })
      .setOrigin(0, 1)
      .setDepth(LAYER.CHAT)
      .setScrollFactor(0);

    // Chat input (DOM element)
    this.chatInput = document.createElement("input");
    this.chatInput.type = "text";
    this.chatInput.placeholder = "Type a message...";
    this.chatInput.maxLength = 200;
    Object.assign(this.chatInput.style, {
      position: "absolute",
      bottom: "16px",
      left: "16px",
      width: `${CHAT_WIDTH}px`,
      padding: "8px 12px",
      background: "#1a1a2e",
      color: "#fff",
      border: "1px solid #444",
      borderRadius: "6px",
      fontSize: "14px",
      fontFamily: "monospace",
      outline: "none",
      zIndex: "10",
    });
    document.getElementById("game-container")!.appendChild(this.chatInput);

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.chatInput.value.trim()) {
        const overworld = this.scene.get("OverworldScene") as any;
        if (overworld?.sendChat) {
          overworld.sendChat(this.chatInput.value);
        }
        this.chatInput.value = "";
      }
      // Prevent game input while typing
      e.stopPropagation();
    });

    // Prevent Phaser from capturing keyboard while chat is focused
    this.chatInput.addEventListener("focus", () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = false;
        const overworld = this.scene.get("OverworldScene");
        if (overworld?.input.keyboard) {
          overworld.input.keyboard.enabled = false;
        }
      }
    });
    this.chatInput.addEventListener("blur", () => {
      if (this.input.keyboard) {
        this.input.keyboard.enabled = true;
        const overworld = this.scene.get("OverworldScene");
        if (overworld?.input.keyboard) {
          overworld.input.keyboard.enabled = true;
        }
      }
    });

    // Listen for events from OverworldScene
    const overworld = this.scene.get("OverworldScene");
    overworld.events.on("updatePlayerData", (data: PlayerData) => {
      this.drawMinimap(data);
    });
    overworld.events.on("chatMessage", (msg: { username: string; text: string }) => {
      this.addChatMessage(`${msg.username}: ${msg.text}`);
    });
  }

  private drawMinimap(data: PlayerData): void {
    const g = this.minimapGraphics;
    const mx = BASE_WIDTH - MINIMAP_SIZE - MINIMAP_MARGIN;
    const my = MINIMAP_MARGIN;
    const scaleX = MINIMAP_SIZE / WORLD_WIDTH;
    const scaleY = MINIMAP_SIZE / WORLD_HEIGHT;

    g.clear();

    // Background
    g.fillStyle(COLOR_MINIMAP_BG, 0.7);
    g.fillRoundedRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE, 8);

    // Border
    g.lineStyle(1, 0x555555, 1);
    g.strokeRoundedRect(mx, my, MINIMAP_SIZE, MINIMAP_SIZE, 8);

    // Remote players
    g.fillStyle(COLOR_MINIMAP_OTHER, 1);
    for (const rp of data.remotePlayers) {
      g.fillCircle(mx + rp.x * scaleX, my + rp.y * scaleY, MINIMAP_DOT_RADIUS);
    }

    // Local player
    g.fillStyle(COLOR_MINIMAP_SELF, 1);
    g.fillCircle(
      mx + data.localPlayer.x * scaleX,
      my + data.localPlayer.y * scaleY,
      MINIMAP_DOT_RADIUS + 1
    );
  }

  private addChatMessage(text: string): void {
    this.chatMessages.push(text);
    if (this.chatMessages.length > CHAT_MAX_MESSAGES) {
      this.chatMessages.shift();
    }
    // Show last ~10 messages
    const visible = this.chatMessages.slice(-10);
    this.chatTextObj.setText(visible.join("\n"));
  }
}
