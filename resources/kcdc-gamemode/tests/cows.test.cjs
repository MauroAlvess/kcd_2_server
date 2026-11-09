"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { profession } = require("./reachpatch.cjs");
// The tables' own XP and no day's limit: these tests are of the work and not of the pace the trades' XP is paid at (src/server/profession-xp.ts, the standard of 2026-11-03): the tests of the pace set it.
profession.useTables();

// The cows' milk (src/server/cows.ts, 2026-10-27): the Agricultores milk the living cow with E, the hunters find milk in the carcass they butcher.

function load({ farmer = true, hunter = true } = {}) {
    const state = {
        emitted: [], chat: [], added: [], carcassAdds: [], xp: [], played: [], stopped: 0, logs: [], timers: [], intervals: [], handlers: new Map(), client: new Map(), lowered: [],
        held: [], released: [], working: false, farming: false, gathering: false, full: false, carcassFails: false, nearby: [], players: [], level: 0,
    };
    const npcs = new Map();
    // The work at an animal that the milking and the shearing share (src/server/livestock-work.ts): the real module, one for each load.
    const livestock = (() => { const box = { exports: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/livestock-work.js"), "utf8"), box); return box.exports.livestockWork; })();
    const context = {
        exports: {},
        require: (id) => ({
            "./animals.js": { animalPopulation: { near: (kind, from, world, radius) => { state.asked = { kind, from: { ...from }, world, radius }; return state.nearby; }, hold: (id, ms) => { state.held.push([id, ms]); return true; }, release: (id) => state.released.push(id) } },
            "./craft.js": { isWorking: () => state.working },
            "./farm.js": { isFarming: () => state.farming },
            "./gather.js": { isGathering: () => state.gathering },
            "./guild-crafts.js": { mayCraft: (player, craft) => (craft === "horta" ? farmer : craft === "abate" ? hunter : false) },
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
                if (owner.actorClass !== undefined) {
                    state.carcassAdds.push(request);
                    return state.carcassFails ? { ok: false, code: "inventoryUnavailable" } : { ok: true, code: "" };
                }
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
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cows.js"), "utf8"), context);
    const cow = (id = 77, at = { x: 101, y: 100, z: 50 }, extra = {}) => {
        const npc = { id, actorClass: "CattleCow", alive: true, position: { ...at }, ...extra };
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
    return { api: context.exports, state, cow, player, npcs, timer, livestock };
}

const plain = (value) => JSON.parse(JSON.stringify(value));
const T0 = 1_760_000_000_000;

test("a milking gives one to three, one more from level 15", () => {
    const sut = load();
    assert.deepEqual([0, 0.34, 0.67, 0.999].map((roll) => sut.api.amountOf(0, roll)), [1, 2, 3, 3]);
    assert.equal(sut.api.amountOf(15, 0), 2);
    assert.equal(sut.api.amountOf(20, 0.999), 4);
});

test("a farmer at a cow is held in the picking animation for six seconds, then the milk comes with a little XP, and the same cow waits half an hour", () => {
    const sut = load();
    sut.cow();
    const greta = sut.player();
    assert.equal(sut.api.startMilking(greta, 77, T0), "");
    assert.deepEqual(sut.state.played, [["PickingHerbs", { loop: true, lockMovement: true }]]);
    assert.deepEqual(plain(sut.state.held), [[77, 21_000]], "the cow stands still for the work, and a little longer at most");
    assert.deepEqual(sut.state.released, []);
    assert.deepEqual(sut.state.lowered, [greta.id], "the torch is lowered first");
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "cow.state", payload: { on: true } });
    assert.equal(sut.api.isMilking(greta), true);
    assert.equal(sut.timer(6_000) !== undefined, true);
    assert.equal(sut.livestock.of(greta.id), "ordenha", "the work is written down for the shearing to see");

    sut.timer(6_000).fn();
    assert.equal(sut.state.added.at(-1)[0], "milk");
    assert.ok(sut.state.added.at(-1)[1] >= 1 && sut.state.added.at(-1)[1] <= 3);
    assert.deepEqual(sut.state.xp, [["survival", 4]]);
    assert.equal(sut.state.stopped, 1);
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "cow.state", payload: { on: false } });
    assert.match(sut.state.chat.at(-1), /^Ordenha: \dx Leite \(\+4 XP\)\.$/);
    assert.equal(sut.api.isMilking(greta), false);
    assert.deepEqual(plain(sut.state.released), [77], "and walks again when the work is done");
    assert.equal(sut.livestock.of(greta.id), "", "and nothing is left at the animal for the next work to find");

    // The same cow, at once: it has given.
    assert.match(sut.api.startMilking(greta, 77, Date.now()), /Esta vaca foi ordenhada há pouco: volte em (29|30) min\./);
    assert.equal(sut.state.played.length, 1, "no second animation");
    assert.equal(sut.api.waitMinutes(77, Date.now() + 31 * 60_000), 0, "and half an hour on it gives again");
});

test("the milk of a milking is rolled and the level counts: a farmer of level 15 has the bonus one", () => {
    const sut = load();
    sut.cow();
    sut.state.level = 15;
    const greta = sut.player();
    sut.api.startMilking(greta, 77, T0);
    sut.timer(6_000).fn();
    assert.ok(sut.state.added.at(-1)[1] >= 2 && sut.state.added.at(-1)[1] <= 4);
});

test("only a farmer, on foot and alive, at a living cow within reach, not working at anything else, may milk", () => {
    const stranger = load({ farmer: false });
    stranger.cow();
    const nobody = stranger.player("Nobody");
    assert.match(stranger.api.startMilking(nobody, 77, T0), /ofício dos agricultores/);
    assert.deepEqual(stranger.state.played, []);

    const sut = load();
    sut.cow();
    const greta = sut.player();
    assert.match(sut.api.startMilking(greta, 12345, T0), /não está mais aí/, "no such body");
    assert.equal(sut.api.startMilking(greta, "x", T0), "Escolha uma vaca.");
    sut.cow(80, { x: 101, y: 100, z: 50 }, { actorClass: "CattleBull" });
    assert.match(sut.api.startMilking(greta, 80, T0), /não está mais aí/, "a bull gives none");
    sut.cow(81, { x: 101, y: 100, z: 50 }, { alive: false });
    assert.match(sut.api.startMilking(greta, 81, T0), /não está mais aí/, "nor a dead one");
    sut.cow(82, { x: 110, y: 100, z: 50 });
    assert.match(sut.api.startMilking(greta, 82, T0), /Chegue mais perto/, "four metres is past the reach the server allows");
    sut.cow(83, { x: 101, y: 100, z: 60 });
    assert.match(sut.api.startMilking(greta, 83, T0), /Chegue mais perto/, "another floor");
    greta.mounted = true;
    assert.equal(sut.api.startMilking(greta, 77, T0), "Agora não dá.");
    greta.mounted = false;
    greta.alive = false;
    assert.equal(sut.api.startMilking(greta, 77, T0), "Agora não dá.");
    greta.alive = true;
    for (const busy of ["working", "farming", "gathering"]) {
        sut.state[busy] = true;
        assert.equal(sut.api.startMilking(greta, 77, T0), "ocupado", busy);
        sut.state[busy] = false;
    }
    sut.livestock.begin(greta.id, "tosquia");
    assert.equal(sut.api.startMilking(greta, 77, T0), "ocupado", "shearing a sheep");
    sut.livestock.end(greta.id);
    assert.deepEqual(sut.state.played, []);
    assert.equal(sut.state.added.length, 0);
});

test("walking off, the cow gone, or a full bag at the end of the work: nothing is milked, nothing is spent, and the animation is let go", () => {
    const sut = load();
    sut.cow();
    const greta = sut.player();
    sut.api.startMilking(greta, 77, T0);
    greta.position = { x: 100, y: 103, z: 50 };
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /Você saiu do lugar: nada foi ordenhado/);
    assert.deepEqual(plain(sut.state.released), [77], "the cow is let go whichever way the work ends");
    assert.equal(sut.state.added.length, 0);
    assert.equal(sut.state.stopped, 1);

    greta.position = { x: 100, y: 100, z: 50 };
    sut.api.startMilking(greta, 77, T0);
    sut.npcs.get(77).alive = false;
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /Nada foi ordenhado\. Essa vaca não está mais aí/);

    sut.npcs.get(77).alive = true;
    sut.state.full = true;
    sut.api.startMilking(greta, 77, T0);
    sut.timer(6_000).fn();
    assert.match(sut.state.chat.at(-1), /não coube na sua bolsa/);
    assert.equal(sut.api.waitMinutes(77, T0), 0, "and the cow has not given: it may be milked again");
    assert.deepEqual(sut.state.xp, []);
    assert.equal(sut.api.isMilking(greta), false);
});

test("the client's stop (a step) ends the work at once: the timer is cancelled, the animation let go, nothing given", () => {
    const sut = load();
    sut.cow();
    const greta = sut.player();
    sut.api.startMilking(greta, 77, T0);
    const timer = sut.timer(6_000);
    assert.equal(sut.api.stopMilking(greta, "Ordenha interrompida."), true);
    assert.equal(timer.cleared, true);
    assert.equal(sut.state.stopped, 1);
    assert.deepEqual(plain(sut.state.released), [77], "a step that gives the work up lets the cow walk again");
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "cow.state", payload: { on: false } });
    assert.equal(sut.state.chat.at(-1), "Ordenha interrompida.");
    assert.equal(sut.api.stopMilking(greta), false, "nothing to stop twice");
    assert.equal(sut.state.added.length, 0);
});

test("the client is told of the nearest cow within reach to a farmer, again only when it changed, and that there is none when it goes; whoever is not a farmer is told nothing", () => {
    const sut = load();
    const greta = sut.player();
    sut.state.nearby = [{ id: 77, x: 101.13, y: 100.4, z: 50, distance: 1.3 }];
    sut.api.tellNear(T0);
    assert.deepEqual(sut.state.asked, { kind: "CattleCow", from: { x: 100, y: 100, z: 50 }, world: 4294967295, radius: 2.8 });
    assert.deepEqual(plain(sut.state.emitted.at(-1)), { to: "Greta", event: "cow.near", payload: { id: 77, x: 101.25, y: 100.5, z: 50, r: 1 } });
    sut.api.tellNear(T0);
    assert.equal(sut.state.emitted.length, 1, "the same word is not said twice");
    sut.state.nearby = [{ id: 77, x: 103, y: 100.4, z: 50, distance: 3 }];
    sut.api.tellNear(T0);
    assert.equal(sut.state.emitted.at(-1).payload.x, 103, "a cow that walked on is told again");
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

test("a cow that gave a moment ago is told as not ready, and so is nothing told to a farmer who is mounted or busy milking", () => {
    const sut = load();
    sut.cow();
    const greta = sut.player();
    sut.api.startMilking(greta, 77, T0);
    sut.timer(6_000).fn();
    sut.state.emitted.length = 0;
    sut.state.nearby = [{ id: 77, x: 101, y: 100, z: 50, distance: 1 }];
    sut.api.tellNear(Date.now());
    assert.equal(sut.state.emitted.at(-1).payload.r, 0, "not ready: the client puts up no hint");
    greta.mounted = true;
    sut.api.tellNear(Date.now());
    assert.deepEqual(plain(sut.state.emitted.at(-1).payload), { id: 0 }, "on a horse there is no cow");
});

test("a hunter's cow carcass holds milk beside its meat and hide; a bull's, a non-hunter's and a failing stock's hold none", () => {
    const sut = load();
    const hunter = sut.player("Jan");
    const cow = sut.cow();
    assert.equal(sut.api.carcassMilk(cow, hunter, () => 0), 1);
    assert.deepEqual(plain(sut.state.carcassAdds), [{ item: "milk", amount: 1, notify: false }]);
    assert.equal(sut.api.carcassMilk(cow, hunter, () => 0.99), 3);
    assert.ok(sut.state.logs.some((line) => /abate: Jan abateu uma vaca: 3x leite na carcaça/.test(line)));
    const bull = sut.cow(90, { x: 0, y: 0, z: 0 }, { actorClass: "CattleBull" });
    assert.equal(sut.api.carcassMilk(bull, hunter), 0);
    const deer = sut.cow(91, { x: 0, y: 0, z: 0 }, { actorClass: "RoeDeerHind" });
    assert.equal(sut.api.carcassMilk(deer, hunter), 0);
    assert.equal(sut.state.carcassAdds.length, 2);

    const stranger = load({ hunter: false });
    const nobody = stranger.player("Nobody");
    assert.equal(stranger.api.carcassMilk(stranger.cow(), nobody), 0);
    assert.deepEqual(stranger.state.carcassAdds, []);

    const failing = load();
    failing.state.carcassFails = true;
    assert.equal(failing.api.carcassMilk(failing.cow(), failing.player("Jan")), 0);
    assert.ok(failing.state.logs.some((line) => /o leite não entrou na carcaça \(inventoryUnavailable\)/.test(line)));
});

test("installed: the press asks, the step stops, the butchering adds the milk, a disconnect lets go, and the tell goes by a timer", () => {
    const sut = load();
    sut.api.installCows();
    sut.cow();
    const greta = sut.player();
    sut.state.client.get("kcdc-gamemode:cow.milk")(greta, JSON.stringify({ id: 77 }));
    assert.equal(sut.api.isMilking(greta), true);
    sut.state.client.get("kcdc-gamemode:cow.stop")(greta);
    assert.equal(sut.api.isMilking(greta), false);
    sut.state.client.get("kcdc-gamemode:cow.milk")(greta, { id: 77 });
    assert.equal(sut.api.isMilking(greta), true, "an object is read as well as a string");
    sut.state.handlers.get("playerDisconnect")(greta);
    assert.equal(sut.api.isMilking(greta), false);

    const hunter = sut.player("Jan");
    sut.state.handlers.get("npcHarvested")(sut.npcs.get(77), hunter);
    assert.equal(sut.state.carcassAdds.length, 1);
    assert.equal(sut.state.intervals[0].ms, 400);
    sut.state.client.get("kcdc-gamemode:cow.milk")(hunter, "nonsense");
    assert.equal(sut.api.isMilking(hunter), false);
});

test("the milking pays the trades' standard: four times the table's XP, said as it was paid (2026-10-27; the standard of 2026-11-03 keeps it)", () => {
    profession.useStandard();
    try {
        const sut = load();
        sut.cow();
        const greta = sut.player();
        assert.equal(sut.api.startMilking(greta, 77, T0), "");
        sut.timer(6_000).fn();
        assert.deepEqual(sut.state.xp, [["survival", 16]]);
        assert.match(sut.state.chat.at(-1), /^Ordenha: \dx Leite \(\+16 XP\)\.$/);
    } finally {
        profession.useTables();
    }
});
