import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { playerShotDamage, resolveEnemyShot } from "./combat.ts";

describe("combat output", () => {
  it("scales a shot by line power, weapons energy and sensors", () => {
    const base = playerShotDamage({
      power: 1,
      weaponsBars: 3,
      sensorsManned: false,
      fromAuto: false,
    });
    const tetris = playerShotDamage({
      power: 4,
      weaponsBars: 3,
      sensorsManned: true,
      fromAuto: false,
    });
    const dry = playerShotDamage({
      power: 4,
      weaponsBars: 0,
      sensorsManned: true,
      fromAuto: false,
    });
    const auto = playerShotDamage({
      power: 1,
      weaponsBars: 3,
      sensorsManned: false,
      fromAuto: true,
    });
    assert.equal(dry, 0);
    assert.ok(tetris > base * 3);
    assert.ok(auto < base);
    assert.ok(Math.abs(auto / base - 0.4) < 0.001);
  });

  it("lets shields soak a hit and engines dodge a low roll", () => {
    const naked = resolveEnemyShot({
      shieldBars: 0,
      shieldManned: false,
      enginesBars: 0,
      helmManned: false,
      roll: 0.5,
    });
    const shielded = resolveEnemyShot({
      shieldBars: 3,
      shieldManned: true,
      enginesBars: 0,
      helmManned: false,
      roll: 0.5,
    });
    const weakShield = resolveEnemyShot({
      shieldBars: 3,
      shieldManned: false,
      enginesBars: 0,
      helmManned: false,
      roll: 0.5,
    });
    const dodge = resolveEnemyShot({
      shieldBars: 0,
      shieldManned: false,
      enginesBars: 4,
      helmManned: true,
      roll: 0.01,
    });
    const noDodge = resolveEnemyShot({
      shieldBars: 0,
      shieldManned: false,
      enginesBars: 4,
      helmManned: true,
      roll: 0.99,
    });
    assert.equal(naked.damage, 18);
    assert.ok(shielded.damage < naked.damage);
    assert.ok(weakShield.damage > shielded.damage);
    assert.equal(dodge.dodged, true);
    assert.equal(dodge.damage, 0);
    assert.equal(noDodge.dodged, false);
    assert.equal(noDodge.damage, 18);
  });
});
