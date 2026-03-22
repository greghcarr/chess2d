import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("number") x: number = 500;
  @type("number") y: number = 500;
  @type("string") username: string = "";
  @type("boolean") inBattle: boolean = false;
  @type("uint16") hue: number = 200;
  @type("string") shape: string = "circle";
  @type("boolean") isNpc: boolean = false;
  @type("boolean") isScenario: boolean = false;
  @type("boolean") isAdmin: boolean = false;
  @type("string") unlockedShapes: string = "";  // comma-separated list
}
