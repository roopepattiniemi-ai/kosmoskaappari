import type { ResolveStep } from "./match3.js";

export type FxKind = "laser-me" | "laser-them" | "boom" | "shield" | "dodge";

export type GameEvent =
  | { type: "reactor"; ok: true; a: number; b: number; steps: ResolveStep[] }
  | { type: "reactor"; ok: false; a: number; b: number }
  | { type: "clear"; rows: number[]; banner: string; power: number }
  | { type: "fx"; kind: FxKind; amount: number };

export type TetrisCmd = "left" | "right" | "rot" | "soft" | "hard";
export type EnergySystem = "weapons" | "shield" | "engines";

export function isTetrisCmd(value: string): value is TetrisCmd {
  return value === "left" || value === "right" || value === "rot" || value === "soft" || value === "hard";
}

export function isEnergySystem(value: string): value is EnergySystem {
  return value === "weapons" || value === "shield" || value === "engines";
}

export function sanitizeName(raw: unknown, fallback: string): string {
  const text = String(raw ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, 16);
  return text.length > 0 ? text : fallback;
}
