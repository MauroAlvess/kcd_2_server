"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The client's E at the player's dog (src/client/dog-menu.ts, 2026-10-26): the game's own prompts at a dog (its "Falar" and the bond) are held back
// while the aim is on the dog, our hint "Cão" stands in their place, and E asks the server for the menu.

function load() {
    const state = { hints: [], removed: [], disabled: [], enabled: [], emitted: [], errors: [], handlers: new Map(), keys: new Map(), tick: null, visible: true, person: 0, dialogue: false, screen: false, hintFails: false, holdFails: false, asked: [] };
    const me = { ready: true, alive: true, mounted: false };
    const context = {
        exports: {},
        require: (id) => (id === "./interaction.js" ? { isInteractionTargetVisible: (position, aim) => { state.asked.push({ position: { ...position }, aim: { ...aim } }); return state.visible; }, getPersonInView: () => state.person } : assert.fail(`unexpected require ${id}`)),
        console: { log() {}, error: (line) => state.errors.push(line) },
        Date,
        JSON,
        Number,
        LocalPlayer: me,
        Hud: { isInDialogue: () => state.dialogue },
        Controls: {
            isEnabled: () => true,
            disableAction: (name) => {
                if (state.holdFails || state.holdFailsAt === name) throw new Error("no such action");
                state.disabled.push(name);
            },
            enableAction: (name) => state.enabled.push(name),
        },
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
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/dog-menu.js"), "utf8"), context);
    context.exports.installDogMenu();
    const near = (value) => state.handlers.get("kcdc-gamemode:dog.near")(JSON.stringify(value));
    return { api: context.exports, state, me, near };
}

const DOG = { id: 55, x: 10, y: 20, z: 5 };
const plain = (value) => JSON.parse(JSON.stringify(value));

test("aiming at the player's dog puts up our hint on E, once, with the game's prompts at a dog held back; looking away takes both down", () => {
    const sut = load();
    sut.near(DOG);
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.deepEqual(plain(sut.state.hints[0].options), { key: "primary_action", text: "Cão" });
    assert.deepEqual(sut.state.disabled, ["use", "companion_bond"], "the game's Falar and bond are held back");
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1, "one hint");

    sut.state.visible = false;
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1]);
    assert.deepEqual(sut.state.enabled, ["use", "companion_bond"]);
    sut.state.visible = true;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 2, "and back again when the aim returns");
});

test("the dog is aimed at by its middle with a narrow aim, as near as our prompts reach: half a metre of the dog on top of two", () => {
    const sut = load();
    sut.near(DOG);
    sut.state.tick();
    const { position, aim } = sut.state.asked[0];
    assert.deepEqual(position, { x: 10, y: 20, z: 5 });
    assert.equal(aim.maxDistance, 2.5);
    assert.ok(aim.aimRadius < 1.2, "a dog is a small thing");
    assert.ok(aim.height > 0 && aim.height < 1, "and low");
});

test("no hint while mounted, in a dialogue, over a transfer screen, or when no dog is near; and E still asks for the menu", () => {
    for (const stop of [(s) => { s.me.mounted = true; }, (s) => { s.state.dialogue = true; }, (s) => { s.state.screen = true; }]) {
        const sut = load();
        sut.near(DOG);
        stop(sut);
        sut.state.tick();
        assert.equal(sut.state.hints.length, 0);
        assert.deepEqual(sut.state.disabled, [], "and nothing of the game's is held back");
    }
    const none = load();
    none.state.tick();
    assert.equal(none.state.hints.length, 0, "no dog near");
    none.near({ id: 0 });
    none.state.tick();
    assert.equal(none.state.hints.length, 0, "told there is none");

    const sut = load();
    sut.near(DOG);
    sut.state.tick();
    sut.state.keys.get("e")();
    assert.deepEqual(sut.state.emitted.map((entry) => entry.name), ["kcdc-gamemode:dog.menu"]);
    assert.deepEqual(plain(sut.state.emitted[0].payload), { id: 55 });
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 1, "a second E within a second and a half is not a second question");
});

test("E is not heard when the aim is elsewhere, or the dog gone, or the player busy", () => {
    const sut = load();
    sut.near(DOG);
    sut.state.visible = false;
    sut.state.keys.get("e")();
    sut.near({ id: 0 });
    sut.state.visible = true;
    sut.state.keys.get("e")();
    sut.near("nonsense");
    sut.state.keys.get("e")();
    sut.near({ id: 55, x: "far", y: 0, z: 0 });
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 0);
    sut.near(DOG);
    sut.state.dialogue = true;
    sut.state.keys.get("e")();
    sut.state.dialogue = false;
    sut.me.alive = false;
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 0);
});

test("a build with no hint to give leaves the menu working; an action that cannot be held back is said once and E still asks", () => {
    const sut = load();
    sut.state.hintFails = true;
    sut.near(DOG);
    sut.state.tick();
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
    assert.deepEqual(sut.state.disabled, ["use", "companion_bond"]);
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 1);

    const stuck = load();
    stuck.state.holdFails = true;
    stuck.near(DOG);
    stuck.state.tick();
    stuck.state.tick();
    assert.equal(stuck.state.errors.length, 1, "said once, not at every look");
    assert.match(stuck.state.errors[0], /dog menu/);
    stuck.state.keys.get("e")();
    assert.equal(stuck.state.emitted.length, 1, "and the question still goes");
});

test("should the game turn down the second of its actions, the first is given back: the game's E must not stay dead", () => {
    const sut = load();
    sut.state.holdFailsAt = "companion_bond";
    sut.near(DOG);
    sut.state.tick();
    assert.deepEqual(sut.state.disabled, ["use"], "the first was held");
    assert.deepEqual(sut.state.enabled, ["use"], "and given back when the second would not be");
    assert.equal(sut.state.errors.length, 1);
    sut.state.tick();
    assert.equal(sut.state.disabled.length, 1, "and no second try");
});

test("a person under the crosshair comes before the dog beside them (2026-10-26)", () => {
    const sut = load();
    sut.near(DOG);
    sut.state.person = 12;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 0);
    assert.deepEqual(sut.state.disabled, []);
    sut.state.keys.get("e")();
    assert.equal(sut.state.emitted.length, 0);
    sut.state.person = 0;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
});
