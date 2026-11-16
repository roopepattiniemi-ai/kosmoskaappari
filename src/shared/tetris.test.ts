import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  PIECES,
  WELL_H,
  WELL_W,
  Bag,
  clearFullRows,
  collides,
  emptyWell,
  ghostY,
  spawnActive,
  stamp,
  tryRotate,
  tryShift,
  wellIndex,
} from "./tetris.ts";
import { mulberry32 } from "./rng.ts";

describe("tetris ammo loader", () => {
  it("deals every piece once per 7-bag", () => {
    const bag = new Bag(mulberry32(3));
    const first = Array.from({ length: 7 }, () => bag.next()).sort();
    const second = Array.from({ length: 7 }, () => bag.next()).sort();
    assert.deepEqual(first, PIECES.slice().sort());
    assert.deepEqual(second, PIECES.slice().sort());
  });

  it("kicks a rotation back inside the well", () => {
    const well = emptyWell();
    const active = { ...spawnActive("T"), x: -1 };
    assert.equal(collides(well, active.piece, active.rot, active.x, active.y), true);
    const rotated = tryRotate(well, { piece: "J", rot: 0, x: 0, y: 0 });
    assert.ok(rotated);
    assert.equal(collides(well, rotated!.piece, rotated!.rot, rotated!.x, rotated!.y), false);
    assert.equal(tryShift(well, spawnActive("I"), -1)?.x, 2);
  });

  it("hard-drops an O onto the floor", () => {
    const active = spawnActive("O");
    const y = ghostY(emptyWell(), active.piece, active.rot, active.x, active.y);
    assert.equal(y, WELL_H - 2);
    const locked = stamp(emptyWell(), { ...active, y });
    assert.equal(locked[wellIndex(active.x, WELL_H - 1)], 2);
    assert.equal(locked[wellIndex(active.x + 1, WELL_H - 2)], 2);
  });

  it("clears two rows, awards double-line power, and keeps the well size", () => {
    const well = emptyWell();
    for (const y of [WELL_H - 2, WELL_H - 1]) {
      for (let x = 0; x < WELL_W; x++) well[wellIndex(x, y)] = 3;
    }
    well[wellIndex(0, WELL_H - 3)] = 5;
    const cleared = clearFullRows(well);
    assert.deepEqual(cleared.rows, [WELL_H - 2, WELL_H - 1]);
    assert.equal(cleared.power, 2);
    assert.equal(cleared.banner, "Kaksoislinja!");
    assert.equal(cleared.well.length, WELL_W * WELL_H);
    assert.equal(cleared.well[wellIndex(0, WELL_H - 1)], 5);
    assert.equal(cleared.well[wellIndex(0, 0)], 0);
  });

  it("names a four-row clear TETRIS", () => {
    const well = emptyWell();
    for (let y = WELL_H - 4; y < WELL_H; y++) {
      for (let x = 0; x < WELL_W; x++) well[wellIndex(x, y)] = 1;
    }
    const cleared = clearFullRows(well);
    assert.equal(cleared.power, 4);
    assert.equal(cleared.banner, "TETRIS!");
    assert.ok(cleared.well.every((cell) => cell === 0));
  });

  it("does not clear a row with a gap", () => {
    const well = emptyWell();
    for (let x = 0; x < WELL_W; x++) well[wellIndex(x, WELL_H - 1)] = 1;
    well[wellIndex(4, WELL_H - 1)] = 0;
    const cleared = clearFullRows(well);
    assert.equal(cleared.rows.length, 0);
    assert.equal(cleared.well[wellIndex(0, WELL_H - 1)], 1);
  });
});
