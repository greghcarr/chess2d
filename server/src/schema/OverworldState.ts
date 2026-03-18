import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState.js";

export class OverworldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}
