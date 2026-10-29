"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The other players' horses, heard only from near (src/client/mount-quiet.ts, 2026-10-26: "sempre que alguém sobe no cavalo escutam de
// longe"): the server says who rides or has just got on or off; this machine stops the mount's sounds and the player's-own-horse sounds on
// the far riders and the horses under them.

const SOUNDS = "kcdc-gamemode:mount.sounds";
const SEEN = "kcdc-gamemode:mount.seen";

function load({ me = { ready: true, id: 50, position: { x: 0, y: 0, z: 0 } }, others, near } = {}) {
    const bodies = others ?? {
        7: { entityId: 107, position: { x: 40, y: 0, z: 0 } }, // far: everything stopped
        8: { entityId: 108, position: { x: 20, y: 0, z: 0 } }, // between: the player's-own-horse sounds only
        9: { entityId: 109, position: { x: 5, y: 0, z: 0 } }, // near: nothing
    };
    // What the engine has round each rider: their own body and the horse under them.
    const around = near ?? {
        40: [{ entityId: 107, class: "Player" }, { entityId: 207, class: "Horse" }],
        20: [{ entityId: 108, class: "Player" }, { entityId: 208, class: "Horse" }],
        5: [{ entityId: 109, class: "Player" }, { entityId: 209, class: "Horse" }],
    };
    const state = { handlers: new Map(), tick: null, timer: null, stopped: [], stoppedAll: [], emitted: [], queries: 0, now: 1_000_000 };
    class Player {
        constructor(id) {
            if (!(id in bodies)) throw new Error("no such player here");
            this.id = id;
            this.entityId = bodies[id].entityId;
            this.position = bodies[id].position;
        }
    }
    const context = {
        exports: {},
        console,
        Math,
        JSON,
        Number,
        Array,
        Set,
        Map,
        Date: { now: () => state.now },
        LocalPlayer: me,
        Player,
        Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
        World: {
            entitiesInRadius: (centre, radius, options) => {
                state.queries += 1;
                assert.ok(radius > 0 && radius <= 5);
                return (around[centre.x] ?? []).slice(0, options?.max ?? 64);
            },
        },
        Audio: {
            stopOnEntity: (trigger, entity) => { state.stopped.push([trigger, entity]); return true; },
            stopAllOnEntity: (entity) => { state.stoppedAll.push(entity); return true; },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push([name, JSON.parse(payload)]) },
        setInterval: (fn, ms) => { state.tick = fn; state.timer = ms; return 1; },
        clearInterval() { state.tick = null; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/mount-quiet.js"), "utf8"), context);
    context.exports.installMountQuiet();
    const say = (riders) => state.handlers.get(SOUNDS)(typeof riders === "string" ? riders : JSON.stringify({ r: riders }));
    const on = (entity) => state.stopped.filter(([, e]) => e === entity).map(([t]) => t);
    return { api: context.exports, state, say, on };
}

test("the server's list is kept as a whole and replaced as a whole; what cannot be read says nobody rides", () => {
    const sut = load();
    sut.say([7, 8]);
    assert.deepEqual(Array.from(sut.api.ridersHeard()), [7, 8]);
    sut.say([]);
    assert.deepEqual(Array.from(sut.api.ridersHeard()), []);
    sut.say([7]);
    sut.say("not json");
    assert.deepEqual(Array.from(sut.api.ridersHeard()), []);
    sut.say([7, "8", -1, 1.5, 9]);
    assert.deepEqual(Array.from(sut.api.ridersHeard()), [7, 9]);
});

test("a far rider: the mount's and the player's-own-horse sounds stopped on the body, and everything on the horse under them", () => {
    const sut = load();
    sut.say([7]);
    sut.state.tick();
    const body = sut.on(107);
    for (const trigger of [...sut.api.MOUNT_SOUNDS, ...sut.api.OWN_HORSE_SOUNDS]) {
        assert.ok(body.includes(trigger), trigger);
    }
    assert.deepEqual(sut.state.stoppedAll, [207], "the horse: all of it");
    assert.ok(sut.api.OWN_HORSE_SOUNDS.includes("hs_hp_grass_gallop"));
    assert.ok(sut.api.OWN_HORSE_SOUNDS.includes("horse_stamina"));
    assert.equal(sut.api.OWN_HORSE_SOUNDS.filter((t) => t.startsWith("hs_hp_")).length, 52, "every ground and pace of the game's table");
});

test("a rider between NEAR_M and HEAR_M keeps the get-on but not the sounds of the player's own horse; one near keeps everything; this machine's own player is never quieted", () => {
    const sut = load();
    sut.say([8, 9, 50]);
    sut.state.tick();
    const between = sut.on(108);
    assert.ok(between.includes("hs_hp_grass") && between.includes("a_o_horse_radar_feedback_loud"));
    assert.ok(!between.includes("a_o_horse_saddle_foley"), "the get-on is heard from 20 m");
    assert.ok(sut.on(208).includes("horse_stamina"), "on the horse too, one by one");
    assert.ok(!sut.state.stoppedAll.includes(208));
    assert.deepEqual(sut.on(109), [], "near: nothing");
    assert.deepEqual(sut.on(209), []);
    assert.equal(sut.state.queries, 1, "the horse is looked for only round the riders that are quieted");
});

test("the horse is looked for once a second and kept in between", () => {
    const sut = load();
    sut.say([7]);
    sut.state.tick();
    sut.state.now += 300;
    sut.state.tick();
    assert.equal(sut.state.queries, 1);
    assert.deepEqual(sut.state.stoppedAll, [207, 207]);
    sut.state.now += sut.api.LOOK_EVERY_MS;
    sut.state.tick();
    assert.equal(sut.state.queries, 2);
});

test("with no horse's class round a far rider, the nearest other thing gets the horse's triggers one by one, and the server is told the classes once", () => {
    const sut = load({ near: { 40: [{ entityId: 107, class: "Player" }, { entityId: 300, class: "AnimalNPC" }, { entityId: 301, class: "GeomEntity" }] } });
    sut.say([7]);
    sut.state.tick();
    assert.deepEqual(sut.state.stoppedAll, [], "nothing unknown is silenced whole");
    assert.ok(sut.on(300).includes("hs_hp_soil_trot") && sut.on(300).includes("a_o_horse_saddle_foley"));
    assert.deepEqual(sut.on(301), []);
    assert.deepEqual(sut.state.emitted, [[SEEN, { c: ["AnimalNPC", "GeomEntity"] }]]);
    sut.state.now += 2_000;
    sut.state.tick();
    assert.equal(sut.state.emitted.length, 1, "once");
});

test("a list the server stopped repeating is forgotten, and nothing is stopped for a rider this machine does not have", () => {
    const sut = load();
    sut.say([7, 12]);
    sut.state.now += sut.api.STALE_MS + 1;
    sut.state.tick();
    assert.deepEqual(Array.from(sut.api.ridersHeard()), []);
    assert.deepEqual(sut.state.stopped, []);
    sut.say([12]);
    sut.state.tick();
    assert.deepEqual(sut.state.stopped, [], "rider 12 is not on this machine");
    assert.equal(sut.state.timer, sut.api.QUIET_EVERY_MS);
});
