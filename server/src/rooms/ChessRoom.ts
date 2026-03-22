import { Room, Client } from "colyseus";
import { Chess } from "chess.js";
import { ChessState, ChatMessage } from "../schema/ChessState";
import { MSG } from "chess2d-shared/protocol";
import { censorText } from "chess2d-shared/wordFilter";
import type { ChessColor, GameResult, EndReason, GameOverData } from "chess2d-shared/chessTypes";
import { getSupabaseAdmin } from "../db/supabaseAdmin";
import { pickNpcMove } from "../npc/npcChessAI";
import { NPC_LIST, type NpcDialogue } from "../npc/npcData";
import { SCENARIO_REWARDS } from "../npc/scenarioRewards";

const NPC_MOVE_DELAY_MIN = 500;
const NPC_MOVE_DELAY_MAX = 2000;
const NPC_CHAT_COOLDOWN_MS = 8000;

interface NpcJoinOptions {
  username?: string;
  color?: string;
  isNpc?: boolean;
  npcId?: string;
  fen?: string;
}

export class ChessRoom extends Room<ChessState> {
  private chess!: Chess;
  private whiteSessionId = "";
  private blackSessionId = "";
  private spectators = new Set<string>();
  private gameOver = false;

  // NPC mode fields
  private npcMode = false;
  private npcColor: ChessColor = "b";
  private npcSkillLevel = 3;
  private npcUsername = "";
  private npcDialogue: NpcDialogue = {};
  private npcScenarioId = "";
  private lastNpcChatTime = 0;

  onCreate(): void {
    this.setState(new ChessState());
    this.chess = new Chess();
    this.maxClients = 50; // 2 players + spectators

    this.onMessage(MSG.CHESS_MOVE, (client, data: { from: string; to: string; promotion?: string }) => {
      if (this.gameOver) return;

      // Validate it's this player's turn
      const isWhite = client.sessionId === this.whiteSessionId;
      const isBlack = client.sessionId === this.blackSessionId;
      if (!isWhite && !isBlack) return;
      if ((this.chess.turn() === "w" && !isWhite) || (this.chess.turn() === "b" && !isBlack)) return;

      try {
        const move = this.chess.move({
          from: data.from,
          to: data.to,
          promotion: data.promotion,
        });

        if (!move) return;

        this.state.fen = this.chess.fen();
        this.state.turn = this.chess.turn();

        // Broadcast move to opponent and spectators
        this.broadcast(MSG.CHESS_MOVE, {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        }, { except: client });

        // Check for game end
        this.checkGameEnd();

        // In NPC mode, schedule the NPC's reply
        if (this.npcMode && !this.gameOver && this.chess.turn() === this.npcColor) {
          this.scheduleNpcMove();
        }
      } catch {
        // Invalid move — ignore
      }
    });

    this.onMessage(MSG.CHESS_RESIGN, (client) => {
      if (this.gameOver) return;
      const isWhite = client.sessionId === this.whiteSessionId;
      const result: GameResult = isWhite ? "black_win" : "white_win";
      this.endGame(result, "resignation");
    });

    this.onMessage(MSG.CHESS_DRAW_OFFER, (client) => {
      if (this.gameOver) return;
      // NPC never accepts draws
      if (this.npcMode) {
        client.send(MSG.CHESS_DRAW_RESPONSE, { accepted: false });
        return;
      }
      const isWhite = client.sessionId === this.whiteSessionId;
      const targetId = isWhite ? this.blackSessionId : this.whiteSessionId;
      const targetClient = this.clients.find((c) => c.sessionId === targetId);
      if (targetClient) {
        targetClient.send(MSG.CHESS_DRAW_OFFER, {
          fromUsername: isWhite ? this.state.whiteUsername : this.state.blackUsername,
        });
      }
    });

    this.onMessage(MSG.CHESS_DRAW_RESPONSE, (client, data: { accepted: boolean }) => {
      if (this.gameOver) return;
      if (data.accepted) {
        this.endGame("draw", "draw_agreement");
      } else {
        const isWhite = client.sessionId === this.whiteSessionId;
        const targetId = isWhite ? this.blackSessionId : this.whiteSessionId;
        const targetClient = this.clients.find((c) => c.sessionId === targetId);
        if (targetClient) {
          targetClient.send(MSG.CHESS_DRAW_RESPONSE, { accepted: false });
        }
      }
    });

    this.onMessage(MSG.CHESS_CHAT, (client, data: { text: string }) => {
      const isWhite = client.sessionId === this.whiteSessionId;
      const isBlack = client.sessionId === this.blackSessionId;
      const isSpectator = this.spectators.has(client.sessionId);

      if (!isWhite && !isBlack && !isSpectator) return;

      let username = "Spectator";
      if (isWhite) username = this.state.whiteUsername;
      else if (isBlack) username = this.state.blackUsername;

      const msg = new ChatMessage();
      msg.username = username;
      msg.text = censorText(data.text.substring(0, 200));
      this.state.chatHistory.push(msg);

      this.broadcast(MSG.CHESS_CHAT, { username, text: msg.text });
    });
  }

  onJoin(client: Client, options: NpcJoinOptions): void {
    // Set up NPC mode on first join if flagged
    if (options.isNpc && options.npcId && !this.npcMode) {
      this.setupNpcMode(options);
    }

    if (!this.whiteSessionId && options.color === "w") {
      this.whiteSessionId = client.sessionId;
      this.state.whitePlayer = client.sessionId;
      this.state.whiteUsername = options.username || "White";
    } else if (!this.blackSessionId && options.color === "b") {
      this.blackSessionId = client.sessionId;
      this.state.blackPlayer = client.sessionId;
      this.state.blackUsername = options.username || "Black";
    } else {
      // Spectator
      this.spectators.add(client.sessionId);
    }

    // If NPC mode and NPC moves first, schedule its move
    if (this.npcMode && this.chess.turn() === this.npcColor) {
      // Send game start dialogue
      this.npcChat(this.npcDialogue.onGameStart);
      this.scheduleNpcMove();
    } else if (this.npcMode && this.npcDialogue.onGameStart) {
      // Player moves first, still send greeting
      this.npcChat(this.npcDialogue.onGameStart);
    }
  }

  onLeave(client: Client): void {
    if (this.spectators.has(client.sessionId)) {
      this.spectators.delete(client.sessionId);
      return;
    }

    if (this.gameOver) return;

    // Player left — opponent wins by resignation
    const isWhite = client.sessionId === this.whiteSessionId;
    const result: GameResult = isWhite ? "black_win" : "white_win";
    this.endGame(result, "resignation");
  }

  private setupNpcMode(options: NpcJoinOptions): void {
    const npcDef = NPC_LIST.find((n) => n.id === options.npcId);
    if (!npcDef) return;

    this.npcMode = true;
    this.npcSkillLevel = npcDef.skillLevel;
    this.npcUsername = npcDef.username;
    this.npcDialogue = npcDef.dialogue;
    this.npcScenarioId = npcDef.scenarioId ?? "";

    // Player is white, NPC is black
    this.npcColor = "b";
    this.blackSessionId = `npc_${npcDef.id}`;
    this.state.blackPlayer = this.blackSessionId;
    this.state.blackUsername = npcDef.username;

    // Custom FEN for scenarios
    if (options.fen) {
      this.chess = new Chess(options.fen);
      this.state.fen = options.fen;
      this.state.turn = this.chess.turn();
    }

    console.log(`[chess] NPC mode: ${npcDef.username} (skill ${npcDef.skillLevel})`);
  }

  private scheduleNpcMove(): void {
    const delay = NPC_MOVE_DELAY_MIN + Math.random() * (NPC_MOVE_DELAY_MAX - NPC_MOVE_DELAY_MIN);
    setTimeout(() => {
      if (this.gameOver) return;

      try {
        const moveData = pickNpcMove(this.chess, this.npcSkillLevel);
        const move = this.chess.move(moveData);
        if (!move) return;

        this.state.fen = this.chess.fen();
        this.state.turn = this.chess.turn();

        this.broadcast(MSG.CHESS_MOVE, {
          from: move.from,
          to: move.to,
          promotion: move.promotion,
        });

        this.maybeNpcChat(move);
        this.checkGameEnd();
      } catch (err) {
        console.error("[chess] NPC move error:", err);
      }
    }, delay);
  }

  private maybeNpcChat(move: { captured?: string | null }): void {
    const now = Date.now();
    if (now - this.lastNpcChatTime < NPC_CHAT_COOLDOWN_MS) return;

    if (this.chess.isCheck() && this.npcDialogue.onCheck) {
      this.npcChat(this.npcDialogue.onCheck);
    } else if (move.captured && this.npcDialogue.onCapture) {
      this.npcChat(this.npcDialogue.onCapture);
    }
  }

  private npcChat(text?: string): void {
    if (!text) return;
    this.lastNpcChatTime = Date.now();

    const msg = new ChatMessage();
    msg.username = this.npcUsername;
    msg.text = text;
    this.state.chatHistory.push(msg);

    this.broadcast(MSG.CHESS_CHAT, { username: this.npcUsername, text });
  }

  private checkGameEnd(): void {
    if (this.chess.isCheckmate()) {
      const result: GameResult = this.chess.turn() === "w" ? "black_win" : "white_win";
      this.endGame(result, "checkmate");
    } else if (this.chess.isStalemate()) {
      this.endGame("draw", "stalemate");
    } else if (this.chess.isThreefoldRepetition()) {
      this.endGame("draw", "threefold");
    } else if (this.chess.isDraw()) {
      // Covers 50-move rule and insufficient material
      if (this.chess.isInsufficientMaterial()) {
        this.endGame("draw", "insufficient");
      } else {
        this.endGame("draw", "fifty_move");
      }
    }
  }

  private endGame(result: GameResult, reason: EndReason): void {
    if (this.gameOver) return;
    this.gameOver = true;

    this.state.result = result;
    this.state.endReason = reason;

    // Check if this is a scenario win that grants a reward
    const humanWon = this.npcMode && (
      (this.npcColor === "b" && result === "white_win") ||
      (this.npcColor === "w" && result === "black_win")
    );
    const reward = humanWon && this.npcScenarioId
      ? SCENARIO_REWARDS[this.npcScenarioId]
      : undefined;

    const gameOverData: GameOverData = { result, reason, reward };
    this.broadcast(MSG.CHESS_GAME_OVER, gameOverData);

    // Record to database
    this.recordGameResult(result, reason, reward).catch(console.error);

    // Auto-dispose after a delay so clients can process
    setTimeout(() => {
      this.disconnect();
    }, 5000);
  }

  private async recordGameResult(
    result: GameResult,
    reason: EndReason,
    reward?: { type: string; name: string }
  ): Promise<void> {
    try {
      const sb = getSupabaseAdmin();

      // Record the game
      await sb.from("game_results").insert({
        white_username: this.state.whiteUsername,
        black_username: this.state.blackUsername,
        result,
        pgn: this.chess.pgn(),
        end_reason: reason,
        ...(this.npcMode ? { is_npc: true } : {}),
      });

      if (this.npcMode) {
        // Only update the human player's NPC stats
        const humanUsername = this.npcColor === "b" ? this.state.whiteUsername : this.state.blackUsername;
        const humanIsWhite = this.npcColor === "b";
        const humanWon = (humanIsWhite && result === "white_win") || (!humanIsWhite && result === "black_win");
        const humanLost = (humanIsWhite && result === "black_win") || (!humanIsWhite && result === "white_win");

        if (humanWon) {
          await sb.rpc("increment_npc_wins", { player_username: humanUsername });
        } else if (humanLost) {
          await sb.rpc("increment_npc_losses", { player_username: humanUsername });
        } else {
          await sb.rpc("increment_npc_draws", { player_username: humanUsername });
        }

        // Record scenario completion + unlock reward
        if (reward && this.npcScenarioId && humanWon) {
          console.log(`[chess] scenario ${this.npcScenarioId} won by ${humanUsername}, reward: ${reward.type}/${reward.name}`);

          await sb.from("scenario_completions").upsert(
            { username: humanUsername, scenario_id: this.npcScenarioId },
            { onConflict: "username,scenario_id" }
          ).then(({ error }) => { if (error) console.error("[chess] scenario_completions upsert failed:", error); });

          if (reward.type === "shape") {
            const { data: profile, error: selectErr } = await sb
              .from("profiles").select("unlocked_shapes").eq("username", humanUsername).single();
            if (selectErr) {
              console.warn(`[chess] no profile for ${humanUsername} — DB unlock skipped (client fallback will handle)`);
            } else if (profile) {
              const current: string[] = profile.unlocked_shapes || [];
              if (!current.includes(reward.name)) {
                const { error: updateErr } = await sb.from("profiles")
                  .update({ unlocked_shapes: [...current, reward.name] }).eq("username", humanUsername);
                if (updateErr) console.error(`[chess] failed to update unlocked_shapes:`, updateErr);
                else console.log(`[chess] unlocked ${reward.name} for ${humanUsername}`);
              }
            }
          } else if (reward.type === "effect") {
            const { data: profile, error: selectErr } = await sb
              .from("profiles").select("unlocked_effects").eq("username", humanUsername).single();
            if (selectErr) {
              console.warn(`[chess] no profile for ${humanUsername} — DB unlock skipped (client fallback will handle)`);
            } else if (profile) {
              const current: string[] = profile.unlocked_effects || [];
              if (!current.includes(reward.name)) {
                const { error: updateErr } = await sb.from("profiles")
                  .update({ unlocked_effects: [...current, reward.name] }).eq("username", humanUsername);
                if (updateErr) console.error(`[chess] failed to update unlocked_effects:`, updateErr);
                else console.log(`[chess] unlocked ${reward.name} for ${humanUsername}`);
              }
            }
          }
        }
      } else {
        // PvP stats
        if (result === "white_win") {
          await getSupabaseAdmin().rpc("increment_wins", { player_username: this.state.whiteUsername });
          await getSupabaseAdmin().rpc("increment_losses", { player_username: this.state.blackUsername });
        } else if (result === "black_win") {
          await getSupabaseAdmin().rpc("increment_wins", { player_username: this.state.blackUsername });
          await getSupabaseAdmin().rpc("increment_losses", { player_username: this.state.whiteUsername });
        } else {
          await getSupabaseAdmin().rpc("increment_draws", { player_username: this.state.whiteUsername });
          await getSupabaseAdmin().rpc("increment_draws", { player_username: this.state.blackUsername });
        }
      }
    } catch (err) {
      console.error("Failed to record game result:", err);
    }
  }
}
