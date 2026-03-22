import Phaser from "phaser";
import { supabase } from "@/utils/supabaseClient.js";
import { VERSION } from "@/constants.js";
import { containsBannedWord } from "chess2d-shared/wordFilter.js";

const COLYSEUS_URL = import.meta.env.VITE_COLYSEUS_URL || "http://localhost:2567";

type AuthMode = "menu" | "login" | "signup";

export class AuthScene extends Phaser.Scene {
  private formContainer!: HTMLDivElement;
  private bgEl!: HTMLDivElement;
  private mode: AuthMode = "menu";
  private pendingError = "";

  constructor() {
    super({ key: "AuthScene" });
  }

  init(data?: { error?: string }): void {
    this.pendingError = data?.error ?? "";
  }

  create(): void {
    // Dev auto-login: ?dev_user=SomeName skips auth entirely
    const devUser = new URLSearchParams(window.location.search).get("dev_user");
    if (devUser) {
      this.enterGame(devUser);
      return;
    }

    // Chessboard background — DOM element covers full screen on any aspect ratio
    this.bgEl = document.createElement("div");
    const sqPx = 120;
    Object.assign(this.bgEl.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      zIndex: "1",
      overflow: "hidden",
    });
    // Inner element rotates slowly via CSS animation
    const inner = document.createElement("div");
    const size = "300vmax"; // always bigger than the viewport in any orientation
    Object.assign(inner.style, {
      position: "absolute",
      top: "50%",
      left: "50%",
      width: size,
      height: size,
      transform: "translate(-50%, -50%)",
      backgroundImage: `
        linear-gradient(45deg, rgba(181,136,99,0.15) 25%, transparent 25%),
        linear-gradient(-45deg, rgba(181,136,99,0.15) 25%, transparent 25%),
        linear-gradient(45deg, transparent 75%, rgba(181,136,99,0.15) 75%),
        linear-gradient(-45deg, transparent 75%, rgba(181,136,99,0.15) 75%)
      `,
      backgroundSize: `${sqPx * 2}px ${sqPx * 2}px`,
      backgroundPosition: `0 0, 0 ${sqPx}px, ${sqPx}px -${sqPx}px, -${sqPx}px 0`,
      backgroundColor: "rgba(240,217,181,0.08)",
      animation: "chess-bg-spin 120s linear infinite",
    });
    this.bgEl.appendChild(inner);
    document.getElementById("game-container")!.appendChild(this.bgEl);

    // Inject the CSS animation if not already present
    if (!document.getElementById("chess-bg-style")) {
      const style = document.createElement("style");
      style.id = "chess-bg-style";
      style.textContent = `@keyframes chess-bg-spin { from { transform: translate(-50%,-50%) rotate(0deg) scale(1); } 50% { transform: translate(-50%,-50%) rotate(180deg) scale(1.3); } to { transform: translate(-50%,-50%) rotate(360deg) scale(1); } }`;
      document.head.appendChild(style);
    }

    this.formContainer = document.createElement("div");
    Object.assign(this.formContainer.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "safe center",
      overflowY: "auto",
      padding: "24px 0",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: "#fff",
      pointerEvents: "auto",
      zIndex: "10",
    });
    document.getElementById("game-container")!.appendChild(this.formContainer);

    this.showMenu();

    // Version label (DOM element — unaffected by camera rotation/zoom)
    const versionEl = document.createElement("div");
    Object.assign(versionEl.style, {
      position: "absolute",
      bottom: "27px",
      right: "27px",
      fontSize: "20px",
      color: "#6a8ab8",
      fontFamily: "monospace",
      pointerEvents: "none",
      zIndex: "10",
    });
    versionEl.textContent = `v${VERSION}`;
    document.getElementById("game-container")!.appendChild(versionEl);
    this.events.on("shutdown", () => {
      versionEl.remove();
      this.bgEl.remove();
    });
  }

  private showMenu(): void {
    this.mode = "menu";
    const errorHtml = this.pendingError
      ? `<p style="color:#ff6b6b;margin-bottom:16px;font-size:20px;">${this.pendingError}</p>`
      : "";
    this.pendingError = "";
    this.formContainer.innerHTML = `
      <h1 id="menu-title" style="font-family:'Foxwhelp',sans-serif;font-size:96px;margin-bottom:8px;letter-spacing:4px;opacity:0;transition:opacity 1s ease;">chess2D</h1>
      <div id="menu-rest" style="display:none;flex-direction:column;align-items:center;">
        <p style="font-family:'Foxwhelp',sans-serif;color:#999;margin-bottom:24px;font-size:28px;text-align:center;">a chess MMO</p>
        ${errorHtml}
        <button id="auth-login" style="${this.buttonStyle()}">log in</button>
        <button id="auth-signup" style="${this.buttonStyle()}margin-top:16px;">sign up</button>
      </div>
    `;

    // Step 2: fade in title
    const title = document.getElementById("menu-title")!;
    requestAnimationFrame(() => { title.style.opacity = "1"; });

    // Step 3: after title fade, show the rest abruptly
    title.addEventListener("transitionend", () => {
      document.getElementById("menu-rest")!.style.display = "flex";
    }, { once: true });

    document.getElementById("auth-login")!.addEventListener("pointerdown", () => this.showLogin());
    document.getElementById("auth-signup")!.addEventListener("pointerdown", () => this.showSignup());
  }

  private showLogin(): void {
    this.mode = "login";
    this.formContainer.innerHTML = `
      <h2 style="font-family:'Foxwhelp',sans-serif;font-size:48px;margin-bottom:32px;">log in</h2>
      <input id="auth-username" type="text" placeholder="username" autocorrect="off" autocapitalize="off" autocomplete="username" style="${this.inputStyle()}" />
      <input id="auth-password" type="password" placeholder="password" autocorrect="off" autocapitalize="off" autocomplete="current-password" style="${this.inputStyle()}margin-top:12px;" />
      <p id="auth-error" style="color:#ff6b6b;margin-top:12px;min-height:20px;font-size:20px;"></p>
      <button id="auth-submit" style="${this.buttonStyle()}margin-top:8px;">log in</button>
      <button id="auth-back" style="${this.linkStyle()}margin-top:16px;">back</button>
    `;
    document.getElementById("auth-submit")!.addEventListener("pointerdown", () => this.handleLogin());
    document.getElementById("auth-back")!.addEventListener("pointerdown", () => this.showMenu());
    this.addEnterKeyHandler("auth-password", () => this.handleLogin());
  }

  private showSignup(): void {
    this.mode = "signup";
    this.formContainer.innerHTML = `
      <h2 style="font-family:'Foxwhelp',sans-serif;font-size:48px;margin-bottom:32px;">sign up</h2>
      <input id="auth-username" type="text" placeholder="username" autocorrect="off" autocapitalize="off" autocomplete="username" style="${this.inputStyle()}" />
      <input id="auth-password" type="password" placeholder="password" autocorrect="off" autocapitalize="off" autocomplete="new-password" style="${this.inputStyle()}margin-top:12px;" />
      <input id="auth-confirm" type="password" placeholder="confirm password" autocorrect="off" autocapitalize="off" autocomplete="new-password" style="${this.inputStyle()}margin-top:12px;" />
      <p id="auth-error" style="color:#ff6b6b;margin-top:12px;min-height:20px;font-size:20px;"></p>
      <button id="auth-submit" style="${this.buttonStyle()}margin-top:8px;">sign up</button>
      <button id="auth-back" style="${this.linkStyle()}margin-top:16px;">back</button>
    `;
    document.getElementById("auth-submit")!.addEventListener("pointerdown", () => this.handleSignup());
    document.getElementById("auth-back")!.addEventListener("pointerdown", () => this.showMenu());
    this.addEnterKeyHandler("auth-confirm", () => this.handleSignup());
  }

  private async handleLogin(): Promise<void> {
    const username = (document.getElementById("auth-username") as HTMLInputElement).value.trim();
    const password = (document.getElementById("auth-password") as HTMLInputElement).value;
    const errorEl = document.getElementById("auth-error")!;

    if (!username || !password) {
      errorEl.textContent = "please fill in all fields.";
      return;
    }
    if (/\s/.test(username) || /\s/.test(password)) {
      errorEl.textContent = "spaces are not allowed in username or password.";
      return;
    }

    if (!await this.checkServerHealth()) {
      errorEl.textContent = "game server is offline. try again later.";
      return;
    }

    // Supabase auth uses email — we construct a fake email from the username
    const email = `${username.toLowerCase()}@chess2d.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = "invalid username or password.";
      return;
    }

    this.enterGame(username);
  }

  private async handleSignup(): Promise<void> {
    const username = (document.getElementById("auth-username") as HTMLInputElement).value.trim();
    const password = (document.getElementById("auth-password") as HTMLInputElement).value;
    const confirm = (document.getElementById("auth-confirm") as HTMLInputElement).value;
    const errorEl = document.getElementById("auth-error")!;

    if (!username || !password || !confirm) {
      errorEl.textContent = "please fill in all fields.";
      return;
    }
    if (/\s/.test(username) || /\s/.test(password)) {
      errorEl.textContent = "spaces are not allowed in username or password.";
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = "passwords do not match.";
      return;
    }
    if (username.length < 3 || username.length > 20) {
      errorEl.textContent = "username must be 3-20 characters.";
      return;
    }
    if (containsBannedWord(username)) {
      errorEl.textContent = "that username is not allowed.";
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = "password must be at least 6 characters.";
      return;
    }

    if (!await this.checkServerHealth()) {
      errorEl.textContent = "game server is offline. try again later.";
      return;
    }

    const email = `${username.toLowerCase()}@chess2d.local`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        errorEl.textContent = "username already taken.";
      } else {
        errorEl.textContent = error.message;
      }
      return;
    }

    // Create profile row
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("profiles").insert({
        id: user.id,
        username,
        wins: 0,
        losses: 0,
        draws: 0,
      });
    }

    this.enterGame(username);
  }

  private async checkServerHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${COLYSEUS_URL}/health`, { signal: AbortSignal.timeout(3000) });
      return res.ok;
    } catch {
      return false;
    }
  }

  private enterGame(username: string): void {
    this.formContainer?.remove();
    this.scene.start("OverworldScene", { username });
    this.scene.launch("UIScene", { username });
  }

  private addEnterKeyHandler(lastFieldId: string, handler: () => void): void {
    document.getElementById(lastFieldId)!.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handler();
    });
  }

  private buttonStyle(): string {
    return `
      background:#fff;
      color:#000;
      border:2px solid #fff;
      padding:14px 48px;
      font-family:'Foxwhelp',sans-serif;
      font-size:32px;
      border-radius:8px;
      cursor:pointer;
      min-width:240px;
    `.replace(/\n\s*/g, "");
  }

  private inputStyle(): string {
    return `
      background:#1a1a2e;
      color:#fff;
      border:1px solid #444;
      padding:12px 16px;
      font-size:22px;
      border-radius:6px;
      min-width:320px;
      outline:none;
      font-family:inherit;
    `.replace(/\n\s*/g, "");
  }

  private linkStyle(): string {
    return `
      background:none;
      color:#999;
      border:none;
      font-size:20px;
      cursor:pointer;
      text-decoration:underline;
      font-family:inherit;
    `.replace(/\n\s*/g, "");
  }
}
