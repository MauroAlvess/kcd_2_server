const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Where a newcomer arrives (src/server/spawns.ts): on the road the game brings Henry in by, west of Suchdol.

class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

function load({ placed = false, random = 0 } = {}) {
    const state = { handlers: new Map(), logs: [], placedFor: [] };
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "./position.js");
            return { placeBack: (player) => { state.placedFor.push(player.nickname); return placed; } };
        },
        console: { log: (line) => state.logs.push(line) },
        Math: Object.create(Math, { random: { value: () => random } }),
        Vector3: FakeVector3,
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/spawns.js"), "utf8"), context);
    return { api: context.exports, state };
}

const newcomer = () => {
    const spawns = [];
    return { nickname: "Hans", spawns, spawn(position, rotation) { spawns.push({ position: { ...position }, rotation: { x: rotation.x, y: rotation.y, z: rotation.z } }); return true; } };
};

test("the start points are the game's own markers of the arrival at Suchdol, on the road to the west of it, a few steps apart", () => {
    const { api } = load();
    assert.equal(api.spawnPoints.length, 3);
    for (const point of api.spawnPoints) {
        const away = Math.hypot(point.position.x - 364.94, point.position.y - 3745.57);
        assert.ok(away < 30, `${point.name} is ${away.toFixed(0)} m from the cart's starting point`);
        assert.ok(point.position.x < 430, "west of Suchdol's lands (they begin at 430)");
        assert.deepEqual(Array.from(point.tags), ["chegada"]);
        assert.equal(point.yaw, -140, "looking down the road toward Suchdol");
    }
    assert.equal(new Set(api.spawnPoints.map((point) => `${point.position.x},${point.position.y}`)).size, 3, "no two the same spot");
});

test("a newcomer is drawn one of them, by weight, and a tag narrows the draw", () => {
    const first = load({ random: 0 });
    assert.equal(first.api.pickSpawnPoint().name, first.api.spawnPoints[0].name);
    const last = load({ random: 0.99 });
    assert.equal(last.api.pickSpawnPoint().name, last.api.spawnPoints[2].name);
    assert.equal(last.api.pickSpawnPoint("chegada") !== null, true);
    assert.equal(last.api.pickSpawnPoint("outra"), null);
});

test("on spawning, somebody with no saved place arrives on the road; somebody who has one is put back and given nothing else", () => {
    const fresh = load({ placed: false, random: 0 });
    fresh.api.installSpawns();
    const player = newcomer();
    fresh.state.handlers.get("playerSpawning")(player);
    assert.deepEqual(fresh.state.placedFor, ["Hans"], "the saved place is asked first");
    assert.deepEqual(player.spawns, [{ position: { x: 364.94, y: 3745.57, z: 131.35 }, rotation: { x: 0, y: 0, z: -140 } }]);
    assert.ok(fresh.state.logs.some((line) => /spawns: Hans chegou pela primeira vez: Estrada de chegada, a oeste de Suchdol/.test(line)));

    const returning = load({ placed: true });
    returning.api.installSpawns();
    const back = newcomer();
    returning.state.handlers.get("playerSpawning")(back);
    assert.deepEqual(back.spawns, [], "put back by position.ts, which did the spawn itself");
});
