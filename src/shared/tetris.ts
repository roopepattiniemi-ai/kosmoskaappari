import type { Rng } from "./rng.js";
import { lineBanner, linePower } from "./balance.js";

export const WELL_W = 10;
export const WELL_H = 16;
export const WELL_CELLS = WELL_W * WELL_H;

export const PIECES = ["I", "O", "T", "S", "Z", "J", "L"] as const;
export type Piece = (typeof PIECES)[number];

/** 1 cyan I, 2 yellow O, 3 purple T, 4 green S, 5 red Z, 6 blue J, 7 orange L. */
export const PIECE_COLOR: Record<Piece, number> = {
  I: 1,
  O: 2,
  T: 3,
  S: 4,
  Z: 5,
  J: 6,
  L: 7,
};

type Cell = [number, number];

/** Four clockwise rotations, cells relative to the piece origin. */
export const ROTATIONS: Record<Piece, Cell[][]> = {
  I: [
    [[0, 0], [1, 0], [2, 0], [3, 0]],
    [[2, 0], [2, 1], [2, 2], [2, 3]],
    [[0, 2], [1, 2], [2, 2], [3, 2]],
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
    [[0, 0], [1, 0], [0, 1], [1, 1]],
  ],
  T: [
    [[1, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [1, 2]],
    [[1, 0], [0, 1], [1, 1], [1, 2]],
  ],
  S: [
    [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[1, 0], [1, 1], [2, 1], [2, 2]],
    [[1, 1], [2, 1], [0, 2], [1, 2]],
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  Z: [
    [[0, 0], [1, 0], [1, 1], [2, 1]],
    [[2, 0], [1, 1], [2, 1], [1, 2]],
    [[0, 1], [1, 1], [1, 2], [2, 2]],
    [[1, 0], [0, 1], [1, 1], [0, 2]],
  ],
  J: [
    [[0, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [2, 0], [1, 1], [1, 2]],
    [[0, 1], [1, 1], [2, 1], [2, 2]],
    [[1, 0], [1, 1], [0, 2], [1, 2]],
  ],
  L: [
    [[2, 0], [0, 1], [1, 1], [2, 1]],
    [[1, 0], [1, 1], [1, 2], [2, 2]],
    [[0, 1], [1, 1], [2, 1], [0, 2]],
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
};

export type Well = number[];

export interface Active {
  piece: Piece;
  rot: number;
  x: number;
  y: number;
}

export function isPiece(value: string): value is Piece {
  return (PIECES as readonly string[]).includes(value);
}

export function emptyWell(): Well {
  return new Array(WELL_CELLS).fill(0);
}

export function wellIndex(x: number, y: number): number {
  return y * WELL_W + x;
}

export function encodeWell(well: Well): string {
  let out = "";
  for (let i = 0; i < WELL_CELLS; i++) out += String(well[i] ?? 0);
  return out;
}

export function decodeWell(text: string): Well {
  const well = emptyWell();
  for (let i = 0; i < WELL_CELLS; i++) {
    const n = Number(text.charAt(i));
    well[i] = Number.isFinite(n) ? n : 0;
  }
  return well;
}

export function cellsOf(piece: Piece, rot: number, px: number, py: number): Cell[] {
  const shape = ROTATIONS[piece][((rot % 4) + 4) % 4]!;
  return shape.map(([x, y]) => [x + px, y + py]);
}

export function collides(well: Well, piece: Piece, rot: number, px: number, py: number): boolean {
  for (const [x, y] of cellsOf(piece, rot, px, py)) {
    if (x < 0 || x >= WELL_W || y >= WELL_H) return true;
    if (y >= 0 && (well[wellIndex(x, y)] ?? 0) !== 0) return true;
  }
  return false;
}

export function ghostY(well: Well, piece: Piece, rot: number, px: number, py: number): number {
  let y = py;
  while (!collides(well, piece, rot, px, y + 1)) y++;
  return y;
}

const KICKS: Cell[] = [
  [0, 0],
  [-1, 0],
  [1, 0],
  [-2, 0],
  [2, 0],
  [0, -1],
  [-1, -1],
  [1, -1],
  [0, -2],
];

export function tryRotate(well: Well, active: Active): Active | null {
  const rot = (active.rot + 1) % 4;
  for (const [kx, ky] of KICKS) {
    const x = active.x + kx;
    const y = active.y + ky;
    if (!collides(well, active.piece, rot, x, y)) {
      return { piece: active.piece, rot, x, y };
    }
  }
  return null;
}

export function tryShift(well: Well, active: Active, dx: number): Active | null {
  const x = active.x + dx;
  if (!collides(well, active.piece, active.rot, x, active.y)) {
    return { ...active, x };
  }
  return null;
}

export function tryDropOne(well: Well, active: Active): Active | null {
  if (!collides(well, active.piece, active.rot, active.x, active.y + 1)) {
    return { ...active, y: active.y + 1 };
  }
  return null;
}

export interface ClearResult {
  well: Well;
  rows: number[];
  power: number;
  banner: string;
}

/** Remove full rows. Survivors fall, empty rows appear at the top. */
export function clearFullRows(well: Well): ClearResult {
  const rows: number[] = [];
  for (let y = 0; y < WELL_H; y++) {
    let full = true;
    for (let x = 0; x < WELL_W; x++) {
      if ((well[wellIndex(x, y)] ?? 0) === 0) {
        full = false;
        break;
      }
    }
    if (full) rows.push(y);
  }
  if (rows.length === 0) return { well, rows, power: 0, banner: "" };
  const clear = new Set(rows);
  const kept: number[] = [];
  for (let y = 0; y < WELL_H; y++) {
    if (clear.has(y)) continue;
    for (let x = 0; x < WELL_W; x++) kept.push(well[wellIndex(x, y)] ?? 0);
  }
  const missing = WELL_CELLS - kept.length;
  const next = new Array(missing).fill(0).concat(kept);
  return {
    well: next,
    rows,
    power: linePower(rows.length),
    banner: lineBanner(rows.length),
  };
}

/** Stamp the piece into a copy of the well. Does not clear rows. */
export function stamp(well: Well, active: Active): Well {
  const next = well.slice();
  const color = PIECE_COLOR[active.piece];
  for (const [x, y] of cellsOf(active.piece, active.rot, active.x, active.y)) {
    if (y >= 0 && y < WELL_H && x >= 0 && x < WELL_W) next[wellIndex(x, y)] = color;
  }
  return next;
}

export function spawnActive(piece: Piece): Active {
  const x = piece === "I" ? 3 : 3;
  return { piece, rot: 0, x, y: 0 };
}

/** 7-bag randomizer: every piece appears once per bag. */
export class Bag {
  private queue: Piece[] = [];
  constructor(private readonly rng: Rng) {}

  next(): Piece {
    if (this.queue.length === 0) this.refill();
    return this.queue.shift()!;
  }

  peek(count: number): Piece[] {
    while (this.queue.length < count) this.refill();
    return this.queue.slice(0, count);
  }

  private refill(): void {
    const bag = PIECES.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      const a = bag[i]!;
      const b = bag[j]!;
      bag[i] = b;
      bag[j] = a;
    }
    this.queue.push(...bag);
  }
}
