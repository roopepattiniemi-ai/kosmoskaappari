import { Client, Room } from "colyseus";
import { sanitizeName } from "../../shared/protocol.js";
import { DuelSim } from "../game/DuelSim.js";
import { DuelState } from "../schema.js";

const waiters: DuelRoom[] = [];

export function waitingDuelId(): string | null {
  const room = waiters.find((candidate) => candidate.listing);
  return room?.roomId ?? null;
}

export class DuelRoom extends Room<{ state: DuelState }> {
  maxClients = 10;
  state = new DuelState();
  listing = false;
  private sim!: DuelSim;

  onCreate(options?: { queue?: boolean }): void {
    this.sim = new DuelSim(this.state, hashRoom(this.roomId));
    this.state.roomCode = this.roomId;
    this.state.queued = !!options?.queue;
    if (options?.queue) {
      this.listing = true;
      waiters.push(this);
    }
    this.setSimulationInterval((deltaMs) => {
      this.sim.tick(Math.min(0.1, deltaMs / 1000));
      if (this.state.phase !== "wait") this.unlist();
    }, 1000 / 20);

    this.onMessage("start", () => {
      this.unlist();
      this.sim.start();
    });
    this.onMessage("aim", (client, message: { system?: number }) => {
      this.sim.aim(client.sessionId, Number(message?.system));
    });
    this.onMessage("pump", (client) => {
      this.sim.pump(client.sessionId);
    });
    this.onMessage("board", (client) => {
      this.sim.board(client.sessionId);
    });
    this.onMessage("blade", (client, message: { a?: number; b?: number }) => {
      this.sim.swap(client.sessionId, Number(message?.a), Number(message?.b));
    });
  }

  onJoin(client: Client, options?: { name?: string; team?: number }): void {
    const team = Number(options?.team);
    this.sim.join(client.sessionId, sanitizeName(options?.name, "Merirosvo"), team === 0 || team === 1 ? team : undefined);
    if (this.state.queued && this.sim.bothSides()) {
      this.unlist();
      this.sim.start();
    }
  }

  onLeave(client: Client): void {
    if (this.state.phase === "wait") this.state.seats.delete(client.sessionId);
    if (this.humansLeft() === 0) this.unlist();
  }

  private humansLeft(): number {
    let count = 0;
    this.state.seats.forEach((seat) => {
      if (!seat.bot) count++;
    });
    return count;
  }

  private unlist(): void {
    this.listing = false;
    const index = waiters.indexOf(this);
    if (index >= 0) waiters.splice(index, 1);
  }
}

function hashRoom(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) {
    hash ^= id.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}
