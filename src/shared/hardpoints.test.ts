import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { enemyOutput, parseMounts, resolvePlayerImpact } from "./hardpoints.ts";
import { MUSIC_FILES, SFX_FILES, musicTrack } from "./music.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("hardpoints and cues", () => {
  it("stores four exterior mounts and four enemy systems", () => {
    const ship = JSON.parse(readFileSync(path.join(root, "assets/v01/alus_oma.json"), "utf8"));
    assert.equal(ship.asepaikat.length, 4);
    assert.equal(ship.ase_sprite.leveys, 96);
    assert.equal(ship.ase_sprite.pivot_x, 96);
    for (const spot of ship.asepaikat) {
      assert.ok(spot.x > 0 && spot.x < ship.leveys);
      assert.ok(spot.y > 0 && spot.y < ship.korkeus);
    }
    const enemy = JSON.parse(readFileSync(path.join(root, "assets/v01/vihollinen.json"), "utf8"));
    assert.equal(enemy.osastot.length, 4);
    for (const box of enemy.osastot) {
      assert.ok(box.osuma[0] >= box.x && box.osuma[0] <= box.x + box.w);
      assert.ok(box.osuma[1] >= box.y && box.osuma[1] <= box.y + box.h);
    }
    assert.deepEqual(parseMounts("1,0,3,2"), [1, 0, 3, 2]);
  });

  it("lets the shield bubble take part of a shot and weakens a broken enemy", () => {
    const hit = resolvePlayerImpact(20, 30);
    assert.ok(hit.shield < 30);
    assert.ok(hit.hullDamage > 0);
    assert.ok(hit.systemDamage > 0);
    const whole = enemyOutput(18, 5, [100, 100, 100, 100]);
    const broken = enemyOutput(18, 5, [20, 20, 20, 20]);
    assert.ok(broken.damage < whole.damage);
    assert.ok(broken.interval > whole.interval);
    assert.equal(broken.regen, 0);
    assert.ok(broken.miss > 0);
  });

  it("picks music from the screen and ships every audio file", () => {
    assert.equal(musicTrack({ inGame: false, phase: "battle", screen: "battle", boss: false }), "valikko");
    assert.equal(musicTrack({ inGame: true, phase: "battle", screen: "battle", boss: false }), "taistelu");
    assert.equal(musicTrack({ inGame: true, phase: "battle", screen: "battle", boss: true }), "pomo");
    assert.equal(musicTrack({ inGame: true, phase: "explore", screen: "shop", boss: false }), "kauppa");
    assert.equal(musicTrack({ inGame: true, phase: "explore", screen: "map", boss: false }), "kartta");
    for (const file of [...Object.values(MUSIC_FILES), ...Object.values(SFX_FILES)]) {
      assert.ok(readFileSync(path.join(root, "assets/audio", file)).byteLength > 1000, file);
    }
  });
});