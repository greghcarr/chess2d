export interface NpcDialogue {
  onGameStart?: string;
  onCheck?: string;
  onCapture?: string;
  onPlayerBlunder?: string;
  onWinning?: string;
}

export interface NpcDefinition {
  id: string;
  username: string;
  x: number;
  y: number;
  hue: number;
  skillLevel: number;       // 1-10
  wanderRadius: number;     // pixels from spawn
  isScenario: boolean;
  shape?: string;
  scenarioFen?: string;
  scenarioId?: string;
  dialogue: NpcDialogue;
}

export const NPC_LIST: NpcDefinition[] = [
  {
    id: "pawn_pusher",
    username: "Pawn Pusher",
    x: 300,
    y: 300,
    hue: 40,
    skillLevel: 2,
    wanderRadius: 60,
    shape: "square",
    isScenario: false,
    dialogue: {
      onGameStart: "Let's have a friendly game!",
      onCapture: "Ooh, I got one!",
      onCheck: "Check!",
      onWinning: "Looks like I'm doing well...",
    },
  },
  {
    id: "the_bishop",
    username: "The Bishop",
    x: 700,
    y: 350,
    hue: 280,
    skillLevel: 5,
    wanderRadius: 40,
    shape: "bishop",
    isScenario: false,
    dialogue: {
      onGameStart: "Diagonals are my domain.",
      onCapture: "Another soul claimed.",
      onCheck: "Your king is exposed.",
      onWinning: "The board bends to my will.",
    },
  },
  {
    id: "endgame_rook",
    username: "Rook Trial",
    x: 500,
    y: 750,
    hue: 0,
    skillLevel: 4,
    wanderRadius: 30,
    isScenario: true,
    shape: "diamond",
    scenarioId: "endgame_rook1",
    // White to move: Rook + King vs King. Mate in ~5 moves.
    scenarioFen: "8/8/8/4k3/8/8/1R6/4K3 w - - 0 1",
    dialogue: {
      onGameStart: "Can you find the checkmate?",
      onCheck: "Getting closer...",
      onWinning: "Don't let me escape!",
    },
  },
];
