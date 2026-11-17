import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { manifestFiles } from "./assets.ts";
import { FEET_ROW, FLOOR_Y, LADDER_X, SECTIONS, buildPath, standPoint } from "./sections.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("ship layout", () => {
  it("matches alus_oma.json floors and room bounds", () => {
    const json = JSON.parse(readFileSync(path.join(root, "assets/v01/alus_oma.json"), "utf8"));
    assert.equal(FLOOR_Y.yla, json.lattia_y.yla);
    assert.equal(FLOOR_Y.ala, json.lattia_y.ala);
    assert.equal(FLOOR_Y.yla, 366);
    assert.equal(FLOOR_Y.ala, 544);
    assert.deepEqual(json.sisalto_bbox, [170, 4, 1487, 686]);
    assert.ok(SECTIONS.reaktori.hitY0 > SECTIONS.reaktori.y0);
    assert.ok(SECTIONS.aseet.hitY0 > SECTIONS.aseet.y0);
    assert.ok(SECTIONS.sensorit.hitY0 > SECTIONS.sensorit.y0);
    assert.equal(SECTIONS.ohjaus.hitY0, SECTIONS.ohjaus.y0);
    for (const [id, room] of Object.entries(json.huoneet) as Array<
      [keyof typeof SECTIONS, { x: number[]; y: number[]; lattia_y: number; kansi: string }]
    >) {
      const section = SECTIONS[id];
      assert.equal(section.x0, room.x[0]);
      assert.equal(section.x1, room.x[1]);
      assert.equal(section.y0, room.y[0]);
      assert.equal(section.y1, room.y[1]);
      assert.equal(section.floorY, room.lattia_y);
      assert.equal(section.deck, room.kansi);
    }
  });

  it("puts the ladder in the reactor column on both decks", () => {
    const upper = SECTIONS.reaktori;
    const lower = SECTIONS.ohjaus;
    assert.ok(LADDER_X > upper.x0 && LADDER_X < upper.x1);
    assert.ok(LADDER_X > lower.x0 && LADDER_X < lower.x1);
    assert.equal(upper.deck, "yla");
    assert.equal(lower.deck, "ala");
    assert.equal(SECTIONS.aseet.deck, "yla");
    assert.equal(SECTIONS.sensorit.deck, "yla");
    assert.equal(SECTIONS.korjaamo.deck, "ala");
    assert.equal(SECTIONS.suojakilpi.deck, "ala");
  });

  it("walks along a deck, and climbs when the deck changes", () => {
    const from = standPoint("ohjaus", 0);
    const same = buildPath(from.x, from.y, "ala", "korjaamo", 0);
    assert.equal(same.length, 1);
    assert.equal(same[0]!.deck, "ala");
    const cross = buildPath(from.x, from.y, "ala", "aseet", 0);
    assert.equal(cross.length, 3);
    assert.equal(cross[0]!.x, LADDER_X);
    assert.equal(cross[0]!.y, FLOOR_Y.ala);
    assert.equal(cross[1]!.x, LADDER_X);
    assert.equal(cross[1]!.y, FLOOR_Y.yla);
    assert.equal(cross[2]!.y, FLOOR_Y.yla);
    assert.equal(cross[2]!.deck, "yla");
    assert.equal(FEET_ROW, 124);
    assert.equal(FLOOR_Y.yla - FEET_ROW, 242);
    assert.equal(FLOOR_Y.ala - FEET_ROW, 420);
  });

  it("lists every file the manifest promises", () => {
    for (const rel of manifestFiles()) {
      const file = path.join(root, "assets", rel);
      assert.ok(readFileSync(file).byteLength > 0, rel);
    }
  });
});
