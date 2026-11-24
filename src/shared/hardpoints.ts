export interface Hardpoint {
  id: number;
  x: number;
  y: number;
}

export interface EnemyBox {
  id: string;
  name: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hitX: number;
  hitY: number;
}

/** Fallback if alus_oma.json has no asepaikat. The barrel grows left from this point. */
export const DEFAULT_HARDPOINTS: Hardpoint[] = [
  { id: 0, x: 250, y: 268 },
  { id: 1, x: 232, y: 330 },
  { id: 2, x: 292, y: 458 },
  { id: 3, x: 260, y: 548 },
];

export const WEAPON_SPRITE = { w: 96, h: 48, pivotX: 96, pivotY: 24 };

export const DEFAULT_ENEMY_BOXES: EnemyBox[] = [
  { id: "aseet", name: "Aseet", x: 610, y: 160, w: 210, h: 120, hitX: 740, hitY: 240 },
  { id: "kilpi", name: "Kilpi", x: 340, y: 190, w: 230, h: 150, hitX: 460, hitY: 270 },
  { id: "ohjaus", name: "Ohjaus", x: 80, y: 55, w: 190, h: 150, hitX: 175, hitY: 140 },
  { id: "reaktori", name: "Reaktori", x: 15, y: 180, w: 160, h: 150, hitX: 90, hitY: 260 },
];

export const DEFAULT_BUBBLE = { x: 460, y: 250, r: 200 };

export const WEAPON_NAMES = ["", "Laser", "Tykki", "Ohjus"];

export function parseMounts(raw: string): number[] {
  const parts = raw.split(",").map((part) => Number(part));
  return Array.from({ length: 4 }, (_, index) => {
    const value = parts[index];
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(3, Math.round(value)));
  });
}

export function parseSystems(raw: string): number[] {
  const parts = raw.split(",").map((part) => Number(part));
  return Array.from({ length: 4 }, (_, index) => {
    const value = parts[index];
    if (!Number.isFinite(value)) return 100;
    return Math.max(0, Math.min(100, value));
  });
}

/** The bubble takes part of the shot. The rest reaches the hull, and the aimed system always feels it. */
export function resolvePlayerImpact(damage: number, shield: number): { shield: number; hullDamage: number; systemDamage: number } {
  const safe = Math.max(0, damage);
  const block = Math.min(Math.max(0, shield), safe * 0.45);
  return {
    shield: Math.max(0, shield - block),
    hullDamage: Math.max(0, safe - block),
    systemDamage: (10 + safe * 0.15) * (block > 0 ? 0.45 : 1),
  };
}

export function enemyOutput(baseDamage: number, interval: number, systems: number[]): { damage: number; interval: number; miss: number; regen: number } {
  const weapons = (systems[0] ?? 100) / 100;
  const shield = (systems[1] ?? 100) / 100;
  const helm = (systems[2] ?? 100) / 100;
  const reactor = (systems[3] ?? 100) / 100;
  return {
    damage: baseDamage * (0.55 + 0.45 * weapons) * (0.7 + 0.3 * reactor),
    interval: interval * (weapons < 0.4 ? 1.7 : 1) * (reactor < 0.4 ? 1.25 : 1),
    miss: helm < 0.4 ? 0.35 : 0,
    regen: shield < 0.35 ? 0 : 4 * shield,
  };
}
