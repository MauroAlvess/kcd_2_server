const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { torch } = require("./torchstub.cjs");
require("./reachpatch.cjs");

// A chest of a World Builder export is opened from its front (`useDirection`); one whose front faces a bed is turned round
// (src/server/furniture.ts; user, 2026-10-19: "os baús que colocamos ... não tem como interagir").

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function load({ walls = [] } = {}) {
    const context = {
        exports: {},
        require: (id) => ({ "./torch-down.js": torch, "./fatigue.js": { fatiguePace: { hold() {} } }, "./store.js": { ensureDir() {}, read: () => ({ status: "missing" }), write() {} } })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {}, error() {} },
        Vector3,
        Navigation: {
            ready: true,
            closestPoint: (p) => (walls.some((w) => p.x >= w.x0 && p.x <= w.x1 && p.y >= w.y0 && p.y <= w.y1) ? new Vector3(p.x + 2, p.y, p.z) : new Vector3(p.x, p.y, p.z)),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/furniture.js"), "utf8"), context);
    return context.exports;
}

const chest = (x, y, dx, dy) => ({ position: { x, y, z: 125 }, useDirection: { x: dx, y: dy } });

test("a chest whose front stands in a bed of the export is not free; turned the other way it is", () => {
    const api = load();
    const obstacles = api.obstaclesOf([
        { model: "objects/manmade/common_furniture/beds/bed_double_royal_a.cgf", position: { x: 0, y: 2, z: 125 } },
        { model: "objects/manmade/common_furniture/chests/chest_fancy_d_big.cgf", position: { x: 0, y: 0.5, z: 125 } },
    ]);
    assert.deepEqual(Array.from(obstacles, (one) => one.r), [1.3, 0.4]);
    const beds = obstacles.slice(0, 1);
    // The opener stands at position - useDirection * 0.9.
    assert.equal(api.frontIsFree(chest(0, 0.5, 0, -1), beds), false, "standing at y 1.4, in the bed");
    assert.equal(api.frontIsFree(chest(0, 0.5, 0, 1), beds), true, "standing at y -0.4, free");
});

test("turning is decided by the export's pieces alone, on both sides of the chest as it was made (2026-10-20)", () => {
    const api = load({ walls: [{ x0: -5, x1: 5, y0: -5, y1: 5 }] });
    const beds = api.obstaclesOf([{ model: "objects/manmade/common_furniture/beds/bed_double_royal_a.cgf", position: { x: 0, y: 2, z: 125 } }]);
    assert.equal(api.frontBlocked(chest(0, 0.5, 0, -1), beds, 1), true, "its front to the bed");
    assert.equal(api.frontBlocked(chest(0, 0.5, 0, -1), beds, -1), false, "its back is free, though the walkable mesh says no ground there");
    assert.equal(api.frontBlocked(chest(0, 0.5, 0, 1), beds, 1), false, "turned, nothing of the export in front: it stays");
    assert.equal(api.frontBlocked({ position: { x: 0, y: 0, z: 0 } }, beds), null);
});

test("a wall of the level counts too, and without a direction nothing can be said", () => {
    const api = load({ walls: [{ x0: -1, x1: 1, y0: -2, y1: -0.2 }] });
    assert.equal(api.frontIsFree(chest(0, 0.5, 0, 1), []), false);
    assert.equal(api.frontIsFree({ position: { x: 0, y: 0, z: 0 } }, []), null);
});

test("tables and chairs of the export are in the way; other props are not", () => {
    const api = load();
    const kinds = api.obstaclesOf([
        { model: "objects/manmade/common_furniture/tables/table_fancy_a_long.cgf", position: { x: 0, y: 0, z: 0 } },
        { model: "objects/manmade/common_furniture/chairs/high/chair_fancy_a.cgf", position: { x: 0, y: 0, z: 0 } },
        { model: "objects/manmade/common_decorations/candles/candle_a.cgf", position: { x: 0, y: 0, z: 0 } },
    ]);
    assert.deepEqual(Array.from(kinds, (one) => one.r), [0.9, 0.35]);
});
