"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { profession } = require("./reachpatch.cjs");
// The tables' own XP and no day's limit: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, the standard of 2026-11-03): the tests of the pace set it.
profession.useTables();

// The sheep's flax (src/server/sheep.ts, 2026-10-31): the Agricultores shear the living sheep with E, as they milk the cow, and take flax.

function load({ farmer = true } = {}) {
    const state = {
        emitted: [], chat: [], added: [], xp: [], played: [], stopped: 0, logs: [], timers: [], intervals: [], handlers: new Map(), client: new Map(), lowered: [],
        held: [], released: [], working: false, farming: false, gathering: false, full: false, nearby: [], players: [], level: 0,
    };
    const npcs = new Map();
    // The work at an animal that the milking and the shearing share (src/server/livestock-work.ts): the real module, one for each load.
    const livestock = (() => { const box = { exports: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/livestock-work.js"), "utf8"), box); return box.exports.livestockWork; })();
    const context = {
        exports: {},
        require: (id) => ({
            "./animals.js": { animalPopulation: { near: (kind, from, world, radius) => { state.asked = { kind, from: { ...from }, world, radius }; return state.nearby; }, hold: (id, ms) => { state.held.push([id, ms]); return true; }, release: (id) => state.released.push(id) } },
            "./craft-data.js": { FARM_CROPS: [{ id: "cebola", harvest: "guid-cebola" }, { id: "linho", harvest: "guid-linho" }] },
            "./craft.js": { isWorking: () => state.working },
            "./farm.js": { isFarming: () => state.farming },
            "./gather.js": { isGathering: () => state.gathering },
            "./guild-crafts.js": { mayCraft: (player, craft) => (craft === "horta" ? farmer : false) },
            "./livestock-work.js": { livestockWork: livestock },
            "./torch-down.js": { lowerTorch: (player) => state.lowered.push(player.id) },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date,
        Math,
        JSON,
        Number,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Npc: { getById: (id) => npcs.get(id) ?? null },
        Player: { all: () => state.players },
        Inventory: {
            add: (owner, request) => {
                if (state.full) return { ok: false, code: "inventoryCapacity" };
                state.added.push([request.item, request.amount]);
                return { ok: true, code: "" };
            },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), onClient: (name, fn) => state.client.set(name, fn) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        clearTimeout: (handle) => { if (state.timers[handle - 1]) state.timers[handle - 1].cleared = true; },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/sheep.js"), "utf8"), context);
    const sheep = (id = 77, at = { x: 101, y: 100, z: 50 }, extra = {}) => {
        const npc = { id, actorClass: "SheepEwe", alive: true, position: { ...at }, ...extra };
        npcs.set(id, npc);
        return npc;
    };
    let nextId = 1;
    const player = (nick = "Greta", at = { x: 100, y: 100, z: 50 }) => {
        const body = {
            id: nextId++, nickname: nick, steamId: nick.toLowerCase(), ready: true, alive: true, mounted: false, virtualWorld: 4294967295, position: { ...at },
            getTrack: () => ({ level: state.level }),
            addXp: (track, amount) => state.xp.push([track, amount]),
            playAnimation: (fragment, options) => { state.played.push([fragment, { ...options }]); },
            stopAnimation: () => { state.stopped += 1; },
            emit: (event, payload) => state.emitted.push({ to: nick, event: event.replace("kcdc-gamemode:", ""), payload: JSON.parse(payload) }),
        };
        state.players.push(body);
        return body;
    };
    const timer = (ms) => state.timers.filter((one) => one.ms === ms && !one.cleared).at(-1);
    return { api: context.exports, state, sheep, player, npcs, timer, livestock };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const T0 = 1_760_000_000_000;

test("a shearing gives one to three flax, one more from level 15, and the flax is the one of the fields (the harvest of the crop \"linho\")", () => {
    const sut = load();
    assert.deepEqual([0, 0.34, 0.67, 0.999].map((roll) => sut.api.amountOf(0, roll)), [1, 2, 3, 3]);
    assert.equal(sut.api.amountOf(15, 0), 2);
    assert.equal(sut.api.amountOf(20, 0.999), 4);
    assert.equal(sut.api.FLAX_ITEM, "guid-linho");
    assert.deepEqual(Array.from(sut.api.SHEEP), ["SheepEwe", "SheepRam"]);
});

test("a farmer at a sheep is held in the picking animation for six seconds, then the flax comes with a little XP, and the same sheep waits half an hour", () => {
    const sut = load();
    sut.sheep();
    const greta = sut.player();
    assert.equal(sut.api.startShearing(greta, 77, T0), "");
    assert.deepEqual(sut.state.played, [["PickingHerbs", { loop: true, lockMovement: true }]]);
    assert.deepEqual(plain(sut.state.held), [[77, 21_000]], "the sheep stands still for the work, and a little longer at most");
    assert.deepEqual(sut.state.released, []);
    assert.deepEqual(sut.state.lowered, [greta.id], "the torch is lowered first");
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "sheep.state", payload: { on: true } });
    assert.equal(sut.api.isShearing(greta), true);
    assert.equal(sut.livestock.of(greta.id), "tosquia", "the work is written down for the milking to see");
    assert.equal(sut.timer(6_000) !== undefined, true);

    sut.timer(6_000).fn();
    assert.equal(sut.state.added.at(-1)[0], "guid-linho");
    assert.ok(sut.state.added.at(-1)[1] >= 1 && sut.state.added.at(-1)[1] <= 3);
    assert.deepEqual(sut.state.xp, [["survival", 4]]);
    assert.equal(sut.state.stopped, 1);
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "sheep.state", payload: { on: false } });
    assert.match(sut.state.chat.at(-1), /^Tosquia: \dx Linho \(\+4 XP\)\.$/);
    assert.equal(sut.api.isShearing(greta), false);
    assert.equal(sut.livestock.of(greta.id), "", "and nothing is left at the animal for the next work to find");
    assert.deepEqual(plain(sut.state.released), [77], "the sheep walks again when the work is done");

    // The same sheep, at once: it has given.
    assert.match(sut.api.startShearing(greta, 77, Date.now()), /Esta ovelha foi tosquiada há pouco: volte em (29|30) min\./);
    assert.equal(sut.state.played.length, 1, "no second animation");
    assert.equal(sut.api.waitMinutes(77, Date.now() + 31 * 60_000), 0, "and half an hour on it gives again");
});

test("the amount of a shearing is rolled and the level counts: a farmer of level 15 has the bonus one", () => {
    const sut = load();
    sut.sheep();
    sut.state.level = 15;
    const greta = sut.player();
    sut.api.startShearing(greta, 77, T0);
    sut.timer(6_000).fn();
    assert.ok(sut.state.added.at(-1)[1] >= 2 && sut.state.added.at(-1)[1] <= 4);
});

test("the ram is sheared as the ewe is; a cow, a pig or a dead sheep is not", () => {
    const sut = load();
    const greta = sut.player();
    sut.sheep(77, { x: 101, y: 100, z: 50 }, { actorClass: "SheepRam" });
    assert.equal(sut.api.startShearing(greta, 77, T0), "");
    sut.api.stopShearing(greta);
    sut.sheep(78, { x: 101, y: 100, z: 50 }, { actorClass: "CattleCow" });
    assert.match(sut.api.startShearing(greta, 78, T0), /Essa ovelha não está mais aí/);
    sut.sheep(79, { x: 101, y: 100, z: 50 }, { actorClass: "Pig" });
    assert.match(sut.api.startShearing(greta, 79, T0), /Essa ovelha não está mais aí/);
    sut.sheep(80, { x: 101, y: 100, z: 50 }, { alive: false });
    assert.match(sut.api.startShearing(greta, 80, T0), /Essa ovelha não está mais aí/);
});

test("only a farmer, on foot and alive, at a living sheep within reach, not working at anything else, may shear; the others are told where to learn the trade", () => {
    const stranger = load({ farmer: false });
    stranger.sheep();
    const nobody = stranger.player("Nobody");
    assert.equal(stranger.api.startShearing(nobody, 77, T0), "Tosquiar é ofício dos agricultores (guilda Agricolae): aprenda o ofício com o agricultor da sua cidade.");
    assert.deepEqual(stranger.state.played, []);

    const sut = load();
    sut.sheep();
    const greta = sut.player();
    assert.match(sut.api.startShearing(greta, 12345, T0), /não está mais aí/, "no such body");
    assert.equal(sut.api.startShearing(greta, "x", T0), "Escolha uma ovelha.");
    sut.sheep(82, { x: 110, y: 100, z: 50 });
    assert.match(sut.api.startShearing(greta, 82, T0), /Chegue mais perto/, "ten metres is past the reach the server allows");
    sut.sheep(83, { x: 101, y: 100, z: 60 });
    assert.match(sut.api.startShearing(greta, 83, T0), /Chegue mais perto/, "another floor");
    greta.mounted = true;
    assert.equal(sut.api.startShearing(greta, 77, T0), "Agora não dá.");
    greta.mounted = false;
    greta.alive = false;
    assert.equal(sut.api.startShearing(greta, 77, T0), "Agora não dá.");
    greta.alive = true;
    for (const busy of ["working", "farming", "gathering"]) {
        sut.state[busy] = true;
        assert.equal(sut.api.startShearing(greta, 77, T0), "ocupado", busy);
        sut.state[busy] = false;
    }
    sut.livestock.begin(greta.id, "ordenha");
    assert.equal(sut.api.startShearing(greta, 77, T0), "ocupado", "milking a cow");
    sut.livestock.end(greta.id);
    assert.deepEqual(sut.state.played, []);
    assert.equal(sut.state.added.length, 0);
});

test("walking off, the sheep gone, or a full bag at the end of the work: nothing is shorn, nothing is spent, and the animation is let go", () => {
    const sut = load();
    sut.sheep();
    const greta = sut.player();
    sut.api.startShearing(greta, 77, T0);
    greta.position = { x: 100, y: 103, z: 50 };
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /Você saiu do lugar: nada foi tosquiado/);
    assert.deepEqual(plain(sut.state.released), [77], "the sheep is let go whichever way the work ends");
    assert.equal(sut.state.added.length, 0);
    assert.equal(sut.state.stopped, 1);
    assert.equal(sut.livestock.of(greta.id), "");

    greta.position = { x: 100, y: 100, z: 50 };
    sut.api.startShearing(greta, 77, T0);
    sut.npcs.get(77).alive = false;
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /Nada foi tosquiado\. Essa ovelha não está mais aí/);

    sut.npcs.get(77).alive = true;
    sut.state.full = true;
    sut.api.startShearing(greta, 77, T0);
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /O linho não coube na sua bolsa/);
    assert.equal(sut.api.waitMinutes(77, T0), 0, "and the sheep has not given: it may be shorn again");
    assert.deepEqual(sut.state.xp, []);
    assert.equal(sut.api.isShearing(greta), false);
});

test("the client's stop (a step) ends the work at once: the timer is cancelled, the animation let go, nothing given", () => {
    const sut = load();
    sut.sheep();
    const greta = sut.player();
    sut.api.startShearing(greta, 77, T0);
    const timer = sut.timer(6_000);
    assert.equal(sut.api.stopShearing(greta, "Tosquia interrompida."), true);
    assert.equal(timer.cleared, true);
    assert.equal(sut.state.stopped, 1);
    assert.deepEqual(plain(sut.state.released), [77], "a step that gives the work up lets the sheep walk again");
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "sheep.state", payload: { on: false } });
    assert.equal(sut.state.chat.at(-1), "Tosquia interrompida.");
    assert.equal(sut.livestock.of(greta.id), "");
    assert.equal(sut.api.stopShearing(greta), false, "nothing to stop twice");
    assert.equal(sut.state.added.length, 0);
});

test("the client is told of the nearest sheep within reach to a farmer, ewe or ram, again only when it changed, and that there is none when it goes; whoever is not a farmer is told nothing", () => {
    const sut = load();
    const greta = sut.player();
    sut.state.nearby = [{ id: 77, x: 101.13, y: 100.4, z: 50, distance: 1.3 }];
    sut.api.tellNear(T0);
    assert.deepEqual(plain(sut.state.asked), { kind: ["SheepEwe", "SheepRam"], from: { x: 100, y: 100, z: 50 }, world: 4294967295, radius: 2.6 });
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "sheep.near", payload: { id: 77, x: 101.25, y: 100.5, z: 50, r: 1 } });
    sut.api.tellNear(T0);
    assert.equal(sut.state.emitted.length, 1, "the same word is not said twice");
    sut.state.nearby = [{ id: 77, x: 102.5, y: 100.4, z: 50, distance: 2.5 }];
    sut.api.tellNear(T0);
    assert.equal(sut.state.emitted.at(-1).payload.x, 102.5, "a sheep that walked on is told again");
    sut.state.nearby = [];
    sut.api.tellNear(T0);
    assert.deepEqual(plain(sut.state.emitted.at(-1).payload), { id: 0 });
    sut.api.tellNear(T0);
    assert.equal(sut.state.emitted.length, 3);
    assert.equal(greta.id, 1);

    const strangers = load({ farmer: false });
    strangers.player("Nobody");
    strangers.state.nearby = [{ id: 77, x: 101, y: 100, z: 50, distance: 1 }];
    strangers.api.tellNear(T0);
    assert.deepEqual(strangers.state.emitted, []);
    assert.equal(strangers.state.asked, undefined, "and nothing is looked for");
});

test("a sheep that gave a moment ago is told as not ready, and so is nothing told to a farmer who is mounted", () => {
    const sut = load();
    sut.sheep();
    const greta = sut.player();
    sut.api.startShearing(greta, 77, T0);
    sut.timer(6_000).fn();
    sut.state.emitted.length = 0;
    sut.state.nearby = [{ id: 77, x: 101, y: 100, z: 50, distance: 1 }];
    sut.api.tellNear(Date.now());
    assert.equal(sut.state.emitted.at(-1).payload.r, 0, "not ready: the client puts up no hint");
    greta.mounted = true;
    sut.api.tellNear(Date.now());
    assert.deepEqual(plain(sut.state.emitted.at(-1).payload), { id: 0 }, "on a horse there is no sheep");
});

test("installed: the press asks, the step stops, a disconnect lets go, a sheep that is gone is forgotten, and the tell goes by a timer", () => {
    const sut = load();
    sut.api.installSheep();
    sut.sheep();
    const greta = sut.player();
    sut.state.client.get("kcdc-gamemode:sheep.shear")(greta, JSON.stringify({ id: 77 }));
    assert.equal(sut.api.isShearing(greta), true);
    sut.state.client.get("kcdc-gamemode:sheep.stop")(greta);
    assert.equal(sut.api.isShearing(greta), false);
    sut.state.client.get("kcdc-gamemode:sheep.shear")(greta, { id: 77 });
    assert.equal(sut.api.isShearing(greta), true, "an object is read as well as a string");
    sut.state.handlers.get("playerDisconnect")(greta);
    assert.equal(sut.api.isShearing(greta), false);
    assert.equal(sut.livestock.of(greta.id), "");
    assert.equal(sut.state.intervals[0].ms, 400);
    sut.state.client.get("kcdc-gamemode:sheep.shear")(greta, "nonsense");
    assert.equal(sut.api.isShearing(greta), false);

    // A sheep that was shorn and is destroyed is not remembered as shorn by the next body that takes its id.
    sut.api.startShearing(greta, 77, T0);
    sut.timer(6_000).fn();
    assert.ok(sut.api.waitMinutes(77, Date.now()) > 0);
    sut.state.handlers.get("npcDestroy")({ id: 77 });
    assert.equal(sut.api.waitMinutes(77, Date.now()), 0);
});

test("the shearing pays the trades' standard: four times the table's XP, said as it was paid (the standard of 2026-11-03 keeps it)", () => {
    profession.useStandard();
    try {
        const sut = load();
        sut.sheep();
        const greta = sut.player();
        assert.equal(sut.api.startShearing(greta, 77, T0), "");
        sut.timer(6_000).fn();
        assert.deepEqual(sut.state.xp, [["survival", 16]]);
        assert.match(sut.state.chat.at(-1), /^Tosquia: \dx Linho \(\+16 XP\)\.$/);
    } finally {
        profession.useTables();
    }
});
