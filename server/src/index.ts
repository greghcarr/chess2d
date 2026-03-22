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
app.use(cors({ origin: true }));
app.use(express.json());

// Log all matchmake requests for debugging
app.use("/matchmake", (req, _res, next) => {
  console.log(`[matchmake] ${req.method} ${req.url} from ${req.ip}`);
  next();
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const httpServer = createServer(app);

const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("overworld", OverworldRoom);
gameServer.define("chess", ChessRoom);

const HOST = process.env.HOST || "0.0.0.0";
httpServer.listen(PORT, HOST, () => {
  console.log(`chess2D server listening on ${HOST}:${PORT}`);
});
