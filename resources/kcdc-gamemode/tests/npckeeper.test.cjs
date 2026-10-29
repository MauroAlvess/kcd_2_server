"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The keeper of the posts and vendors (src/server/npc-keeper.ts, 2026-10-25: "caem no rio e não voltam ou se trancam em casa e não saem mais").

function load() {
    const sandbox = { exports: {}, Math: Object.create(Math, { random: { value: () => 0 } }), Navigation: { ready: true }, Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/npc-keeper.js"), "utf8"), sandbox);
    return sandbox.exports;
}

function ground({ off = () => false, shut = () => false, ready = true } = {}) {
    const asked = { onGround: 0, canWalk: 0 };
    return {
        asked,
        get ready() { return ready; },
        onGround(at) { asked.onGround += 1; return !off(at); },
        canWalk(from, to) { asked.canWalk += 1; return !shut(from, to); },
    };
}

const PLACE = { x: 100, y: 100, z: 50 };

test("a body well below its place has fallen, one past its walk and the margin has strayed, and nothing is asked before its look comes round", () => {
    const { NpcKeeper, keeperSettings } = load();
    const probe = ground();
    const keeper = new NpcKeeper(probe);
    assert.equal(keeper.look("a", { x: 100, y: 100, z: 40 }, PLACE, 12, 0), "caiu", "first look at once (random 0): ten metres down");
    assert.equal(keeper.look("a", { x: 100, y: 100, z: 40 }, PLACE, 12, 5_000), null, "not again before its next look");
    assert.equal(keeper.look("b", { x: 100 + 12 + keeperSettings.strayM + 1, y: 100, z: 50 }, PLACE, 12, 0), "longe");
    assert.equal(keeper.look("c", { x: 100 + 12 + keeperSettings.strayM - 1, y: 100, z: 50 }, PLACE, 12, 0), null, "within its walk and the margin");
    assert.equal(keeper.look("d", { x: 400, y: 100, z: 50 }, PLACE, 12, 0, true), null, "on its way home at night: far is fine");
});

test("off the walkable ground twice running is deep water; with no walk back twice running, a locked house; near its place nobody asks for a walk", () => {
    const { NpcKeeper, keeperSettings } = load();
    const probe = ground({ off: (at) => at.x === 110, shut: (from) => from.x === 120 });
    const keeper = new NpcKeeper(probe);
    const wet = { x: 110, y: 100, z: 50 };
    assert.equal(keeper.look("w", wet, PLACE, 30, 0), null, "once is not enough");
    assert.equal(keeper.look("w", wet, PLACE, 30, keeperSettings.lookEveryMs), "fora do chão");

    const inside = { x: 120, y: 100, z: 50 };
    let reason = null;
    let now = 0;
    for (let look = 0; look < 10 && reason === null; look += 1) {
        reason = keeper.look("h", inside, PLACE, 30, now);
        now += keeperSettings.lookEveryMs;
    }
    assert.equal(reason, "preso");
    assert.ok(now >= keeperSettings.reachEveryMs, "the walk back is asked only every so often");

    const before = probe.asked.canWalk;
    keeper.look("n", { x: 101, y: 100, z: 50 }, PLACE, 30, 10 * keeperSettings.reachEveryMs);
    keeper.look("n", { x: 101, y: 100, z: 50 }, PLACE, 30, 20 * keeperSettings.reachEveryMs);
    assert.equal(probe.asked.canWalk, before, "a metre from its place: there");
});

test("a body brought back is left alone for a while, its rescues are counted, and with no walkable ground loaded only falls and strays count", () => {
    const { NpcKeeper, keeperSettings, keeperNote } = load();
    const keeper = new NpcKeeper(ground({ ready: false, off: () => true, shut: () => true }));
    assert.equal(keeper.look("x", { x: 130, y: 100, z: 50 }, PLACE, 30, 0), null, "no mesh: neither water nor a locked house can be told");
    assert.equal(keeper.rescued("x", 0), 1);
    assert.equal(keeper.look("x", { x: 100, y: 100, z: 30 }, PLACE, 30, keeperSettings.restMs - 1), null, "resting");
    assert.equal(keeper.look("x", { x: 100, y: 100, z: 30 }, PLACE, 30, keeperSettings.restMs), "caiu");
    assert.equal(keeper.rescued("x", keeperSettings.restMs), 2);
    assert.equal(
        keeperNote("vendors", "Boticário (Raborsch)", { x: 104.4, y: 103, z: 30.2 }, PLACE, "caiu", 2),
        "npc-keeper: vendors: Boticário (Raborsch) caiu (no rio, num barranco ou para baixo do chão), a 5 m do lugar (104, 103, 30): feito de novo no lugar (2a vez neste início)",
    );
});
