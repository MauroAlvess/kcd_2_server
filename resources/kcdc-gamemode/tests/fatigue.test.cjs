const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function loadServer() {
    const clients = new Map();
    const handlers = new Map();
    const intervals = [];
    const logs = [];
    const players = [];
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => handlers.set(name, fn), onClient: (name, fn) => clients.set(name, fn) },
        Player: { all: () => players },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/fatigue.js"), "utf8"), context);
    return { api: context.exports, clients, handlers, intervals, logs, players };
}

/** A body whose energy is what was last set, or what the game wore it down to. */
function body(id, energy, { max = 100, ready = true, alive = true } = {}) {
    return {
        id,
        ready,
        alive,
        maxExhaust: max,
        energy,
        sets: [],
        getStat(stat) { assert.equal(stat, "exhaust"); return this.energy; },
        setStat(stat, value) { assert.equal(stat, "exhaust"); this.sets.push(value); this.energy = value; return true; },
    };
}

/**
 * A pace with a clock the test moves, and `minutes` of ticks run on `players`. `say` is what the client keeps saying
 * before each tick (it says its posture every five seconds), or nothing.
 */
function paced(api) {
    const clock = { now: 1_000_000 };
    const pace = new api.FatiguePace(() => clock.now);
    const run = (players, minutes, say = () => {}) => {
        for (let spent = 0; spent < minutes * 60_000; spent += 15_000) {
            say();
            pace.tick(players);
            clock.now += 15_000;
        }
        say();
        pace.tick(players);
    };
    return { pace, clock, run };
}

test("the stance tags of the game's stance group say lying, sitting or up; a body asleep is lying", () => {
    const { api } = loadServer();
    assert.equal(api.postureOf(5), "lying");
    assert.equal(api.postureOf(28), "lying", "lying in a bed");
    assert.equal(api.postureOf(1), "sitting");
    assert.equal(api.postureOf(3), "sitting", "sitting on the ground");
    assert.equal(api.postureOf(36), "sitting", "a sitting variation");
    assert.equal(api.postureOf(0), "up", "on a horse is no rest");
    assert.equal(api.postureOf(255), "up", "nothing set");
    assert.equal(api.postureOf(255, true), "lying");
});

test("lying down brings the energy back from empty in twelve minutes; sitting takes thirty", () => {
    const { api } = loadServer();
    const lying = paced(api);
    const tired = body(1, 0);
    const inBed = () => lying.pace.report(1, 28, false);
    lying.run([tired], 6, inBed);
    assert.ok(Math.abs(tired.energy - 50) < 3, `half way after six minutes, ${tired.energy}`);
    lying.run([tired], 7, inBed);
    assert.equal(tired.energy, 100, "and full, never past it");

    const sitting = paced(api);
    const other = body(2, 0);
    sitting.run([other], 15, () => sitting.pace.report(2, 1, false));
    assert.ok(Math.abs(other.energy - 50) < 4, `half way after fifteen minutes sitting, ${other.energy}`);

    const stale = paced(api);
    const lazy = body(3, 0);
    stale.pace.report(3, 28, false);
    stale.run([lazy], 6);
    assert.equal(lazy.energy, 0, "a posture the client stopped saying is not rest");
});

test("up and about the energy wears down to five percent in four hours, never below by this pace", () => {
    const { api } = loadServer();
    const { run } = paced(api);
    const walker = body(1, 100);
    run([walker], 120);
    assert.ok(Math.abs(walker.energy - 52.5) < 2, `half the way down after two hours, ${walker.energy}`);
    run([walker], 200);
    assert.equal(walker.energy, 5, "the floor");
});

test("what the game wore down by itself counts toward the pace instead of being added to it", () => {
    const { api } = loadServer();
    const { pace, clock } = paced(api);
    const walker = body(1, 80);
    pace.tick([walker]);
    clock.now += 15_000;
    walker.energy -= 1;
    pace.tick([walker]);
    assert.deepEqual(walker.sets, [], "the game already took more than a tick's worth: nothing more");
});

test("a posture not said again for a while is not believed, and the unready and the dead are left alone", () => {
    const { api } = loadServer();
    const { pace, clock, run } = paced(api);
    pace.report(1, 28, false);
    assert.equal(pace.posture(1).posture, "lying");
    clock.now += 13_000;
    assert.equal(pace.posture(1).posture, "up");
    assert.equal(pace.posture(1).tag, 28, "the last tag is still told, for /cansaco");

    const waiting = body(2, 50, { ready: false });
    const dead = body(3, 50, { alive: false });
    run([waiting, dead], 5);
    assert.deepEqual([waiting.sets, dead.sets], [[], []]);
});

test("the client's posture reports are checked, and /cansaco says the energy and the posture", () => {
    const { api, clients, intervals, logs, players } = loadServer();
    api.installFatigue();
    const report = clients.get("kcdc-gamemode:posture");
    const hans = { ...body(4, 64), nickname: "Hans" };
    players.push(hans);
    report(hans, JSON.stringify({ tag: 1, asleep: 0 }));
    report(hans, JSON.stringify({ tag: 999 }));
    report(hans, "nonsense");
    assert.match(api.describeFatigue(hans), /^Energia 64%, sentado \(postura 1\)/);
    report(hans, { tag: 255, asleep: 1 });
    assert.match(api.describeFatigue(hans), /deitado \(postura 255\)/);
    assert.equal(intervals[0].ms, 15_000);
    assert.ok(logs.some((line) => /fatigue: deitado recupera em 12 min, sentado em 30 min/.test(line)));
});

test("the client says its posture when it changes and every five seconds, and nothing before the body is ready", () => {
    const intervals = [];
    const sent = [];
    const clock = { now: 0 };
    const me = { ready: false, stanceTag: 255, sleeping: 0 };
    const context = {
        exports: {},
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        get LocalPlayer() { return me; },
        Events: { on() {}, emitServer: (name, payload) => sent.push({ name, payload: JSON.parse(payload) }) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/posture.js"), "utf8"), context);
    context.exports.installPosture();
    const tick = () => { clock.now += 1000; intervals[0].fn(); };

    tick();
    assert.deepEqual(sent, []);
    me.ready = true;
    tick();
    assert.deepEqual(sent.at(-1), { name: "kcdc-gamemode:posture", payload: { tag: 255, asleep: 0 } });
    tick();
    tick();
    assert.equal(sent.length, 1, "nothing new to say");
    me.stanceTag = 1;
    tick();
    assert.deepEqual(sent.at(-1).payload, { tag: 1, asleep: 0 });
    for (let i = 0; i < 5; i += 1) tick();
    assert.equal(sent.length, 3, "said again after five seconds");
    me.sleeping = 1;
    tick();
    assert.deepEqual(sent.at(-1).payload, { tag: 1, asleep: 1 });
});
