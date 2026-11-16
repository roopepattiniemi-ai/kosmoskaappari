import {
  AUTO_EFF,
  DODGE_CAP,
  DODGE_PER_BAR,
  ENEMY_RAW_DAMAGE,
  SENSOR_MOD_AUTO,
  SENSOR_MOD_MANNED,
  SHIELD_BLOCK_PER_BAR,
  SHOT_BASE,
} from "./balance.js";

export function stationEff(manned: boolean): number {
  return manned ? 1 : AUTO_EFF;
}

export interface EnemyShotInput {
  shieldBars: number;
  shieldManned: boolean;
  enginesBars: number;
  helmManned: boolean;
  /** 0–1. A roll under the dodge chance avoids the hit. */
  roll: number;
  raw?: number;
}

export interface EnemyShotResult {
  dodged: boolean;
  blocked: number;
  damage: number;
}

export function resolveEnemyShot(input: EnemyShotInput): EnemyShotResult {
  const raw = input.raw ?? ENEMY_RAW_DAMAGE;
  const dodge = Math.min(
    DODGE_CAP,
    input.enginesBars * DODGE_PER_BAR * stationEff(input.helmManned),
  );
  if (input.roll < dodge) {
    return { dodged: true, blocked: 0, damage: 0 };
  }
  const blocked = input.shieldBars * SHIELD_BLOCK_PER_BAR * stationEff(input.shieldManned);
  const damage = Math.max(0, raw - blocked);
  return { dodged: false, blocked, damage };
}

export interface PlayerShotInput {
  /** 1–4 from line clears. Auto shots pass 1 and fromAuto. */
  power: number;
  weaponsBars: number;
  sensorsManned: boolean;
  fromAuto: boolean;
}

/** output = line power × allocated weapons energy × sensor efficiency (× 0.4 if the loader was automatic). */
export function playerShotDamage(input: PlayerShotInput): number {
  if (input.weaponsBars <= 0 || input.power <= 0) return 0;
  const sensors = input.sensorsManned ? SENSOR_MOD_MANNED : SENSOR_MOD_AUTO;
  const auto = input.fromAuto ? AUTO_EFF : 1;
  return SHOT_BASE * input.power * (input.weaponsBars / 3) * sensors * auto;
}
