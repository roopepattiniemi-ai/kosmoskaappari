import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { Client, type Room } from "@colyseus/sdk";
import type { Server } from "colyseus";
import { findMove, decodeBoard } from "../shared/match3.ts";
import { start } from "./index.ts";
import { ShipState } from "./schema.ts";

process.env.KOSMOS_TEST = "1";

let server: Server;
let port: number;

async function waitFor(check: () => boolean, label: string, ms = 6000): Promise<void> {
  const startAt = Date.now();
  while (Date.now() - startAt < ms) {
    if (check()) return;
    await new Promise((resolve) => setTimeout(resolve, 40));
  }
  throw new Error(`timeout: ${label}`);
}

describe("two clients, one ship", () => {
  before(async () => {
    port = 28771;
    server = await start(port);
  });

  after(async () => {
    await server.gracefullyShutdown(false);
  });

  it("joins from a shared room id, walks, allocates, swaps and fires", async () => {
    const url = `http://127.0.0.1:${port}`;
    const ada = new Client(url);
    const pekka = new Client(url);
    let roomA: Room | undefined;
    let roomB: Room | undefined;
    try {
      roomA = await ada.create("ship", { name: "Aada" }, ShipState);
      roomB = await pekka.joinById(roomA.roomId, { name: "Pekka" }, ShipState);
      const stateA = roomA.state as ShipState;
      const stateB = roomB.state as ShipState;

      await waitFor(() => stateA.players.size === 2 && stateB.players.size === 2, "both crews");
      assert.equal(stateA.roomCode, roomA.roomId);
      assert.equal(stateB.players.get(roomA.sessionId)?.name, "Aada");
      assert.equal(stateA.players.get(roomB.sessionId)?.name, "Pekka");

      const liisa = new Client(url);
      const roomC = await liisa.joinById(roomA.roomId, { name: "Liisa" }, ShipState);
      await waitFor(() => stateA.players.size === 3, "third pirate");
      await roomC.leave();

      roomA.send("go", { section: "reaktori" });
      roomB.send("go", { section: "aseet" });
      await waitFor(() => {
        const a = stateB.players.get(roomA.sessionId);
        const b = stateA.players.get(roomB.sessionId);
        return a?.section === "reaktori" && a.walking === false && b?.section === "aseet" && b.walking === false;
      }, "arrival");

      const move = findMove(decodeBoard(stateA.reactor.board));
      assert.ok(move);
      const boardBefore = stateA.reactor.board;
      roomA.send("swap", { a: move![0], b: move![1] });
      await waitFor(() => stateB.reactor.board !== boardBefore, "reactor sync");
      assert.equal(stateA.reactor.board, stateB.reactor.board);

      roomA.send("alloc", { system: "weapons", delta: -1 });
      roomB.send("alloc", { system: "shield", delta: 1 });
      await waitFor(
        () => stateA.energy.weapons === 1 && stateB.energy.shield === 2 && stateA.energy.shield === 2,
        "energy sync",
      );

      roomB.send("debug", { cmd: "line" });
      await waitFor(() => stateA.weapons.ammo.length > 0 && stateB.weapons.ammo === stateA.weapons.ammo, "ammo sync", 10000);

      const enemy = stateA.battle.enemyHull;
      await waitFor(() => stateB.battle.enemyHull < enemy, "shot landed", 4000);
      assert.ok(stateA.battle.enemyHull < enemy);

      roomA.send("restart");
      await waitFor(() => stateB.battle.phase === "battle" && stateB.battle.enemyHull === 140, "restart");
      assert.equal(stateA.players.size, 2);
      assert.equal(stateB.energy.weapons, 2);
    } finally {
      await roomA?.leave();
      await roomB?.leave();
    }
  });
});
