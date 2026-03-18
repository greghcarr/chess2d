import Phaser from "phaser";
import { COLOR_CHESS_WHITE_PIECE, COLOR_CHESS_BLACK_PIECE, CHESS_SQUARE_SIZE } from "@/constants.js";

type PieceType = "p" | "r" | "n" | "b" | "q" | "k";

const PIECE_SIZE = CHESS_SQUARE_SIZE * 0.7;
const HALF = PIECE_SIZE / 2;

export function drawPiece(
  graphics: Phaser.GameObjects.Graphics,
  type: PieceType,
  color: "w" | "b",
  cx: number,
  cy: number
): void {
  const fill = color === "w" ? COLOR_CHESS_WHITE_PIECE : COLOR_CHESS_BLACK_PIECE;
  const outline = color === "w" ? 0x333333 : 0xcccccc;

  graphics.lineStyle(2, outline, 1);
  graphics.fillStyle(fill, 1);

  switch (type) {
    case "p":
      drawPawn(graphics, cx, cy);
      break;
    case "r":
      drawRook(graphics, cx, cy);
      break;
    case "n":
      drawKnight(graphics, cx, cy);
      break;
    case "b":
      drawBishop(graphics, cx, cy);
      break;
    case "q":
      drawQueen(graphics, cx, cy);
      break;
    case "k":
      drawKing(graphics, cx, cy);
      break;
  }
}

function drawPawn(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  // Stem
  g.fillRect(cx - HALF * 0.15, cy - HALF * 0.1, HALF * 0.3, HALF * 0.5);
  // Head
  g.fillCircle(cx, cy - HALF * 0.3, HALF * 0.3);
  g.strokeCircle(cx, cy - HALF * 0.3, HALF * 0.3);
}

function drawRook(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  // Body
  g.fillRect(cx - HALF * 0.4, cy - HALF * 0.3, HALF * 0.8, HALF * 0.7);
  g.strokeRect(cx - HALF * 0.4, cy - HALF * 0.3, HALF * 0.8, HALF * 0.7);
  // Battlements
  const bw = HALF * 0.2;
  g.fillRect(cx - HALF * 0.5, cy - HALF * 0.6, bw, HALF * 0.35);
  g.strokeRect(cx - HALF * 0.5, cy - HALF * 0.6, bw, HALF * 0.35);
  g.fillRect(cx - bw / 2, cy - HALF * 0.6, bw, HALF * 0.35);
  g.strokeRect(cx - bw / 2, cy - HALF * 0.6, bw, HALF * 0.35);
  g.fillRect(cx + HALF * 0.5 - bw, cy - HALF * 0.6, bw, HALF * 0.35);
  g.strokeRect(cx + HALF * 0.5 - bw, cy - HALF * 0.6, bw, HALF * 0.35);
}

function drawKnight(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  // Body
  g.fillRect(cx - HALF * 0.3, cy - HALF * 0.1, HALF * 0.6, HALF * 0.5);
  // Head (angled)
  g.fillTriangle(
    cx - HALF * 0.3, cy - HALF * 0.1,
    cx + HALF * 0.3, cy - HALF * 0.1,
    cx + HALF * 0.1, cy - HALF * 0.65
  );
  g.strokeTriangle(
    cx - HALF * 0.3, cy - HALF * 0.1,
    cx + HALF * 0.3, cy - HALF * 0.1,
    cx + HALF * 0.1, cy - HALF * 0.65
  );
  // Eye
  g.fillStyle(g.defaultStrokeColor as number, 1);
  g.fillCircle(cx + HALF * 0.05, cy - HALF * 0.3, 2);
  // Reset fill
  g.fillStyle(g.defaultFillColor as number, 1);
}

function drawBishop(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.5, cy + HALF * 0.3, HALF, HALF * 0.35, 3);
  // Body - tapered
  g.fillTriangle(
    cx - HALF * 0.4, cy + HALF * 0.3,
    cx + HALF * 0.4, cy + HALF * 0.3,
    cx, cy - HALF * 0.45
  );
  g.strokeTriangle(
    cx - HALF * 0.4, cy + HALF * 0.3,
    cx + HALF * 0.4, cy + HALF * 0.3,
    cx, cy - HALF * 0.45
  );
  // Top ball
  g.fillCircle(cx, cy - HALF * 0.55, HALF * 0.15);
  g.strokeCircle(cx, cy - HALF * 0.55, HALF * 0.15);
}

function drawQueen(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  // Body
  g.fillTriangle(
    cx - HALF * 0.5, cy + HALF * 0.3,
    cx + HALF * 0.5, cy + HALF * 0.3,
    cx, cy - HALF * 0.3
  );
  g.strokeTriangle(
    cx - HALF * 0.5, cy + HALF * 0.3,
    cx + HALF * 0.5, cy + HALF * 0.3,
    cx, cy - HALF * 0.3
  );
  // Crown points
  const pts = [-0.4, -0.15, 0, 0.15, 0.4];
  for (const px of pts) {
    g.fillCircle(cx + HALF * px, cy - HALF * 0.45, HALF * 0.1);
    g.strokeCircle(cx + HALF * px, cy - HALF * 0.45, HALF * 0.1);
  }
}

function drawKing(g: Phaser.GameObjects.Graphics, cx: number, cy: number): void {
  // Base
  g.fillRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  g.strokeRoundedRect(cx - HALF * 0.6, cy + HALF * 0.3, HALF * 1.2, HALF * 0.35, 3);
  // Body
  g.fillTriangle(
    cx - HALF * 0.5, cy + HALF * 0.3,
    cx + HALF * 0.5, cy + HALF * 0.3,
    cx, cy - HALF * 0.2
  );
  g.strokeTriangle(
    cx - HALF * 0.5, cy + HALF * 0.3,
    cx + HALF * 0.5, cy + HALF * 0.3,
    cx, cy - HALF * 0.2
  );
  // Cross on top
  const crossCy = cy - HALF * 0.5;
  g.fillRect(cx - 2, crossCy - HALF * 0.2, 4, HALF * 0.35);
  g.fillRect(cx - HALF * 0.15, crossCy - HALF * 0.1, HALF * 0.3, 4);
  g.strokeRect(cx - 2, crossCy - HALF * 0.2, 4, HALF * 0.35);
  g.strokeRect(cx - HALF * 0.15, crossCy - HALF * 0.1, HALF * 0.3, 4);
}
