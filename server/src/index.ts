import { resolve } from "path";
import dotenv from "dotenv";
dotenv.config({ path: resolve(__dirname, "../../.env") });

import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createServer } from "http";
import express from "express";
import cors from "cors";
import { OverworldRoom } from "./rooms/OverworldRoom";
import { ChessRoom } from "./rooms/ChessRoom";

const PORT = parseInt(process.env.COLYSEUS_PORT || "2567");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("overworld", OverworldRoom);
gameServer.define("chess", ChessRoom);

httpServer.listen(PORT, () => {
  console.log(`Chess2D server listening on port ${PORT}`);
});
