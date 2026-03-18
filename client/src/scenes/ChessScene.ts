import Phaser from "phaser";
import { Chess, type Square, type Move } from "chess.js";
import { colyseusClient } from "@/network/colyseusClient.js";
import { MSG } from "chess2d-shared/protocol.js";
import { drawPiece } from "@/chess/drawVectorPiece.js";
import {
  CHESS_SQUARE_SIZE,
  CHESS_BOARD_SIZE,
  COLOR_CHESS_LIGHT,
  COLOR_CHESS_DARK,
  COLOR_CHESS_HIGHLIGHT,
  BASE_WIDTH,
  BASE_HEIGHT,
  CHAT_FONT_SIZE,
} from "@/constants.js";
import { LAYER } from "@/layers.js";
import type { Room } from "colyseus.js";
import type { ChessColor, GameOverData } from "chess2d-shared/chessTypes.js";

export class ChessScene extends Phaser.Scene {
  private chess!: Chess;
  private room: Room | null = null;
  private playerColor: ChessColor = "w";
  private opponentUsername = "";
  private username = "";

  private boardGraphics!: Phaser.GameObjects.Graphics;
  private pieceGraphics!: Phaser.GameObjects.Graphics;
  private highlightGraphics!: Phaser.GameObjects.Graphics;

  private boardX = 0;
  private boardY = 0;
  private selectedSquare: Square | null = null;
  private legalMoves: Move[] = [];

  private capturedWhite: string[] = [];
  private capturedBlack: string[] = [];
  private capturedText!: Phaser.GameObjects.Text;
  private capturedTextOpponent!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;

  private chatMessages: string[] = [];
  private chatTextObj!: Phaser.GameObjects.Text;
  private chatInput!: HTMLInputElement;

  constructor() {
    super({ key: "ChessScene" });
  }

  init(data: { roomId: string; color: string; opponentUsername: string; username: string }): void {
    this.playerColor = data.color as ChessColor;
    this.opponentUsername = data.opponentUsername;
    this.username = data.username;
  }

  create(): void {
    this.chess = new Chess();
    this.capturedWhite = [];
    this.capturedBlack = [];
    this.chatMessages = [];
    this.selectedSquare = null;
    this.legalMoves = [];

    // Dark background overlay
    this.add
      .rectangle(BASE_WIDTH / 2, BASE_HEIGHT / 2, BASE_WIDTH, BASE_HEIGHT, 0x000000, 0.85)
      .setDepth(LAYER.CHESSBOARD - 1)
      .setScrollFactor(0);

    // Center the board
    this.boardX = (BASE_WIDTH - CHESS_BOARD_SIZE) / 2;
    this.boardY = (BASE_HEIGHT - CHESS_BOARD_SIZE) / 2 - 40;

    this.boardGraphics = this.add.graphics().setDepth(LAYER.CHESSBOARD).setScrollFactor(0);
    this.highlightGraphics = this.add.graphics().setDepth(LAYER.CHESSBOARD + 1).setScrollFactor(0);
    this.pieceGraphics = this.add.graphics().setDepth(LAYER.CHESS_PIECES).setScrollFactor(0);

    this.drawBoard();
    this.drawPieces();

    // Status text (whose turn, check, etc.)
    this.statusText = this.add
      .text(BASE_WIDTH / 2, this.boardY - 30, this.getStatusText(), {
        fontSize: "20px",
        color: "#ffffff",
        fontFamily: "monospace",
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(LAYER.CHESS_PIECES + 1)
      .setScrollFactor(0);

    // Player labels
    const bottomLabel = this.playerColor === "w" ? this.username : this.opponentUsername;
    const topLabel = this.playerColor === "w" ? this.opponentUsername : this.username;

    this.add
      .text(this.boardX, this.boardY + CHESS_BOARD_SIZE + 12, bottomLabel, {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setDepth(LAYER.CHESS_PIECES + 1)
      .setScrollFactor(0);

    this.add
      .text(this.boardX, this.boardY - 16, topLabel, {
        fontSize: "16px",
        color: "#ffffff",
        fontFamily: "monospace",
      })
      .setOrigin(0, 1)
      .setDepth(LAYER.CHESS_PIECES + 1)
      .setScrollFactor(0);

    // Captured pieces display
    this.capturedText = this.add
      .text(this.boardX + CHESS_BOARD_SIZE + 20, this.boardY + CHESS_BOARD_SIZE - 20, "", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        wordWrap: { width: 200 },
      })
      .setOrigin(0, 1)
      .setDepth(LAYER.CHESS_PIECES + 1)
      .setScrollFactor(0);

    this.capturedTextOpponent = this.add
      .text(this.boardX + CHESS_BOARD_SIZE + 20, this.boardY + 20, "", {
        fontSize: "18px",
        color: "#ffffff",
        fontFamily: "monospace",
        wordWrap: { width: 200 },
      })
      .setDepth(LAYER.CHESS_PIECES + 1)
      .setScrollFactor(0);

    // Battle chat
    this.chatTextObj = this.add
      .text(16, BASE_HEIGHT - 200, "", {
        fontSize: `${CHAT_FONT_SIZE}px`,
        color: "#aaaaff",
        fontFamily: "monospace",
        wordWrap: { width: 350 },
        lineSpacing: 4,
      })
      .setOrigin(0, 1)
      .setDepth(LAYER.CHESS_PIECES + 2)
      .setScrollFactor(0);

    this.chatInput = document.createElement("input");
    this.chatInput.type = "text";
    this.chatInput.placeholder = "Battle chat...";
    this.chatInput.maxLength = 200;
    Object.assign(this.chatInput.style, {
      position: "absolute",
      bottom: "16px",
      left: "16px",
      width: "350px",
      padding: "8px 12px",
      background: "#1a1a3e",
      color: "#aaaaff",
      border: "1px solid #5555aa",
      borderRadius: "6px",
      fontSize: "14px",
      fontFamily: "monospace",
      outline: "none",
      zIndex: "10",
    });
    document.getElementById("game-container")!.appendChild(this.chatInput);

    this.chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && this.chatInput.value.trim()) {
        if (this.room) {
          this.room.send(MSG.CHESS_CHAT, { text: this.chatInput.value.trim() });
        }
        this.chatInput.value = "";
      }
      e.stopPropagation();
    });

    // Click on board squares
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.handleBoardClick(pointer.x, pointer.y);
    });

    this.connectToChessRoom();
  }

  private drawBoard(): void {
    const g = this.boardGraphics;
    g.clear();

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const isLight = (row + col) % 2 === 0;
        g.fillStyle(isLight ? COLOR_CHESS_LIGHT : COLOR_CHESS_DARK, 1);
        g.fillRect(
          this.boardX + col * CHESS_SQUARE_SIZE,
          this.boardY + row * CHESS_SQUARE_SIZE,
          CHESS_SQUARE_SIZE,
          CHESS_SQUARE_SIZE
        );
      }
    }

    // Board border
    g.lineStyle(3, 0x444444, 1);
    g.strokeRect(this.boardX, this.boardY, CHESS_BOARD_SIZE, CHESS_BOARD_SIZE);

    // Rank/file labels
    const files = "abcdefgh";
    const ranks = "87654321";
    const displayFiles = this.playerColor === "b" ? files.split("").reverse().join("") : files;
    const displayRanks = this.playerColor === "b" ? ranks.split("").reverse().join("") : ranks;

    for (let i = 0; i < 8; i++) {
      this.add
        .text(
          this.boardX + i * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2,
          this.boardY + CHESS_BOARD_SIZE + 4,
          displayFiles[i],
          { fontSize: "12px", color: "#888888", fontFamily: "monospace" }
        )
        .setOrigin(0.5, 0)
        .setDepth(LAYER.CHESS_PIECES + 1)
        .setScrollFactor(0);

      this.add
        .text(
          this.boardX - 12,
          this.boardY + i * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2,
          displayRanks[i],
          { fontSize: "12px", color: "#888888", fontFamily: "monospace" }
        )
        .setOrigin(0.5, 0.5)
        .setDepth(LAYER.CHESS_PIECES + 1)
        .setScrollFactor(0);
    }
  }

  private drawPieces(): void {
    const g = this.pieceGraphics;
    g.clear();

    const board = this.chess.board();
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) continue;

        const { displayRow, displayCol } = this.toDisplayCoords(row, col);
        const cx = this.boardX + displayCol * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2;
        const cy = this.boardY + displayRow * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2;

        drawPiece(g, piece.type, piece.color, cx, cy);
      }
    }
  }

  private drawHighlights(): void {
    const g = this.highlightGraphics;
    g.clear();

    if (!this.selectedSquare) return;

    // Highlight selected square
    const { row: selRow, col: selCol } = this.squareToRowCol(this.selectedSquare);
    const { displayRow: sr, displayCol: sc } = this.toDisplayCoords(selRow, selCol);
    g.fillStyle(COLOR_CHESS_HIGHLIGHT, 0.5);
    g.fillRect(
      this.boardX + sc * CHESS_SQUARE_SIZE,
      this.boardY + sr * CHESS_SQUARE_SIZE,
      CHESS_SQUARE_SIZE,
      CHESS_SQUARE_SIZE
    );

    // Highlight legal move targets
    for (const move of this.legalMoves) {
      const { row, col } = this.squareToRowCol(move.to as Square);
      const { displayRow: dr, displayCol: dc } = this.toDisplayCoords(row, col);
      g.fillStyle(COLOR_CHESS_HIGHLIGHT, 0.3);
      g.fillCircle(
        this.boardX + dc * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2,
        this.boardY + dr * CHESS_SQUARE_SIZE + CHESS_SQUARE_SIZE / 2,
        CHESS_SQUARE_SIZE * 0.2
      );
    }
  }

  private handleBoardClick(screenX: number, screenY: number): void {
    const col = Math.floor((screenX - this.boardX) / CHESS_SQUARE_SIZE);
    const row = Math.floor((screenY - this.boardY) / CHESS_SQUARE_SIZE);

    if (col < 0 || col > 7 || row < 0 || row > 7) return;

    const { boardRow, boardCol } = this.fromDisplayCoords(row, col);
    const square = this.rowColToSquare(boardRow, boardCol);

    // If it's not our turn, ignore
    if (this.chess.turn() !== this.playerColor) return;

    if (this.selectedSquare) {
      // Try to make a move
      const move = this.legalMoves.find((m) => m.to === square);
      if (move) {
        this.makeMove(move);
      } else {
        // Select a different piece if it's ours
        const piece = this.chess.get(square);
        if (piece && piece.color === this.playerColor) {
          this.selectSquare(square);
        } else {
          this.clearSelection();
        }
      }
    } else {
      const piece = this.chess.get(square);
      if (piece && piece.color === this.playerColor) {
        this.selectSquare(square);
      }
    }
  }

  private selectSquare(square: Square): void {
    this.selectedSquare = square;
    this.legalMoves = this.chess.moves({ square, verbose: true });
    this.drawHighlights();
  }

  private clearSelection(): void {
    this.selectedSquare = null;
    this.legalMoves = [];
    this.drawHighlights();
  }

  private makeMove(move: Move): void {
    // Check for pawn promotion
    const promotion = move.flags.includes("p") ? "q" : undefined; // auto-queen for now

    if (this.room) {
      this.room.send(MSG.CHESS_MOVE, { from: move.from, to: move.to, promotion });
    }

    // Optimistic local update
    const result = this.chess.move({ from: move.from, to: move.to, promotion });
    if (result && result.captured) {
      if (result.color === "w") {
        this.capturedBlack.push(result.captured);
      } else {
        this.capturedWhite.push(result.captured);
      }
    }

    this.clearSelection();
    this.drawPieces();
    this.updateCapturedDisplay();
    this.statusText.setText(this.getStatusText());
  }

  private getStatusText(): string {
    if (this.chess.isCheckmate()) {
      const winner = this.chess.turn() === this.playerColor ? this.opponentUsername : this.username;
      return `Checkmate! ${winner} wins!`;
    }
    if (this.chess.isStalemate()) return "Stalemate - Draw!";
    if (this.chess.isThreefoldRepetition()) return "Threefold repetition - Draw!";
    if (this.chess.isDraw()) return "Draw!";
    if (this.chess.isCheck()) {
      return this.chess.turn() === this.playerColor ? "You are in check!" : "Opponent is in check!";
    }
    return this.chess.turn() === this.playerColor ? "Your turn" : "Opponent's turn";
  }

  private updateCapturedDisplay(): void {
    const pieceSymbols: Record<string, string> = {
      p: "P",
      r: "R",
      n: "N",
      b: "B",
      q: "Q",
    };

    // Our captured opponent pieces (shown on our side = right)
    const ourCaptures = this.playerColor === "w" ? this.capturedBlack : this.capturedWhite;
    const theirCaptures = this.playerColor === "w" ? this.capturedWhite : this.capturedBlack;

    this.capturedText.setText(ourCaptures.map((p) => pieceSymbols[p] || p).join(" "));
    this.capturedTextOpponent.setText(theirCaptures.map((p) => pieceSymbols[p] || p).join(" "));
  }

  private async connectToChessRoom(): Promise<void> {
    try {
      this.room = await colyseusClient.joinOrCreate("chess", {
        username: this.username,
        color: this.playerColor,
      });

      this.room.onMessage(MSG.CHESS_MOVE, (data: { from: string; to: string; promotion?: string }) => {
        // Apply opponent's move
        const result = this.chess.move({ from: data.from, to: data.to, promotion: data.promotion });
        if (result && result.captured) {
          if (result.color === "w") {
            this.capturedBlack.push(result.captured);
          } else {
            this.capturedWhite.push(result.captured);
          }
        }
        this.clearSelection();
        this.drawPieces();
        this.updateCapturedDisplay();
        this.statusText.setText(this.getStatusText());
      });

      this.room.onMessage(MSG.CHESS_GAME_OVER, (data: GameOverData) => {
        this.showGameOverDialog(data);
      });

      this.room.onMessage(MSG.CHESS_CHAT, (msg: { username: string; text: string }) => {
        this.chatMessages.push(`${msg.username}: ${msg.text}`);
        const visible = this.chatMessages.slice(-8);
        this.chatTextObj.setText(visible.join("\n"));
      });
    } catch (err) {
      console.error("Failed to join chess room:", err);
    }
  }

  private showGameOverDialog(data: GameOverData): void {
    let message: string;
    if (data.result === "draw") {
      message = `Draw by ${data.reason}!`;
    } else {
      const didWin =
        (data.result === "white_win" && this.playerColor === "w") ||
        (data.result === "black_win" && this.playerColor === "b");
      message = didWin ? "You win!" : "You lose!";
    }

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "absolute",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.6)",
      zIndex: "30",
    });

    const dialog = document.createElement("div");
    Object.assign(dialog.style, {
      background: "#1a1a2e",
      border: "2px solid #3399ff",
      borderRadius: "12px",
      padding: "32px 48px",
      textAlign: "center",
      color: "#fff",
      fontFamily: "'Segoe UI', Arial, sans-serif",
    });
    dialog.innerHTML = `
      <h2 style="font-size:32px;margin-bottom:12px;">${message}</h2>
      <p style="color:#999;margin-bottom:24px;">Reason: ${data.reason}</p>
      <button id="chess-exit" style="background:#3399ff;color:#fff;border:none;padding:12px 32px;border-radius:8px;cursor:pointer;font-size:18px;">Return to Overworld</button>
    `;
    overlay.appendChild(dialog);
    document.getElementById("game-container")!.appendChild(overlay);

    document.getElementById("chess-exit")!.addEventListener("pointerdown", () => {
      overlay.remove();
      this.exitChess();
    });
  }

  private exitChess(): void {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
    this.chatInput.remove();
    this.scene.stop();
    const overworld = this.scene.get("OverworldScene") as any;
    overworld.resumeFromChess();
  }

  // ── Coordinate helpers ────────────────────────────────

  private toDisplayCoords(boardRow: number, boardCol: number): { displayRow: number; displayCol: number } {
    if (this.playerColor === "w") {
      return { displayRow: boardRow, displayCol: boardCol };
    }
    return { displayRow: 7 - boardRow, displayCol: 7 - boardCol };
  }

  private fromDisplayCoords(displayRow: number, displayCol: number): { boardRow: number; boardCol: number } {
    if (this.playerColor === "w") {
      return { boardRow: displayRow, boardCol: displayCol };
    }
    return { boardRow: 7 - displayRow, boardCol: 7 - displayCol };
  }

  private squareToRowCol(square: Square): { row: number; col: number } {
    const col = square.charCodeAt(0) - 97; // 'a' = 0
    const row = 8 - parseInt(square[1]);
    return { row, col };
  }

  private rowColToSquare(row: number, col: number): Square {
    const file = String.fromCharCode(97 + col);
    const rank = (8 - row).toString();
    return `${file}${rank}` as Square;
  }
}
