import { Schema, type, ArraySchema } from "@colyseus/schema";

export class ChatMessage extends Schema {
  @type("string") username: string = "";
  @type("string") text: string = "";
}

export class ChessState extends Schema {
  @type("string") fen: string = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
  @type("string") turn: string = "w";
  @type("string") whitePlayer: string = "";
  @type("string") blackPlayer: string = "";
  @type("string") whiteUsername: string = "";
  @type("string") blackUsername: string = "";
  @type("string") result: string = ""; // empty = in progress
  @type("string") endReason: string = "";
  @type([ChatMessage]) chatHistory = new ArraySchema<ChatMessage>();
}
