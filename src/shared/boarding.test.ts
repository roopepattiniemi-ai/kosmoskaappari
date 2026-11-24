import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32 } from "./rng.ts";
import {
  B_CELLS,
  BLADE_NAMES,
  aiBladeMove,
  bladeSwap,
  encodeBlade,
  generateBladeBoard,
  strikeDamage,
} from "./boarding.ts";

describe("boarding blades", () => {
  it("turns a three-cut into a strike and ignores a dead swap", () => {
    const board: number[] = [];
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) board.push(y === 0 ? [0, 0, 1, 0, 2, 3][x]! : (x + 3 + y) % 4);
    }
    const hit = bladeSwap(board, 2, 3, mulberry32(1));
    assert.ok(hit);
    assert.ok((hit?.damage ?? 0) >= strikeDamage(3));
    assert.equal(encodeBlade(hit?.board ?? []).length, B_CELLS);
    const quiet = Array.from({ length: B_CELLS }, (_, index) => (index + Math.floor(index / 6)) % 2);
    assert.equal(bladeSwap(quiet, 1, 2, mulberry32(1)), null);
    assert.equal(BLADE_NAMES.length, 4);
  });

  it("gives the NPC a legal opening on a fresh board", () => {
    for (let seed = 1; seed <= 8; seed++) {
      const board = generateBladeBoard(mulberry32(seed));
      const move = aiBladeMove(board);
      assert.ok(move, `seed ${seed}`);
      const hit = bladeSwap(board, move![0], move![1], mulberry32(seed));
      assert.ok(hit && hit.damage >= 14);
    }
  });
});
