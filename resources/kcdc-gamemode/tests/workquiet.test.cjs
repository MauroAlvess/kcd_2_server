"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The other players' loud works, seen from this machine (src/client/work-quiet.ts, 2026-10-23: "o barulho de cortar madeira e minerar só pode
// dar para escutar em quem estiver perto"): the server says who is working at what; the sounds of each worker further than 12 m are stopped here.

const SOUNDS = "kcdc-gamemode:work.sounds";

function load({ me = { ready: true, id: 50, position: { x: 0, y: 0, z: 0 } }, others } = {}) {
    const bodies = others ?? { 7: { entityId: 107, position: { x: 30, y: 0, z: 0 } }, 8: { entityId: 108, position: { x: 5, y: 0, z: 0 } }, 9: { entityId: 109, position: { x: 0, y: 9, z: 5 } } };
    const state = { handlers: new Map(), tick: null, timer: null, stopped: [], now: 1_000_000 };
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
        Date: { now: () => state.now },
        LocalPlayer: me,
        Player,
        Audio: { stopOnEntity: (trigger, entity) => { state.stopped.push([trigger, entity]); return true; } },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        setInterval: (fn, ms) => { state.tick = fn; state.timer = ms; return 1; },
        clearInterval() { state.tick = null; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/work-quiet.js"), "utf8"), context);
    context.exports.installWorkQuiet();
    const say = (workers) => state.handlers.get(SOUNDS)(typeof workers === "string" ? workers : JSON.stringify({ w: workers }));
    return { api: context.exports, state, say };
}

test("the server's list is kept as a whole and replaced as a whole; a message that cannot be read says nobody works; only whole rows are kept", () => {
    const sut = load();
    sut.say([[7, "lenha"], [8, "mina"]]);
    assert.deepEqual(Array.from(sut.api.workersHeard(), (row) => Array.from(row)), [[7, "lenha"], [8, "mina"]]);
    sut.say([]);
    assert.deepEqual(Array.from(sut.api.workersHeard()), []);
    sut.say([[7, "lenha"]]);
    sut.say("not json");
    assert.deepEqual(Array.from(sut.api.workersHeard()), []);
    sut.say([[7], ["x", "lenha"], [7, 5], [1.5, "mina"], [9, "horta"], "no"]);
    assert.deepEqual(Array.from(sut.api.workersHeard(), (row) => Array.from(row)), [[9, "horta"]]);
});

test("the sounds of a worker further than 12 m are stopped, those of one near are left, and each kind has its own triggers", () => {
    const sut = load();
    sut.say([[7, "lenha"], [8, "lenha"], [9, "mina"]]);
    sut.state.tick();
    const lenha = Array.from(sut.api.WORK_SOUNDS.lenha);
    assert.ok(lenha.includes("f_lu_axe_log2") && lenha.includes("f_lu_axe_log2_louder"), "the axe in the log, both of its triggers");
    assert.deepEqual(sut.state.stopped.filter(([, entity]) => entity === 107).map(([trigger]) => trigger), lenha, "30 m away: stopped");
    assert.deepEqual(sut.state.stopped.filter(([, entity]) => entity === 108), [], "5 m away: heard");
    assert.deepEqual(sut.state.stopped.filter(([, entity]) => entity === 109), [], "9 m flat and 5 m up is 10.3 m: within, the distance being the whole one");
    assert.ok(sut.state.timer <= 100, "often enough that what leaks is a click, not a blow");

    sut.state.stopped.length = 0;
    const far = load({ others: { 7: { entityId: 107, position: { x: 0, y: 13, z: 0 } } } });
    far.say([[7, "mina"]]);
    far.state.tick();
    const mina = Array.from(far.api.WORK_SOUNDS.mina);
    assert.ok(mina.includes("f_sto_pickaxe_stone") && mina.includes("f_sto_hammer_chisel_stone"));
    assert.deepEqual(far.state.stopped.map(([trigger]) => trigger), mina, "13 m: stopped, with the stonemason's triggers");

    const farm = load({ others: { 7: { entityId: 107, position: { x: 50, y: 0, z: 0 } } } });
    farm.say([[7, "horta"]]);
    farm.state.tick();
    assert.ok(farm.api.WORK_SOUNDS.horta.includes("f_pe_shovel1_use") && farm.api.WORK_SOUNDS.horta.includes("f_pe_hoe_use"));
    assert.deepEqual(farm.state.stopped.map(([trigger]) => trigger), Array.from(farm.api.WORK_SOUNDS.horta));
});

test("the worker's own machine hears the work; a kind nobody knows is left alone; nothing happens before the list, or while this player is not in the world", () => {
    const own = load({ me: { ready: true, id: 7, position: { x: 0, y: 0, z: 0 } } });
    own.say([[7, "lenha"]]);
    own.state.tick();
    assert.deepEqual(own.state.stopped, []);

    const odd = load();
    odd.say([[7, "dança"]]);
    odd.state.tick();
    assert.deepEqual(odd.state.stopped, []);

    const none = load();
    none.state.tick();
    assert.deepEqual(none.state.stopped, [], "no list, no work");

    const loading = load({ me: { ready: false, id: 50, position: { x: 0, y: 0, z: 0 } } });
    loading.say([[7, "lenha"]]);
    loading.state.tick();
    assert.deepEqual(loading.state.stopped, []);
});

test("a body this machine does not have, or one with no entity, is skipped without an error; the others are still silenced", () => {
    const sut = load({ others: { 7: { entityId: 0, position: { x: 40, y: 0, z: 0 } }, 9: { entityId: 109, position: { x: 40, y: 0, z: 0 } } } });
    sut.say([[6, "lenha"], [7, "lenha"], [9, "lenha"]]);
    assert.doesNotThrow(() => sut.state.tick());
    assert.deepEqual(new Set(sut.state.stopped.map(([, entity]) => entity)), new Set([109]));
});

test("a list the server has not repeated for twelve seconds is forgotten; the resource stopping ends the work", () => {
    const sut = load();
    sut.say([[7, "lenha"]]);
    sut.state.now += sut.api.STALE_MS - 1_000;
    sut.state.tick();
    assert.ok(sut.state.stopped.length > 0, "still believed");
    sut.state.stopped.length = 0;
    sut.state.now += 2_000;
    sut.state.tick();
    assert.deepEqual(sut.state.stopped, [], "a worker the server stopped talking of is no worker");
    assert.deepEqual(Array.from(sut.api.workersHeard()), []);

    sut.say([[7, "lenha"]]);
    sut.state.handlers.get("resourceStop")("other");
    assert.ok(sut.state.tick);
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.tick, null);
    assert.deepEqual(Array.from(sut.api.workersHeard()), []);
});
