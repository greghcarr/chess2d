import { Room, Client } from "colyseus";
import { Chess } from "chess.js";
import { ChessState, ChatMessage } from "../schema/ChessState.js";
import { MSG } from "chess2d-shared/protocol.js";
import type { GameResult, EndReason, GameOverData } from "chess2d-shared/chessTypes.js";
import { supabaseAdmin } from "../db/supabaseAdmin.js";

export class ChessRoom extends Room<ChessState> {
  private chess!: Chess;
  private whiteSessionId = "";
  private blackSessionId = "";
  private spectators = new Set<string>();
  private gameOver = false;

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
      msg.text = data.text.substring(0, 200);
      this.state.chatHistory.push(msg);

      this.broadcast(MSG.CHESS_CHAT, { username, text: msg.text });
    });
  }

  onJoin(client: Client, options: { username?: string; color?: string }): void {
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

    const gameOverData: GameOverData = { result, reason };
    this.broadcast(MSG.CHESS_GAME_OVER, gameOverData);

    // Record to database
    this.recordGameResult(result, reason).catch(console.error);

    // Auto-dispose after a delay so clients can process
    setTimeout(() => {
      this.disconnect();
    }, 5000);
  }

  private async recordGameResult(result: GameResult, reason: EndReason): Promise<void> {
    try {
      // Record the game
      await supabaseAdmin.from("game_results").insert({
        white_username: this.state.whiteUsername,
        black_username: this.state.blackUsername,
        result,
        pgn: this.chess.pgn(),
        end_reason: reason,
      });

      // Update player stats
      if (result === "white_win") {
        await supabaseAdmin.rpc("increment_wins", { player_username: this.state.whiteUsername });
        await supabaseAdmin.rpc("increment_losses", { player_username: this.state.blackUsername });
      } else if (result === "black_win") {
        await supabaseAdmin.rpc("increment_wins", { player_username: this.state.blackUsername });
        await supabaseAdmin.rpc("increment_losses", { player_username: this.state.whiteUsername });
      } else {
        await supabaseAdmin.rpc("increment_draws", { player_username: this.state.whiteUsername });
        await supabaseAdmin.rpc("increment_draws", { player_username: this.state.blackUsername });
      }
    } catch (err) {
      console.error("Failed to record game result:", err);
    }
  }
}
