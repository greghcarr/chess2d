import { Room, Client } from "colyseus";
import { OverworldState } from "../schema/OverworldState";
import { PlayerState } from "../schema/PlayerState";
import { PATCH_RATE_MS } from "../constants";
import { WORLD_WIDTH, WORLD_HEIGHT, FENCE_THICKNESS, SPAWN_X, SPAWN_Y } from "chess2d-shared/worldConfig";
import { MSG } from "chess2d-shared/protocol";

export class OverworldRoom extends Room<OverworldState> {
  private battleRequests = new Map<string, string>(); // requester -> target

  onCreate(): void {
    this.setState(new OverworldState());
    this.setPatchRate(PATCH_RATE_MS);
    this.setPrivate(false);
    this.maxClients = 100;

    this.onMessage(MSG.PLAYER_MOVE, (client, data: { x: number; y: number }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.inBattle) return;

      player.x = this.clamp(data.x, FENCE_THICKNESS, WORLD_WIDTH - FENCE_THICKNESS);
      player.y = this.clamp(data.y, FENCE_THICKNESS, WORLD_HEIGHT - FENCE_THICKNESS);
    });

    this.onMessage(MSG.CHAT, (client, data: { text: string }) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const text = data.text.substring(0, 200);
      this.broadcast(MSG.CHAT, { username: player.username, text });
    });

    this.onMessage(MSG.BATTLE_REQUEST, (client, data: { targetSessionId: string }) => {
      const requester = this.state.players.get(client.sessionId);
      const target = this.state.players.get(data.targetSessionId);
      if (!requester || !target) return;
      if (requester.inBattle || target.inBattle) return;

      this.battleRequests.set(client.sessionId, data.targetSessionId);

      // Notify the target
      const targetClient = this.clients.find((c) => c.sessionId === data.targetSessionId);
      if (targetClient) {
        targetClient.send(MSG.BATTLE_REQUEST, {
          requesterSessionId: client.sessionId,
          requesterUsername: requester.username,
        });
      }
    });

    this.onMessage(MSG.BATTLE_RESPONSE, (client, data: { requesterSessionId: string; accepted: boolean }) => {
      const requesterClient = this.clients.find((c) => c.sessionId === data.requesterSessionId);
      if (!requesterClient) return;

      if (!data.accepted) {
        const responder = this.state.players.get(client.sessionId);
        requesterClient.send(MSG.BATTLE_RESPONSE, {
          accepted: false,
          username: responder?.username || "Unknown",
        });
        this.battleRequests.delete(data.requesterSessionId);
        return;
      }

      // Accepted — start a chess match
      const requesterPlayer = this.state.players.get(data.requesterSessionId);
      const responderPlayer = this.state.players.get(client.sessionId);
      if (!requesterPlayer || !responderPlayer) return;

      requesterPlayer.inBattle = true;
      responderPlayer.inBattle = true;

      // Randomly assign colors
      const requesterIsWhite = Math.random() < 0.5;
      const roomId = `chess_${Date.now()}`;

      requesterClient.send(MSG.BATTLE_START, {
        roomId,
        color: requesterIsWhite ? "w" : "b",
        opponentUsername: responderPlayer.username,
      });
      client.send(MSG.BATTLE_START, {
        roomId,
        color: requesterIsWhite ? "b" : "w",
        opponentUsername: requesterPlayer.username,
      });

      this.battleRequests.delete(data.requesterSessionId);
    });
  }

  onJoin(client: Client, options: { username?: string }): void {
    const player = new PlayerState();
    player.x = SPAWN_X;
    player.y = SPAWN_Y;
    player.username = options.username || `Player_${client.sessionId.substring(0, 4)}`;
    this.state.players.set(client.sessionId, player);
    console.log(`${player.username} joined the overworld (total: ${this.state.players.size})`);
    this.state.players.forEach((p: PlayerState, key: string) => {
      console.log(`  [state] player: ${key} => ${p.username} (${p.x}, ${p.y})`);
    });
  }

  onLeave(client: Client): void {
    const player = this.state.players.get(client.sessionId);
    if (player) {
      console.log(`${player.username} left the overworld`);
    }
    this.state.players.delete(client.sessionId);
    this.battleRequests.delete(client.sessionId);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
