// Named render depth layers — higher values render on top
export const LAYER = {
  GROUND: 0,
  FENCE: 10,
  CLICK_MARKER: 20,
  REMOTE_PLAYERS: 30,
  LOCAL_PLAYER: 40,
  CHESSBOARD: 50,
  CHESS_PIECES: 60,
  PLAYER_NAMES: 70,
  UI_BACKGROUND: 100,
  MINIMAP: 110,
  CHAT: 120,
  MODAL: 130,
  VERSION_LABEL: 140,
} as const;
