export const MSG = {
  PLAYER_MOVE: "playerMove",
  CHAT: "chat",
  BATTLE_REQUEST: "battleRequest",
  BATTLE_RESPONSE: "battleResponse",
  BATTLE_START: "battleStart",
  CHESS_MOVE: "chessMove",
  CHESS_RESIGN: "chessResign",
  CHESS_DRAW_OFFER: "chessDrawOffer",
  CHESS_DRAW_RESPONSE: "chessDrawResponse",
  CHESS_GAME_OVER: "chessGameOver",
  CHESS_CHAT: "chessChat",
  SPECTATE_JOIN: "spectateJoin",
} as const;

export type MessageType = (typeof MSG)[keyof typeof MSG];
