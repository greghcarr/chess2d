import "./patchColyseus.js";
import { Client } from "colyseus.js";

const colyseusUrl = import.meta.env.VITE_COLYSEUS_URL || "http://localhost:2567";

export const colyseusClient = new Client(colyseusUrl);
