const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// What the villagers do while they stand about (src/server/idle-gestures.ts).

function load(rows) {
    const logs = [];
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Math,
        Animations: { list: (word) => rows.filter((row) => row.fragment.toLowerCase().includes(String(word).toLowerCase())) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/idle-gestures.js"), "utf8"), context);
    return { api: context.exports, logs };
}

const row = (fragment, over = {}) => ({ fragment, tags: "", duration: 3, oneShot: true, fullBody: false, male: true, female: true, ...over });
const body = (id = 1, over = {}) => {
    const npc = { id, alive: true, status: "idle", simulator: { id: 5 }, played: [], playAnimation(fragment, how) { this.played.push([fragment, how.tags]); return true; }, ...over };
    return npc;
};

test("the pool is the game's own idle variations, the plain variant that fits a man and a woman, short ones only, and says what it found", () => {
    const sut = load([
        row("MotionIdleVARdefault"),
        row("MotionIdleVARdefault", { tags: "l_noweapon+r_noweapon" }),
        row("MotionIdleVAR1", { duration: 30 }),
        row("MotionIdleVAR1"),
        row("MotionIdleVAR2", { female: false }),
        row("MotionIdleVAR2", { oneShot: false }),
        row("CheckStash"),
        row("ChestCheckIn"),
    ]);
    const pool = Array.from(sut.api.gesturePool(), (entry) => entry.fragment);
    assert.deepEqual(pool, ["MotionIdleVARdefault", "MotionIdleVAR1"], "never the chest checks, whose hands take up gear with its sound (2026-10-25)");
    assert.match(sut.logs[0], /2 gesto\(s\) de pausa achados/);
    sut.api.gesturePool();
    assert.equal(sut.logs.length, 1, "searched once");
});

test("a pause may become a gesture, not on a body nobody runs, not while it walks, not twice within the gap, and never the same twice running", () => {
    const sut = load([row("MotionIdleVARdefault"), row("MotionIdleVAR1"), row("MotionIdleVAR2")]);
    const npc = body();
    assert.equal(sut.api.maybeGesture(npc, 1_000, () => 0.9), false, "the chance said no");
    assert.equal(sut.api.maybeGesture(npc, 1_000, () => 0.1), true);
    assert.equal(npc.played.length, 1);
    assert.equal(sut.api.maybeGesture(npc, 2_000, () => 0.1), false, "too soon");
    const first = npc.played[0][0];
    assert.equal(sut.api.maybeGesture(npc, 1_000 + sut.api.gestures.everyMs, () => 0.1), true);
    assert.notEqual(npc.played[1][0], first);

    assert.equal(sut.api.maybeGesture(body(2, { simulator: null }), 1_000, () => 0.1), false, "nobody runs it: it would play nothing");
    assert.equal(sut.api.maybeGesture(body(3, { status: "running" }), 1_000, () => 0.1), false);
    assert.equal(sut.api.maybeGesture(body(4, { alive: false }), 1_000, () => 0.1), false);
});

test("with nothing found in the catalog there is no gesture and no error", () => {
    const sut = load([]);
    assert.equal(sut.api.maybeGesture(body(), 1_000, () => 0.1), false);
});
