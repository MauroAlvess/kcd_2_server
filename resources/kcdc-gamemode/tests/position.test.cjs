const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const FILE = "playerdata/positions.json";
const GLOBAL_WORLD = 4294967295;
const STEAM = "76561198000000001";

/** A quaternion for a pure turn of `degrees` around the vertical, in the engine's w, x, y, z. */
function turn(degrees) {
    const half = (degrees * Math.PI) / 360;
    return { w: Math.cos(half), x: 0, y: 0, z: Math.sin(half) };
}

function load(initialFile) {
    const files = new Map(initialFile === undefined ? [] : [[FILE, initialFile]]);
    const writes = [];
    const handlers = new Map();
    const timers = new Map();
    const logs = [];
    const players = new Map();
    let nextTimer = 1;
    let now = 1_000_000;

    class Vector3 {
        constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
    }

    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "node:fs");
            return {
                readFileSync(file) {
                    if (!files.has(file)) throw new Error("ENOENT");
                    return files.get(file);
                },
                writeFileSync(file, data) { files.set(file, data); writes.push(file); },
                mkdirSync() {},
            };
        },
        console: { log: (line) => logs.push(line) },
        Vector3,
        Date: { now: () => now },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { getById: (id) => players.get(id) ?? null },
        setInterval: (fn) => { const id = nextTimer++; timers.set(id, fn); return id; },
        clearInterval: (id) => timers.delete(id),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/position.js"), "utf8"), context);
    context.exports.installPosition();

    return {
        api: context.exports,
        files,
        writes,
        logs,
        timers,
        /** The saved file, parsed. */
        saved: () => JSON.parse(files.get(FILE) ?? "{}"),
        fire: (name, ...args) => handlers.get(name)(...args),
        tick: () => { now += 20_000; for (const fn of [...timers.values()]) fn(); },
        /** A player the server knows by id, standing somewhere. Pass `spawned` calls to send them through playerSpawned. */
        player: (id, where = {}) => {
            const spawns = [];
            const player = {
                id,
                nickname: `Jogador${id}`,
                steamId: STEAM,
                ready: true,
                virtualWorld: GLOBAL_WORLD,
                position: { x: 1000, y: 2000, z: 100 },
                rotation: turn(0),
                spawn: (position, rotation) => { spawns.push({ position, rotation }); return true; },
                spawns,
                ...where,
            };
            players.set(id, player);
            return player;
        },
        leave: (id) => players.delete(id),
    };
}

// The module runs in its own vm realm, so what it builds has that realm's prototypes.
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a heading is read from the quaternion, whichever way round the player faces", () => {
    const { api } = load();
    for (const degrees of [0, 45, 90, 135, 180, -45, -90, -135]) {
        assert.ok(Math.abs(api.yawOf(turn(degrees)) - degrees) < 1e-9, `${degrees} degrees`);
    }
    assert.ok(Math.abs(api.yawOf(turn(270)) - -90) < 1e-9, "270 is -90");
});

test("a lean forward or sideways does not change the heading", () => {
    const { api } = load();
    const half = Math.PI / 12;                 // 30 degrees of lean around X
    const lean = { w: Math.cos(half), x: Math.sin(half), y: 0, z: 0 };
    assert.ok(Math.abs(api.yawOf(lean)) < 1e-9);

    // Turn 90 degrees, then lean: the heading is still 90.
    const turned = turn(90);
    const leaned = {
        w: turned.w * lean.w - turned.x * lean.x - turned.y * lean.y - turned.z * lean.z,
        x: turned.w * lean.x + turned.x * lean.w + turned.y * lean.z - turned.z * lean.y,
        y: turned.w * lean.y - turned.x * lean.z + turned.y * lean.w + turned.z * lean.x,
        z: turned.w * lean.z + turned.x * lean.y - turned.y * lean.x + turned.z * lean.w,
    };
    assert.ok(Math.abs(api.yawOf(leaned) - 90) < 1e-6);
});

test("Euler degrees are read the way player.spawn reads them", () => {
    const { api } = load();
    assert.equal(api.yawOf({ x: 0, y: 0, z: 90 }), 90);
    assert.equal(api.yawOf({ x: 0, y: 0, z: 540 }), 180);
    assert.equal(api.yawOf({ x: 0, y: 0, z: -180 }), 180);
    assert.equal(api.yawOf({ x: 0, y: 0, z: -90 }), -90);
});

test("a player with nothing saved is not placed, so the start point answers", () => {
    const sut = load();
    const player = sut.player(1);
    assert.equal(sut.api.placeBack(player), false);
    assert.deepEqual(player.spawns, []);
});

test("a player who is not on Steam is never placed", () => {
    const sut = load(JSON.stringify({ "": { x: 5, y: 5, z: 5, yaw: 0, savedAt: 1 } }));
    const player = sut.player(1, { steamId: "" });
    assert.equal(sut.api.placeBack(player), false);
});

test("a returning player is put where they were, facing the way they faced", () => {
    const sut = load(JSON.stringify({ [STEAM]: { x: 3158.7, y: 962.51, z: 59.66, yaw: 135, savedAt: 1 } }));
    const player = sut.player(1);

    assert.equal(sut.api.placeBack(player), true);
    assert.equal(player.spawns.length, 1);
    assert.deepEqual(plain(player.spawns[0].position), { x: 3158.7, y: 962.51, z: 59.66 });
    assert.deepEqual(plain(player.spawns[0].rotation), { x: 0, y: 0, z: 135 });
    assert.ok(sut.logs.some((line) => line.includes("put back where they stood")));
});

test("a saved place that makes no sense is ignored rather than used", () => {
    for (const bad of [
        { x: "1", y: 2, z: 3, yaw: 0 },
        { x: NaN, y: 2, z: 3, yaw: 0 },
        { x: null, y: 2, z: 3, yaw: 0 },
        { x: 0, y: 0, z: 0, yaw: 0 },
        { x: 0.3, y: 0.2, z: 0.1, yaw: 0 },
        { x: 1e9, y: 2, z: 3, yaw: 0 },
        { x: 1, y: 2, z: 3, yaw: Infinity },
    ]) {
        const sut = load(JSON.stringify({ [STEAM]: { ...bad, savedAt: 1 } }));
        const player = sut.player(1);
        assert.equal(sut.api.placeBack(player), false, JSON.stringify(bad));
        assert.deepEqual(player.spawns, []);
    }
});

test("a pose read before the player has landed is never saved, so it cannot erase the real place", () => {
    const sut = load(JSON.stringify({ [STEAM]: { x: 3158.7, y: 962.51, z: 59.66, yaw: 0, savedAt: 1 } }));
    const player = sut.player(1, { position: { x: 1, y: 1, z: 1 } });   // the start point, still

    sut.tick();                                  // a save tick while they are loading
    sut.fire("playerDisconnect", player);         // and they drop out before landing

    assert.deepEqual(plain(sut.saved()[STEAM]), { x: 3158.7, y: 962.51, z: 59.66, yaw: 0, savedAt: 1 });
    assert.deepEqual(sut.writes, []);
});

test("once landed, the place is saved on the next tick, with its heading", () => {
    const sut = load();
    const player = sut.player(1, { position: { x: 1500.126, y: 2500.5, z: 120.004 }, rotation: turn(90) });
    sut.fire("playerSpawned", player);

    sut.tick();

    const saved = sut.saved()[STEAM];
    assert.equal(saved.x, 1500.13);
    assert.equal(saved.y, 2500.5);
    assert.equal(saved.z, 120);
    assert.equal(saved.yaw, 90);
    assert.equal(typeof saved.savedAt, "number");
});

test("standing still writes nothing more, and walking more than half a metre does", () => {
    const sut = load();
    const player = sut.player(1);
    sut.fire("playerSpawned", player);

    sut.tick();
    assert.equal(sut.writes.length, 1);

    sut.tick();
    player.position = { x: 1000.2, y: 2000.2, z: 100 };       // 0.28 m
    sut.tick();
    assert.equal(sut.writes.length, 1, "shuffling is not worth a write");

    player.position = { x: 1010, y: 2000, z: 100 };
    sut.tick();
    assert.equal(sut.writes.length, 2);
    assert.equal(sut.saved()[STEAM].x, 1010);
});

test("a player who leaves has the last place they stood saved, before the next tick could", () => {
    const sut = load();
    const player = sut.player(1);
    sut.fire("playerSpawned", player);
    sut.tick();

    player.position = { x: 1234, y: 2345, z: 99 };
    sut.fire("playerDisconnect", player);
    assert.equal(sut.saved()[STEAM].x, 1234);

    // and once gone they are no longer followed
    sut.leave(1);
    const writes = sut.writes.length;
    sut.tick();
    assert.equal(sut.writes.length, writes);
});

test("a server restart saves everybody still in the world before it stops", () => {
    const sut = load();
    const player = sut.player(1, { position: { x: 1700, y: 2800, z: 130 } });
    sut.fire("playerSpawned", player);

    sut.fire("resourceStop", "some-other-resource");
    assert.deepEqual(plain(sut.saved()), {}, "another resource stopping saves nothing and stops nothing");
    assert.equal(sut.timers.size, 1);

    sut.fire("resourceStop", "kcdc-gamemode");
    assert.equal(sut.saved()[STEAM].x, 1700);
    assert.equal(sut.timers.size, 0, "the timer is cleared");
    assert.ok(sut.logs.some((line) => line.includes("saved 1 changed place(s) from 1 player(s)")), "the stop says what it saved");
});

test("a pose from another virtual world, or from a player who is not ready, is not saved", () => {
    const sut = load();
    const elsewhere = sut.player(1, { virtualWorld: 7 });
    const loading = sut.player(2, { ready: false, steamId: "76561198000000002" });
    sut.fire("playerSpawned", elsewhere);
    sut.fire("playerSpawned", loading);

    sut.tick();
    assert.deepEqual(plain(sut.saved()), {});

    elsewhere.virtualWorld = GLOBAL_WORLD;
    sut.tick();
    assert.equal(sut.saved()[STEAM].x, 1000, "back in the global world, saved again");
});

test("a pose that is not a place is not saved", () => {
    const sut = load();
    for (const position of [{ x: 0, y: 0, z: 0 }, { x: NaN, y: 5, z: 5 }, { x: 5e9, y: 5, z: 5 }]) {
        const player = sut.player(1, { position });
        sut.fire("playerSpawned", player);
        sut.tick();
    }
    assert.deepEqual(plain(sut.saved()), {});
    assert.deepEqual(sut.writes, []);
});

test("two players are kept apart by their Steam ids", () => {
    const sut = load();
    const a = sut.player(1, { position: { x: 1100, y: 2100, z: 101 } });
    const b = sut.player(2, { steamId: "76561198000000002", position: { x: 3200, y: 900, z: 55 } });
    sut.fire("playerSpawned", a);
    sut.fire("playerSpawned", b);
    sut.tick();

    assert.equal(sut.saved()[STEAM].x, 1100);
    assert.equal(sut.saved()["76561198000000002"].x, 3200);
});

test("forgetting a place drops it, and nothing is saved for that player until they land again", () => {
    const sut = load();
    const player = sut.player(1, { position: { x: 1100, y: 2100, z: -400 } });   // stuck under the map
    sut.fire("playerSpawned", player);
    sut.tick();
    assert.ok(sut.saved()[STEAM]);

    assert.equal(sut.api.forgetPlace(player), true);
    assert.equal(sut.saved()[STEAM], undefined);

    sut.tick();
    sut.fire("playerDisconnect", player);
    assert.equal(sut.saved()[STEAM], undefined, "neither the next tick nor leaving puts it back");

    // Back in the world after rejoining, they are followed again.
    sut.fire("playerSpawned", player);
    player.position = { x: 1500, y: 2500, z: 100 };
    sut.tick();
    assert.equal(sut.saved()[STEAM].x, 1500);
});

test("forgetting a place that was never saved says so", () => {
    const sut = load();
    assert.equal(sut.api.forgetPlace(sut.player(1)), false);
});

test("the saved places survive a restart, and a damaged file starts empty rather than failing", () => {
    const first = load();
    const player = first.player(1, { position: { x: 1700, y: 2800, z: 130 }, rotation: turn(-90) });
    first.fire("playerSpawned", player);
    first.tick();

    const second = load(first.files.get(FILE));
    assert.deepEqual(plain(second.api.getSavedPlace(STEAM)), { x: 1700, y: 2800, z: 130, yaw: -90, savedAt: second.api.getSavedPlace(STEAM).savedAt });

    const broken = load("{ not json");
    assert.equal(broken.api.getSavedPlace(STEAM), null);
    assert.equal(broken.api.getSavedPlace(""), null);
});
