const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
    const logs = [];
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./place.js") return { distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) };
            if (id === "./npc-spawn.js") return { spawnNpc: () => assert.fail("nothing spawns in these tests") };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Date,
        Math,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/animals.js"), "utf8"), context);
    return { api: context.exports, logs };
}

const point = (count, actorClass = "RoeDeer", guid = `p-${count}-${actorClass}`) => ({ guid, count, actorClass, soul: "soul", position: { x: 0, y: 0, z: 0 } });

test("a spawn point keeps one and three tenths times the herd the level authored, at least one, at most ten", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    assert.equal(max, 10);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 8].map((count) => api.slotsFor(point(count), max)), [0, 1, 3, 4, 5, 7, 10]);
    assert.equal(api.slotsFor(point(0.4), max), 0, "a point the level left empty stays empty");
});

test("wolves and wild dogs grow too, by a smaller share", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    assert.equal(api.slotsFor(point(2, "Wolf"), max), 2);
    assert.equal(api.slotsFor(point(3, "WildDog"), max), 3);
    assert.equal(api.animalDensity.predators, 1.1);
    assert.equal(api.animalDensity.prey, 1.3);
    assert.equal(api.animalDensity.hare, 0.3);
    assert.equal(api.animalDensity.livestock, 1);
    assert.equal(api.slotsFor(point(4, "SheepEwe"), max), 4, "the farm animals keep the level's numbers");
});

test("a smaller herd scattered around a point is a share of the point's herd, at least one animal", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    const share = api.animalPopulationSettings.satelliteShare;
    assert.equal(share, 0.6);
    assert.deepEqual([1, 2, 3, 4].map((count) => api.slotsFor(point(count), max, share)), [1, 2, 2, 3]);
    assert.equal(api.slotsFor(point(0), max, share), 0);
    assert.equal(api.slotsFor(point(1, "Wolf"), max, 0.1), 1, "never fewer than one where the level put any");
});

test("a population counts its slots by the same rule, and animals come back sooner than before", () => {
    const { api } = load();
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 0, () => 0);
    assert.equal(population.add(point(2), 0), true);
    assert.equal(population.add(point(2), 0), false, "a point is added once per world");
    assert.equal(population.add(point(0, "Hare", "empty"), 0), false);
    assert.equal(api.animalPopulationSettings.respawnMs, 3 * 60_000);
    assert.equal(api.animalPopulationSettings.maxAnimals, 700);
    assert.equal(api.animalPopulationSettings.spawnsPerTick, 4, "country is filled faster than before");
});

test("a pack of wolves or wild dogs that was put down stays down for twenty minutes or so; the game, a boar, is back in three or four (2026-10-24)", () => {
    const { api, made } = populated({ players: [walker(100)] });
    let clock = 1_000_000;
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "WildDog", "d"), 0, 0, 0.3);
    population.add(point(1, "Wolf", "w"), 0, 0, 0.3);
    population.add(point(1, "Boar", "b"), 0, 0, 0.3);
    population.tick();
    assert.equal(made.length, 3);
    for (const npc of made) {
        npc.alive = false;
        // The game's death event, which `installAnimalPopulation` hands to `lost` (the round does not ask a far herd whether its bodies live).
        population.lost(npc.id, true);
    }
    population.tick();
    // The corpses go after a minute and a half; the places wait for their time.
    clock += 100_000;
    population.tick();
    population.tick();
    assert.equal(made.length, 3, "nothing is made again at once");
    clock += 4 * 60_000;
    for (let i = 0; i < 4; i += 1) population.tick();
    assert.deepEqual(made.slice(3).map((npc) => npc.options.class), ["Boar"], "the boar's place refilled after about four minutes; the dog's and the wolf's did not");
    clock += 6 * 60_000;
    for (let i = 0; i < 4; i += 1) population.tick();
    assert.equal(made.length, 4, "ten minutes after, the pack is still down");
    clock += 20 * 60_000;
    for (let i = 0; i < 6; i += 1) population.tick();
    assert.deepEqual(made.slice(4).map((npc) => npc.options.class).sort(), ["Wolf", "WildDog"].sort(), "half an hour after, both are back");
});

test("the farm animals are the pastures', and a satellite is the same animal under a name of its own", () => {
    const { api } = load();
    assert.deepEqual(Array.from(api.LIVESTOCK).sort(), ["CattleBull", "CattleCow", "Pig", "SheepEwe", "SheepRam"]);
    const wild = point(3, "Boar", "abc");
    const satellite = api.satelliteOf(wild, 2);
    assert.equal(satellite.guid, "abc~2");
    assert.equal(satellite.actorClass, "Boar");
    assert.equal(satellite.count, 3);
    assert.equal(wild.guid, "abc", "the level's own point is left as it was");
});

/** A world with players, a mesh that answers, and bodies that stay where they are put. */
function populated({ players = [], others = [], section = undefined } = {}) {
    const bodies = new Map();
    const made = [];
    const calls = { closest: [], random: [] };
    let next = 1;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./place.js") return { distanceBetween: (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) };
            if (id === "./npc-spawn.js") {
                return {
                    spawnNpc: (options) => {
                        const npc = { id: next++, actorClass: options.class, alive: true, status: "idle", position: options.position, options, moves: [], fled: [], invulnerable: false, frozen: false, remove() { bodies.delete(this.id); }, moveTo(target, how) { this.moves.push(how?.speed); }, flee(from, how) { this.fled.push({ from, how }); return true; }, hold() {}, attack() { return true; } };
                        bodies.set(npc.id, npc);
                        made.push(npc);
                        return npc;
                    },
                };
            }
            assert.fail("unexpected require " + id);
        },
        console: { log() {} },
        Date,
        Math,
        ...(section === undefined ? {} : { __kcdcSection: section }),
        Player: { all: () => players },
        Npc: { getById: (id) => bodies.get(id) ?? null, all: () => [...bodies.values(), ...others] },
        Navigation: {
            ready: true,
            closestPoint(at) { calls.closest.push(at); return { x: at.x + 1, y: at.y + 1, z: at.z }; },
            randomPoint(centre, radius) { const n = calls.random.length; calls.random.push({ centre, radius }); return { x: centre.x + radius / 2 + n * 3, y: centre.y, z: centre.z }; },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/animals.js"), "utf8"), context);
    return { api: context.exports, made, calls, bodies };
}

const walker = (x, y = 0) => ({ ready: true, virtualWorld: 0, position: { x, y, z: 0 }, canAct: true, id: 1 });

test("a scattered herd settles once on walkable ground of its own, away from the level's point", () => {
    const { api, made, calls } = populated({ players: [walker(140)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    assert.equal(population.add(api.satelliteOf(point(2, "Boar", "b"), 1), 0, 120, 0.6), true);
    population.tick();
    population.tick();
    assert.equal(calls.closest.length, 1, "the anchor is looked for once");
    assert.equal(calls.random[0].radius, 120, "the herd's home is scattered about the anchor");
    assert.deepEqual({ ...calls.random[0].centre }, { x: 1, y: 1, z: 0 });
    assert.equal(calls.random[1].radius, api.animalPopulationSettings.spawnRadius, "its animals then appear about that home");
    assert.deepEqual({ ...calls.random[1].centre }, { x: 61, y: 1, z: 0 });
    assert.ok(made.length >= 1 && made.length <= api.animalPopulationSettings.spawnsPerTick * 2);
});

test("the level's own herd settles at its anchor, with no scattering", () => {
    const { api, calls } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(2, "Boar", "b"), 0);
    population.tick();
    assert.ok(calls.random.every((call) => call.radius === api.animalPopulationSettings.spawnRadius), "only spawn positions are drawn at random");
    assert.deepEqual({ ...calls.random[0].centre }, { x: 1, y: 1, z: 0 });
});

test("no more animals than the cap at once, and none in sight of a player", () => {
    const { api, made } = populated({ players: [walker(0, 100)] });
    const settings = { ...api.animalPopulationSettings, maxAnimals: 3, spawnsPerTick: 10, queriesPerTick: 40 };
    const population = new api.AnimalPopulation(settings, () => 1_000_000, () => 0);
    population.add(point(4, "RoeDeer", "a"), 0);
    population.add(point(4, "RoeDeer", "b"), 0);
    for (let i = 0; i < 6; i += 1) population.tick();
    assert.equal(made.length, 3);
    const near = populated({ players: [walker(0, 20)] });
    const close = new near.api.AnimalPopulation(near.api.animalPopulationSettings, () => 1_000_000, () => 0);
    close.add(point(3, "RoeDeer", "c"), 0);
    close.tick();
    assert.equal(near.made.length, 0, "a point with a player within sixty metres stays empty");
});

test("the population says how many animals stand and how many sites keep them, and the cap can be lowered while it runs", () => {
    const { api, made } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "Hare", "h"), 0);
    population.add(point(3, "Boar", "b"), 0);
    assert.deepEqual({ ...population.standing() }, { bodies: 0, sites: 2 });
    population.tick();
    const { bodies, sites } = population.standing();
    assert.equal(sites, 2);
    assert.equal(bodies, made.length);
    assert.ok(bodies >= 1);
    api.animalPopulationSettings.maxAnimals = bodies;
    population.tick();
    population.tick();
    assert.equal(population.standing().bodies, bodies, "with the cap lowered to what stands, nothing more appears");
});

test("a hare runs from one spot to the next, sooner than the others; a deer walks (a player within 76 m of the herd's home, or it stands still: 2026-10-25)", () => {
    const { api, made } = populated({ players: [walker(70)] });
    let clock = 1_000_000;
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => clock, () => 0.5);
    // One body each (a share of the herd), to compare one hare with one deer.
    population.add(point(1, "Hare", "h"), 0, 0, 0.3);
    population.add(point(1, "RoeDeerHind", "d"), 0, 0, 0.3);
    population.tick();
    assert.equal(made.length, 2);
    for (let i = 0; i < 20; i += 1) {
        clock += 1_000;
        population.tick();
    }
    const hare = made.find((npc) => npc.options.class === "Hare");
    const deer = made.find((npc) => npc.options.class === "RoeDeerHind");
    assert.ok(hare.moves.length > deer.moves.length, `the hare moves more often (${hare.moves.length} against ${deer.moves.length})`);
    assert.ok(hare.moves.every((speed) => speed === "run"));
    assert.ok(deer.moves.length > 0 && deer.moves.every((speed) => speed === "walk"));
});

test("installing keeps the level's wild points a second, smaller herd each, and the pastures none", () => {
    const logs = [];
    const points = [
        { guid: "hare", count: 2, actorClass: "Hare", soul: "s", position: { x: 0, y: 0, z: 0 } },
        { guid: "wolf", count: 3, actorClass: "Wolf", soul: "s", position: { x: 500, y: 0, z: 0 } },
        { guid: "cow", count: 4, actorClass: "CattleCow", soul: "s", position: { x: 900, y: 0, z: 0 } },
    ];
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./place.js") return { distanceBetween: () => 0 };
            if (id === "./npc-spawn.js") return { spawnNpc: () => assert.fail("nothing spawns here") };
            assert.fail("unexpected require " + id);
        },
        console: { log: (line) => logs.push(line) },
        Date,
        Math,
        Npc: { animalSpawnpoints: () => points },
        Events: { on() {} },
        setInterval: () => 1,
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/animals.js"), "utf8"), context);
    context.exports.installAnimalPopulation();
    const line = logs.find((entry) => entry.startsWith("animals:"));
    assert.ok(line, "the census is said in the log");
    assert.match(line, /3 pontos de nascimento/);
    assert.match(line, /Hare 1\b/, "a third of the level's herd, and no scattered one for the hares");
    assert.match(line, /Wolf 5\b/, "3 for the level's herd and 2 for the scattered one");
    assert.match(line, /CattleCow 4\b/, "a pasture keeps the level's own herd and no scattered one");
    assert.match(line, /no máximo 700 animais/);
});

// ---------------------------------------------------------------------------------------------
// How much each takes, and which of them run.

test("every animal is given the same big ledger, and each kind keeps a health of its own apart from it; a kind with none listed gets the default", () => {
    const { api, made } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "Hare", "h"), 0);
    population.add(point(3, "Wolf", "w"), 0);
    population.add(point(3, "CattleCow", "c"), 0);
    population.add(point(3, "Dragon", "d"), 0);
    for (let n = 0; n < 6; n += 1) population.tick();
    const byKind = new Map(made.map((npc) => [npc.options.class, npc.options]));
    for (const kind of ["Hare", "Wolf", "CattleCow", "Dragon"]) {
        assert.equal(byKind.get(kind).health, 1000, kind);
        assert.equal(byKind.get(kind).maxHealth, 1000, kind);
    }
    assert.equal(api.healthOf("Hare"), 8);
    assert.equal(api.healthOf("Wolf"), 55);
    assert.equal(api.healthOf("CattleCow"), 90);
    assert.equal(api.healthOf("Dragon"), api.DEFAULT_ANIMAL_HEALTH, "the default for a kind the table lacks");
    assert.ok(api.ANIMAL_HEALTH.Hare < api.ANIMAL_HEALTH.RoeDeer && api.ANIMAL_HEALTH.RoeDeer < api.ANIMAL_HEALTH.RedDeer && api.ANIMAL_HEALTH.RedDeer < api.ANIMAL_HEALTH.Boar, "a hare is not a boar");
});

test("an animal left invulnerable or frozen is made mortal and free again, looked at every ten seconds (while a player is within reach of its herd)", () => {
    const { api, made } = populated({ players: [walker(70)] });
    let clock = 1_000_000;
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(2, "Boar", "b"), 0);
    population.tick();
    assert.ok(made.length >= 1);
    const [body] = made;
    body.invulnerable = true;
    body.frozen = true;
    clock += 1_000;
    population.tick();
    clock += 11_000;
    population.tick();
    assert.equal(body.invulnerable, false);
    assert.equal(body.frozen, false);
});

test("a hare, a roe deer, a red deer and a boar run from a player who comes within their distance, once in six seconds; a sheep does not", () => {
    const hunter = walker(100);
    const sut = populated({ players: [hunter] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "Hare", "h"), 0);
    population.add(point(1, "RoeDeer", "r"), 0);
    population.add(point(1, "Boar", "b"), 0);
    population.add(point(1, "SheepEwe", "s"), 0);
    for (let n = 0; n < 6; n += 1) population.tick();
    const [hare, deer, boar, sheep] = ["Hare", "RoeDeer", "Boar", "SheepEwe"].map((kind) => sut.made.find((npc) => npc.options.class === kind));
    assert.ok(hare && deer && boar && sheep);
    // The hunter walks up to them.
    hunter.position = { x: 5, y: 0, z: 0 };
    for (const npc of [hare, deer, boar, sheep]) npc.position = { x: 0, y: 0, z: 0 };
    clock += 20_000;
    population.tick();
    assert.equal(hare.fled.length, 1);
    assert.equal(deer.fled.length, 1);
    assert.equal(boar.fled.length, 1);
    assert.equal(sheep.fled.length, 0, "a farm animal stands where it is");
    assert.equal(hare.fled[0].how.speed, "run");
    assert.equal(hare.fled[0].from, hunter, "away from the player himself (1.7.0), the game's own escape");

    clock += 1_000;
    population.tick();
    assert.equal(hare.fled.length, 1, "not told again within six seconds");
    clock += 3_000;
    population.tick();
    assert.equal(hare.fled.length, 1);
    clock += 3_000;
    population.tick();
    assert.equal(hare.fled.length, 2);

    // Far enough, and the deer goes back to its day.
    hunter.position = { x: 100, y: 0, z: 0 };
    clock += 20_000;
    population.tick();
    assert.equal(deer.fled.length, 2, "no new order once the player is far");
});

test("a deer lets a player nearer than a hare does not: the distances are the kind's own", () => {
    const { api } = populated();
    assert.ok(api.FLEE_FROM_M.Boar < api.FLEE_FROM_M.Hare && api.FLEE_FROM_M.Hare < api.FLEE_FROM_M.RoeDeer && api.FLEE_FROM_M.RoeDeer <= api.FLEE_FROM_M.RedDeer);
    assert.equal(api.FLEE_FROM_M.Wolf, undefined);
});

test("the deer come as RoeDeerHind, RoeDeerBuck, RedDeerDoe and RedDeerStag, and are the deer of the tables: they flee and have a health of their own", () => {
    const hunter = walker(100);
    const sut = populated({ players: [hunter] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    for (const kind of ["RoeDeerHind", "RoeDeerBuck", "RedDeerDoe", "RedDeerStag"]) population.add(point(1, kind, kind), 0);
    for (let n = 0; n < 6; n += 1) population.tick();
    assert.equal(sut.made.length >= 4, true);
    const health = Object.fromEntries(sut.made.map((npc) => [npc.options.class, sut.api.healthOf(npc.options.class)]));
    assert.deepEqual(health, { RoeDeerHind: 28, RoeDeerBuck: 28, RedDeerDoe: 40, RedDeerStag: 40 });
    for (const npc of sut.made) npc.position = { x: 0, y: 0, z: 0 };
    hunter.position = { x: 15, y: 0, z: 0 };
    clock += 20_000;
    population.tick();
    assert.ok(sut.made.every((npc) => npc.fled.length === 1), "all four run from a hunter at 15 m");
    assert.equal(sut.api.kindOf("RoeDeerBuck"), "RoeDeer");
    assert.equal(sut.api.kindOf("Wolf"), "Wolf");
});

test("animals are made only where a player's game can run them: none past 150 m, and none for a player who already has forty about", () => {
    const far = populated({ players: [walker(240)] });
    const population = new far.api.AnimalPopulation(far.api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "Hare", "h"), 0);
    population.tick();
    population.tick();
    assert.equal(far.made.length, 0, "240 m is past what a game would run");
    assert.equal(far.api.animalPopulationSettings.activationDistance, 150);

    const crowded = populated({ players: [walker(100)] });
    const settings = { ...crowded.api.animalPopulationSettings, perPlayerBudget: 2, spawnsPerTick: 10 };
    const herd = new crowded.api.AnimalPopulation(settings, () => 1_000_000, () => 0);
    herd.add(point(10, "Hare", "h2"), 0);
    for (let n = 0; n < 6; n += 1) herd.tick();
    assert.equal(crowded.made.length, 2, "two, then the player's game has all it is given");
});

test("the bodies that are not the animals' (a camp's bandits, a town's people) take room in the same game, so fewer animals are made", () => {
    const bandits = Array.from({ length: 20 }, (_, n) => ({ id: 1000 + n, alive: true, position: { x: 90, y: n, z: 0 } }));
    const camp = populated({ players: [walker(100)], others: bandits });
    const settings = { ...camp.api.animalPopulationSettings, perPlayerBudget: 22, spawnsPerTick: 10 };
    const herd = new camp.api.AnimalPopulation(settings, () => 1_000_000, () => 0);
    herd.add(point(10, "RoeDeer", "r"), 0);
    for (let n = 0; n < 6; n += 1) herd.tick();
    assert.equal(camp.made.length, 2, "twenty are already running there: room for two more");

    const dead = bandits.map((body) => ({ ...body, alive: false }));
    const quiet = populated({ players: [walker(100)], others: dead });
    const again = new quiet.api.AnimalPopulation({ ...quiet.api.animalPopulationSettings, perPlayerBudget: 22, spawnsPerTick: 10 }, () => 1_000_000, () => 0);
    again.add(point(10, "RoeDeer", "r"), 0);
    for (let n = 0; n < 6; n += 1) again.tick();
    assert.ok(quiet.made.length > 2, "corpses run nothing");
});

/** Counts what is asked of the engine about the bodies: lookups by id, and reads of a body's place and life. */
function watchReads(sut) {
    const reads = { lookups: 0, position: 0, alive: 0 };
    const get = sut.bodies.get.bind(sut.bodies);
    sut.bodies.get = (id) => { reads.lookups += 1; return get(id); };
    const spy = (npc) => {
        if (npc.spied) return;
        npc.spied = true;
        const at = npc.position;
        Object.defineProperty(npc, "position", { get() { reads.position += 1; return at; }, set(value) { Object.defineProperty(npc, "position", { value, writable: true, configurable: true }); }, configurable: true });
        let alive = npc.alive;
        Object.defineProperty(npc, "alive", { get() { reads.alive += 1; return alive; }, set(value) { alive = value; }, configurable: true });
    };
    return { reads, spy, reset: () => { reads.lookups = 0; reads.position = 0; reads.alive = 0; } };
}

test("a herd far from every player is not asked about, and does not walk, second after second; it does as soon as a player comes within reach of it (2026-10-25)", () => {
    // 140 m from the herd's home: inside the 150 m where animals are made, outside the 76 m where a player can matter to one of them.
    const hunter = walker(140);
    const sut = populated({ players: [hunter] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0.5);
    population.add(point(2, "Boar", "b"), 0);
    population.tick();
    assert.ok(sut.made.length >= 1);
    const watch = watchReads(sut);
    sut.made.forEach(watch.spy);
    watch.reset();
    // Long enough for every first walk to be due (about six seconds after the spawn) and long overdue.
    for (let n = 0; n < 30; n += 1) {
        clock += 1_000;
        population.tick();
    }
    assert.deepEqual({ ...watch.reads }, { lookups: 0, position: 0, alive: 0 }, "thirty quiet seconds, with every walk overdue: not one question to the engine about a body");
    assert.equal(sut.made.reduce((sum, npc) => sum + npc.moves.length, 0), 0, "and nobody is sent on a walk that nobody would see");

    // A player comes within reach of the herd: it is asked about, and the walks that were due long ago are spread over the next ten seconds.
    hunter.position = { x: 70, y: 0, z: 0 };
    clock += 1_000;
    population.tick();
    assert.ok(watch.reads.position >= 1, "asked about once a player is near");
    assert.equal(sut.made.reduce((sum, npc) => sum + npc.moves.length, 0), 0, "but not all sent at once: a walk that fell due long ago is put off a little");
    for (let n = 0; n < 11; n += 1) {
        clock += 1_000;
        population.tick();
    }
    assert.ok(sut.made.reduce((sum, npc) => sum + npc.moves.length, 0) > 0, "and within ten seconds they are on their way");
});

test("a herd with a player within 76 m of its home is asked about every second: an aggro or a flight depends on where the body is", () => {
    const sut = populated({ players: [walker(70)] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "Boar", "b"), 0, 0, 1);
    population.tick();
    assert.equal(sut.made.length, 1);
    const watch = watchReads(sut);
    sut.made.forEach(watch.spy);
    clock += 1_000;
    population.tick();
    watch.reset();
    for (let n = 0; n < 3; n += 1) {
        clock += 1_000;
        population.tick();
    }
    assert.ok(watch.reads.position >= 3, `read every second (${watch.reads.position} reads in three)`);
});

test("when perf-watch is watching, the round hands in how long its parts took: the preparation, the sites, the mesh, the births and the walks (2026-10-25)", () => {
    const parts = new Map();
    const sut = populated({ players: [walker(70)], section: (label, took) => parts.set(label, (parts.get(label) ?? 0) + 1) });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "Boar", "b"), 0, 0, 1);
    population.tick();
    for (let n = 0; n < 6; n += 1) {
        clock += 1_000;
        population.tick();
    }
    for (const label of ["animals.preparo", "animals.sitios", "animals.malha", "animals.nascer", "animals.passeio"]) {
        assert.ok((parts.get(label) ?? 0) >= 1, `${label} was handed in (${[...parts.keys()].join(", ")})`);
    }
    assert.equal(parts.get("animals.sitios"), 7, "once for each round");

    // Without the hook nothing is timed and nothing breaks.
    const bare = populated({ players: [walker(70)] });
    const quiet = new bare.api.AnimalPopulation(bare.api.animalPopulationSettings, () => clock, () => 0);
    quiet.add(point(1, "Boar", "b"), 0, 0, 1);
    assert.doesNotThrow(() => { quiet.tick(); quiet.tick(); });
});

test("a corpse is left alone until its time is up, and then taken away once nobody sees it", () => {
    const sut = populated({ players: [walker(100)] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "Boar", "b"), 0, 0, 1);
    population.tick();
    clock += 1_000;
    population.tick();
    const [boar] = sut.made;
    boar.alive = false;
    population.lost(boar.id, true);
    const watch = watchReads(sut);
    watch.spy(boar);
    watch.reset();
    clock += 30_000;
    population.tick();
    assert.deepEqual({ ...watch.reads }, { lookups: 0, position: 0, alive: 0 }, "a corpse before its time is not asked about");
    clock += 61_000;
    population.tick();
    assert.equal(sut.bodies.has(boar.id), false, "taken away when its time was up");
});

test("a blow comes off the animal's own health and the ledger is put back to full; the last one holds it and kills it a moment later, from its feet", () => {
    const sut = populated({ players: [walker(100)] });
    const later = [];
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => 1_000_000, () => 0, (run, ms) => later.push({ run, ms }));
    population.add(point(3, "RoeDeer", "r"), 0);
    population.tick();
    const [deer] = sut.made;
    assert.ok(deer);
    const killed = [];
    const held = [];
    deer.kill = (by) => killed.push(by);
    deer.hold = () => held.push(deer.id);
    deer.maxHealth = 1000;
    const hunter = { id: 7, steamId: "7656", nickname: "Hans" };

    // A roe deer has 28 of its own: 15, then 10, leaves 3.
    deer.health = 985;
    population.wounded(deer, hunter, 15);
    assert.equal(deer.health, 1000, "the ledger is full again: the game never sees it low");
    deer.health = 990;
    population.wounded(deer, hunter, 10);
    assert.equal(deer.health, 1000);
    assert.deepEqual(killed, []);
    assert.deepEqual(later, [], "still on its feet with 3 left");

    deer.health = 988;
    population.wounded(deer, hunter, 12);
    assert.deepEqual(held, [deer.id], "held where it stands");
    assert.deepEqual(killed, [], "not dead yet: a moment first");
    assert.equal(later.length, 1);
    assert.equal(later[0].ms, sut.api.animalPopulationSettings.finishDelayMs);
    later[0].run();
    assert.deepEqual(killed, [hunter], "and then it dies, with the hunter's name on it");

    // A body that died meanwhile, or that is not ours, is left alone.
    const stranger = { id: 99, alive: true, health: 1, maxHealth: 100, actorClass: "Boar", kill: () => assert.fail("not ours"), hold: () => assert.fail("not ours") };
    population.wounded(stranger, hunter, 500);
    assert.equal(stranger.health, 1, "nor healed");
    population.wounded({ ...deer, alive: false, kill: () => assert.fail("already dead") }, null, 500);
});

test("a hare dies of a blow that would not have killed a boar; the blows of an unknown attacker count too", () => {
    const sut = populated({ players: [walker(100)] });
    const later = [];
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => 1_000_000, () => 0, (run, ms) => later.push({ run, ms }));
    population.add(point(1, "Hare", "h"), 0);
    population.add(point(1, "Boar", "b"), 0);
    for (let n = 0; n < 4; n += 1) population.tick();
    const hare = sut.made.find((npc) => npc.options.class === "Hare");
    const boar = sut.made.find((npc) => npc.options.class === "Boar");
    for (const npc of [hare, boar]) {
        npc.kills = [];
        npc.kill = (by) => npc.kills.push(by ?? "nobody");
        npc.maxHealth = 1000;
        npc.actorClass = npc.options.class;
    }
    population.wounded(hare, null, 9);
    population.wounded(boar, null, 9);
    assert.equal(later.length, 1, "the hare only");
    later[0].run();
    assert.deepEqual(hare.kills, ["nobody"]);
    assert.deepEqual(boar.kills, []);
    population.forgetWounds(boar.id);
    population.wounded(boar, null, 54);
    assert.equal(later.length, 2, "forgotten wounds start again from the kind's health: no new death for the boar (the hare's was looked at again: the second is that check)");
});

test("a list of kinds is asked at once: the ewes and the rams of a flock, nearest first, and no cow or pig among them (the shearing, 2026-10-31)", () => {
    const { api, made } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "SheepEwe", "ewes"), 0);
    population.add(point(2, "SheepRam", "rams"), 0);
    population.add(point(2, "CattleCow", "cows"), 0);
    for (let i = 0; i < 4; i += 1) population.tick();
    const sheep = made.filter((npc) => npc.options.class === "SheepEwe" || npc.options.class === "SheepRam");
    assert.ok(sheep.some((npc) => npc.options.class === "SheepEwe") && sheep.some((npc) => npc.options.class === "SheepRam"), "both kinds are made");
    const from = { x: sheep[0].position.x + 1, y: sheep[0].position.y, z: sheep[0].position.z };
    const found = population.near(["SheepEwe", "SheepRam"], from, 0, 60);
    assert.ok(found.length >= 2, "the flock, ewes and rams together");
    assert.ok(found.every((one) => sheep.some((npc) => npc.id === one.id)), "no cow among them");
    assert.ok(found.every((one, index) => index === 0 || one.distance >= found[index - 1].distance), "nearest first");
    assert.equal(found[0].id, sheep[0].id);
    // One kind alone, as a string, is as it always was.
    assert.ok(population.near("SheepRam", from, 0, 60).every((one) => made.find((npc) => npc.id === one.id).options.class === "SheepRam"));
    assert.equal(population.near([], from, 0, 60).length, 0, "no kind, nothing");
});

test("the living animals of a kind near a point, nearest first, and only those that could be that near are asked of the engine (the milking, 2026-10-27)", () => {
    const { api, made, bodies } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(4, "CattleCow", "cows"), 0);
    population.add(point(2, "Pig", "pigs"), 0);
    for (let i = 0; i < 4; i += 1) population.tick();
    const cows = made.filter((npc) => npc.options.class === "CattleCow");
    assert.ok(cows.length >= 2, "the herd is made");
    const [first, second] = cows;
    const from = { x: first.position.x + 1, y: first.position.y, z: first.position.z };

    const found = population.near("CattleCow", from, 0, 3);
    assert.equal(found[0].id, first.id, "the nearest first");
    assert.ok(Math.abs(found[0].distance - 1) < 1e-9);
    assert.ok(found.every((cow, index) => index === 0 || cow.distance >= found[index - 1].distance), "in order");
    assert.ok(found.every((cow) => cows.some((npc) => npc.id === cow.id)), "no pig among the cows");
    assert.deepEqual(population.near("Pig", from, 0, 3).every((pig) => made.find((npc) => npc.id === pig.id).options.class === "Pig"), true);
    assert.equal(population.near("CattleCow", { ...from, z: from.z + 10 }, 0, 3).length, 0, "not on another floor");

    first.alive = false;
    assert.ok(!population.near("CattleCow", from, 0, 3).some((cow) => cow.id === first.id), "a dead one is not milked");
    first.alive = true;

    // A farmer far from the herd asks the engine about nobody: the places last read say none could be near.
    const reads = [];
    const original = bodies.get.bind(bodies);
    bodies.get = (id) => { reads.push(id); return original(id); };
    assert.equal(population.near("CattleCow", { x: from.x + 400, y: from.y, z: from.z }, 0, 3).length, 0);
    assert.equal(reads.length, 0);
    assert.equal(second === undefined, false);
});

test("a held animal stands: the round sends it on no walk until it is let go, or the time given is up (the milking, 2026-10-27)", () => {
    const { api, made } = populated({ players: [walker(70)] });
    let clock = 1_000_000;
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "CattleCow", "cow"), 0);
    population.tick();
    const cow = made[0];
    let holds = 0;
    cow.hold = () => { holds += 1; };
    assert.equal(population.hold(cow.id, 20_000), true);
    assert.equal(holds, 1, "its walk is stopped where it is");
    const walked = cow.moves.length;
    for (let i = 0; i < 12; i += 1) {
        clock += 1_000;
        population.tick();
    }
    assert.equal(cow.moves.length, walked, "twelve seconds held: not one step ordered");
    population.release(cow.id);
    for (let i = 0; i < 12; i += 1) {
        clock += 1_000;
        population.tick();
    }
    assert.ok(cow.moves.length > walked, "let go: it walks again after a moment");

    // A hold nobody lets go of ends by itself.
    const second = populated({ players: [walker(70)] });
    let later = 2_000_000;
    const other = new second.api.AnimalPopulation(second.api.animalPopulationSettings, () => later, () => 0);
    other.add(point(1, "CattleCow", "cow2"), 0);
    other.tick();
    const lost = second.made[0];
    assert.equal(other.hold(lost.id, 5_000), true);
    const steps = lost.moves.length;
    for (let i = 0; i < 20; i += 1) {
        later += 1_000;
        other.tick();
    }
    assert.ok(lost.moves.length > steps, "past its time the cow is free");
    assert.equal(other.hold(9999, 1000), false, "no such body");
    lost.alive = false;
    assert.equal(other.hold(lost.id, 1000), false, "a dead one is not held");
});

test("a round that has used its time stops where it is and the next one goes on from there: every herd is looked at in the end, none skipped (the lag at the combat, 2026-10-31)", () => {
    const { api, made } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation({ ...api.animalPopulationSettings, budgetMs: -1 }, () => 1_000_000, () => 0);
    for (const guid of ["a", "b", "c", "d"]) population.add(point(1, "Hare", guid), 0, 0, 0.3);
    assert.equal(api.animalPopulationSettings.budgetMs, 30, "thirty milliseconds a round");
    population.tick();
    assert.equal(made.length, 1, "out of time after the first site: only its herd was made");
    assert.equal(population.budgeted, 1);
    for (let i = 0; i < 6; i += 1) population.tick();
    assert.equal(made.length, 4, "the rounds that followed went on from where the first stopped, and every herd has its body");
    assert.ok(population.budgeted >= 4);

    // With the time there is, one round does it all and is never cut.
    const fast = populated({ players: [walker(100)] });
    const whole = new fast.api.AnimalPopulation(fast.api.animalPopulationSettings, () => 1_000_000, () => 0);
    for (const guid of ["a", "b", "c", "d"]) whole.add(point(1, "Hare", guid), 0, 0, 0.3);
    whole.tick();
    assert.ok(fast.made.length >= 2, "a whole round makes what the spawns of a round allow");
    assert.equal(whole.budgeted, 0, "and is not cut");
});


// The last blow that does not kill (2026-11-06, "alguns dos animais e caça bugam às vezes ficando imortais"): the death is looked at again, asked for again, and a body that still lives is taken out.

function dying() {
    const sut = populated({ players: [walker(100)] });
    const later = [];
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => 1_000_000, () => 0, (run, ms) => later.push({ run, ms }));
    population.add(point(3, "RoeDeer", "r"), 0);
    population.tick();
    const [deer] = sut.made;
    const killed = [];
    const removed = [];
    deer.kill = (by) => killed.push(by);
    deer.hold = () => undefined;
    deer.remove = () => removed.push(deer.id);
    deer.maxHealth = 1000;
    deer.status = "running";
    deer.simulator = null;
    const hunter = { id: 7, steamId: "7656", nickname: "Hans" };
    return { sut, later, population, deer, killed, removed, hunter };
}

test("an animal that is still alive after the last blow's death is asked for again, and after three tries it is taken out of the world", () => {
    const { sut, later, population, deer, killed, removed, hunter } = dying();
    population.wounded(deer, hunter, 500);
    assert.equal(later.length, 1);
    assert.equal(later[0].ms, sut.api.animalPopulationSettings.finishDelayMs);
    later[0].run();
    assert.deepEqual(killed, [hunter], "the first death asked for");
    assert.equal(later.length, 2);
    assert.equal(later[1].ms, sut.api.animalPopulationSettings.finishCheckMs, "looked at again a moment later");
    later[1].run();
    later[2].run();
    assert.deepEqual(killed, [hunter, hunter, hunter], "asked three times in all, still with the hunter's name");
    assert.deepEqual(removed, [], "not yet");
    later[3].run();
    assert.deepEqual(removed, [deer.id], "a body that cannot die is taken out");
    assert.equal(later.length, 4, "and nothing more is scheduled");
    assert.deepEqual(killed.length, 3);
});

test("an animal that dies is left alone by the check, and the blow its own death raises does not start a second chain", () => {
    const { later, population, deer, killed, removed, hunter } = dying();
    population.wounded(deer, hunter, 500);
    // The kill raises a blow of its own before the body is dead.
    later[0].run();
    population.wounded(deer, hunter, 1000);
    assert.equal(later.length, 2, "no second death scheduled: the first one is being seen to");
    deer.alive = false;
    later[1].run();
    assert.equal(later.length, 2, "dead: the check ends the chain");
    assert.deepEqual(killed, [hunter]);
    assert.deepEqual(removed, []);

    // Forgotten when it goes, so that a new body with the same number starts clean.
    population.forgetWounds(deer.id);
    deer.alive = true;
    population.wounded(deer, hunter, 500);
    assert.equal(later.length, 3, "a new chain starts");
});
