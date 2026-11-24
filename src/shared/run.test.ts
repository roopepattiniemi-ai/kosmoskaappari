import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mulberry32 } from "./rng.ts";
import {
  encodeMap,
  generateMap,
  parseMap,
  resolveVote,
  threat,
  upgradeCost,
  upgradeFactor,
  eventOutcome,
} from "./run.ts";

describe("roguelike run", () => {
  it("builds three sectors of 6–8 nodes with one boss each and a path through", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const nodes = generateMap(mulberry32(seed));
      const round = parseMap(encodeMap(nodes));
      assert.equal(round.length, nodes.length);
      for (let sector = 0; sector < 3; sector++) {
        const group = nodes.filter((node) => node.sector === sector);
        assert.ok(group.length >= 6 && group.length <= 8, `sector ${sector} has ${group.length}`);
        assert.equal(group.filter((node) => node.type === "boss").length, 1);
        assert.equal(group.find((node) => node.col === 0)?.type, "battle");
      }
      const seen = new Set<number>([0]);
      const queue = [0];
      while (queue.length) {
        const id = queue.pop()!;
        for (const next of nodes[id].next) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      const lastBoss = nodes.filter((node) => node.type === "boss").at(-1)!;
      assert.ok(seen.has(lastBoss.id));
      assert.equal(lastBoss.next.length, 0);
    }
  });

  it("picks a majority and lets the captain break a tie", () => {
    assert.deepEqual(resolveVote(["a", "b", "c"], { a: 4 }, "a"), { ready: false, choice: null });
    assert.deepEqual(resolveVote(["a", "b", "c"], { a: 4, b: 4 }, "c"), { ready: true, choice: 4 });
    assert.deepEqual(resolveVote(["a", "b"], { a: 3, b: 3 }, "a"), { ready: true, choice: 3 });
    assert.deepEqual(resolveVote(["a", "b"], { a: 3, b: 9 }, "a"), { ready: true, choice: 3 });
    assert.deepEqual(resolveVote(["a", "b"], { a: 5, b: 8 }, "z"), { ready: true, choice: 5 });
  });

  it("raises hull and prices with sector, boss and upgrade level", () => {
    assert.equal(threat(0, false).hull, 140);
    assert.ok(threat(1, false).hull > threat(0, false).hull);
    assert.ok(threat(2, true).damage > threat(2, false).damage);
    assert.equal(upgradeCost(2), 8);
    assert.equal(upgradeCost(3), 14);
    assert.equal(upgradeFactor(1), 1);
    assert.equal(upgradeFactor(3), 1.5);
    assert.equal(eventOutcome(2, 0, 0.1).weak, 1);
    assert.equal(eventOutcome(0, 1, 0.1).hull, -8);
    assert.equal(eventOutcome(0, 1, 0.9).fuel, 2);
  });
});
