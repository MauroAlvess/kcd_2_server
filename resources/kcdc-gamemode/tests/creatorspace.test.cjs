const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const box = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/creator-space.js"), "utf8"), box);
const space = box.exports;
const flat = (spot) => ({ x: spot.x, y: spot.y, z: spot.z });
const apart = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("somebody is in the picture when they stand within 30 m, whatever the height", () => {
    assert.equal(space.MIN_DISTANCE_M, 30);
    const here = { x: 0, y: 0, z: 0 };
    assert.equal(space.crowded(here, []), false);
    assert.equal(space.crowded(here, [{ x: 29.9, y: 0, z: 0 }]), true);
    assert.equal(space.crowded(here, [{ x: 30, y: 0, z: 0 }]), false);
    assert.equal(space.crowded(here, [{ x: 3, y: 4, z: 50 }]), true, "another floor of the same house is as much in the way");
});

test("nobody near: no booth; crowded: the first ring's first free direction, on ground", () => {
    const here = { x: 100, y: 100, z: 10 };
    assert.equal(space.planBooth(here, [{ x: 500, y: 500, z: 0 }], flat), null);
    const booth = space.planBooth(here, [{ x: 101, y: 100, z: 10 }], flat);
    assert.ok(booth !== null);
    assert.ok(Math.abs(apart(booth, here) - space.RINGS_M[0]) < 1e-9, "the nearest ring");
    assert.ok(apart(booth, { x: 101, y: 100 }) >= 30);
});

test("a spot beside another creator's booth is skipped, and the next ring is tried when a whole ring is taken", () => {
    const here = { x: 0, y: 0, z: 0 };
    const first = space.planBooth(here, [{ x: 1, y: 0, z: 0 }], flat);
    const second = space.planBooth(here, [{ x: 1, y: 0, z: 0 }, first], flat);
    assert.ok(apart(second, first) >= 30);

    const ringOne = Array.from({ length: space.BEARINGS }, (_, n) => ({ x: Math.cos((n / space.BEARINGS) * 2 * Math.PI) * space.RINGS_M[0], y: Math.sin((n / space.BEARINGS) * 2 * Math.PI) * space.RINGS_M[0], z: 0 }));
    const beyond = space.planBooth(here, [{ x: 1, y: 0, z: 0 }, ...ringOne], flat);
    assert.ok(beyond !== null && apart(beyond, here) > space.RINGS_M[0], "past the taken ring");
});

test("ground that is not there, or too high or low, is no booth; nowhere at all leaves them where they are", () => {
    const here = { x: 0, y: 0, z: 0 };
    const crowd = [{ x: 1, y: 0, z: 0 }];
    assert.equal(space.planBooth(here, crowd, () => null), null);
    assert.equal(space.planBooth(here, crowd, (spot) => ({ ...spot, z: spot.z + space.MAX_RISE_M + 1 })), null);
    assert.equal(space.planBooth(here, crowd, (spot) => ({ ...spot, z: spot.z - space.MAX_RISE_M - 1 })), null);
    assert.ok(space.planBooth(here, crowd, (spot) => ({ ...spot, z: spot.z + space.MAX_RISE_M })) !== null);
    // Ground that moves the spot to somebody else's feet is judged where it ends up.
    assert.equal(space.planBooth(here, crowd, () => ({ x: 2, y: 0, z: 0 })), null);
});

test("a creator is taken back only to a spot with nobody on it", () => {
    const origin = { x: 0, y: 0, z: 0 };
    assert.equal(space.backFree(origin, []), true);
    assert.equal(space.backFree(origin, [{ x: 2.9, y: 0, z: 0 }]), false);
    assert.equal(space.backFree(origin, [{ x: 3, y: 0, z: 0 }]), true);
});
