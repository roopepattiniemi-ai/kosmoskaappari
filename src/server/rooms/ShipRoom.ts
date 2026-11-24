import { Client, Room } from "colyseus";
import { isEnergySystem, isTetrisCmd, sanitizeName, type GameEvent } from "../../shared/protocol.js";
import { ShipSim } from "../game/ShipSim.js";
import { ShipState } from "../schema.js";

const NAMES = ["Kapteeni", "Kansimies", "Tykkimies", "Korjaaja", "Tähystäjä"];

export class ShipRoom extends Room<{ state: ShipState }> {
  maxClients = 5;
  state = new ShipState();
  private sim!: ShipSim;

  onCreate(): void {
    this.sim = new ShipSim(this.state, hashRoom(this.roomId));
    this.state.roomCode = this.roomId;
    this.sim.start();
    this.setSimulationInterval((deltaMs) => {
      const events = this.sim.tick(Math.min(0.1, deltaMs / 1000));
      this.emitEvents(events);
    }, 1000 / 20);

    this.onMessage("go", (client, message: { section?: string }) => {
      this.sim.go(client.sessionId, String(message?.section ?? ""));
    });
    this.onMessage("swap", (client, message: { a?: number; b?: number }) => {
      const events = this.sim.swap(client.sessionId, Number(message?.a), Number(message?.b));
      for (const event of events) {
        if (event.type === "reactor" && !event.ok) client.send("reactor", event);
        else this.broadcast(event.type, event);
      }
    });
    this.onMessage("tetris", (client, message: { cmd?: string }) => {
      const cmd = String(message?.cmd ?? "");
      if (isTetrisCmd(cmd)) this.sim.tetris(client.sessionId, cmd);
    });
    this.onMessage("alloc", (client, message: { system?: string; delta?: number }) => {
      void client;
      const system = String(message?.system ?? "");
      if (isEnergySystem(system)) this.sim.alloc(system, Number(message?.delta));
    });
    this.onMessage("shield", (client, message: { lane?: number }) => {
      this.sim.shieldTap(client.sessionId, Number(message?.lane));
    });
    this.onMessage("helm", (client, message: { dir?: number; lock?: boolean }) => {
      if (message?.lock) this.sim.helmLock(client.sessionId);
      else this.sim.helmNudge(client.sessionId, Number(message?.dir));
    });
    this.onMessage("repair", (client, message: { index?: number }) => {
      this.sim.repairTap(client.sessionId, Number(message?.index));
    });
    this.onMessage("sensors", (client) => {
      this.sim.sensorTap(client.sessionId);
    });
    this.onMessage("restart", () => {
      this.sim.restart();
    });
    this.onMessage("continue", () => {
      this.sim.continueRun();
    });
    this.onMessage("vote", (client, message: { node?: number }) => {
      this.sim.vote(client.sessionId, Number(message?.node));
    });
    this.onMessage("shop", (client, message: { action?: string }) => {
      this.sim.shop(client.sessionId, String(message?.action ?? ""));
    });
    this.onMessage("event", (client, message: { choice?: number }) => {
      this.sim.choose(client.sessionId, Number(message?.choice));
    });
    this.onMessage("done", () => {
      this.sim.done();
    });
    this.onMessage("reopen", () => {
      this.sim.reopen();
    });
    this.onMessage("aim", (client, message: { system?: number }) => {
      this.sim.aim(client.sessionId, Number(message?.system));
    });
    this.onMessage("board", (client) => {
      this.sim.requestBoard(client.sessionId);
    });
    this.onMessage("blade", (client, message: { a?: number; b?: number }) => {
      this.sim.blade(client.sessionId, Number(message?.a), Number(message?.b));
    });
    this.onMessage("debug", (client, message: { cmd?: string }) => {
      if (process.env.KOSMOS_TEST !== "1") return;
      void client;
      if (message?.cmd === "line") this.emitEvents(this.sim.debugClearBottomRow());
    });
  }

  onJoin(client: Client, options?: { name?: string }): void {
    const fallback = NAMES[this.state.players.size] ?? "Merirosvo";
    this.sim.join(client.sessionId, sanitizeName(options?.name, fallback));
    if (!this.state.roomCode) this.state.roomCode = this.roomId;
  }

  onDrop(client: Client): void {
    this.allowReconnection(client, 20);
  }

  onLeave(client: Client, code?: number): void {
    void code;
    this.sim.leave(client.sessionId);
  }

  private emitEvents(events: GameEvent[]): void {
    for (const event of events) {
      if (event.type === "reactor" && !event.ok) continue;
      this.broadcast(event.type, event);
    }
  }
}

function hashRoom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
