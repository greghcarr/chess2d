import { Client } from "colyseus.js";

const colyseusUrl = import.meta.env.VITE_COLYSEUS_URL as string;

export const colyseusClient = new Client(colyseusUrl);
