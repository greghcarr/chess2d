import { Schema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
  x!: number;
  y!: number;
  username!: string;
  inBattle!: boolean;
}

defineTypes(PlayerState, {
  x: "number",
  y: "number",
  username: "string",
  inBattle: "boolean",
});
