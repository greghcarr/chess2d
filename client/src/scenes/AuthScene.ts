import Phaser from "phaser";
import { supabase } from "@/utils/supabaseClient.js";
import { BASE_WIDTH, BASE_HEIGHT, VERSION } from "@/constants.js";

type AuthMode = "menu" | "login" | "signup";

export class AuthScene extends Phaser.Scene {
  private formContainer!: HTMLDivElement;
  private mode: AuthMode = "menu";

  constructor() {
    super({ key: "AuthScene" });
  }

  create(): void {
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
      justifyContent: "center",
      fontFamily: "'Segoe UI', Arial, sans-serif",
      color: "#fff",
      pointerEvents: "auto",
      zIndex: "10",
    });
    document.getElementById("game-container")!.appendChild(this.formContainer);

    this.showMenu();

    // Version label
    this.add
      .text(BASE_WIDTH - 16, BASE_HEIGHT - 16, `v${VERSION}`, {
        fontSize: "16px",
        color: "#999999",
        fontFamily: "monospace",
      })
      .setOrigin(1, 1);
  }

  private showMenu(): void {
    this.mode = "menu";
    this.formContainer.innerHTML = `
      <h1 style="font-size:72px;margin-bottom:8px;letter-spacing:4px;">Chess2D</h1>
      <p style="color:#999;margin-bottom:48px;font-size:18px;">MMO Chess in the Browser</p>
      <button id="auth-login" style="${this.buttonStyle()}">Log In</button>
      <button id="auth-signup" style="${this.buttonStyle()}margin-top:16px;">Sign Up</button>
    `;
    document.getElementById("auth-login")!.addEventListener("pointerdown", () => this.showLogin());
    document.getElementById("auth-signup")!.addEventListener("pointerdown", () => this.showSignup());
  }

  private showLogin(): void {
    this.mode = "login";
    this.formContainer.innerHTML = `
      <h2 style="font-size:36px;margin-bottom:32px;">Log In</h2>
      <input id="auth-username" type="text" placeholder="Username" style="${this.inputStyle()}" />
      <input id="auth-password" type="password" placeholder="Password" style="${this.inputStyle()}margin-top:12px;" />
      <p id="auth-error" style="color:#ff6b6b;margin-top:12px;min-height:20px;font-size:14px;"></p>
      <button id="auth-submit" style="${this.buttonStyle()}margin-top:8px;">Log In</button>
      <button id="auth-back" style="${this.linkStyle()}margin-top:16px;">Back</button>
    `;
    document.getElementById("auth-submit")!.addEventListener("pointerdown", () => this.handleLogin());
    document.getElementById("auth-back")!.addEventListener("pointerdown", () => this.showMenu());
    this.addEnterKeyHandler("auth-password", () => this.handleLogin());
  }

  private showSignup(): void {
    this.mode = "signup";
    this.formContainer.innerHTML = `
      <h2 style="font-size:36px;margin-bottom:32px;">Sign Up</h2>
      <input id="auth-username" type="text" placeholder="Username" style="${this.inputStyle()}" />
      <input id="auth-password" type="password" placeholder="Password" style="${this.inputStyle()}margin-top:12px;" />
      <input id="auth-confirm" type="password" placeholder="Confirm Password" style="${this.inputStyle()}margin-top:12px;" />
      <p id="auth-error" style="color:#ff6b6b;margin-top:12px;min-height:20px;font-size:14px;"></p>
      <button id="auth-submit" style="${this.buttonStyle()}margin-top:8px;">Sign Up</button>
      <button id="auth-back" style="${this.linkStyle()}margin-top:16px;">Back</button>
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
      errorEl.textContent = "Please fill in all fields.";
      return;
    }

    // Supabase auth uses email — we construct a fake email from the username
    const email = `${username.toLowerCase()}@chess2d.local`;
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      errorEl.textContent = "Invalid username or password.";
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
      errorEl.textContent = "Please fill in all fields.";
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = "Passwords do not match.";
      return;
    }
    if (username.length < 3 || username.length > 20) {
      errorEl.textContent = "Username must be 3-20 characters.";
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = "Password must be at least 6 characters.";
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
        errorEl.textContent = "Username already taken.";
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

  private enterGame(username: string): void {
    this.formContainer.remove();
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
      background:#3399ff;
      color:#fff;
      border:none;
      padding:14px 48px;
      font-size:18px;
      border-radius:8px;
      cursor:pointer;
      min-width:240px;
      font-family:inherit;
    `.replace(/\n\s*/g, "");
  }

  private inputStyle(): string {
    return `
      background:#1a1a2e;
      color:#fff;
      border:1px solid #444;
      padding:12px 16px;
      font-size:16px;
      border-radius:6px;
      min-width:280px;
      outline:none;
      font-family:inherit;
    `.replace(/\n\s*/g, "");
  }

  private linkStyle(): string {
    return `
      background:none;
      color:#999;
      border:none;
      font-size:14px;
      cursor:pointer;
      text-decoration:underline;
      font-family:inherit;
    `.replace(/\n\s*/g, "");
  }
}
