import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";

export class OverworldState extends Schema {
  players!: MapSchema<PlayerState>;
}

defineTypes(OverworldState, {
  players: { map: PlayerState },
});
