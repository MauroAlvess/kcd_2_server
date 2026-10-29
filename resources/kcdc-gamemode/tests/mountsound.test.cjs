"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Who rides, or has just got on or off a horse (src/server/mount-sound.ts, 2026-10-26: "sempre que alguém sobe no cavalo escutam de longe"):
// told to every client, so that each keeps those sounds to the players near.

const EVENT = "kcdc-gamemode:mount.sounds";
const SEEN = "kcdc-gamemode:mount.seen";

function load() {
    const state = { handlers: new Map(), client: new Map(), timer: null, interval: null, players: new Map(), logs: [], now: 1_000_000, timeouts: [] };
    const context = {
        exports: {},
        JSON,
        Date: { now: () => state.now },
        console: { log: (line) => state.logs.push(line) },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        Player: { all: () => [...state.players.values()] },
        setInterval: (fn, ms) => { state.timer = fn; state.interval = ms; return 1; },
        clearInterval() { state.timer = null; },
        setTimeout: (fn, ms) => { state.timeouts.push({ fn, ms }); return state.timeouts.length; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/mount-sound.js"), "utf8"), context);
    context.exports.installMountSound();
    let next = 1;
    const player = (nickname, { ready = true, mounted = false } = {}) => {
        const body = { id: next++, nickname, ready, mounted, told: [], emit(event, payload) { assert.equal(event, EVENT); this.told.push(JSON.parse(payload).r); } };
        state.players.set(body.id, body);
        return body;
    };
    return { api: context.exports, state, player };
}

test("a climb, a mount and a get-off are told at once to every player in the world; the handler of the climb decides nothing", () => {
    const sut = load();
    const hans = sut.player("hans");
    const greta = sut.player("greta");
    const loading = sut.player("loading", { ready: false });
    assert.equal(sut.state.handlers.get("horseMounting")({}, hans), undefined, "never false: the ride is the other handlers' to refuse");
    assert.deepEqual(greta.told, [[1]]);
    assert.deepEqual(hans.told, [[1]], "the rider too: his machine ignores himself");
    assert.deepEqual(loading.told, []);
    sut.state.handlers.get("horseMount")({}, null);
    assert.equal(greta.told.length, 1, "a horse with nobody: nothing");
    sut.state.now += sut.api.COALESCE_MS;
    sut.state.handlers.get("horseDismount")({}, greta);
    assert.deepEqual(hans.told.at(-1), [1, 2]);
});

test("the riders are those in a saddle and those who got on or off in the last seconds; the list is repeated while anybody rides, and once more when nobody does", () => {
    const sut = load();
    const hans = sut.player("hans", { mounted: true });
    const greta = sut.player("greta");
    sut.state.timer();
    assert.deepEqual(greta.told, [[1]]);
    sut.state.now += sut.api.COALESCE_MS;
    sut.api.stirred(greta, sut.state.now);
    assert.deepEqual(greta.told.at(-1), [1, 2]);
    sut.state.now += sut.api.STIR_MS + 1;
    hans.mounted = false;
    sut.state.timer();
    assert.deepEqual(greta.told.at(-1), [], "nobody: said once, so the machines let go");
    const count = greta.told.length;
    sut.state.timer();
    assert.equal(greta.told.length, count, "and then nothing");
    assert.equal(sut.state.interval, sut.api.REPEAT_MS);
});

test("a player who comes in is told at once; a client's report of the classes beside a rider is logged once per set, names only", () => {
    const sut = load();
    sut.player("hans", { mounted: true });
    const late = sut.player("late");
    sut.state.handlers.get("playerReady")(late);
    assert.deepEqual(late.told, [[1]]);
    const report = sut.state.client.get(SEEN);
    report({ nickname: "greta" }, JSON.stringify({ c: ["GeomEntity", "AnimalNPC"] }));
    report({ nickname: "greta" }, JSON.stringify({ c: ["AnimalNPC", "GeomEntity"] }));
    report({ nickname: "greta" }, JSON.stringify({ c: ["<script>", 5, "Ok"] }));
    report({ nickname: "greta" }, "not json");
    assert.deepEqual(sut.state.logs, [
        "montaria: nenhum cavalo achado junto de um cavaleiro distante, por greta; o que havia ali: AnimalNPC,GeomEntity",
        "montaria: nenhum cavalo achado junto de um cavaleiro distante, por greta; o que havia ali: Ok",
    ]);
});

test("a burst of get-ons and get-offs is said once at the start and once at the end of the window, not once for each", () => {
    const sut = load();
    const riders = Array.from({ length: 10 }, (_, i) => sut.player(`r${i}`));
    const watcher = sut.player("watcher");
    for (const rider of riders) sut.api.stirred(rider, sut.state.now);
    assert.equal(watcher.told.length, 1, "the first of the spell is said at once");
    assert.deepEqual(watcher.told[0], [1]);
    assert.equal(sut.state.timeouts.length, 1, "the rest wait for one word at the end of the window");
    assert.ok(sut.state.timeouts[0].ms <= sut.api.COALESCE_MS && sut.state.timeouts[0].ms > 0);

    sut.state.now += sut.api.COALESCE_MS;
    sut.state.timeouts.shift().fn();
    assert.equal(watcher.told.length, 2);
    assert.deepEqual(watcher.told[1], riders.map((rider) => rider.id), "the last word is the whole list");

    sut.state.now += sut.api.COALESCE_MS;
    sut.api.stirred(riders[0], sut.state.now);
    assert.equal(watcher.told.length, 3, "after a quiet spell, at once again");
});

test("the repeat every three seconds counts as having said it, so a get-on right after it waits", () => {
    const sut = load();
    const hans = sut.player("hans", { mounted: true });
    sut.state.timer();
    assert.equal(hans.told.length, 1);
    const greta = sut.player("greta");
    sut.api.stirred(greta, sut.state.now);
    assert.equal(hans.told.length, 1, "inside the window of the repeat");
    assert.equal(sut.state.timeouts.length, 1);
});
