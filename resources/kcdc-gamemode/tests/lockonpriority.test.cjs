"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The combat lock-on prefers enemy NPCs to players (src/server/lockon-priority.ts, 2026-10-25): decided once a second on the server, sent as a change.

const GLOBAL = 0xFFFFFFFF;

function load() {
    const state = { now: 1_000_000, tick: null, logs: [], handlers: new Map(), npcs: new Map(), players: [] };
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn) => { state.tick = fn; return 1; },
        clearInterval: () => { state.tick = null; },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        Player: { all: () => state.players },
        Npc: { getById: (id) => state.npcs.get(id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/lockon-priority.js"), "utf8"), context);
    const hostiles = { bandits: [], gangs: [], wolves: [] };
    context.exports.installLockOnPriority([() => hostiles.bandits, () => hostiles.gangs, () => hostiles.wolves]);
    const player = (id, x, y = 0, world = GLOBAL) => {
        const body = { id, ready: true, position: { x, y, z: 0 }, virtualWorld: world, sent: [], emit(name, data) { assert.equal(name, "kcdc-gamemode:combat.priority"); this.sent.push(JSON.parse(data)); } };
        state.players.push(body);
        return body;
    };
    const npc = (id, x, y = 0, alive = true, world = GLOBAL) => { state.npcs.set(id, { id, alive, position: { x, y, z: 0 }, virtualWorld: world }); return id; };
    const look = (ms = 1000) => { state.now += ms; state.tick(); };
    return { api: context.exports, state, hostiles, player, npc, look };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("within 28 m of a bandit, the players round are named to the client, once; far from any, nothing is said", () => {
    const sut = load();
    const a = sut.player(1, 0);
    const b = sut.player(2, 10);
    const far = sut.player(3, 500);
    sut.hostiles.bandits.push(sut.npc(100, 20));
    sut.look();
    assert.deepEqual(plain(a.sent), [{ on: true, ids: [2] }]);
    assert.deepEqual(plain(b.sent), [{ on: true, ids: [1] }]);
    assert.deepEqual(plain(far.sent), [], "nobody near him, nothing to tell");
    sut.look();
    assert.equal(a.sent.length, 1, "unchanged: not sent again");
    const walker = sut.player(4, 5);
    sut.look();
    assert.deepEqual(plain(a.sent.at(-1)), { on: true, ids: [2, 4] }, "a player who comes near is added");
    assert.ok(walker.sent.length >= 1);
});

test("the roads' gangs and the hunting animals count too, a dead body or another world does not", () => {
    const sut = load();
    const a = sut.player(1, 0, 0, 5);
    sut.hostiles.gangs.push(sut.npc(200, 10, 0, true, 6), sut.npc(201, 10, 0, false, 5));
    sut.look();
    assert.deepEqual(plain(a.sent), [], "one is in another world and one is dead");
    sut.hostiles.wolves.push(sut.npc(300, 15, 0, true, 5));
    sut.look();
    assert.deepEqual(plain(a.sent), [{ on: true, ids: [] }], "a wolf in the same world");
    sut.state.npcs.clear();
    sut.hostiles.gangs.length = 0;
    sut.hostiles.wolves.length = 0;
    sut.hostiles.bandits.push(sut.npc(400, 10, 0, true, GLOBAL));
    sut.look();
    assert.equal(a.sent.length, 1, "the global world is seen by every world, and it was already on");
});

test("it stays on while one is within 40 m and for four seconds after the last, then the players are let back in", () => {
    const sut = load();
    const a = sut.player(1, 0);
    sut.player(2, 10);
    const id = sut.npc(100, 20);
    sut.hostiles.bandits.push(id);
    sut.look();
    assert.equal(a.sent.length, 1);
    sut.state.npcs.get(id).position.x = 35;
    sut.look();
    assert.equal(a.sent.length, 1, "35 m: still on (the far edge is 40)");
    sut.state.npcs.get(id).position.x = 300;
    sut.look(2000);
    assert.equal(a.sent.length, 1, "gone, but not for four seconds yet");
    sut.look(2500);
    assert.deepEqual(plain(a.sent.at(-1)), { on: false, ids: [] });
    sut.look();
    assert.equal(a.sent.length, 2, "and that is said once");
});

test("decide() is the rule: on near, kept to the far edge and for the hold, off after", () => {
    const { decide, lockOnPriority } = load().api;
    assert.equal(decide({ on: false, until: 0 }, 28, 0).on, true);
    assert.equal(decide({ on: false, until: 0 }, 29, 0).on, false);
    assert.equal(decide({ on: true, until: 5000 }, 40, 100).on, true);
    assert.equal(decide({ on: true, until: 5000 }, 41, 100).on, true, "within the hold");
    assert.equal(decide({ on: true, until: 5000 }, 41, 5000).on, false);
    assert.equal(decide({ on: true, until: 5000 }, Infinity, 100).on, true);
    assert.equal(lockOnPriority.nearM < lockOnPriority.farM, true);
});

test("a player who is not ready is not looked at, and a disconnect forgets the state", () => {
    const sut = load();
    const a = sut.player(1, 0);
    a.ready = false;
    sut.hostiles.bandits.push(sut.npc(100, 5));
    sut.look();
    assert.deepEqual(plain(a.sent), []);
    a.ready = true;
    sut.look();
    assert.equal(a.sent.length, 1);
    sut.state.handlers.get("playerDisconnect")(a);
    sut.look();
    assert.equal(a.sent.length, 2, "a new session of the same slot is told again");
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.tick, null);
});
