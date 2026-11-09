"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The client's E at a wild horse (src/client/horse-menu.ts): the game's climb is held back while the aim is on the horse, and
// the game's "[E] Montar" goes with it, so our own hint "Domar" stands in its place (2026-10-20: "o E parou de aparecer na direita"). A horse a player keeps has none of this since 2026-11-09.

function load() {
    const state = { hints: [], removed: [], disabled: [], enabled: [], emitted: [], handlers: new Map(), keys: new Map(), tick: null, visible: true, person: 0, asked: [], dialogue: false, screen: false, hintFails: false };
    const me = { ready: true, alive: true, mounted: false };
    const context = {
        exports: {},
        require: (id) => (id === "./interaction.js" ? { isInteractionTargetVisible: (position, aim) => { state.asked.push({ position: { ...position }, aim: { ...aim } }); return state.visible; }, getPersonInView: () => state.person } : assert.fail(`unexpected require ${id}`)),
        console: { log() {}, error() {} },
        Date,
        JSON,
        Number,
        LocalPlayer: me,
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => true, disableAction: (name) => state.disabled.push(name), enableAction: (name) => state.enabled.push(name) },
        NativeUI: { element: () => ({ visible: state.screen }) },
        ActionHint: {
            create: (options, handler) => {
                if (state.hintFails) throw new Error("no hint");
                state.hints.push({ options, handler });
                return state.hints.length;
            },
            remove: (id) => state.removed.push(id),
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push({ name, payload }) },
        Key: { bind: (key, mode, fn) => state.keys.set(key, fn) },
        setInterval: (fn) => { state.tick = fn; return 1; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/horse-menu.js"), "utf8"), context);
    context.exports.installHorseMenu();
    const near = (value) => state.handlers.get("kcdc-gamemode:horse.near")(JSON.stringify(value));
    return { api: context.exports, state, me, near };
}

const HORSE = { id: 77, x: 10, y: 20, z: 5, w: 1 };

test("aiming at a wild horse puts up our hint on E, once, beside the climb being held back; looking away takes both down", () => {
    const sut = load();
    sut.near(HORSE);
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.hints[0].options)), { key: "primary_action", text: "Domar" });
    assert.deepEqual(sut.state.disabled, ["mount_horse", "use_horse"], "the game's climb is held back");
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1, "one hint");

    sut.state.visible = false;
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1]);
    assert.deepEqual(sut.state.enabled, ["mount_horse", "use_horse"]);
    sut.state.visible = true;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 2, "and back again when the aim returns");
});

test("a horse the server does not call wild gets no hint and no hold, and E asks for nothing: a kept horse is mounted by the game's own E (2026-11-09)", () => {
    const sut = load();
    sut.near({ id: 77, x: 10, y: 20, z: 5 });
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
    assert.deepEqual(sut.state.disabled, [], "the game's own climb is not held back");
    sut.state.keys.get("e")();
    assert.deepEqual(sut.state.emitted, []);
});

test("no hint while mounted, in a dialogue, over a transfer screen, or when no horse is near; and E still asks for the menu", () => {
    for (const stop of [(s) => { s.me.mounted = true; }, (s) => { s.state.dialogue = true; }, (s) => { s.state.screen = true; }]) {
        const sut = load();
        sut.near(HORSE);
        stop(sut);
        sut.state.tick();
        assert.equal(sut.state.hints.length, 0);
    }
    const none = load();
    none.state.tick();
    assert.equal(none.state.hints.length, 0, "no horse near");

    const sut = load();
    sut.near(HORSE);
    sut.state.tick();
    sut.state.keys.get("e")();
    assert.deepEqual(sut.state.emitted.map((entry) => entry.name), ["kcdc-gamemode:horse.menu"]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted[0].payload)), { id: 77 });
});

test("a build with no hint to give leaves the menu working", () => {
    const sut = load();
    sut.state.hintFails = true;
    sut.near(HORSE);
    sut.state.tick();
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
    assert.deepEqual(sut.state.disabled, ["mount_horse", "use_horse"]);
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 1);
});

test("a person under the crosshair comes before the horse beside them: no hint, nothing held back, and E is theirs (2026-10-26)", () => {
    const sut = load();
    sut.near(HORSE);
    sut.state.person = 12;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0, "no hint of the horse's while somebody's [E] Conversar is up");
    assert.deepEqual(sut.state.disabled, [], "and the game's own climb is not held back");
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 0, "E does not ask for the horse's menu");

    sut.state.person = 0;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1, "the horse's again when nobody is aimed at");
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 1);
});

test("the horse is aimed at nearer than before: the aim is 1.5 m round its middle and the reach 2.6 m (2026-10-26)", () => {
    const sut = load();
    sut.near(HORSE);
    sut.state.tick();
    const { aim } = sut.state.asked[0];
    assert.equal(aim.aimRadius, 1.5, "a player standing beside the horse is not inside the aim");
    assert.equal(aim.maxDistance, 2.6);
    assert.equal(aim.height, 1);
});
