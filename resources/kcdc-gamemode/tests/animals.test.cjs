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

test("a spawn point keeps one and six tenths times the herd the level authored, at least one, at most ten", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    assert.equal(max, 10);
    assert.deepEqual([0, 1, 2, 3, 4, 5, 8].map((count) => api.slotsFor(point(count), max)), [0, 2, 3, 5, 6, 8, 10]);
    assert.equal(api.slotsFor(point(0.4), max), 0, "a point the level left empty stays empty");
});

test("wolves and wild dogs grow too, by a smaller share", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    assert.equal(api.slotsFor(point(2, "Wolf"), max), 3);
    assert.equal(api.slotsFor(point(3, "WildDog"), max), 4);
    assert.equal(api.animalDensity.predators, 1.3);
    assert.equal(api.animalDensity.prey, 1.6);
    assert.equal(api.animalDensity.hare, 0.3);
    assert.equal(api.animalDensity.livestock, 1);
    assert.equal(api.slotsFor(point(4, "SheepEwe"), max), 4, "the farm animals keep the level's numbers");
});

test("a smaller herd scattered around a point is a share of the point's herd, at least one animal", () => {
    const { api } = load();
    const max = api.animalPopulationSettings.maxPerPoint;
    const share = api.animalPopulationSettings.satelliteShare;
    assert.equal(share, 0.6);
    assert.deepEqual([1, 2, 3, 4].map((count) => api.slotsFor(point(count), max, share)), [1, 2, 3, 4]);
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
function populated({ players = [], others = [] } = {}) {
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
                        const npc = { id: next++, alive: true, status: "idle", position: options.position, options, moves: [], fled: [], invulnerable: false, frozen: false, remove() { bodies.delete(this.id); }, moveTo(target, how) { this.moves.push(how?.speed); }, flee(from, how) { this.fled.push({ from, how }); return true; }, hold() {}, attack() { return true; } };
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

test("a hare runs from one spot to the next, sooner than the others; a deer walks", () => {
    const { api, made } = populated({ players: [walker(100)] });
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
    assert.match(line, /Wolf 6\b/, "4 for the level's herd and 2 for the scattered one");
    assert.match(line, /CattleCow 4\b/, "a pasture keeps the level's own herd and no scattered one");
    assert.match(line, /no máximo 700 animais/);
});

// ---------------------------------------------------------------------------------------------
// How much each takes, and which of them run.

test("each kind is spawned with a health of its own, near the game's, and a kind with none listed gets the server's default", () => {
    const { api, made } = populated({ players: [walker(100)] });
    const population = new api.AnimalPopulation(api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "Hare", "h"), 0);
    population.add(point(3, "Wolf", "w"), 0);
    population.add(point(3, "CattleCow", "c"), 0);
    population.add(point(3, "Dragon", "d"), 0);
    for (let n = 0; n < 6; n += 1) population.tick();
    const byKind = new Map(made.map((npc) => [npc.options.class, npc.options]));
    assert.equal(byKind.get("Hare").health, 12);
    assert.equal(byKind.get("Hare").maxHealth, 12);
    assert.equal(byKind.get("Wolf").health, 70);
    assert.equal(byKind.get("CattleCow").maxHealth, 140);
    assert.equal(byKind.get("Dragon")?.health, undefined, "nothing said of a kind the table lacks");
    assert.ok(api.ANIMAL_HEALTH.Hare < api.ANIMAL_HEALTH.RoeDeer && api.ANIMAL_HEALTH.RoeDeer < api.ANIMAL_HEALTH.RedDeer && api.ANIMAL_HEALTH.RedDeer < api.ANIMAL_HEALTH.Boar, "a hare is not a boar");
});

test("an animal left invulnerable or frozen is made mortal and free again, looked at every ten seconds", () => {
    const { api, made } = populated({ players: [walker(100)] });
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

test("a hare, a roe deer and a red deer run from a player who comes within their distance, once in three seconds; a boar does not", () => {
    const hunter = walker(100);
    const sut = populated({ players: [hunter] });
    let clock = 1_000_000;
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => clock, () => 0);
    population.add(point(1, "Hare", "h"), 0);
    population.add(point(1, "RoeDeer", "r"), 0);
    population.add(point(1, "Boar", "b"), 0);
    for (let n = 0; n < 6; n += 1) population.tick();
    const [hare, deer, boar] = ["Hare", "RoeDeer", "Boar"].map((kind) => sut.made.find((npc) => npc.options.class === kind));
    assert.ok(hare && deer && boar);
    // The hunter walks up to them.
    hunter.position = { x: 5, y: 0, z: 0 };
    for (const npc of [hare, deer, boar]) npc.position = { x: 0, y: 0, z: 0 };
    clock += 20_000;
    population.tick();
    assert.equal(hare.fled.length, 1);
    assert.equal(deer.fled.length, 1);
    assert.equal(boar.fled.length, 0, "a boar stands its ground");
    assert.equal(hare.fled[0].how.speed, "run");
    assert.deepEqual({ ...hare.fled[0].from }, { x: 5, y: 0, z: 0 }, "away from the player");

    clock += 1_000;
    population.tick();
    assert.equal(hare.fled.length, 1, "not told again within three seconds");
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
    assert.ok(api.FLEE_FROM_M.Hare < api.FLEE_FROM_M.RoeDeer && api.FLEE_FROM_M.RoeDeer <= api.FLEE_FROM_M.RedDeer);
    assert.equal(api.FLEE_FROM_M.Boar, undefined);
    assert.equal(api.FLEE_FROM_M.Wolf, undefined);
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

test("a game animal hurt past a third of its health is finished with the game's own death; a healthy one, and a body that is not ours, are left alone", () => {
    const sut = populated({ players: [walker(100)] });
    const population = new sut.api.AnimalPopulation(sut.api.animalPopulationSettings, () => 1_000_000, () => 0);
    population.add(point(3, "RoeDeer", "r"), 0);
    population.tick();
    const [deer] = sut.made;
    assert.ok(deer);
    const killed = [];
    deer.kill = (by) => killed.push(by);
    deer.maxHealth = 45;
    const hunter = { id: 7, steamId: "7656", nickname: "Hans" };

    deer.health = 40;
    population.wounded(deer, hunter);
    assert.equal(killed.length, 0, "scratched, it runs");
    deer.health = 15;
    population.wounded(deer, hunter);
    assert.deepEqual(killed, [hunter], "hurt past a third, it falls, and the hunter has the kill");

    const stranger = { id: 99, alive: true, health: 1, maxHealth: 100, kill: () => assert.fail("not ours") };
    population.wounded(stranger, hunter);
    population.wounded({ ...deer, alive: false, kill: () => assert.fail("already dead") }, null);
});
