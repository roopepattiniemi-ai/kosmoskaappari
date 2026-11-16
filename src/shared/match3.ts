import type { Rng } from "./rng.js";

export const COLS = 8;
export const ROWS = 8;
export const TYPES = 6;
export const CELL_COUNT = COLS * ROWS;
export const CHARGE_PER_CELL = 4;

export type Board = number[];

export interface MatchGroup {
  cells: number[];
  horizontal: boolean;
  length: number;
  type: number;
}

export interface ResolveStep {
  cleared: number[];
  gain: number;
  cascade: number;
  banner: string;
  board: string;
}

export interface ResolveResult {
  steps: ResolveStep[];
  board: Board;
  gain: number;
}

export function idx(x: number, y: number): number {
  return y * COLS + x;
}

export function encodeBoard(board: Board): string {
  let out = "";
  for (let i = 0; i < board.length; i++) {
    const v = board[i] ?? -1;
    out += v < 0 ? "." : String(v);
  }
  return out;
}

export function decodeBoard(text: string): Board {
  const board: Board = [];
  for (let i = 0; i < CELL_COUNT; i++) {
    const ch = text.charAt(i);
    board.push(ch === "" || ch === "." ? -1 : Number(ch));
  }
  return board;
}

export function adjacent(a: number, b: number): boolean {
  if (a === b || a < 0 || b < 0 || a >= CELL_COUNT || b >= CELL_COUNT) return false;
  const ax = a % COLS;
  const ay = Math.floor(a / COLS);
  const bx = b % COLS;
  const by = Math.floor(b / COLS);
  return Math.abs(ax - bx) + Math.abs(ay - by) === 1;
}

export function findGroups(board: Board): MatchGroup[] {
  const groups: MatchGroup[] = [];
  for (let y = 0; y < ROWS; y++) {
    let x = 0;
    while (x < COLS) {
      const t = board[idx(x, y)] ?? -1;
      let x2 = x + 1;
      while (x2 < COLS && board[idx(x2, y)] === t) x2++;
      const len = x2 - x;
      if (t >= 0 && len >= 3) {
        const cells: number[] = [];
        for (let k = x; k < x2; k++) cells.push(idx(k, y));
        groups.push({ cells, horizontal: true, length: len, type: t });
      }
      x = x2;
    }
  }
  for (let x = 0; x < COLS; x++) {
    let y = 0;
    while (y < ROWS) {
      const t = board[idx(x, y)] ?? -1;
      let y2 = y + 1;
      while (y2 < ROWS && board[idx(x, y2)] === t) y2++;
      const len = y2 - y;
      if (t >= 0 && len >= 3) {
        const cells: number[] = [];
        for (let k = y; k < y2; k++) cells.push(idx(x, k));
        groups.push({ cells, horizontal: false, length: len, type: t });
      }
      y = y2;
    }
  }
  return groups;
}

function swapWouldMatch(board: Board, a: number, b: number): boolean {
  const va = board[a] ?? 0;
  const vb = board[b] ?? 0;
  board[a] = vb;
  board[b] = va;
  const ok = findGroups(board).length > 0;
  board[a] = va;
  board[b] = vb;
  return ok;
}

/** First legal swap, scanning left-to-right, top-to-bottom. */
export function findMove(board: Board): [number, number] | null {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const i = idx(x, y);
      if (x + 1 < COLS && swapWouldMatch(board, i, idx(x + 1, y))) return [i, idx(x + 1, y)];
      if (y + 1 < ROWS && swapWouldMatch(board, i, idx(x, y + 1))) return [i, idx(x, y + 1)];
    }
  }
  return null;
}

function applyClears(board: Board, groups: MatchGroup[]): { cleared: number[]; banner: string } {
  const mark = new Set<number>();
  let banner = "";
  for (const g of groups) {
    for (const c of g.cells) mark.add(c);
    if (g.length >= 5) banner = "Kristallipommi!";
    else if (g.length >= 4 && banner === "") banner = "Linja!";
    if (g.length >= 4 && g.horizontal) {
      const y = Math.floor(g.cells[0]! / COLS);
      for (let x = 0; x < COLS; x++) mark.add(idx(x, y));
    } else if (g.length >= 4 && !g.horizontal) {
      const x = g.cells[0]! % COLS;
      for (let y = 0; y < ROWS; y++) mark.add(idx(x, y));
    }
    if (g.length >= 5) {
      for (let i = 0; i < board.length; i++) {
        if (board[i] === g.type) mark.add(i);
      }
    }
  }
  return { cleared: [...mark], banner };
}

export function collapseAndRefill(board: Board, cleared: Set<number>, rng: Rng): Board {
  const next = board.slice();
  for (const i of cleared) next[i] = -1;
  for (let x = 0; x < COLS; x++) {
    const stack: number[] = [];
    for (let y = ROWS - 1; y >= 0; y--) {
      const v = next[idx(x, y)] ?? -1;
      if (v >= 0) stack.push(v);
    }
    let si = 0;
    for (let y = ROWS - 1; y >= 0; y--) {
      const survivor = stack[si];
      if (survivor !== undefined) {
        next[idx(x, y)] = survivor;
        si++;
      } else {
        next[idx(x, y)] = Math.floor(rng() * TYPES);
      }
    }
  }
  return next;
}

/** Clear matches, drop, refill, repeat. A 4-match also clears its row or column. A 5-match clears that colour. */
export function resolveBoard(start: Board, rng: Rng): ResolveResult {
  let board = start.slice();
  const steps: ResolveStep[] = [];
  let total = 0;
  for (let guard = 0; guard < 24; guard++) {
    const groups = findGroups(board);
    if (groups.length === 0) break;
    const { cleared, banner } = applyClears(board, groups);
    const cascade = steps.length;
    const mult = 1 + cascade * 0.5;
    const gain = Math.round(cleared.length * CHARGE_PER_CELL * mult);
    total += gain;
    board = collapseAndRefill(board, new Set(cleared), rng);
    const label = banner || (cascade > 0 ? `Ketju x${cascade + 1}` : "Osuma!");
    steps.push({
      cleared,
      gain,
      cascade,
      banner: label,
      board: encodeBoard(board),
    });
  }
  // Safety valve: break anything still matching so the board never locks.
  for (let extra = 0; extra < 6 && findGroups(board).length > 0; extra++) {
    const g = findGroups(board)[0];
    if (!g) break;
    board[g.cells[0]!] = (g.type + 1 + extra) % TYPES;
  }
  return { steps, board, gain: total };
}

export function trySwap(board: Board, a: number, b: number, rng: Rng): ResolveResult | null {
  if (!adjacent(a, b)) return null;
  const next = board.slice();
  const tmp = next[a] ?? 0;
  next[a] = next[b] ?? 0;
  next[b] = tmp;
  if (findGroups(next).length === 0) return null;
  return resolveBoard(next, rng);
}

function fallbackBoard(): Board {
  const board: Board = [];
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) board.push((x + y * 2) % TYPES);
  }
  // Guaranteed horizontal match after swapping (2,0) with (2,1).
  board[idx(0, 0)] = 0;
  board[idx(1, 0)] = 0;
  board[idx(2, 0)] = 5;
  board[idx(2, 1)] = 0;
  return board;
}

export function generateBoard(rng: Rng): Board {
  for (let attempt = 0; attempt < 40; attempt++) {
    const seed: Board = [];
    for (let i = 0; i < CELL_COUNT; i++) seed.push(Math.floor(rng() * TYPES));
    const resolved = resolveBoard(seed, rng);
    if (findGroups(resolved.board).length === 0 && findMove(resolved.board)) {
      return resolved.board;
    }
  }
  const board = fallbackBoard();
  return findMove(board) ? board : fallbackBoard();
}
