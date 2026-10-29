"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The client's half of the gardens (src/client/farm.ts, 2026-10-22): aimed at the soil of a bed within reach of the body, an Agricultor sees
// Plantar (free), Colher (theirs, ripe) or Plantação (theirs, growing) on E; the press names the bed; picking shows Parar and a walk stops it.

const RIGHTS = "kcdc-gamemode:crafts.rights";
const BEDS = "kcdc-gamemode:farm.beds";
const STATE = "kcdc-gamemode:farm.state";
const USE = "kcdc-gamemode:farm.use";
const STOP = "kcdc-gamemode:farm.stop";
const ASK = "kcdc-gamemode:farm.ask";

/** x, y, z, yaw, length, state: a bed running north-south through (100, 100) and an east-west one through (110, 100). */
const ROWS = [
    [100, 100, 50, 0, 4, 0],
    [110, 100, 50, 90, 4, 1],
    [120, 100, 50, 0, 4, 2],
    [130, 100, 50, 0, 4, 3],
];

function load() {
    const listeners = new Map();
    const events = { get: (name) => (...args) => (listeners.get(name) ?? []).forEach((fn) => fn(...args)) };
    const emitted = [];
    const hints = [];
    const intervals = [];
    const state = {
        now: 1_000_000,
        dialogue: false,
        keys: new Set(),
        enabled: true,
        person: false,
        busy: false,
        hit: null,
        ray: true,
        me: { ready: true, alive: true, mounted: false, position: { x: 102, y: 100, z: 50 } },
    };
    class Vector3 {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }
    const shared = {
        console: { log() {} },
        Events: { on: (name, fn) => listeners.set(name, [...(listeners.get(name) ?? []), fn]), emitServer: (name, payload) => emitted.push([name, payload]) },
        Key: { isDown: (key) => state.keys.has(key) },
        Controls: { disableAction() {}, enableAction() {}, isEnabled: () => state.enabled },
        Hud: { isInDialogue: () => state.dialogue },
        ActionHint: {
            create: (options, press) => { hints.push({ ...options, press, removed: false }); return hints.length; },
            remove: (id) => { hints[id - 1].removed = true; },
        },
        Camera: { screenRay: () => (state.ray ? { origin: new Vector3(102, 98, 51.6), target: new Vector3(102, 106, 51.6), direction: new Vector3(0, 1, 0) } : null) },
        World: { raycast: () => state.hit },
        setInterval: (fn) => { intervals.push(fn); return intervals.length; },
        clearInterval() {},
        Vector3,
        Date: { now: () => state.now },
        Math,
        JSON,
        Number,
        Array,
    };
    const rights = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/trade-rights.js"), "utf8"), { ...shared, exports: rights.exports, require: () => assert.fail("trade-rights requires nothing") });
    const farm = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/farm.js"), "utf8"), {
        ...shared,
        exports: farm.exports,
        require: (id) =>
            ({
                "./trade-rights.js": rights.exports,
                "./furniture.js": { furnitureBusy: () => state.busy },
                "./interaction.js": { getPersonInView: () => state.person },
            })[id] ?? assert.fail(`unexpected require ${id}`),
        get LocalPlayer() { return state.me; },
    });
    rights.exports.installTradeRights();
    farm.exports.installFarm();
    const tell = (fields) => events.get(RIGHTS)(JSON.stringify(fields));
    const look = () => intervals.forEach((fn) => fn());
    const shown = () => hints.filter((hint) => !hint.removed);
    return { api: farm.exports, events, emitted, hints, state, tell, look, shown };
}

/** The ground the crosshair's ray meets. */
const ground = (x, y, z = 50) => ({ kind: "terrain", terrain: true, category: null, model: null, distance: 5, position: { x, y, z } });

test("the client asks the server for the beds when it starts, and keeps what it is sent, and only whole rows of numbers", () => {
    const sut = load();
    assert.ok(sut.emitted.some(([name]) => name === ASK), "asked at once");
    sut.tell({ horta: true });
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.hit = ground(100, 100);
    sut.look();
    assert.equal(sut.shown().length, 1);
    sut.events.get(BEDS)(JSON.stringify([[1, 2, 3]]));
    sut.look();
    assert.deepEqual(sut.shown(), [], "a short row is not a bed");
    sut.events.get(BEDS)("not json");
    sut.events.get(BEDS)(JSON.stringify({ not: "a list" }));
    sut.look();
    assert.deepEqual(sut.shown(), []);
    sut.events.get(BEDS)(JSON.stringify([[100, 100, 50, 0, 4, "x"], [100, 100, 50, 0, 4, 0]]));
    sut.look();
    assert.equal(sut.shown().length, 1, "the good row is kept, the other left out");
});

test("a bed is a row: the distance to it is to the nearest point of the row, which runs the bed's way", () => {
    const sut = load();
    const north = ROWS[0];
    assert.equal(sut.api.distanceToRow(north, 100, 100), 0);
    assert.equal(sut.api.distanceToRow(north, 103, 101), 3);
    assert.equal(sut.api.distanceToRow(north, 100, 110), 8, "past the end of the row");
    const east = ROWS[1];
    assert.ok(Math.abs(sut.api.distanceToRow(east, 111.5, 100)) < 1e-9, "an east-west row");
    assert.ok(Math.abs(sut.api.distanceToRow(east, 110, 103) - 3) < 1e-9);
});

test("the bed aimed at is the nearest to the ground under the crosshair within 1.8 m, with the body within reach (2.5 m) and not a floor away; another's is not aimed at", () => {
    const sut = load();
    const body = { x: 102, y: 100, z: 50 };
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 100, y: 100 }, body), 0, "on the row");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 101.2, y: 100 }, body), 0, "beside it, within 1.8 m");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 98.4, y: 100 }, body), 0, "1.6 m off: the soil's edge, the row being only its middle line");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 97.8, y: 100 }, body), -1, "2.2 m off: the aim is on the grass");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 100, y: 100 }, { x: 105, y: 100, z: 50 }), -1, "the body five metres from the row");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 100, y: 100 }, { x: 102, y: 100, z: 56 }), -1, "a floor above");
    assert.equal(sut.api.bedAimedAt(ROWS, { x: 130, y: 100 }, { x: 130, y: 100, z: 50 }), -1, "a bed that is another farmer's");
    assert.equal(sut.api.bedAimedAt([], { x: 100, y: 100 }, body), -1);
    // The nearer of two beds the aim is between.
    const close = [[100, 100, 50, 0, 4, 0], [101.5, 100, 50, 0, 4, 0]];
    assert.equal(sut.api.bedAimedAt(close, { x: 100.2, y: 100 }, body), 0, "the first, being the nearer");
    assert.equal(sut.api.bedAimedAt(close, { x: 101, y: 100 }, body), 1, "the second, being the nearer");
});

test("a player who may farm and has no beds (an administrator's /oficios livre sends the right, not the beds) asks for them again, at most every four seconds", () => {
    const sut = load();
    const asks = () => sut.emitted.filter(([name]) => name === ASK).length;
    assert.equal(asks(), 1, "asked at the start");
    sut.look();
    assert.equal(asks(), 1, "not a farmer yet: nothing more to ask");
    sut.tell({ horta: true });
    sut.look();
    assert.equal(asks(), 2, "the right came and the beds did not: ask");
    sut.look();
    assert.equal(asks(), 2, "not twice in a row");
    sut.state.now += sut.api.ASK_AGAIN_MS + 100;
    sut.look();
    assert.equal(asks(), 3, "and again when it has waited");
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.now += 10_000;
    sut.look();
    assert.equal(asks(), 3, "the beds came: done");
});

test("an Agricultor aimed at a free bed sees Plantar on E; at theirs growing, Plantação; at theirs ripe, Colher; the press names the bed", () => {
    const sut = load();
    sut.tell({ horta: true });
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.hit = ground(100, 100);
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => [hint.key, hint.text]), [["primary_action", "Plantar"]]);
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [USE, JSON.stringify({ b: 0 })]);
    sut.shown()[0].press();
    assert.equal(sut.emitted.filter(([name]) => name === USE).length, 1, "a double press is one");

    sut.state.me.position = { x: 110, y: 101.5, z: 50 };
    sut.state.hit = ground(110, 100);
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), ["Plantação"], "theirs, growing: E says how long is left");
    sut.state.now += 1_000;
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [USE, JSON.stringify({ b: 1 })]);

    sut.state.me.position = { x: 120, y: 101.5, z: 50 };
    sut.state.hit = ground(120, 100);
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), ["Colher"]);
    sut.state.now += 1_000;
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [USE, JSON.stringify({ b: 2 })]);

    sut.state.hit = ground(100, 130);
    sut.look();
    assert.deepEqual(sut.shown(), [], "the ground away from the beds");
});

test("nothing is traced for a player who is nobody's farmer, and no hint comes up in a dialogue, beside somebody to talk to, riding, or with the controls off", () => {
    const sut = load();
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.hit = ground(100, 100);
    sut.look();
    assert.deepEqual(sut.shown(), [], "no right to the gardens");
    sut.tell({ horta: false });
    sut.look();
    assert.deepEqual(sut.shown(), []);
    sut.tell({ horta: true });
    sut.look();
    assert.equal(sut.shown().length, 1);
    for (const [name, on, off] of [["dialogue", true, false], ["person", true, false], ["busy", true, false], ["enabled", false, true]]) {
        sut.state[name] = on;
        sut.look();
        assert.deepEqual(sut.shown(), [], name);
        sut.state[name] = off;
    }
    sut.state.me.mounted = true;
    sut.look();
    assert.deepEqual(sut.shown(), [], "on a horse");
    sut.state.me.mounted = false;
    sut.state.ray = false;
    sut.look();
    assert.deepEqual(sut.shown(), [], "no view: no ray");
    sut.state.ray = true;
    sut.state.hit = null;
    sut.look();
    assert.deepEqual(sut.shown(), [], "the ray met nothing");
});

test("while the harvest goes on the hint says Parar de colher whatever is aimed at, and the press stops it", () => {
    const sut = load();
    sut.tell({ horta: true });
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.me.position = { x: 120, y: 101.5, z: 50 };
    sut.state.hit = ground(120, 100);
    sut.look();
    sut.events.get(STATE)(JSON.stringify({ on: true }));
    sut.state.hit = null;
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), ["Parar de colher"]);
    sut.state.now += 1_000;
    sut.shown()[0].press();
    assert.deepEqual(sut.emitted.at(-1), [STOP, undefined]);
    sut.events.get(STATE)(JSON.stringify({ on: false }));
    sut.look();
    assert.deepEqual(sut.shown().map((hint) => hint.text), [], "and it goes when the work ends");
});

test("while the harvest goes on a step key asks the server to stop, after the grace for the keys still held from walking up; asked once", () => {
    const sut = load();
    sut.tell({ horta: true });
    const stops = () => sut.emitted.filter(([name]) => name === STOP).length;
    sut.state.keys.add("a");
    sut.look();
    assert.equal(stops(), 0, "not picking: a walk is nobody's business");
    sut.events.get(STATE)(JSON.stringify({ on: true }));
    sut.look();
    assert.equal(stops(), 0, "held from the walk up: let be");
    sut.state.now += 800;
    sut.look();
    assert.equal(stops(), 1);
    sut.look();
    assert.equal(stops(), 1, "once");
    sut.events.get(STATE)("not json");
    sut.events.get(STATE)(JSON.stringify({ on: false }));
    sut.events.get(STATE)(JSON.stringify({ on: true }));
    sut.state.keys.clear();
    sut.state.now += 800;
    sut.look();
    assert.equal(stops(), 1, "standing still is picking");
});

test("the hint is taken away when the resource stops", () => {
    const sut = load();
    sut.tell({ horta: true });
    sut.events.get(BEDS)(JSON.stringify(ROWS));
    sut.state.hit = ground(100, 100);
    sut.look();
    assert.equal(sut.shown().length, 1);
    sut.events.get("resourceStop")("another");
    assert.equal(sut.shown().length, 1);
    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.shown(), []);
});
