import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compartmentFactor,
  formatIntegrity,
  helmScore,
  parseIntegrity,
  sensorLocked,
  shieldCaught,
} from "./stations.ts";

describe("station puzzles", () => {
  it("keeps six integrity values inside 0–100", () => {
    const parsed = parseIntegrity("10,200,-4,50");
    assert.equal(parsed.length, 6);
    assert.equal(parsed[0], 10);
    assert.equal(parsed[1], 100);
    assert.equal(parsed[2], 0);
    assert.equal(parsed[3], 50);
    assert.equal(parsed[5], 100);
    assert.equal(formatIntegrity(parsed).split(",").length, 6);
  });

  it("scales a broken compartment down to a limp", () => {
    assert.equal(compartmentFactor(100), 1);
    assert.equal(compartmentFactor(0), 0.25);
    assert.ok(compartmentFactor(40) > compartmentFactor(0));
    assert.ok(compartmentFactor(40) < compartmentFactor(100));
  });

  it("catches a shield spark only in the open window of the right lane", () => {
    assert.equal(shieldCaught(0.8, 1, 1), true);
    assert.equal(shieldCaught(0.2, 1, 1), false);
    assert.equal(shieldCaught(0.9, 0, 1), false);
    assert.equal(shieldCaught(1, 1, 1), false);
  });

  it("scores the helm on how close the wheel is to the mark", () => {
    assert.equal(helmScore(3, 3), 1);
    assert.equal(helmScore(2, 3), 0.5);
    assert.equal(helmScore(0, 3), 0);
  });

  it("locks sensors when the sweep is near the blip, including the wrap", () => {
    assert.equal(sensorLocked(2.2, 2), true);
    assert.equal(sensorLocked(5, 2), false);
    assert.equal(sensorLocked(0.2, 7), true);
    assert.equal(sensorLocked(7.8, 0), true);
  });
});
