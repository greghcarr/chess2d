export type ChessColor = "w" | "b";

export type GameResult = "white_win" | "black_win" | "draw";

export type EndReason =
  | "checkmate"
  | "resignation"
  | "stalemate"
  | "timeout"
  | "draw_agreement"
  | "threefold"
  | "fifty_move"
  | "insufficient";

export interface ChessMoveData {
  from: string;
  to: string;
  promotion?: string;
}

export interface GameOverData {
  result: GameResult;
  reason: EndReason;
}

export interface BattleRequestData {
  targetSessionId: string;
}

export interface BattleResponseData {
  requesterSessionId: string;
  accepted: boolean;
}
