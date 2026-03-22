import { PLAYER_RADIUS } from "@/constants.js";

const R = PLAYER_RADIUS;

/**
 * Draw a player shape (head + body) centered at (x, y).
 * Supports: circle (default), diamond, star, triangle.
 */
export function drawPlayerShape(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  shape: string,
  color: number,
  alpha: number = 1
): void {
  g.fillStyle(color, alpha);

  switch (shape) {
    case "diamond":
      drawDiamond(g, x, y);
      break;
    case "star":
      drawStar(g, x, y);
      break;
    case "triangle":
      drawTriangle(g, x, y);
      break;
    case "square":
      drawSquare(g, x, y);
      break;
    case "bishop":
      drawBishop(g, x, y);
      break;
    default:
      drawCircle(g, x, y);
      break;
  }
}

function drawCircle(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillCircle(x, y, R);
  g.fillRoundedRect(x - R * 0.6, y + R * 0.4, R * 1.2, R * 1.0, 4);
}

function drawDiamond(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillPoints([
    { x: x, y: y - R },
    { x: x + R, y: y },
    { x: x, y: y + R },
    { x: x - R, y: y },
  ], true);
  g.fillRoundedRect(x - R * 0.5, y + R * 0.6, R * 1.0, R * 0.8, 3);
}

function drawStar(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  const points: { x: number; y: number }[] = [];
  const outerR = R;
  const innerR = R * 0.45;
  for (let i = 0; i < 10; i++) {
    const angle = (Math.PI / 2) + (i * Math.PI) / 5;
    const r = i % 2 === 0 ? outerR : innerR;
    points.push({
      x: x + Math.cos(angle) * r,
      y: y - Math.sin(angle) * r,
    });
  }
  g.fillPoints(points, true);
  g.fillRoundedRect(x - R * 0.5, y + R * 0.5, R * 1.0, R * 0.8, 3);
}

function drawTriangle(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillPoints([
    { x: x, y: y - R },
    { x: x + R, y: y + R * 0.6 },
    { x: x - R, y: y + R * 0.6 },
  ], true);
  g.fillRoundedRect(x - R * 0.5, y + R * 0.6, R * 1.0, R * 0.7, 3);
}

function drawSquare(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  g.fillRect(x - R * 0.85, y - R * 0.85, R * 1.7, R * 1.7);
  g.fillRoundedRect(x - R * 0.5, y + R * 0.6, R * 1.0, R * 0.8, 3);
}

function drawBishop(g: Phaser.GameObjects.Graphics, x: number, y: number): void {
  // Mitre (pointed top)
  g.fillPoints([
    { x: x, y: y - R * 1.2 },
    { x: x + R * 0.3, y: y - R * 0.7 },
    { x: x - R * 0.3, y: y - R * 0.7 },
  ], true);
  // Head — rounded bulge
  g.fillCircle(x, y - R * 0.3, R * 0.6);
  // Neck taper
  g.fillPoints([
    { x: x - R * 0.5, y: y - R * 0.1 },
    { x: x + R * 0.5, y: y - R * 0.1 },
    { x: x + R * 0.35, y: y + R * 0.4 },
    { x: x - R * 0.35, y: y + R * 0.4 },
  ], true);
  // Base
  g.fillRoundedRect(x - R * 0.6, y + R * 0.4, R * 1.2, R * 0.8, 4);
}
