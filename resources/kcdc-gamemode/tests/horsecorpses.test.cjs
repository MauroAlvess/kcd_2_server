"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The dead horses are taken out of the world after a while (src/server/horse-corpses.ts, 2026-10-31).

function load() {
    const state = { handlers: new Map(), timers: [], destroyed: [], logs: [], horses: new Map(), throwOnGet: false, throwOnDestroy: false };
    const context = {
        exports: {},
        require: (id) => assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Math,
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        Horse: {
            getById: (id) => {
                if (state.throwOnGet) throw new Error("no such thing");
                return state.horses.get(id) ?? null;
            },
        },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        clearTimeout: (handle) => { if (state.timers[handle - 1]) state.timers[handle - 1].cleared = true; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horse-corpses.js"), "utf8"), context);
    context.exports.installHorseCorpses();
    const horse = (id, alive = false) => {
        const body = { id, alive, destroy() { if (state.throwOnDestroy) throw new Error("gone"); state.destroyed.push(id); state.horses.delete(id); } };
        state.horses.set(id, body);
        return body;
    };
    const die = (body) => state.handlers.get("horseDeath")(body, null, "combat");
    const live = () => state.timers.filter((timer) => !timer.cleared);
    return { api: context.exports, state, horse, die, live };
}

test("a horse that dies lies five minutes, and then the body is taken out of the world", () => {
    const sut = load();
    assert.equal(sut.api.corpseSettings.afterMs, 5 * 60_000);
    const body = sut.horse(41);
    sut.die(body);
    assert.equal(sut.live().length, 1);
    assert.equal(sut.live()[0].ms, 300_000);
    assert.equal(sut.api.corpsesWaiting(), 1);
    assert.deepEqual(sut.state.destroyed, [], "not yet");
    sut.live()[0].fn();
    assert.deepEqual(sut.state.destroyed, [41]);
    assert.equal(sut.api.corpsesWaiting(), 0);
    assert.match(sut.state.logs.at(-1), /o cadáver de um cavalo foi retirado do mundo \(5 min depois da morte\)/);
});

test("a horse that was brought back to life meanwhile (an owner away, the game's own knock-out) is left alone", () => {
    const sut = load();
    const body = sut.horse(42);
    sut.die(body);
    body.alive = true;
    sut.live()[0].fn();
    assert.deepEqual(sut.state.destroyed, []);
    assert.equal(sut.api.corpsesWaiting(), 0, "and it is not waited for any more");
    assert.equal(sut.state.logs.length, 0);
});

test("a horse that dies again has its time start over; two horses are two waits", () => {
    const sut = load();
    const body = sut.horse(43);
    sut.die(body);
    const first = sut.live()[0];
    sut.die(body);
    assert.equal(first.cleared, true, "the first wait is over: only the last death counts");
    assert.equal(sut.live().length, 1);
    sut.die(sut.horse(44));
    assert.equal(sut.live().length, 2);
    assert.equal(sut.api.corpsesWaiting(), 2);
});

test("a body taken away by somebody else is no longer waited for, and a stop leaves no timer behind", () => {
    const sut = load();
    const body = sut.horse(45);
    sut.die(body);
    sut.state.handlers.get("horseDestroy")(body);
    assert.equal(sut.live().length, 0);
    assert.equal(sut.api.corpsesWaiting(), 0);
    sut.die(sut.horse(46));
    sut.die(sut.horse(47));
    sut.state.handlers.get("resourceStop")("another-resource");
    assert.equal(sut.live().length, 2, "another resource's stop is not ours");
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.live().length, 0);
    assert.equal(sut.api.corpsesWaiting(), 0);
});

test("a body already gone, an engine that will not answer and one that will not destroy are met without a word to the log", () => {
    const sut = load();
    assert.equal(sut.api.removeCorpse(999), false, "no such horse");
    const body = sut.horse(48);
    sut.state.throwOnGet = true;
    assert.equal(sut.api.removeCorpse(48), false);
    sut.state.throwOnGet = false;
    sut.state.throwOnDestroy = true;
    assert.equal(sut.api.removeCorpse(48), false);
    sut.state.throwOnDestroy = false;
    assert.equal(sut.api.removeCorpse(48), true);
    assert.deepEqual(sut.state.destroyed, [48]);
    assert.equal(body.alive, false);
});
