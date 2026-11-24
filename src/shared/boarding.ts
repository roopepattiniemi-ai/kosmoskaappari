import type { Rng } from "./rng.js";

/** Sword-puzzle grid. Four placeholder colours stand in for blade tiles. */
export const B_COLS = 6;
export const B_ROWS = 6;
export const B_CELLS = B_COLS * B_ROWS;
export const B_TYPES = 4;
export const BOARD_HP = 80;

export const BLADE_NAMES = ["Viilto", "Pistö", "Lyönti", "Torjunta"] as const;

export function bladeIndex(x: number, y: number): number {
  return y * B_COLS + x;
}

export function encodeBlade(board: number[]): string {
  return board.map((value) => (value < 0 ? "." : String(value))).join("");
}

export function decodeBlade(text: string): number[] {
  const board: number[] = [];
  for (let i = 0; i < B_CELLS; i++) {
    const ch = text.charAt(i);
    board.push(ch === "" || ch === "." ? 0 : Math.max(0, Math.min(B_TYPES - 1, Number(ch) || 0)));
  }
  return board;
}

export function bladeAdjacent(a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0 || a >= B_CELLS || b >= B_CELLS) return false;
  const ax = a % B_COLS;
  const ay = Math.floor(a / B_COLS);
  const bx = b % B_COLS;
  const by = Math.floor(b / B_COLS);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function strikeDamage(cells: number): number {
  if (cells < 3) return 0;
  return 14 + (cells - 3) * 6;
}

function groupsOf(board: number[]): number[][] {
  const found: number[][] = [];
  for (let y = 0; y < B_ROWS; y++) {
    let x = 0;
    while (x < B_COLS) {
      const type = board[bladeIndex(x, y)] ?? -1;
      let end = x + 1;
      while (end < B_COLS && board[bladeIndex(end, y)] === type) end++;
      if (type >= 0 && end - x >= 3) {
        const cells: number[] = [];
        for (let k = x; k < end; k++) cells.push(bladeIndex(k, y));
        found.push(cells);
      }
      x = end;
    }
  }
  for (let x = 0; x < B_COLS; x++) {
    let y = 0;
    while (y < B_ROWS) {
      const type = board[bladeIndex(x, y)] ?? -1;
      let end = y + 1;
      while (end < B_ROWS && board[bladeIndex(x, end)] === type) end++;
      if (type >= 0 && end - y >= 3) {
        const cells: number[] = [];
        for (let k = y; k < end; k++) cells.push(bladeIndex(x, k));
        found.push(cells);
      }
      y = end;
    }
  }
  return found;
}

function collapse(board: number[], cleared: Set<number>, rng: Rng): number[] {
  const next = board.slice();
  for (let x = 0; x < B_COLS; x++) {
    const stack: number[] = [];
    for (let y = B_ROWS - 1; y >= 0; y--) {
      const index = bladeIndex(x, y);
      if (!cleared.has(index)) stack.push(next[index] ?? 0);
    }
    for (let y = B_ROWS - 1; y >= 0; y--) {
      const index = bladeIndex(x, y);
      next[index] = stack.length ? (stack.shift() as number) : Math.floor(rng() * B_TYPES);
    }
  }
  return next;
}

export function generateBladeBoard(rng: Rng): number[] {
  for (let attempt = 0; attempt < 24; attempt++) {
    const board = Array.from({ length: B_CELLS }, () => Math.floor(rng() * B_TYPES));
    if (!groupsOf(board).length && aiBladeMove(board)) return board;
  }
  const board = Array.from({ length: B_CELLS }, (_, index) => (index + Math.floor(index / B_COLS)) % B_TYPES);
  return board;
}

/** First legal swap that creates a chain. Deterministic, so the NPC crew can play. */
export function aiBladeMove(board: number[]): [number, number] | null {
  for (let index = 0; index < board.length; index++) {
    const x = index % B_COLS;
    const y = Math.floor(index / B_COLS);
    const neighbors = [
      x + 1 < B_COLS ? index + 1 : -1,
      y + 1 < B_ROWS ? index + B_COLS : -1,
    ];
    for (const next of neighbors) {
      if (next < 0) continue;
      const copy = board.slice();
      const swap = copy[index] ?? 0;
      copy[index] = copy[next] ?? 0;
      copy[next] = swap;
      if (groupsOf(copy).length) return [index, next];
    }
  }
  return null;
}

export function bladeSwap(board: number[], a: number, b: number, rng: Rng): { board: number[]; damage: number } | null {
  if (!bladeAdjacent(a, b)) return null;
  const next = board.slice();
  const swap = next[a] ?? 0;
  next[a] = next[b] ?? 0;
  next[b] = swap;
  if (!groupsOf(next).length) return null;
  let damage = 0;
  let current = next;
  for (let guard = 0; guard < 6; guard++) {
    const groups = groupsOf(current);
    if (!groups.length) break;
    const cleared = new Set<number>();
    for (const group of groups) for (const cell of group) cleared.add(cell);
    damage += strikeDamage(cleared.size);
    current = collapse(current, cleared, rng);
  }
  return { board: current, damage };
}
