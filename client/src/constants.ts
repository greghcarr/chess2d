// ── Display ──────────────────────────────────────────────
export const BASE_WIDTH = 1920;
export const BASE_HEIGHT = 1080;

// ── Version ──────────────────────────────────────────────
export const VERSION = "0.1.0-pre-alpha";

// ── Colors ───────────────────────────────────────────────
export const COLOR_GROUND = 0x4a7c59;
export const COLOR_FENCE = 0x8b6f47;
export const COLOR_PLAYER = 0x3399ff;
export const COLOR_REMOTE_PLAYER = 0xcccccc;
export const COLOR_CLICK_MARKER = 0xffff00;
export const COLOR_MINIMAP_BG = 0x222222;
export const COLOR_MINIMAP_SELF = 0x3399ff;
export const COLOR_MINIMAP_OTHER = 0xffffff;
export const COLOR_CHESS_LIGHT = 0xf0d9b5;
export const COLOR_CHESS_DARK = 0xb58863;
export const COLOR_CHESS_HIGHLIGHT = 0x7fc97f;
export const COLOR_CHESS_WHITE_PIECE = 0xffffff;
export const COLOR_CHESS_BLACK_PIECE = 0x333333;
export const COLOR_UI_BG = 0x000000;
export const COLOR_UI_TEXT = 0xffffff;
export const COLOR_CHAT_BG = 0x1a1a2e;
export const COLOR_VERSION_TEXT = 0x999999;

// ── Player ───────────────────────────────────────────────
export const PLAYER_RADIUS = 16;
export const PLAYER_SPEED = 200; // pixels per second
export const PLAYER_NAME_OFFSET_Y = -28;

// ── Click Marker ─────────────────────────────────────────
export const CLICK_MARKER_SIZE = 12;
export const CLICK_MARKER_DURATION = 600; // ms

// ── Camera ───────────────────────────────────────────────
export const ZOOM_DEFAULT = 1.5;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;
export const ZOOM_STEP = 0.15;
export const ZOOM_TWEEN_DURATION = 150; // ms

// ── Minimap ──────────────────────────────────────────────
export const MINIMAP_SIZE = 160;
export const MINIMAP_MARGIN = 16;
export const MINIMAP_DOT_RADIUS = 3;
export const MINIMAP_UPDATE_INTERVAL = 500; // ms

// ── Chat ─────────────────────────────────────────────────
export const CHAT_WIDTH = 400;
export const CHAT_HEIGHT = 200;
export const CHAT_MARGIN = 16;
export const CHAT_MAX_MESSAGES = 50;
export const CHAT_FONT_SIZE = 14;

// ── Chess Board ──────────────────────────────────────────
export const CHESS_SQUARE_SIZE = 80;
export const CHESS_BOARD_SIZE = CHESS_SQUARE_SIZE * 8;
export const CHESS_PIECE_SCALE = 0.8;

// ── Battle ───────────────────────────────────────────────
export const BATTLE_REQUEST_RANGE = 150; // max distance to request a battle
export const BATTLE_FACE_DISTANCE = 120; // distance apart when facing off

// ── Network ──────────────────────────────────────────────
export const INTERPOLATION_SPEED = 0.15; // lerp factor for remote players
