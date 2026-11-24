import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { B_CELLS, encodeBlade } from "../../shared/boarding.ts";
import { DuelState } from "../schema.ts";
import { DuelSim } from "./DuelSim.ts";

describe("crew duel", () => {
  it("splits two pirates, fills bots and lets a drained shield be boarded", () => {
    const sim = new DuelSim(new DuelState(), 4);
    sim.join("a", "Aada");
    sim.join("b", "Pekka");
    assert.equal(sim.state.seats.get("a")?.team, 0);
    assert.equal(sim.state.seats.get("b")?.team, 1);
    sim.start();
    assert.equal(sim.state.phase, "battle");
    assert.equal(sim.state.seats.size, 10);
    sim.state.shield1 = 0;
    sim.board("a");
    assert.equal(sim.state.phase, "boarding");
    assert.equal(sim.state.attacker, 0);
    const board = Array.from({ length: B_CELLS }, () => 1);
    board[0] = 0;
    board[1] = 0;
    board[2] = 1;
    board[3] = 0;
    sim.state.board0 = encodeBlade(board);
    sim.swap("a", 2, 3);
    assert.ok(sim.state.hp1 < 80);
  });

  it("fires a charged gun into the other hull", () => {
    const sim = new DuelSim(new DuelState(), 2);
    sim.join("a", "Aada");
    sim.start();
    sim.aim("a", 2);
    sim.state.charge0 = 100;
    sim.state.shield1 = 0;
    sim.tick(0.05);
    assert.ok(sim.state.hull1 < 100);
    assert.ok(Number(sim.state.sys1.split(",")[2]) < 100);
  });
});
