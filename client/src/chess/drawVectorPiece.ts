import Phaser from "phaser";
import { COLOR_CHESS_WHITE_PIECE, COLOR_CHESS_BLACK_PIECE } from "@/constants.js";

type PieceType = "p" | "r" | "n" | "b" | "q" | "k";

export function drawPiece(
  graphics: Phaser.GameObjects.Graphics,
  type: PieceType,
  color: "w" | "b",
  cx: number,
  cy: number,
  squareSize: number
): void {
  const PIECE_SIZE = squareSize * 0.7;
  const HALF = PIECE_SIZE / 2;
  const fill = color === "w" ? COLOR_CHESS_WHITE_PIECE : COLOR_CHESS_BLACK_PIECE;
  const outline = color === "w" ? 0x333333 : 0xcccccc;

  graphics.lineStyle(2, outline, 1);
  graphics.fillStyle(fill, 1);

  switch (type) {
    case "p": drawPawn(graphics, cx, cy, HALF); break;
    case "r": drawRook(graphics, cx, cy, HALF); break;
    case "n": drawKnight(graphics, cx, cy, HALF); break;
    case "b": drawBishop(graphics, cx, cy, HALF); break;
    case "q": drawQueen(graphics, cx, cy, HALF); break;
    case "k": drawKing(graphics, cx, cy, HALF); break;
  }
}

function drawPawn(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.fillRect(cx - H * 0.15, cy - H * 0.1, H * 0.3, H * 0.5);
  g.fillCircle(cx, cy - H * 0.3, H * 0.3);
  g.strokeCircle(cx, cy - H * 0.3, H * 0.3);
}

function drawRook(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.fillRect(cx - H * 0.4, cy - H * 0.3, H * 0.8, H * 0.7);
  g.strokeRect(cx - H * 0.4, cy - H * 0.3, H * 0.8, H * 0.7);
  const bw = H * 0.2;
  g.fillRect(cx - H * 0.5, cy - H * 0.6, bw, H * 0.35);
  g.strokeRect(cx - H * 0.5, cy - H * 0.6, bw, H * 0.35);
  g.fillRect(cx - bw / 2, cy - H * 0.6, bw, H * 0.35);
  g.strokeRect(cx - bw / 2, cy - H * 0.6, bw, H * 0.35);
  g.fillRect(cx + H * 0.5 - bw, cy - H * 0.6, bw, H * 0.35);
  g.strokeRect(cx + H * 0.5 - bw, cy - H * 0.6, bw, H * 0.35);
}

function drawKnight(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.fillRect(cx - H * 0.3, cy - H * 0.1, H * 0.6, H * 0.5);
  g.fillTriangle(cx - H * 0.3, cy - H * 0.1, cx + H * 0.3, cy - H * 0.1, cx + H * 0.1, cy - H * 0.65);
  g.strokeTriangle(cx - H * 0.3, cy - H * 0.1, cx + H * 0.3, cy - H * 0.1, cx + H * 0.1, cy - H * 0.65);
  g.fillStyle(g.defaultStrokeColor as number, 1);
  g.fillCircle(cx + H * 0.05, cy - H * 0.3, 2);
  g.fillStyle(g.defaultFillColor as number, 1);
}

function drawBishop(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.5, cy + H * 0.3, H, H * 0.35, 3);
  g.fillTriangle(cx - H * 0.4, cy + H * 0.3, cx + H * 0.4, cy + H * 0.3, cx, cy - H * 0.45);
  g.strokeTriangle(cx - H * 0.4, cy + H * 0.3, cx + H * 0.4, cy + H * 0.3, cx, cy - H * 0.45);
  g.fillCircle(cx, cy - H * 0.55, H * 0.15);
  g.strokeCircle(cx, cy - H * 0.55, H * 0.15);
}

function drawQueen(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.fillTriangle(cx - H * 0.5, cy + H * 0.3, cx + H * 0.5, cy + H * 0.3, cx, cy - H * 0.3);
  g.strokeTriangle(cx - H * 0.5, cy + H * 0.3, cx + H * 0.5, cy + H * 0.3, cx, cy - H * 0.3);
  for (const px of [-0.4, -0.15, 0, 0.15, 0.4]) {
    g.fillCircle(cx + H * px, cy - H * 0.45, H * 0.1);
    g.strokeCircle(cx + H * px, cy - H * 0.45, H * 0.1);
  }
}

function drawKing(g: Phaser.GameObjects.Graphics, cx: number, cy: number, H: number): void {
  g.fillRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.strokeRoundedRect(cx - H * 0.6, cy + H * 0.3, H * 1.2, H * 0.35, 3);
  g.fillTriangle(cx - H * 0.5, cy + H * 0.3, cx + H * 0.5, cy + H * 0.3, cx, cy - H * 0.2);
  g.strokeTriangle(cx - H * 0.5, cy + H * 0.3, cx + H * 0.5, cy + H * 0.3, cx, cy - H * 0.2);
  const crossCy = cy - H * 0.5;
  g.fillRect(cx - 2, crossCy - H * 0.2, 4, H * 0.35);
  g.fillRect(cx - H * 0.15, crossCy - H * 0.1, H * 0.3, 4);
  g.strokeRect(cx - 2, crossCy - H * 0.2, 4, H * 0.35);
  g.strokeRect(cx - H * 0.15, crossCy - H * 0.1, H * 0.3, 4);
}
