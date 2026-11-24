import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { idx } from "../../shared/match3.ts";
import { parseMap } from "../../shared/run.ts";
import { FLOOR_Y } from "../../shared/sections.ts";
import { ShipState } from "../schema.ts";
import { ShipSim } from "./ShipSim.ts";

function boot(): ShipSim {
  const sim = new ShipSim(new ShipState(), 11);
  sim.start();
  sim.join("a", "Aada");
  sim.join("b", "Pekka");
  return sim;
}

describe("ship simulation", () => {
  it("spawns the crew on the lower deck and walks one up to the reactor", () => {
    const sim = boot();
    const a = sim.state.players.get("a")!;
    const b = sim.state.players.get("b")!;
    assert.equal(a.section, "ohjaus");
    assert.equal(b.section, "korjaamo");
    assert.equal(a.y, FLOOR_Y.ala);
    assert.equal(a.color, 0);
    assert.equal(b.color, 1);
    sim.go("a", "reaktori");
    assert.equal(a.walking, true);
    sim.tick(4);
    assert.equal(a.walking, false);
    assert.equal(a.section, "reaktori");
    assert.ok(Math.abs(a.y - FLOOR_Y.yla) < 1);
    assert.equal(b.section, "korjaamo");
  });

  it("shares an energy pool and refuses to over-allocate", () => {
    const sim = boot();
    assert.equal(sim.state.energy.pool, 4);
    assert.equal(sim.state.energy.weapons + sim.state.energy.shield + sim.state.energy.engines, 4);
    sim.alloc("weapons", -1);
    sim.alloc("shield", 1);
    assert.equal(sim.state.energy.weapons, 1);
    assert.equal(sim.state.energy.shield, 2);
    sim.alloc("engines", 1);
    assert.equal(sim.state.energy.engines, 1);
  });

  it("turns reactor matches into charge and leaves an idle crew on auto", () => {
    const sim = boot();
    const before = sim.state.energy.charge;
    sim.tick(4);
    assert.ok(sim.state.energy.charge > before + 4);
    sim.place("a", "reaktori");
    const parked = sim.state.energy.charge;
    sim.tick(3);
    assert.ok(Math.abs(sim.state.energy.charge - parked) < 0.2);

    const board = sim.state.reactor.board.split("");
    // Plant a guaranteed swap on the live board's top-left without touching the sim's resolver.
    const custom = new Array(64).fill(0).map((_, i) => (i * 2 + 1) % 6);
    custom[idx(0, 0)] = 0;
    custom[idx(1, 0)] = 0;
    custom[idx(2, 0)] = 4;
    custom[idx(2, 1)] = 0;
    sim.state.reactor.board = custom.join("");
    const events = sim.swap("a", idx(2, 0), idx(2, 1));
    assert.equal(events[0]?.type, "reactor");
    assert.equal(events[0] && "ok" in events[0] && events[0].ok, true);
    assert.notEqual(sim.state.reactor.board, custom.join(""));
    assert.equal(sim.swap("b", idx(0, 0), idx(1, 0))[0] && true, true);
    const rejected = sim.swap("b", 0, 1);
    assert.equal("ok" in rejected[0]! && rejected[0].ok, false);
    void board;
  });

  it("loads a shot from a cleared row and fires it with weapons power", () => {
    const sim = boot();
    sim.place("a", "aseet");
    sim.tick(0.05);
    assert.ok(sim.state.weapons.piece.length > 0);
    const enemy = sim.state.battle.enemyHull;
    const events = sim.debugClearBottomRow();
    assert.equal(events[0]?.type, "clear");
    assert.match(sim.state.weapons.ammo, /1/);
    sim.state.energy.weapons = 3;
    sim.tick(1.4);
    assert.ok(sim.state.battle.enemyHull < enemy);
    assert.equal(sim.state.weapons.ammo.includes("1"), false);
  });

  it("auto-loads weak ammo only while weapons are empty", () => {
    const sim = boot();
    sim.state.energy.weapons = 0;
    sim.tick(7);
    assert.match(sim.state.weapons.ammo, /a/);
    const ammo = sim.state.weapons.ammo;
    sim.place("a", "aseet");
    sim.tick(7);
    assert.equal(sim.state.weapons.ammo.startsWith(ammo), true);
    assert.equal(sim.state.weapons.ammo.slice(ammo.length).includes("a"), false);
  });

  it("ends the battle and restarts it without dropping the crew", () => {
    const sim = boot();
    sim.state.battle.enemyHull = 1;
    sim.state.energy.weapons = 3;
    sim.debugClearBottomRow();
    sim.tick(1.4);
    assert.equal(sim.state.battle.phase, "victory");
    sim.restart();
    assert.equal(sim.state.battle.phase, "battle");
    assert.equal(sim.state.battle.playerHull, 100);
    assert.equal(sim.state.battle.enemyHull, 140);
    assert.equal(sim.state.players.size, 2);
    assert.equal(sim.state.energy.weapons, 2);
  });

  it("records an enemy volley against the hull", () => {
    const sim = boot();
    sim.place("a", "sensorit");
    sim.place("b", "korjaamo");
    sim.state.energy.shield = 0;
    sim.state.energy.engines = 0;
    const seq = sim.state.battle.logSeq;
    sim.state.battle.enemyIn = 0.01;
    sim.tick(0.05);
    assert.ok(sim.state.battle.logSeq !== seq);
    assert.ok(sim.state.battle.playerHull < 100);
    assert.ok(sim.state.stations.hulls.split(",").some((value) => Number(value) < 100));
  });

  it("gives five pirates distinct colours and homes", () => {
    const sim = new ShipSim(new ShipState(), 3);
    sim.start();
    for (const id of ["a", "b", "c", "d", "e"]) sim.join(id, id);
    const colors = new Set<number>();
    sim.state.players.forEach((player) => colors.add(player.color));
    assert.equal(colors.size, 5);
    assert.equal(sim.state.players.get("a")?.section, "ohjaus");
    assert.equal(sim.state.players.get("e")?.section, "aseet");
  });

  it("charges the shield only when the spark is caught", () => {
    const sim = boot();
    sim.place("a", "suojakilpi");
    sim.state.stations.shieldLane = 2;
    sim.state.stations.shieldT = 0.8;
    sim.state.stations.shieldCharge = 10;
    sim.shieldTap("a", 0);
    assert.ok(sim.state.stations.shieldCharge <= 10);
    sim.state.stations.shieldLane = 2;
    sim.state.stations.shieldT = 0.8;
    sim.shieldTap("a", 2);
    assert.ok(sim.state.stations.shieldCharge > 10);
  });

  it("locks the helm onto the mark and patches the sparking compartment", () => {
    const sim = boot();
    sim.place("a", "ohjaus");
    sim.state.stations.helmTarget = 4;
    sim.state.stations.helmPos = 4;
    sim.state.stations.dodgeCharge = 10;
    sim.helmLock("a");
    assert.ok(sim.state.stations.dodgeCharge > 10);

    sim.place("a", "korjaamo");
    sim.state.stations.hulls = "40,100,100,100,100,100";
    sim.state.stations.spark = 0;
    const hull = sim.state.battle.playerHull;
    sim.repairTap("a", 0);
    assert.ok(Number(sim.state.stations.hulls.split(",")[0]) > 40);
    assert.ok(sim.state.battle.playerHull >= hull);
    sim.repairTap("a", 3);
    assert.match(sim.state.battle.log, /Väärä/);
  });

  it("reveals the next strike when the sensor sweep is on the blip", () => {
    const sim = boot();
    sim.place("a", "sensorit");
    sim.state.stations.blip = 2;
    sim.state.stations.sweep = 2.1;
    sim.state.stations.revealed = false;
    sim.sensorTap("a");
    assert.equal(sim.state.stations.revealed, true);
    assert.ok(sim.state.stations.weak > 0);
    sim.state.stations.blip = 2;
    sim.state.stations.sweep = 6;
    sim.state.stations.revealed = false;
    sim.sensorTap("a");
    assert.equal(sim.state.stations.revealed, false);
  });

  it("jumps by majority vote, spends fuel and keeps the hull", () => {
    const sim = boot();
    const map = parseMap(sim.state.run.map);
    const dest = map[0]!.next[0]!;
    sim.state.battle.phase = "explore";
    sim.state.run.screen = "map";
    sim.state.run.fuel = 4;
    sim.vote("a", dest);
    assert.equal(sim.state.run.node, 0);
    sim.vote("b", dest);
    assert.equal(sim.state.run.node, dest);
    assert.equal(sim.state.run.fuel, 3);
    sim.state.run.fuel = 0;
    sim.state.run.node = 0;
    sim.state.run.screen = "map";
    sim.state.battle.phase = "explore";
    sim.state.run.votes = "";
    const next = parseMap(sim.state.run.map)[0]!.next[0]!;
    sim.vote("a", next);
    sim.vote("b", next);
    assert.equal(sim.state.run.node, 0);
    assert.match(sim.state.battle.log, /Polttoaine/);
  });

  it("pays crystals for a weapon upgrade and aims a shot at one system", () => {
    const sim = boot();
    sim.state.battle.phase = "explore";
    sim.state.run.screen = "shop";
    sim.state.run.crystals = 30;
    sim.shop("a", "up:weapons");
    assert.equal(sim.state.run.weapons, 2);
    assert.equal(sim.state.run.crystals, 22);
    assert.equal(sim.state.run.mounts, "2,0,0,0");
    sim.state.battle.phase = "battle";
    sim.state.run.screen = "battle";
    sim.aim("a", 2);
    sim.place("a", "aseet");
    sim.state.energy.weapons = 3;
    sim.state.battle.enemySys = "100,0,100,100";
    sim.state.battle.enemyShield = 30;
    sim.debugClearBottomRow();
    sim.tick(1.4);
    const systems = sim.state.battle.enemySys.split(",").map(Number);
    assert.ok(systems[2]! < 100);
    assert.equal(systems[0], 100);
    assert.ok(sim.state.battle.enemyShield < 30);
  });

  it("grants crystals on a win, ends the run on a loss, and keeps the hull between nodes", () => {
    const sim = boot();
    sim.place("a", "aseet");
    sim.state.battle.playerHull = 40;
    sim.state.battle.enemyHull = 1;
    sim.state.energy.weapons = 3;
    sim.debugClearBottomRow();
    sim.tick(1.4);
    assert.equal(sim.state.battle.phase, "victory");
    assert.ok(sim.state.run.crystals > 0);
    const hull = sim.state.battle.playerHull;
    sim.continueRun();
    assert.equal(sim.state.battle.phase, "explore");
    assert.equal(sim.state.run.screen, "map");
    assert.equal(sim.state.battle.playerHull, hull);

    sim.restart();
    sim.state.battle.playerHull = 1;
    sim.state.energy.shield = 0;
    sim.state.energy.engines = 0;
    sim.state.battle.enemyIn = 0.01;
    sim.tick(0.05);
    assert.equal(sim.state.battle.phase, "defeat");
    assert.equal(sim.state.run.screen, "over");
  });
});
