"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The Agricultores' shearing, the client's half (src/client/sheep-shear.ts, 2026-10-31): our hint "Tosquiar" on E while the aim is on the nearest sheep the server told of,
// "Parar" while the work goes on, and a step that ends it.

function load() {
    const state = { hints: [], removed: [], emitted: [], handlers: new Map(), intervals: [], visible: true, person: 0, dialogue: false, screen: false, furniture: false, keys: new Set(), asked: [], errors: [] };
    const me = { ready: true, alive: true, mounted: false };
    const context = {
        exports: {},
        require: (id) => ({
            "./furniture.js": { furnitureBusy: () => state.furniture },
            "./interaction.js": { isInteractionTargetVisible: (position, aim) => { state.asked.push({ position: { ...position }, aim: { ...aim } }); return state.visible; }, getPersonInView: () => state.person },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {}, error: (line) => state.errors.push(line) },
        Date,
        JSON,
        Number,
        LocalPlayer: me,
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => true },
        NativeUI: { element: () => ({ visible: state.screen }) },
        Key: { isDown: (key) => state.keys.has(key) },
        ActionHint: {
            create: (options, handler) => {
                state.hints.push({ options, handler });
                return state.hints.length;
            },
            remove: (id) => state.removed.push(id),
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push({ name, payload }) },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/sheep-shear.js"), "utf8"), context);
    context.exports.installSheepShear();
    const look = state.intervals.find((interval) => interval.ms === 150).fn;
    const walk = state.intervals.find((interval) => interval.ms === 100).fn;
    const near = (value) => state.handlers.get("kcdc-gamemode:sheep.near")(JSON.stringify(value));
    const work = (on) => state.handlers.get("kcdc-gamemode:sheep.state")(JSON.stringify({ on }));
    return { api: context.exports, state, me, near, work, look, walk };
}

const SHEEP = { id: 77, x: 10, y: 20, z: 5, r: 1 };
const plain = (value) => JSON.parse(JSON.stringify(value));

test("aiming at the sheep the server told of puts up our hint on E, once; looking away takes it down; a sheep that gave a moment ago has none", () => {
    const sut = load();
    sut.near(SHEEP);
    sut.look();
    assert.equal(sut.state.hints.length, 1);
    assert.deepEqual(plain(sut.state.hints[0].options), { key: "primary_action", text: "Tosquiar" });
    sut.look();
    assert.equal(sut.state.hints.length, 1, "one hint");
    sut.state.visible = false;
    sut.look();
    assert.deepEqual(sut.state.removed, [1]);
    sut.state.visible = true;
    sut.look();
    assert.equal(sut.state.hints.length, 2, "and back again when the aim returns");

    const waiting = load();
    waiting.near({ ...SHEEP, r: 0 });
    waiting.look();
    assert.equal(waiting.state.hints.length, 0, "not ready: nothing to offer");
});

test("a sheep is aimed at by its back, as near as our prompts reach: six tenths of a metre of the sheep on top of two", () => {
    const sut = load();
    sut.near(SHEEP);
    sut.look();
    const { position, aim } = sut.state.asked[0];
    assert.deepEqual(position, { x: 10, y: 20, z: 5 });
    assert.equal(aim.maxDistance, 2.6);
    assert.ok(aim.aimRadius >= 0.7 && aim.aimRadius < 1.1, "a sheep is smaller than a cow");
    assert.ok(aim.height > 0.3 && aim.height < 0.8, "and aimed at its back");
});

test("no hint while mounted, in a dialogue, over a transfer screen, on a seat, with a person in view, or when no sheep is told of", () => {
    for (const stop of [(s) => { s.me.mounted = true; }, (s) => { s.state.dialogue = true; }, (s) => { s.state.screen = true; }, (s) => { s.state.furniture = true; }, (s) => { s.state.person = 3; }, (s) => { s.me.alive = false; }]) {
        const sut = load();
        sut.near(SHEEP);
        stop(sut);
        sut.look();
        assert.equal(sut.state.hints.length, 0);
    }
    const none = load();
    none.look();
    none.near({ id: 0 });
    none.look();
    none.near("nonsense");
    none.look();
    none.near({ id: 55, x: "far", y: 0, z: 0 });
    none.look();
    assert.equal(none.state.hints.length, 0);
});

test("the press of the hint asks the server to shear that sheep, not twice in a second, and not when the aim is gone", () => {
    const sut = load();
    sut.near(SHEEP);
    sut.look();
    sut.state.hints[0].handler();
    assert.deepEqual(sut.state.emitted.map((entry) => entry.name), ["kcdc-gamemode:sheep.shear"]);
    assert.deepEqual(plain(sut.state.emitted[0].payload), { id: 77 });
    sut.state.hints[0].handler();
    assert.equal(sut.state.emitted.length, 1, "a second press inside a second is not a second question");

    const away = load();
    away.near(SHEEP);
    away.look();
    away.state.visible = false;
    away.state.hints[0].handler();
    assert.equal(away.state.emitted.length, 0);
});

test("while the work goes on the hint says Parar and its press stops it; a step after the grace stops it, once; a step in the grace does not", () => {
    const sut = load();
    sut.near(SHEEP);
    sut.work(true);
    sut.look();
    assert.deepEqual(plain(sut.state.hints.at(-1).options), { key: "primary_action", text: "Parar de tosquiar" });
    sut.state.keys.add("w");
    sut.walk();
    assert.equal(sut.state.emitted.length, 0, "the keys still held from walking up to the sheep are let be");

    const realNow = Date.now;
    Date.now = () => realNow() + 1_000;
    try {
        sut.walk();
        sut.walk();
    } finally {
        Date.now = realNow;
    }
    assert.deepEqual(sut.state.emitted.map((entry) => entry.name), ["kcdc-gamemode:sheep.stop"], "asked once");

    const press = load();
    press.near(SHEEP);
    press.work(true);
    press.look();
    press.state.hints.at(-1).handler();
    assert.deepEqual(press.state.emitted.map((entry) => entry.name), ["kcdc-gamemode:sheep.stop"]);

    press.work(false);
    press.look();
    assert.equal(press.state.hints.at(-1).options.text, "Tosquiar", "and when it is over the hint is the first again");
});
