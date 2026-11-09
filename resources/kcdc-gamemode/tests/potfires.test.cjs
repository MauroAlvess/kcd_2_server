"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The stew pots' fires (src/server/pot-fires.ts, 2026-11-02: "existe fogueira de caldeirão para cozinhar: temos que deixar todas acesas, ou pelo menos ao cozinhar acendermos elas").

function load({ pots = [], saved = null } = {}) {
    const state = { set: [], files: new Map(saved === null ? [] : [["playerdata/pot-fires.json", saved]]), timers: [], intervals: [], handlers: new Map(), logs: [], now: 1_000_000 };
    const list = pots.map((pot) => ({ fireLit: null, ...pot }));
    const context = {
        exports: {},
        require: (id) =>
            id === "./store.js"
                ? { ensureDir() {}, read: (file) => (state.files.has(file) ? { status: "ok", value: state.files.get(file) } : { status: "missing" }), write: (file, value) => state.files.set(file, JSON.parse(JSON.stringify(value))) }
                : assert.fail(`unexpected require ${id}`),
        CookPot: {
            all: (world = 0) => (world === 0 ? list : []),
            setFireLit: (guid, lit, world = 0) => {
                state.set.push([guid, lit, world]);
                const pot = list.find((one) => one.guid === guid);
                if (pot === undefined) return false;
                pot.fireLit = lit;
                return true;
            },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearTimeout() {},
        clearInterval() {},
        Date: { now: () => state.now },
        console: { log: (line) => state.logs.push(line) },
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/pot-fires.js"), "utf8"), context);
    return { api: context.exports, state, list };
}

const POTS = [
    { guid: "p1", position: { x: 0, y: 0, z: 10 } },
    { guid: "p2", position: { x: 100, y: 0, z: 10 } },
    { guid: "p3", position: { x: 200, y: 0, z: 10 }, fireLit: true },
];
const cook = (x, over = {}) => ({ id: 1, virtualWorld: 0xffffffff, position: { x, y: 1, z: 10 }, ...over });

test("by default every cauldron burns, for everybody: the first look lights the cold ones, and a later look lights only what went out", () => {
    const sut = load({ pots: POTS });
    sut.api.installPotFires();
    assert.equal(sut.api.potFires.mode, "todas");
    sut.state.timers[0].fn();
    assert.deepEqual(sut.state.set, [["p1", true, 0], ["p2", true, 0]], "the one already burning is left");
    assert.ok(sut.state.logs.some((line) => /2 fogueira\(s\) de caldeirão acesa\(s\) agora, de 3 \(todas\)/.test(line)));
    sut.state.set = [];
    sut.state.intervals.find((interval) => interval.ms === 3 * 60_000).fn();
    assert.deepEqual(sut.state.set, [], "nothing to do");
    sut.list[1].fireLit = false;
    sut.state.intervals.find((interval) => interval.ms === 3 * 60_000).fn();
    assert.deepEqual(sut.state.set, [["p2", true, 0]]);
});

test("a world nobody entered has no pots yet: the first player in makes them known, and they are lit a little after", () => {
    const sut = load({ pots: [] });
    sut.api.installPotFires();
    sut.state.timers[0].fn();
    assert.deepEqual(sut.state.set, []);
    sut.list.push({ guid: "p9", position: { x: 0, y: 0, z: 0 }, fireLit: null });
    sut.state.handlers.get("playerSpawned")({ id: 1 });
    sut.state.timers.at(-1).fn();
    assert.deepEqual(sut.state.set, [["p9", true, 0]]);
});

test("in 'cozinhar' a cauldron burns when somebody cooks at it, and is the game's again ten minutes later; far from a pot nothing is lit", () => {
    const sut = load({ pots: POTS });
    sut.api.installPotFires();
    assert.match(sut.api.choosePotFires("cozinhar"), /acendem quando alguém cozinha nelas, por 10 minutos/);
    assert.deepEqual(sut.state.files.get("playerdata/pot-fires.json"), { mode: "cozinhar" });
    assert.deepEqual(sut.list.map((pot) => pot.fireLit), [null, null, null], "every pot handed back to the game");
    sut.state.set = [];
    assert.equal(sut.api.litForCooking(cook(2), sut.state.now), "p1", "the global world cooks at world 0's pots");
    assert.deepEqual(sut.state.set, [["p1", true, 0]]);
    assert.equal(sut.api.litForCooking(cook(50), sut.state.now), "", "no pot within four metres");
    sut.state.now += 9 * 60_000;
    sut.state.intervals.find((interval) => interval.ms === 3 * 60_000).fn();
    assert.equal(sut.list[0].fireLit, true, "still burning");
    sut.state.now += 2 * 60_000;
    sut.state.intervals.find((interval) => interval.ms === 3 * 60_000).fn();
    assert.equal(sut.list[0].fireLit, null, "the game's again");
});

test("'jogo' hands every cauldron back to each player's own game, nothing is lit for cooking, and the choice is kept for the next start", () => {
    const sut = load({ pots: POTS });
    sut.api.installPotFires();
    sut.state.timers[0].fn();
    assert.match(sut.api.choosePotFires("jogo"), /são do jogo de cada um.* 3 devolvidas ao jogo\./);
    assert.deepEqual(sut.list.map((pot) => pot.fireLit), [null, null, null]);
    assert.equal(sut.api.litForCooking(cook(2)), "");
    const again = load({ pots: POTS, saved: { mode: "jogo" } });
    again.api.installPotFires();
    assert.equal(again.api.potFires.mode, "jogo");
    again.state.timers[0].fn();
    assert.deepEqual(again.state.set, [], "nothing lit at the start");
    assert.deepEqual(["todas", "acesas", "Cozinhar", "jogo", "apagar", "x", undefined].map(again.api.parsePotFireMode), ["todas", "todas", "cozinhar", "jogo", "jogo", null, null]);
});
