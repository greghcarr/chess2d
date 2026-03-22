export interface ScenarioReward {
  type: "shape" | "effect";
  name: string;
}

export const SCENARIO_REWARDS: Record<string, ScenarioReward> = {
  endgame_rook1: { type: "shape", name: "diamond" },
};
