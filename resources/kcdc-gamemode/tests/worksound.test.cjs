"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Who is at a loud work (src/server/work-sound.ts, 2026-10-23): told to every client, so that each keeps the sound of the felling, the mining
// and the digging to the players near.

const EVENT = "kcdc-gamemode:work.sounds";
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const state = { handlers: new Map(), timer: null, interval: null, players: new Map(), cleared: 0, now: 1_000_000, timeouts: [] };
    const context = {
        exports: {},
        JSON,
        Date: { now: () => state.now },
        setTimeout: (fn, ms) => { state.timeouts.push({ fn, ms }); return state.timeouts.length; },
        console: { log() {} },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        Player: { getById: (id) => state.players.get(id) ?? null, all: () => [...state.players.values()] },
        setInterval: (fn, ms) => { state.timer = fn; state.interval = ms; return 1; },
        clearInterval() { state.cleared += 1; state.timer = null; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/work-sound.js"), "utf8"), context);
    context.exports.installWorkSound();
    let next = 1;
    const player = (nickname, { ready = true, alive = true } = {}) => {
        const body = { id: next++, nickname, ready, alive, told: [], emit(event, payload) { assert.equal(event, EVENT); this.told.push(JSON.parse(payload).w); } };
        state.players.set(body.id, body);
        return body;
    };
    return { api: context.exports, state, player };
}

test("somebody starting a work is told to every player in the world, with the kind; ending it is told too, and ending what was not begun is not", () => {
    const sut = load();
    const hans = sut.player("hans");
    const greta = sut.player("greta");
    const loading = sut.player("loading", { ready: false });
    sut.api.workBegins(hans, "lenha");
    assert.deepEqual(hans.told, [[[1, "lenha"]]], "the worker too: his machine ignores his own");
    assert.deepEqual(greta.told, [[[1, "lenha"]]]);
    assert.deepEqual(loading.told, [], "a player still loading is told nothing");
    sut.state.now += sut.api.COALESCE_MS;
    sut.api.workBegins(greta, "horta");
    assert.deepEqual(hans.told.at(-1), [[1, "lenha"], [2, "horta"]]);
    sut.state.now += sut.api.COALESCE_MS;
    sut.api.workEnds(hans);
    assert.deepEqual(greta.told.at(-1), [[2, "horta"]]);
    const before = greta.told.length;
    sut.state.now += sut.api.COALESCE_MS;
    sut.api.workEnds(hans);
    assert.equal(greta.told.length, before, "he was not working");
});

test("a worker who has gone, is not in the world or is dead is dropped from the list", () => {
    const sut = load();
    const hans = sut.player("hans");
    const greta = sut.player("greta");
    const otto = sut.player("otto");
    sut.api.workBegins(hans, "mina");
    sut.api.workBegins(greta, "lenha");
    sut.api.workBegins(otto, "horta");
    greta.alive = false;
    sut.state.players.delete(otto.id);
    assert.deepEqual(plain(sut.api.workersNow()), [[1, "mina"]]);
});

test("while somebody works the list is said again every four seconds; with nobody working it is not", () => {
    const sut = load();
    const hans = sut.player("hans");
    assert.equal(sut.state.interval, sut.api.REPEAT_MS);
    sut.state.timer();
    assert.deepEqual(hans.told, [], "nobody works: nothing to say");
    sut.api.workBegins(hans, "lenha");
    hans.told.length = 0;
    sut.state.timer();
    assert.deepEqual(hans.told, [[[1, "lenha"]]]);
});

test("a player who comes in while others work is told at once, and only they; one who leaves stops working", () => {
    const sut = load();
    const hans = sut.player("hans");
    const greta = sut.player("greta");
    sut.state.handlers.get("playerReady")(greta);
    assert.deepEqual(greta.told, [], "nobody works");
    sut.api.workBegins(hans, "mina");
    hans.told.length = 0;
    greta.told.length = 0;
    const late = sut.player("late");
    sut.state.handlers.get("playerReady")(late);
    assert.deepEqual(late.told, [[[1, "mina"]]]);
    assert.deepEqual(hans.told, []);
    sut.state.now += sut.api.COALESCE_MS;
    sut.state.handlers.get("playerDisconnect")(hans);
    assert.deepEqual(greta.told.at(-1), []);
});

test("the resource stopping ends the repeating, and another resource's stop does not", () => {
    const sut = load();
    const hans = sut.player("hans");
    sut.api.workBegins(hans, "lenha");
    sut.state.handlers.get("resourceStop")("other");
    assert.equal(sut.state.cleared, 0);
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.cleared, 1);
    assert.deepEqual(plain(sut.api.workersNow()), []);
});

test("a burst of begins and ends is said once at the start and once at the end of the window, not once for each", () => {
    const sut = load();
    const workers = Array.from({ length: 10 }, (_, i) => sut.player(`w${i}`));
    const watcher = sut.player("watcher");
    for (const worker of workers) sut.api.workBegins(worker, "lenha");
    assert.equal(watcher.told.length, 1, "the first of the spell is said at once");
    assert.deepEqual(watcher.told[0], [[1, "lenha"]]);
    assert.equal(sut.state.timeouts.length, 1, "the rest wait for one word at the end of the window");
    assert.ok(sut.state.timeouts[0].ms <= sut.api.COALESCE_MS && sut.state.timeouts[0].ms > 0);

    for (const worker of workers.slice(0, 5)) sut.api.workEnds(worker);
    assert.equal(watcher.told.length, 1, "nothing more yet");
    assert.equal(sut.state.timeouts.length, 1, "and still one timer, not one for each");

    sut.state.now += sut.api.COALESCE_MS;
    sut.state.timeouts.shift().fn();
    assert.equal(watcher.told.length, 2);
    assert.deepEqual(watcher.told[1].map(([id]) => id), [6, 7, 8, 9, 10], "the last word is the true list: the five still at work");

    sut.state.now += sut.api.COALESCE_MS;
    sut.api.workEnds(workers[5]);
    assert.equal(watcher.told.length, 3, "after a quiet spell, at once again");
});

test("the repeating every four seconds counts as having said it, so an event right after it waits", () => {
    const sut = load();
    const hans = sut.player("hans");
    sut.api.workBegins(hans, "lenha");
    hans.told.length = 0;
    sut.state.now += 3_000;
    sut.state.timer();
    assert.equal(hans.told.length, 1);
    const greta = sut.player("greta");
    sut.api.workBegins(greta, "mina");
    assert.equal(hans.told.length, 1, "inside the window of the repeat");
    assert.equal(sut.state.timeouts.length, 1);
});
