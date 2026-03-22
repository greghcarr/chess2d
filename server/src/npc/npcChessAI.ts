import { Chess, type Move } from "chess.js";

const PIECE_VALUE: Record<string, number> = {
  p: 1, n: 3, b: 3, r: 5, q: 9, k: 0,
};

const CENTER_SQUARES = new Set(["d4", "d5", "e4", "e5", "c3", "c6", "f3", "f6"]);

/**
 * Pick a move for an NPC given a skill level (1-10).
 *
 * Levels 1-3: random with increasing capture bias
 * Levels 4-6: scored selection, pick from top N
 * Levels 7-10: minimax with alpha-beta pruning
 */
export function pickNpcMove(
  chess: Chess,
  skillLevel: number
): { from: string; to: string; promotion?: string } {
  const moves = chess.moves({ verbose: true });
  if (moves.length === 0) throw new Error("No legal moves available");
  if (moves.length === 1) return simplify(moves[0]);

  const level = Math.max(1, Math.min(10, Math.round(skillLevel)));

  if (level <= 3) {
    return simplify(pickRandom(moves, level));
  } else if (level <= 6) {
    return simplify(pickScored(chess, moves, level));
  } else {
    return simplify(pickMinimax(chess, level));
  }
}

function simplify(move: Move): { from: string; to: string; promotion?: string } {
  return { from: move.from, to: move.to, promotion: move.promotion };
}

/** Levels 1-3: random with increasing bias toward captures. */
function pickRandom(moves: Move[], level: number): Move {
  const captureWeight = level; // 1, 2, or 3
  const weighted: Move[] = [];
  for (const m of moves) {
    const count = m.captured ? captureWeight : 1;
    for (let i = 0; i < count; i++) weighted.push(m);
  }
  return weighted[Math.floor(Math.random() * weighted.length)];
}

/** Levels 4-6: score each move, pick randomly from top N. */
function pickScored(chess: Chess, moves: Move[], level: number): Move {
  const scored = moves.map((m) => ({ move: m, score: scoreMove(chess, m) }));
  scored.sort((a, b) => b.score - a.score);

  // Higher level = smaller pool of top moves
  const topN = Math.max(1, 7 - level); // level 4 → 3, level 5 → 2, level 6 → 1
  const pool = scored.slice(0, topN);
  return pool[Math.floor(Math.random() * pool.length)].move;
}

function scoreMove(chess: Chess, move: Move): number {
  let score = 0;
  if (move.captured) score += PIECE_VALUE[move.captured] || 1;
  // Check bonus: apply move, see if it gives check, undo
  chess.move(move);
  if (chess.isCheck()) score += 2;
  if (chess.isCheckmate()) score += 100;
  chess.undo();
  if (CENTER_SQUARES.has(move.to)) score += 0.5;
  return score;
}

/** Levels 7-10: minimax with alpha-beta. */
function pickMinimax(chess: Chess, level: number): Move {
  const depth = level <= 8 ? 2 : 3;
  const moves = chess.moves({ verbose: true });

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const move of moves) {
    chess.move(move);
    const score = -alphaBeta(chess, depth - 1, -Infinity, -bestScore);
    chess.undo();

    // Add tiny randomness so equal moves aren't always the same
    const jitter = (Math.random() - 0.5) * 0.01;
    if (score + jitter > bestScore) {
      bestScore = score + jitter;
      bestMove = move;
    }
  }

  return bestMove;
}

function alphaBeta(chess: Chess, depth: number, alpha: number, beta: number): number {
  if (depth === 0 || chess.isGameOver()) {
    return evaluate(chess);
  }

  const moves = chess.moves({ verbose: true });
  for (const move of moves) {
    chess.move(move);
    const score = -alphaBeta(chess, depth - 1, -beta, -alpha);
    chess.undo();

    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function evaluate(chess: Chess): number {
  if (chess.isCheckmate()) {
    // The side to move is checkmated — bad for them
    return -1000;
  }
  if (chess.isDraw() || chess.isStalemate()) return 0;

  const board = chess.board();
  let score = 0;
  const turn = chess.turn();

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      const value = PIECE_VALUE[piece.type] || 0;
      score += piece.color === turn ? value : -value;
    }
  }

  return score;
}
