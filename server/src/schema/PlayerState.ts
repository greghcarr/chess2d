import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("number") x: number = 500;
  @type("number") y: number = 500;
  @type("string") username: string = "";
  @type("boolean") inBattle: boolean = false;
}
