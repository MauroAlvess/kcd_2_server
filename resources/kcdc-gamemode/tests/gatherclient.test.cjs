"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The client's half of the guilds' rights and of the Coletores' work (src/client/trade-rights.ts, src/client/gather.ts, 2026-10-21): the
// game's own butchering switched off for whoever is not a hunter, and "Cortar lenha" or "Minerar" on E aimed at a tree or a rock.

const RIGHTS = "kcdc-gamemode:crafts.rights";
const ASK = "kcdc-gamemode:crafts.ask";
const START = "kcdc-gamemode:gather.start";
const STOP = "kcdc-gamemode:gather.stop";
const STATE = "kcdc-gamemode:gather.state";
const PINE = "objects/natural/vegetation/trees/normal_trees/pinus_sylvestris/pinus_sylvestris_a.cgf";

function load() {
    // Every handler of an event, as the client keeps them: two modules listen for the resource's stop.
    const listeners = new Map();
    const events = { get: (name) => (...args) => (listeners.get(name) ?? []).forEach((fn) => fn(...args)) };
    const emitted = [];
    const actions = [];
    const hints = [];
    const intervals = [];
    const rays = [];
    const state = {
        now: 1_000_000,
        dialogue: false,
        keys: new Set(),
        enabled: true,
        person: false,
        busy: false,
        hit: null,
        me: { ready: true, alive: true, mounted: false, position: { x: 10, y: 20, z: 100 } },
    };
    class Vector3 {
        constructor(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }
    const shared = {
        console: { log() {} },
        Events: { on: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]), emitServer: (name, payload) => emitted.push([name, payload]) },
        Key: { isDown: (key) => state.keys.has(key) },
        Controls: { disableAction: (name) => actions.push(["off", name]), enableAction: (name) => actions.push(["on", name]), isEnabled: () => state.enabled },
        Hud: { isInDialogue: () => state.dialogue },
        ActionHint: {
            create: (options, press) => { hints.push({ ...options, press, removed: false }); return hints.length; },
            remove: (id) => { hints[id - 1].removed = true; },
        },
        Camera: { screenRay: () => ({ origin: new Vector3(10, 18, 101.6), target: new Vector3(10, 25, 101.6), direction: new Vector3(0, 1, 0) }) },
        World: { raycast: (from, to, options) => { rays.push({ from, to, options }); return state.hit; } },
        setInterval: (fn) => { intervals.push(fn); return intervals.length; },
        clearInterval() {},
        Vector3,
        Date: { now: () => state.now },
        Math,
        JSON,
    };
    const rights = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/trade-rights.js"), "utf8"), { ...shared, exports: rights.exports, require: () => assert.fail("trade-rights requires nothing") });
    const gather = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/gather.js"), "utf8"), {
        ...shared,
        exports: gather.exports,
        require: (id) =>
            ({
                "./trade-rights.js": rights.exports,
                "./furniture.js": { furnitureBusy: () => state.busy },
                "./interaction.js": { getPersonInView: () => state.person },
            })[id] ?? assert.fail(`unexpected require ${id}`),
        get LocalPlayer() {
            return state.me;
        },
    });
    rights.exports.installTradeRights();
    gather.exports.installGather();
    const tell = (fields) => events.get(RIGHTS)(JSON.stringify(fields));
    const look = () => intervals.forEach((fn) => fn());
    const shown = () => hints.filter((hint) => !hint.removed);
    return { events, emitted, actions, hints, rays, state, tell, look, shown };
}

const tree = (x = 10.4, y = 21.2, z = 101.5) => ({ category: "tree", model: PINE, kind: "vegetation", distance: 1.4, position: { x, y, z } });

test("the client asks for its rights at once, and the game's butchering is switched off for anybody who is not a hunter", () => {
    const sut = load();
    assert.deepEqual(sut.emitted, [[ASK, undefined]]);
    sut.tell({ abate: false, lenha: false, mina: false });
    assert.deepEqual(sut.actions, [["off", "butcher"]]);
    sut.tell({ abate: false, lenha: true, mina: true });
    assert.deepEqual(sut.actions, [["off", "butcher"]], "switched off once, not held twice");
    sut.tell({ abate: true, lenha: false, mina: false });
    assert.deepEqual(sut.actions, [["off", "butcher"], ["on", "butcher"]], "a hunter has it back");
    sut.tell({ abate: false });
    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.actions.at(-1), ["on", "butcher"], "given back when the resource stops");
});

test("a Coletor aimed at a tree within reach sees Cortar lenha on E, and the press asks the server to start", () => {
    const sut = load();
    sut.tell({ abate: false, lenha: true, mina: true });
    sut.state.hit = tree();
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => [hint.key, hint.text]), [["primary_action", "Cortar lenha"]]);
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [START, JSON.stringify({ k: "tree", m: PINE, x: 10.4, y: 21.2, z: 101.5 })]);
    sut.shown()[0].press();
    assert.equal(sut.emitted.filter(([name]) => name === START).length, 1, "a double press is one");
    sut.state.hit = { category: "rock", model: "objects/natural/stones/gneiss_stone_a.cgf", kind: "brush", distance: 1, position: { x: 10, y: 21, z: 100.2 } };
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), ["Minerar"]);
});

test("while the work goes on the hint says Parar, and the press stops it", () => {
    const sut = load();
    sut.tell({ lenha: true, mina: true });
    sut.state.hit = tree();
    sut.look();
    sut.events.get(STATE)(JSON.stringify({ on: true, k: "tree" }));
    sut.state.hit = null;
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), ["Parar de cortar"], "whatever is aimed at");
    sut.state.now += 1000;
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [STOP, undefined]);
    sut.events.get(STATE)(JSON.stringify({ on: false }));
    sut.look();
    assert.deepEqual(sut.shown(), []);
});

test("no hint and no ray for another guild's player, nor out of reach, at what is not a tree or a rock, in a dialogue, beside somebody to talk to", () => {
    const sut = load();
    sut.state.hit = tree();
    sut.look();
    assert.equal(sut.rays.length, 0, "no right: nothing traced");
    sut.tell({ lenha: false, mina: true });
    sut.look();
    assert.deepEqual(sut.shown(), [], "a tree is not a miner's");
    sut.tell({ lenha: true, mina: true });
    sut.state.hit = tree(10, 24.5, 101);
    sut.look();
    assert.deepEqual(sut.shown(), [], "four metres and a half off");
    sut.state.hit = { category: "bush", model: "objects/natural/vegetation/bushes/b.cgf", kind: "vegetation", distance: 1, position: { x: 10, y: 21, z: 100 } };
    sut.look();
    assert.deepEqual(sut.shown(), []);
    sut.state.hit = tree();
    sut.state.dialogue = true;
    sut.look();
    assert.deepEqual(sut.shown(), []);
    sut.state.dialogue = false;
    sut.state.person = true;
    sut.look();
    assert.deepEqual(sut.shown(), []);
    sut.state.person = false;
    sut.look();
    assert.equal(sut.shown().length, 1);
});

test("while the work goes on a step key asks the server to stop, once the grace for the keys still held from walking up is over; asked once (2026-10-22)", () => {
    const sut = load();
    sut.tell({ lenha: true, mina: true });
    const stops = () => sut.emitted.filter(([name]) => name === STOP).length;
    sut.state.keys.add("w");
    sut.look();
    assert.equal(stops(), 0, "not working: a walk is nobody's business");
    sut.events.get(STATE)(JSON.stringify({ on: true, k: "tree" }));
    sut.look();
    assert.equal(stops(), 0, "W still held from the walk up to the tree: let be");
    sut.state.now += 800;
    sut.look();
    assert.equal(stops(), 1, "a step key after the grace stops the work");
    sut.look();
    assert.equal(stops(), 1, "asked once, not at every look");

    // The server ends it and the next work is asked about afresh, with its own grace.
    sut.events.get(STATE)(JSON.stringify({ on: false }));
    sut.events.get(STATE)(JSON.stringify({ on: true, k: "rock" }));
    sut.look();
    assert.equal(stops(), 1, "a new work has its grace");
    sut.state.keys.clear();
    sut.state.now += 800;
    sut.look();
    assert.equal(stops(), 1, "standing still is working");
    sut.state.keys.add("space");
    sut.look();
    assert.equal(stops(), 2, "any step key: Space too");
});

test("the tree or the rock must be within two metres of the body, the one reach of our prompts (2026-10-22)", () => {
    const sut = load();
    sut.tell({ lenha: true, mina: true });
    sut.state.hit = tree(10, 21.9, 101);
    sut.look();
    assert.equal(sut.shown().length, 1, "1.9 m: Cortar lenha");
    sut.state.hit = tree(10, 22.3, 101);
    sut.look();
    assert.deepEqual(sut.shown(), [], "2.3 m: out of reach (it was 3)");
});
