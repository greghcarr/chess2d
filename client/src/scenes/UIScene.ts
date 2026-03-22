import Phaser from "phaser";
import {
  BASE_WIDTH,
  BASE_HEIGHT,
  VERSION,
  MINIMAP_SIZE,
  MINIMAP_MARGIN,
  MINIMAP_DOT_RADIUS,
  CHAT_WIDTH,
  CHAT_MAX_MESSAGES,
  COLOR_MINIMAP_BG,
  COLOR_MINIMAP_OTHER,
  ALL_SHAPES,
} from "@/constants.js";
import { WORLD_WIDTH, WORLD_HEIGHT } from "chess2d-shared/worldConfig.js";
import { LAYER } from "@/layers.js";

interface PlayerData {
  localPlayer: { x: number; y: number };
  remotePlayers: { x: number; y: number; isNpc: boolean }[];
  localHue: number;
}

export class UIScene extends Phaser.Scene {
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private chatMessages: { text: string; time: number }[] = [];
  private chatTextEl!: HTMLDivElement;
  private chatInput!: HTMLInputElement;
  private colorPicker!: HTMLInputElement;
  private shapePicker!: HTMLSelectElement;
  private username = "";
  private pauseOverlay!: Phaser.GameObjects.Rectangle;
  private pauseMenu!: HTMLDivElement;
  private paused = false;

  constructor() {
    super({ key: "UIScene" });
  }

  init(data: { username: string }): void {
    this.username = data.username;
  }

  create(): void {
    // Version label — bottom right
    this.add
      .text(BASE_WIDTH - 27, BASE_HEIGHT - 27, `v${VERSION}`, {
        fontSize: "26px",
        color: "#6a8ab8",
        fontFamily: "monospace",
      })
      .setAlpha(0.5)
      .setOrigin(1, 1)
      .setDepth(LAYER.VERSION_LABEL)
      .setScrollFactor(0);

    // Minimap background
    this.minimapGraphics = this.add.graphics();
    this.minimapGraphics.setDepth(LAYER.MINIMAP);
    this.minimapGraphics.setScrollFactor(0);

    // Minimap click-to-move
    const minimapHitArea = new Phaser.Geom.Rectangle(
      BASE_WIDTH - MINIMAP_SIZE - MINIMAP_MARGIN,
      MINIMAP_MARGIN,
      MINIMAP_SIZE,
      MINIMAP_SIZE
    );
    this.minimapGraphics.setInteractive(minimapHitArea, Phaser.Geom.Rectangle.Contains);
    this.minimapGraphics.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const mx = BASE_WIDTH - MINIMAP_SIZE - MINIMAP_MARGIN;
      const my = MINIMAP_MARGIN;
      const worldX = ((pointer.x - mx) / MINIMAP_SIZE) * WORLD_WIDTH;
      const worldY = ((pointer.y - my) / MINIMAP_SIZE) * WORLD_HEIGHT;
      const overworld = this.scene.get("OverworldScene") as any;
      overworld?.movePlayerTo?.(worldX, worldY);
    });

    // Chat text display (DOM element — stays aligned with input across screen sizes)
    this.chatTextEl = document.createElement("div");
    Object.assign(this.chatTextEl.style, {
      position: "absolute",
      bottom: "68px",
      left: "16px",
      width: `${CHAT_WIDTH}px`,
      maxHeight: "300px",
      overflow: "hidden",
      color: "#fff",
      fontFamily: "monospace",
      fontSize: "14px",
      lineHeight: "1.4",
      padding: "8px 12px",
      background: "#1a1a2e",
      border: "1px solid #444",
      borderRadius: "6px",
      boxSizing: "border-box",
      pointerEvents: "none",
      zIndex: "10",
      display: "none",
    });
    document.getElementById("game-container")!.appendChild(this.chatTextEl);

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
        const text = this.chatInput.value.trim();
        this.chatInput.value = "";

        if (text.startsWith("/")) {
          this.handleSlashCommand(text);
        } else {
          const overworld = this.scene.get("OverworldScene") as any;
          if (overworld?.sendChat) {
            overworld.sendChat(text);
          }
        }
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

    // Color picker — bottom left, above chat
    this.colorPicker = document.createElement("input");
    this.colorPicker.type = "range";
    this.colorPicker.min = "0";
    this.colorPicker.max = "360";
    this.colorPicker.value = "200";
    Object.assign(this.colorPicker.style, {
      position: "absolute",
      top: "42px",
      left: "16px",
      width: "120px",
      accentColor: "hsl(200, 100%, 60%)",
      zIndex: "10",
      display: "none",
    });
    document.getElementById("game-container")!.appendChild(this.colorPicker);

    // Set initial value from overworld once connected
    const overworld = this.scene.get("OverworldScene") as any;
    if (overworld?.getPlayerHue) {
      const hue = overworld.getPlayerHue();
      this.colorPicker.value = String(hue);
      this.colorPicker.style.accentColor = `hsl(${hue}, 100%, 60%)`;
    }

    this.colorPicker.addEventListener("input", () => {
      const hue = parseInt(this.colorPicker.value, 10);
      this.colorPicker.style.accentColor = `hsl(${hue}, 100%, 60%)`;
      const ow = this.scene.get("OverworldScene") as any;
      if (ow?.setPlayerHue) {
        ow.setPlayerHue(hue);
      }
    });

    // Shape picker — below color picker
    this.shapePicker = document.createElement("select");
    Object.assign(this.shapePicker.style, {
      position: "absolute",
      top: "16px",
      left: "16px",
      width: "120px",
      padding: "4px 8px",
      background: "#1a1a2e",
      color: "#fff",
      border: "1px solid #444",
      borderRadius: "6px",
      fontSize: "13px",
      fontFamily: "monospace",
      outline: "none",
      zIndex: "10",
    });
    document.getElementById("game-container")!.appendChild(this.shapePicker);

    // Populate with initially available shapes
    this.rebuildShapePicker(overworld?.getAvailableShapes?.() ?? ["circle"]);

    this.shapePicker.addEventListener("change", () => {
      const ow = this.scene.get("OverworldScene") as any;
      if (ow?.setPlayerShape) {
        ow.setPlayerShape(this.shapePicker.value);
      }
    });
    // Prevent Phaser from interpreting dropdown interaction as game clicks
    for (const evt of ["pointerdown", "pointerup", "pointermove", "mousedown", "mouseup"] as const) {
      this.shapePicker.addEventListener(evt, (e) => e.stopPropagation());
    }

    // Listen for events from OverworldScene (remove old listeners first to prevent duplicates on re-create)
    overworld.events.off("updatePlayerData");
    overworld.events.off("shapesUpdated");
    overworld.events.off("hueResolved");
    overworld.events.off("chatMessage");
    overworld.events.on("updatePlayerData", (data: PlayerData) => {
      this.drawMinimap(data);
    });
    overworld.events.on("chatMessage", (msg: { username: string; text: string }) => {
      this.addChatMessage(`${msg.username}: ${msg.text}`);
    });
    overworld.events.on("shapesUpdated", (shapes: string[]) => {
      this.rebuildShapePicker(shapes);
    });
    overworld.events.on("hueResolved", (hue: number) => {
      this.colorPicker.value = String(hue);
      this.colorPicker.style.accentColor = `hsl(${hue}, 100%, 60%)`;
      this.colorPicker.style.display = "";
    });

    // Pause overlay — full-screen dim
    this.pauseOverlay = this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.6)
      .setDepth(LAYER.MODAL)
      .setScrollFactor(0)
      .setVisible(false);

    // Pause menu — DOM container
    this.pauseMenu = document.createElement("div");
    Object.assign(this.pauseMenu.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%) scale(1.5)",
      background: "#1a1a2e",
      border: "2px solid #fff",
      borderRadius: "12px",
      padding: "32px 48px",
      color: "#fff",
      fontFamily: "'Foxwhelp', sans-serif",
      zIndex: "30",
      textAlign: "center",
      display: "none",
    });
    this.pauseMenu.innerHTML = `
      <p style="font-family:'Foxwhelp',sans-serif;font-size:28px;margin-bottom:24px;">paused</p>
      <button id="pause-resume" style="background:#fff;color:#000;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;margin-bottom:12px;display:block;width:100%;">resume</button>
      <button id="pause-logout" style="background:transparent;color:#fff;border:2px solid #fff;padding:10px 32px;border-radius:8px;cursor:pointer;font-family:'Foxwhelp',sans-serif;font-size:22px;display:block;width:100%;">logout</button>
    `;
    document.getElementById("game-container")!.appendChild(this.pauseMenu);

    this.pauseMenu.querySelector("#pause-resume")!.addEventListener("pointerdown", () => {
      this.togglePause();
    });
    this.pauseMenu.querySelector("#pause-logout")!.addEventListener("pointerdown", () => {
      this.togglePause();
      const ow = this.scene.get("OverworldScene") as any;
      ow?.logout?.();
    });

    // Escape key toggles pause
    this.input.keyboard!.on("keydown-ESC", () => {
      this.togglePause();
    });

    // Periodically expire old chat messages
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.refreshChat() });

    // Clean up DOM elements when scene shuts down
    this.events.on("shutdown", () => {
      this.chatTextEl.remove();
      this.chatInput.remove();
      this.colorPicker.remove();
      this.shapePicker.remove();
      this.pauseMenu.remove();
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

    // Remote players and NPCs
    for (const rp of data.remotePlayers) {
      g.fillStyle(rp.isNpc ? 0xffcc00 : COLOR_MINIMAP_OTHER, 1);
      g.fillCircle(mx + rp.x * scaleX, my + rp.y * scaleY, MINIMAP_DOT_RADIUS);
    }

    // Local player — use their chosen hue
    g.fillStyle(Phaser.Display.Color.HSLToColor(data.localHue / 360, 1, 0.6).color, 1);
    g.fillCircle(
      mx + data.localPlayer.x * scaleX,
      my + data.localPlayer.y * scaleY,
      MINIMAP_DOT_RADIUS + 1
    );
  }

  hidePublicChat(): void {
    this.chatTextEl.style.display = "none";
    this.chatInput.style.display = "none";
    this.colorPicker.style.display = "none";
    this.shapePicker.style.display = "none";
    this.minimapGraphics.setVisible(false);
  }

  showPublicChat(): void {
    this.chatTextEl.style.display = "";
    this.chatInput.style.display = "";
    this.colorPicker.style.display = "";
    this.shapePicker.style.display = "";
    this.minimapGraphics.setVisible(true);
  }

  private togglePause(): void {
    this.paused = !this.paused;
    this.pauseOverlay.setVisible(this.paused);
    this.pauseMenu.style.display = this.paused ? "" : "none";

    const overworld = this.scene.get("OverworldScene");
    if (this.paused) {
      this.scene.pause("OverworldScene");
      this.chatInput.blur();
    } else {
      this.scene.resume("OverworldScene");
    }
  }

  private handleSlashCommand(text: string): void {
    const cmd = text.toLowerCase().split(/\s+/)[0];
    switch (cmd) {
      case "/quit":
      case "/logout": {
        const overworld = this.scene.get("OverworldScene") as any;
        overworld?.logout?.();
        break;
      }
      default:
        this.addChatMessage(`unknown command: ${cmd}`);
        break;
    }
  }

  private rebuildShapePicker(available: string[]): void {
    const current = this.shapePicker.value;
    this.shapePicker.innerHTML = "";
    for (const s of ALL_SHAPES) {
      if (!available.includes(s.value)) continue;
      const opt = document.createElement("option");
      opt.value = s.value;
      opt.textContent = s.label;
      this.shapePicker.appendChild(opt);
    }
    // Restore selection if still available, otherwise default to first
    if (available.includes(current)) {
      this.shapePicker.value = current;
    }
  }

  private addChatMessage(text: string): void {
    this.chatMessages.push({ text, time: Date.now() });
    if (this.chatMessages.length > CHAT_MAX_MESSAGES) {
      this.chatMessages.shift();
    }
    this.refreshChat();
  }

  private refreshChat(): void {
    const CHAT_TTL_MS = 30_000;
    const now = Date.now();
    const visible = this.chatMessages
      .filter((m) => now - m.time < CHAT_TTL_MS)
      .slice(-10)
      .map((m) => m.text);
    this.chatTextEl.innerText = visible.join("\n");
    this.chatTextEl.style.display = visible.length > 0 ? "" : "none";
  }
}
