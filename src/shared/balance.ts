/** Tunable combat and station numbers for the single v0.1 battle. */

export const AUTO_EFF = 0.4;

export const PLAYER_HULL = 100;
export const ENEMY_HULL = 140;
export const ENEMY_INTERVAL = 5;
export const ENEMY_FIRST_SHOT = 6.5;
export const ENEMY_RAW_DAMAGE = 18;
export const SHIELD_BLOCK_PER_BAR = 3.5;
export const DODGE_PER_BAR = 0.1;
export const DODGE_CAP = 0.45;
export const REPAIR_MANNED = 0.72;
export const REPAIR_AUTO = 0.18;

/** Damage of a player shot before energy, sensors and auto penalty. */
export const SHOT_BASE = 16;
export const SENSOR_MOD_MANNED = 1.15;
export const SENSOR_MOD_AUTO = 0.7;
export const AUTO_SHOT_MULT = 0.4;
export const AUTO_AMMO_EVERY = 6.8;
export const FIRE_INTERVAL = 1.15;
export const AMMO_CAP = 8;

export const START_PIPS = 4;
export const MAX_PIPS = 8;
export const SYSTEM_CAP = 4;
export const PIP_COST = 28;
export const REACTOR_AUTO_CHARGE = 1.5;

export const WALK_SPEED = 250;
export const CLIMB_SPEED = 175;

export const GRAVITY_START = 0.82;
export const GRAVITY_MIN = 0.3;
export const GRAVITY_RAMP = 0.0045;
export const LOCK_DELAY = 0.45;
export const MAX_LOCK_RESETS = 10;

export function gravityInterval(elapsedSec: number): number {
  return Math.max(GRAVITY_MIN, GRAVITY_START - elapsedSec * GRAVITY_RAMP);
}

export function linePower(lines: number): number {
  if (lines <= 0) return 0;
  if (lines >= 4) return 4;
  return lines;
}

export function lineBanner(lines: number): string {
  if (lines === 2) return "Kaksoislinja!";
  if (lines === 3) return "Kolmoislinja!";
  if (lines >= 4) return "TETRIS!";
  return "";
}
