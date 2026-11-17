import { SECTION_IDS, type SectionId } from "./sections.js";

/** Six compartments, same order as SECTION_IDS. 0 is broken, 100 is whole. */
export const INTEGRITY_MAX = 100;

export function blankIntegrity(): number[] {
  return SECTION_IDS.map(() => INTEGRITY_MAX);
}

export function parseIntegrity(raw: string): number[] {
  const parts = raw.split(",").map((part) => Number(part));
  return SECTION_IDS.map((_, index) => {
    const value = parts[index];
    if (!Number.isFinite(value)) return INTEGRITY_MAX;
    return Math.max(0, Math.min(INTEGRITY_MAX, value));
  });
}

export function formatIntegrity(values: number[]): string {
  return parseIntegrity(values.join(",")).map((value) => String(Math.round(value))).join(",");
}

/** Broken rooms still limp along. A whole room adds nothing extra. */
export function compartmentFactor(integrity: number): number {
  const clamped = Math.max(0, Math.min(INTEGRITY_MAX, integrity));
  return 0.25 + 0.75 * (clamped / INTEGRITY_MAX);
}

export const SHIELD_WINDOW_START = 0.58;
export const SHIELD_CATCH = 22;
export const HELM_POSITIONS = 5;
export const SENSOR_MARKS = 8;
export const SENSOR_LOCK_RANGE = 1.2;

export function shieldCaught(progress: number, lane: number, sparkLane: number): boolean {
  return lane === sparkLane && progress >= SHIELD_WINDOW_START && progress < 1;
}

/** 1 on the mark, 0.5 one step off, otherwise nothing. */
export function helmScore(position: number, target: number): number {
  const gap = Math.abs(position - target);
  if (gap === 0) return 1;
  if (gap === 1) return 0.5;
  return 0;
}

export function sensorLocked(sweep: number, blip: number): boolean {
  const span = SENSOR_MARKS;
  const delta = Math.abs((((sweep % span) + span) % span) - blip);
  return Math.min(delta, span - delta) <= SENSOR_LOCK_RANGE;
}

export function sectionIndex(id: SectionId): number {
  return SECTION_IDS.indexOf(id);
}

export const ATTACK_NAMES: SectionId[] = [...SECTION_IDS];
