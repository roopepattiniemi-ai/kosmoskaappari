import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELL_COUNT,
  COLS,
  CHARGE_PER_CELL,
  type Board,
  decodeBoard,
  encodeBoard,
  findGroups,
  findMove,
  generateBoard,
  idx,
  resolveBoard,
  trySwap,
} from "./match3.ts";
import { mulberry32 } from "./rng.ts";

function striped(): Board {
  const board: Board = [];
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < COLS; x++) board.push((x + y * 2) % 6);
  }
  return board;
}

describe("match-3", () => {
  it("generates a stable board with a legal move", () => {
    for (let seed = 1; seed <= 25; seed++) {
      const board = generateBoard(mulberry32(seed));
      assert.equal(board.length, CELL_COUNT);
      assert.equal(findGroups(board).length, 0);
      assert.ok(findMove(board), `seed ${seed} has no move`);
      assert.ok(board.every((cell) => cell >= 0 && cell < 6));
    }
  });

  it("rejects a swap that does not match and a diagonal swap", () => {
    const board = striped();
    const rng = mulberry32(1);
    assert.equal(trySwap(board, idx(0, 0), idx(1, 0), rng), null);
    assert.equal(trySwap(board, idx(0, 0), idx(1, 1), rng), null);
    assert.deepEqual(board, striped());
  });

  it("clears a match, awards charge, and stays the same length", () => {
    const board = striped();
    board[idx(0, 0)] = 0;
    board[idx(1, 0)] = 0;
    board[idx(2, 0)] = 5;
    board[idx(2, 1)] = 0;
    const result = trySwap(board, idx(2, 0), idx(2, 1), mulberry32(2));
    assert.ok(result);
    assert.ok(result!.gain >= 3 * CHARGE_PER_CELL);
    assert.equal(result!.board.length, CELL_COUNT);
    assert.equal(encodeBoard(result!.board).length, CELL_COUNT);
    assert.equal(findGroups(result!.board).length, 0);
    assert.ok(result!.steps[0]!.cleared.length >= 3);
  });

  it("a horizontal 4-match clears the whole row", () => {
    const board = striped();
    for (let x = 0; x < 4; x++) board[idx(x, 3)] = 1;
    // Break the accidental verticals the stripe may have created.
    for (let y = 0; y < 8; y++) {
      if (y === 3) continue;
      if (board[idx(0, y)] === 1) board[idx(0, y)] = 2;
      if (board[idx(1, y)] === 1) board[idx(1, y)] = 3;
      if (board[idx(2, y)] === 1) board[idx(2, y)] = 4;
      if (board[idx(3, y)] === 1) board[idx(3, y)] = 5;
    }
    const result = resolveBoard(board, mulberry32(3));
    const first = result.steps[0]!;
    assert.equal(first.banner, "Linja!");
    for (let x = 0; x < COLS; x++) assert.ok(first.cleared.includes(idx(x, 3)));
    assert.ok(first.gain >= COLS * CHARGE_PER_CELL);
  });

  it("a 5-match clears every crystal of that colour", () => {
    const board = striped();
    for (let x = 0; x < 5; x++) board[idx(x, 4)] = 4;
    board[idx(7, 6)] = 4;
    for (let y = 0; y < 8; y++) {
      if (y === 4) continue;
      for (let x = 0; x < 5; x++) if (board[idx(x, y)] === 4) board[idx(x, y)] = (x + 3) % 6;
    }
    board[idx(7, 6)] = 4;
    const result = resolveBoard(board, mulberry32(4));
    const first = result.steps[0]!;
    assert.equal(first.banner, "Kristallipommi!");
    assert.ok(first.cleared.includes(idx(7, 6)));
    assert.ok(first.cleared.includes(idx(0, 4)));
  });

  it("cascades when a fall creates a new match", () => {
    const board: Board = [];
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < COLS; x++) board.push((x * 2 + y) % 6);
    }
    board[idx(0, 7)] = 1;
    board[idx(1, 7)] = 1;
    board[idx(2, 7)] = 1;
    board[idx(0, 6)] = 3;
    board[idx(1, 6)] = 3;
    board[idx(2, 6)] = 3;
    const result = resolveBoard(board, mulberry32(9));
    assert.ok(result.steps.length >= 2, `steps ${result.steps.length}`);
    assert.ok(result.gain > result.steps[0]!.gain);
    assert.equal(findGroups(result.board).length, 0);
  });

  it("round-trips the board encoding", () => {
    const board = generateBoard(mulberry32(8));
    assert.deepEqual(decodeBoard(encodeBoard(board)), board);
  });
});
