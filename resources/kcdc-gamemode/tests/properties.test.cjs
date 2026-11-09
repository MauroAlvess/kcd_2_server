const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
require("./reachpatch.cjs");

/** A fake disk with the handful of calls store.js makes, so a write can be followed back into a read. */
function fakeDisk() {
    const files = new Map();
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) {
                if (!files.has(from)) throw new Error("ENOENT");
                files.set(to, files.get(from));
                files.delete(from);
            },
            existsSync: (file) => files.has(file),
        },
    };
}

function loadStore(disk) {
    const sandbox = { exports: {}, require: (id) => { assert.equal(id, "node:fs"); return disk.fs; } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), sandbox);
    return sandbox.exports;
}

/**
 * A door the way the framework has it: a lock the level made is not `lockedByServer`; one a script sets is, until it is
 * unlocked. `areas` are the level areas that link the door, `inside` who they hold.
 */
function makeDoor(guid, { locked = false, startsLocked = locked, lockpickable = true, x = 600, y = 3250, z = 145, name = `door[${guid}]` } = {}) {
    let shut = locked;
    let byScript = false;
    let open = false;
    return {
        guid,
        name,
        position: { x, y, z },
        areas: [],
        startsLocked,
        lockpickable,
        get locked() { return shut; },
        set locked(value) { shut = value; byScript = value; },
        get lockedByServer() { return shut && byScript; },
        get open() { return open; },
        setOpen(value) {
            if (open === value) return false;
            open = value;
            if (value) shut = false;
            return true;
        },
    };
}

function makeStash(levelGuid, { locked = false, startsLocked = locked, lockpickable = true, x = 600, y = 3250, z = 145, name = `stash[Chest/chest1_${levelGuid}]` } = {}) {
    let shut = locked;
    let byScript = false;
    return {
        levelGuid,
        guid: levelGuid,
        keyItem: "",
        startsLocked,
        lockpickable,
        name,
        position: { x, y, z },
        get locked() { return shut; },
        set locked(value) { shut = value; byScript = value; },
        get lockedByServer() { return shut && byScript; },
    };
}

/** A level area linked to doors, the way Area.all("level") reports them. `box` is [minX, maxX, minY, maxY], what contains() tests. */
function makeArea(id, name, links, box = [0, 0, 0, 0]) {
    return {
        id,
        name,
        doors: links.map(([door, link]) => ({ guid: door.guid, name: door.name, position: door.position, link })),
        contains: (p) => p.x >= box[0] && p.x <= box[1] && p.y >= box[2] && p.y <= box[3],
    };
}

/**
 * world holds what the level places: doors, stashes and areas. doorAnswer is what the next Door.queryNearest resolves with;
 * nearestStash what Stash.nearest finds. inventories maps steamId -> rows the test or Inventory.add put there.
 */
function load({ doors = [], stashes = [], areas = [], seed = null, gates = [], disk: given = null } = {}) {
    const disk = given ?? fakeDisk();
    if (seed) disk.files.set("playerdata/properties.json", JSON.stringify(seed));
    const store = loadStore(disk);

    let doorAnswer = { found: false, reason: "nothing to find yet" };
    let nearestStash = null;
    const itemCalls = [];
    const registered = new Map();
    const addCalls = [];
    const renamed = [];
    const inventories = new Map();
    const handlers = new Map();
    const timers = [];
    const intervals = [];
    const cleared = [];
    const logs = [];

    const context = {
        exports: {},
        require: (id) => {
            // the owner's name is the one the character goes by (acquaintances.ts): here, the nickname
            if (id === "./acquaintances.js") return { nameOf: (player) => player.characterName ?? player.nickname };
            if (id === "./level.js") return { onKuttenberg: () => true };
            assert.equal(id, "./store.js");
            return store;
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => { cleared.push(id); },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Door: {
            queryNearest: async () => doorAnswer,
            find: (guid) => doors.find((door) => door.guid === guid) ?? null,
            all: () => doors,
        },
        Stash: {
            nearest: () => nearestStash,
            find: (guid) => stashes.find((stash) => stash.levelGuid === guid) ?? null,
            all: () => stashes,
        },
        Gate: { all: () => gates },
        Area: { all: () => areas, getAt: (position) => areas.filter((area) => area.contains(position)) },
        Items: {
            register: (id, definition) => {
                itemCalls.push({ id, definition });
                const before = registered.get(id);
                if (before && JSON.stringify(before) !== JSON.stringify(definition)) throw new Error("conflicting definition");
                registered.set(id, definition);
                return id;
            },
        },
        Inventory: {
            add: (player, request) => {
                addCalls.push({ steamId: player.steamId, ...request });
                const rows = inventories.get(player.steamId) ?? [];
                rows.push({ item: request.item, amount: request.amount });
                inventories.set(player.steamId, rows);
                return { ok: true, code: "" };
            },
            get: (player) => ({ ready: true, revision: 1, items: inventories.get(player.steamId) ?? [], harvested: undefined, quickslots: null }),
            setItemName: (item, name) => { renamed.push({ item, name }); return [item]; },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/properties.js"), "utf8"), context);
    return {
        api: context.exports,
        disk,
        files: disk.files,
        itemCalls,
        addCalls,
        renamed,
        handlers,
        timers,
        intervals,
        cleared,
        logs,
        setDoor: (answer) => { doorAnswer = answer; },
        setNearestStash: (stash) => { nearestStash = stash; },
        give: (steamId, item, amount = 1) => {
            const rows = inventories.get(steamId) ?? [];
            rows.push({ item, amount });
            inventories.set(steamId, rows);
        },
        saved: () => JSON.parse(disk.files.get("playerdata/properties.json")),
    };
}

function makePlayer(steamId, nickname = "Jogador", position = { x: 0, y: 0, z: 0 }) {
    return { steamId, nickname, position };
}

// ---------------------------------------------------------------------------------------------
// Registering by hand, as before.

test("registering at a door creates a property, mints its key, and locks it by the record: the door stays unlocked in the game", async () => {
    const sut = load();
    const door = makeDoor("aaaa000000000001", { x: 10, y: 20, z: 30 });
    sut.setDoor({ found: true, door });

    const result = await sut.api.registerProperty(makePlayer("1"), "Casa do Ferreiro", "Kuttenberg");

    assert.equal(result.ok, true);
    assert.equal(result.property.name, "Casa do Ferreiro");
    assert.equal(result.property.region, "Kuttenberg");
    assert.equal(result.property.kind, "house");
    assert.equal(result.property.doorGuid, door.guid);
    assert.equal(result.property.createdBy, "1");
    assert.equal(result.property.auto, false);
    assert.equal(result.property.lockSet, true, "registered by hand means locked by hand");
    assert.equal(sut.api.lockedNow(door.guid), true);
    assert.equal(door.locked, false, "the game is never told: its one prompt there stays Abrir");
    assert.deepEqual([result.property.x, result.property.y, result.property.z], [10, 20, 30]);

    assert.equal(sut.itemCalls.length, 1);
    assert.match(sut.itemCalls[0].id, /^kcdc-property:/);
    assert.match(sut.itemCalls[0].definition.name, /Casa do Ferreiro/);
    assert.equal(sut.itemCalls[0].definition.stackable, false);
    assert.equal(result.property.keyItem, sut.itemCalls[0].id);

    assert.equal(sut.saved()[result.property.id].name, "Casa do Ferreiro");
});

test("a blank region falls back to a label, and is trimmed when given", async () => {
    const sut = load();
    sut.setDoor({ found: true, door: makeDoor("aaaa000000000002") });
    const result = await sut.api.registerProperty(makePlayer("1"), "Casinha", "   ");
    assert.equal(result.property.region, "Sem região");

    sut.setDoor({ found: true, door: makeDoor("aaaa000000000003") });
    const result2 = await sut.api.registerProperty(makePlayer("1"), "Outra", "  Suchdol  ");
    assert.equal(result2.property.region, "Suchdol");
});

test("a name that is too short or too long is refused without ever asking the client for a door", async () => {
    const sut = load();
    let queried = false;
    sut.setDoor(new Proxy({ found: true, door: makeDoor("x") }, { get: () => { queried = true; return undefined; } }));

    const tooShort = await sut.api.registerProperty(makePlayer("1"), "A", "x");
    assert.equal(tooShort.ok, false);
    assert.match(tooShort.reason, /2 e 60/);
    assert.equal((await sut.api.registerProperty(makePlayer("1"), "x".repeat(61), "x")).ok, false);

    assert.equal(queried, false, "queryNearest's result was never even read");
    assert.equal(sut.itemCalls.length, 0);
});

test("no door nearby is refused with the client's own reason, and nothing is created", async () => {
    const sut = load();
    sut.setDoor({ found: false, reason: "nothing in sight" });
    const result = await sut.api.registerProperty(makePlayer("1"), "Uma Casa", "x");
    assert.equal(result.ok, false);
    assert.match(result.reason, /nothing in sight/);
    assert.equal(sut.itemCalls.length, 0);
});

test("a door that is already a property is refused, and no second key is minted", async () => {
    const sut = load();
    sut.setDoor({ found: true, door: makeDoor("bbbb000000000001") });
    await sut.api.registerProperty(makePlayer("1"), "Primeira", "x");

    const again = await sut.api.registerProperty(makePlayer("2"), "Segunda", "y");
    assert.equal(again.ok, false);
    assert.match(again.reason, /já é uma propriedade/);
    assert.equal(sut.itemCalls.length, 1);
});

test("two properties named alike get distinct ids", async () => {
    const sut = load();
    sut.setDoor({ found: true, door: makeDoor("cccc000000000001") });
    const first = await sut.api.registerProperty(makePlayer("1"), "Casa Grande", "x");
    sut.setDoor({ found: true, door: makeDoor("cccc000000000002") });
    const second = await sut.api.registerProperty(makePlayer("1"), "Casa Grande", "x");

    assert.notEqual(first.property.id, second.property.id);
    assert.equal(sut.api.listProperties().length, 2);
});

test("removing a property forgets it and leaves the door as it is", async () => {
    const sut = load();
    const door = makeDoor("dddd000000000001");
    sut.setDoor({ found: true, door });
    const { property } = await sut.api.registerProperty(makePlayer("1"), "Casa", "x");

    const removed = sut.api.removeProperty(property.id);
    assert.equal(removed.id, property.id);
    assert.equal(sut.api.getProperty(property.id), null);
    assert.equal(sut.api.lockedNow(door.guid), null, "no property, no lock of the server's");
    assert.equal(door.locked, false);
    assert.equal(sut.api.removeProperty(property.id), null);
});

test("listProperties sorts by region, then by name", async () => {
    const sut = load();
    for (const [guid, name, region] of [["h1", "Zelda", "Suchdol"], ["h2", "Ana", "Kuttenberg"], ["h3", "Beto", "Kuttenberg"]]) {
        sut.setDoor({ found: true, door: makeDoor(guid) });
        await sut.api.registerProperty(makePlayer("1"), name, region);
    }
    const names = Array.from(sut.api.listProperties(), (p) => `${p.region}/${p.name}`);
    assert.deepEqual(names, ["Kuttenberg/Ana", "Kuttenberg/Beto", "Suchdol/Zelda"]);
});

// ---------------------------------------------------------------------------------------------
// The census: Suchdol mapped from what the level places.

/** A small village: two houses and a barn inside Suchdol, a house outside it, chests and a barrel. */
function village() {
    const west = [makeDoor("1000000000000001", { x: 520, y: 3250, name: "Door/front[structures/living/houses/house_1s_3r_c6]" }), makeDoor("1000000000000002", { x: 521, y: 3251, name: "Door/inner" })];
    const east = [makeDoor("2000000000000001", { x: 700, y: 3300, name: "Door/front[structures/living/houses/house_1s_4r_d]" }), makeDoor("2000000000000002", { x: 701, y: 3300, name: "Door/storeroom" })];
    const barn = makeDoor("3000000000000001", { x: 610, y: 3260, name: "Door/barn[structures/industrial/barns/barn_r4]" });
    const farAway = makeDoor("4000000000000001", { x: 9200, y: 500, name: "Door/front[structures/living/houses/house_far]" }); // off the map: no place is mapped there
    // A door of the fortress: the castle's own, which the census leaves out unless asked.
    const loose = makeDoor("5000000000000001", { x: 763, y: 3333, name: "AnimDoor[structures/defensive/fortresses/suchdol1:Door/door_village_right29[x]]" });
    const doors = [...west, ...east, barn, farAway, loose];
    const areas = [
        makeArea("a2", "SmartArea64[structures/living/houses/house_1s_4r_d_1]", [[east[0], "entrance"], [east[1], "storage"]], [680, 720, 3280, 3320]),
        makeArea("a1", "SmartArea[structures/living/houses/house_1s_3r_c6_1]", [[west[0], "entrance"], [west[1], "basic"]], [500, 545, 3235, 3265]),
        makeArea("a3", "WH_TriggerArea22[structures/industrial/barns/barn_r4_1]", [[barn, "entrance"]], [600, 620, 3250, 3270]),
        makeArea("a4", "SmartArea[structures/living/houses/house_far_1]", [[farAway, "entrance"]], [9190, 9210, 490, 510]),
        // A tower: an area with no door of its own, which only gives a hint to the chests standing in it.
        makeArea("a5", "TriggerArea[structures/military/tower_1]", [], [790, 810, 3340, 3360]),
    ];
    const stashes = [
        makeStash("c000000000000001", { x: 560, y: 3240 }),
        makeStash("c000000000000002", { x: 800, y: 3350 }),
        makeStash("c000000000000004", { x: 525, y: 3252 }),
        makeStash("b000000000000001", { x: 600, y: 3240, name: "Stash12[Stash/barrel_with_arrows29_x]" }),
        makeStash("c000000000000003", { x: 9300, y: 600 }),
        makeStash("", { x: 600, y: 3240, name: "spawned_stash_1" }),
    ];
    return { doors, areas, stashes, west, east, barn, farAway, loose };
}

test("the census files each building and chest inside Suchdol, named by type and numbered west to east", () => {
    const world = village();
    const sut = load(world);

    const report = sut.api.mapRegion("suchdol");

    assert.equal(report.housesAdded, 3, "two houses and the barn");
    assert.equal(report.chestsAdded, 3, "the barrel, the chest elsewhere and the scripted one are not properties");
    assert.equal(report.chestsSeen, 3);
    assert.equal(report.areasWithDoors, 3);
    assert.equal(report.looseDoorsSeen, 1, "the one door no building owns is counted");
    assert.equal(report.fortressDoorsLeftOut, 1, "but it is the fortress's, so it is not filed");
    assert.match(report.looseSamples[0], /^AnimDoor\[structures\/defensive\/fortresses\/suchdol1:Door\/door_village_right29\[x\]\] @ 763,3333$/);
    assert.match(sut.api.describeCensus(report), /1 portas da fortaleza ficaram de fora/);

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.deepEqual(Object.keys(byName).sort(), ["Baú 01", "Baú 02 (Torre)", "Casa 01", "Casa 01 · Baú 1", "Casa 02", "Celeiro 01"]);
    assert.equal(byName["Casa 01"].doorGuid, "1000000000000001", "the western house is the first");
    assert.equal(byName["Casa 02"].doorGuid, "2000000000000001");
    assert.deepEqual(Array.from(byName["Casa 02"].doors), ["2000000000000001", "2000000000000002"], "entrance and storage room");
    assert.deepEqual(Array.from(byName["Casa 01"].doors), ["1000000000000001"], "an inner door is not locked with the house");
    assert.equal(byName["Baú 01"].stashGuid, "c000000000000001");
    assert.equal(byName["Casa 01 · Baú 1"].stashGuid, "c000000000000004", "a chest inside a house is named after it");
    assert.equal(byName["Baú 02 (Torre)"].stashGuid, "c000000000000002", "and one in a tower says so");
    assert.equal(byName["Casa 01"].region, "Suchdol");
    assert.equal(byName["Casa 01"].auto, true);
    assert.equal(byName["Casa 01"].keys, 0);
    assert.equal(byName["Casa 01"].locked, false, "nothing is private until a key is handed out");
    assert.ok(world.doors.every((door) => door.locked === false), "the census locks nothing");
    assert.ok(world.stashes.every((stash) => stash.locked === false));

    assert.equal(sut.itemCalls.length, 0, "no key type is registered until a key is handed out: every client is sent each one");
    assert.ok(Object.values(byName).every((property) => property.keyItem === ""));
    assert.equal(sut.saved()[byName["Casa 01"].id].name, "Casa 01");
});

test("mapping again finds nothing new, and a building that appears later takes the next number", () => {
    const world = village();
    const sut = load(world);
    sut.api.mapRegion("suchdol");

    const again = sut.api.mapRegion("suchdol");
    assert.equal(again.housesAdded + again.chestsAdded, 0);
    assert.equal(again.alreadyKnown, 6);

    const extra = makeDoor("6000000000000001", { x: 560, y: 3300, name: "Door/front[structures/living/houses/house_new]" });
    world.doors.push(extra);
    world.areas.push(makeArea("a5", "SmartArea[structures/living/houses/house_new_1]", [[extra, "entrance"]]));
    const later = sut.api.mapRegion("suchdol");
    assert.equal(later.housesAdded, 1);
    assert.ok(Array.from(sut.api.listProperties(), (p) => p.name).includes("Casa 03"));
});

test("a chest that appears later inside a house already filed takes the next number there", () => {
    const world = village();
    const sut = load(world);
    sut.api.mapRegion("suchdol");

    world.stashes.push(makeStash("c000000000000009", { x: 530, y: 3255 }));
    const later = sut.api.mapRegion("suchdol");
    assert.equal(later.chestsAdded, 1);
    assert.ok(Array.from(sut.api.listProperties(), (p) => p.name).includes("Casa 01 · Baú 2"));
});

test("the fortress's own doors are only filed when asked for, as Fortaleza", () => {
    const sut = load(village());
    sut.api.mapRegion("suchdol");
    assert.ok(!Array.from(sut.api.listProperties(), (p) => p.name).some((name) => name.startsWith("Fortaleza")));

    const report = sut.api.mapRegion("suchdol", { looseDoors: true });
    assert.equal(report.looseDoorsAdded, 1);
    assert.equal(report.fortressDoorsLeftOut, 0);
    assert.match(sut.api.describeCensus(report), /1 porta\(s\) soltas/);
    assert.ok(Array.from(sut.api.listProperties(), (p) => p.name).includes("Fortaleza 01"));
});

/** Doors the level links to no area: a pub with two doors, a house, plain village doors, the castle's, a cutscene's. */
function strayDoors() {
    const pub = "structures/municipal/pubs/unique/tachov/tachov_tavern_noshed1";
    const doors = [
        makeDoor("a000000000000001", { x: 634, y: 3252, name: `AnimDoor[${pub}:Door/door_village_left65[${pub}]]` }),
        makeDoor("a000000000000002", { x: 633, y: 3247, name: `AnimDoor[${pub}:Door/door_village_left64[${pub}]]` }),
        makeDoor("a000000000000003", { x: 850, y: 3200, name: "AnimDoor[structures/living/houses/house_1s_6r_b1:Door/door_village_left2[x]]" }),
        makeDoor("a000000000000004", { x: 588, y: 3234, name: "AnimDoor[Door/door_village_right61_57e575a0]" }),
        makeDoor("a000000000000005", { x: 576, y: 3288, name: "AnimDoor[Door/door_village_left46_7b30a776]" }),
        makeDoor("a000000000000006", { x: 772, y: 3358, name: "AnimDoor[Door/door_village_right26_45f6a6bf]" }),
        makeDoor("a000000000000007", { x: 735, y: 3364, name: "cin_m4890k_AnimDoor3" }),
        makeDoor("a000000000000008", { x: 700, y: 3200, name: `AnimDoor[${pub}:Door/door_far[${pub}]]` }),
    ];
    return { doors, areas: [], stashes: [] };
}

test("doors the level links to no building are filed by what they are, a building's doors together", () => {
    const sut = load(strayDoors());
    const report = sut.api.mapRegion("suchdol");

    assert.equal(report.looseDoorsSeen, 8);
    assert.equal(report.fortressDoorsLeftOut, 1, "the plain door inside the castle's walls is the castle's");
    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.deepEqual(Object.keys(byName).sort(), ["Casa 01", "Porta 01", "Porta 02", "Taverna 01", "Taverna 02"]);
    assert.deepEqual(Array.from(byName["Taverna 01"].doors).sort(), ["a000000000000001", "a000000000000002"], "the two doors of one pub are one property");
    assert.deepEqual(Array.from(byName["Taverna 02"].doors), ["a000000000000008"], "a far door of the same prefab is another building");
    assert.equal(byName["Casa 01"].doorGuid, "a000000000000003");
    assert.equal(byName["Casa 01"].kind, "house");
    assert.equal(byName["Porta 01"].kind, "door");
    assert.equal(report.housesAdded, 3, "two taverns and the house");
    assert.equal(report.looseDoorsAdded, 2, "the two plain village doors");
    assert.ok(!Object.values(byName).some((p) => p.doors.includes("a000000000000007")), "a cutscene's door is never a property");
});

test("an unknown region is not mapped", () => {
    const sut = load(village());
    assert.equal(sut.api.mapRegion("narnia"), null);
    assert.equal(sut.api.listProperties().length, 0);
});

// ---------------------------------------------------------------------------------------------
// Keys and locks.

function mapped() {
    const world = village();
    const sut = load(world);
    sut.api.mapRegion("suchdol");
    const find = (name) => Array.from(sut.api.listProperties()).find((p) => p.name === name);
    return { world, sut, find };
}

test("a key handed out is just a key: nothing gets locked by it, the first or any other", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    const admin = makePlayer("9", "Mauro");

    const first = sut.api.grantKey(admin, house.id);
    assert.equal(first.ok, true);
    assert.doesNotMatch(first.message, /trancada/);
    assert.equal(sut.api.lockState(sut.api.getProperty(house.id)), "none");
    assert.equal(world.east[0].locked, false);
    assert.equal(sut.api.getProperty(house.id).keys, 1);
    assert.equal(sut.api.getProperty(house.id).lockSet, undefined, "nobody set a lock");
    assert.deepEqual(sut.addCalls.at(-1), { steamId: "9", item: sut.api.getProperty(house.id).keyItem, amount: 1 });

    sut.api.grantKey(admin, house.id);
    assert.equal(sut.api.getProperty(house.id).keys, 2);
    assert.equal(sut.api.lockState(sut.api.getProperty(house.id)), "none");
});

test("the key type of a property is registered the first time a key is handed out, and only then", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    assert.equal(sut.itemCalls.length, 0);

    sut.api.grantKey(makePlayer("9"), house.id);
    assert.equal(sut.itemCalls.length, 1);
    assert.match(sut.itemCalls[0].id, /^kcdc-property:suchdol-casa-01$/);
    const keyItem = sut.api.getProperty(house.id).keyItem;
    assert.equal(keyItem, sut.itemCalls[0].id);
    assert.deepEqual(sut.addCalls.at(-1), { steamId: "9", item: keyItem, amount: 1 });

    sut.api.grantKey(makePlayer("9"), house.id);
    assert.equal(sut.itemCalls.length, 1, "a second key reuses the type");
    assert.equal(sut.saved()[house.id].keyItem, keyItem, "and the type is remembered");
});

test("a key nobody has registered is held by nobody, so it opens nothing", async () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.setDoor({ found: true, door: world.east[0] });
    const refused = await sut.api.useKeyAt(makePlayer("5"));
    assert.equal(refused.ok, false);
    assert.match(refused.message, /não tem a chave/);
});

test("a key can go straight to another player, and the administrator keeps nothing", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    const admin = makePlayer("9", "Mauro");
    const tenant = makePlayer("10", "Hans");

    const result = sut.api.grantKey(admin, house.id, tenant);
    assert.equal(result.ok, true);
    assert.match(result.message, /com Hans/);
    assert.deepEqual(sut.addCalls.at(-1), { steamId: "10", item: sut.api.getProperty(house.id).keyItem, amount: 1 });
    assert.equal(sut.addCalls.filter((call) => call.steamId === "9").length, 0);
});

test("a chest locked on purpose is locked in the game too (2026-10-19): the game then offers only its key and its lockpick", () => {
    const { world, sut, find } = mapped();
    const chest = find("Baú 01");

    sut.api.setLocked(chest.id, true);
    const stash = world.stashes.find((s) => s.levelGuid === chest.stashGuid);
    assert.equal(stash.locked, true);
    assert.equal(stash.lockedByServer, true);
    assert.equal(sut.api.lockedNow(chest.stashGuid), true);
    sut.api.setLocked(chest.id, false);
    assert.equal(stash.locked, false);
});

test("granting an unknown property's key fails cleanly", () => {
    const sut = load();
    const result = sut.api.grantKey(makePlayer("9"), "no-such-property");
    assert.equal(result.ok, false);
    assert.equal(sut.addCalls.length, 0);
});

test("holding the right key toggles the server's lock of every door of the house, and only that key works", async () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.grantKey(makePlayer("9"), house.id);
    const tenant = makePlayer("5", "Hans");
    sut.give(tenant.steamId, sut.api.getProperty(house.id).keyItem);

    sut.setDoor({ found: true, door: world.east[0] });
    const locked = await sut.api.useKeyAt(tenant);
    assert.equal(locked.ok, true);
    assert.match(locked.message, /trancada/);
    assert.equal(sut.api.lockState(sut.api.getProperty(house.id)), "all", "the storage room with it");
    assert.equal(sut.api.getProperty(house.id).locked, true, "and the choice is what a restart keeps");
    assert.equal(world.east[0].locked, true, "the game holds the lock");
    assert.equal(world.east[1].locked, true);

    const unlocked = await sut.api.useKeyAt(tenant);
    assert.match(unlocked.message, /destrancada/);
    assert.equal(sut.api.lockState(sut.api.getProperty(house.id)), "none");

    // Another house's key does nothing here.
    const stranger = makePlayer("6");
    sut.api.grantKey(makePlayer("9"), find("Casa 01").id);
    sut.give(stranger.steamId, sut.api.getProperty(find("Casa 01").id).keyItem);
    const refused = await sut.api.useKeyAt(stranger);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /não tem a chave/);
});

test("using a key with no door in sight, or at a door that is no property, is refused", async () => {
    const { world, sut } = mapped();
    sut.setDoor({ found: false, reason: "no door in sight" });
    const noDoor = await sut.api.useKeyAt(makePlayer("5"));
    assert.equal(noDoor.ok, false);
    assert.match(noDoor.message, /no door in sight/);

    sut.setDoor({ found: true, door: world.loose });
    const notTracked = await sut.api.useKeyAt(makePlayer("5"));
    assert.match(notTracked.message, /não é uma propriedade/);
});

test("a chest within reach is unlocked with its key, and not without it", async () => {
    const { world, sut, find } = mapped();
    const chest = find("Baú 02 (Torre)");
    sut.api.setLocked(chest.id, true);
    sut.api.grantKey(makePlayer("9"), chest.id);
    const stash = world.stashes.find((s) => s.levelGuid === chest.stashGuid);
    sut.setNearestStash(stash);

    const without = await sut.api.useKeyAt(makePlayer("5"));
    assert.equal(without.ok, false);
    assert.equal(sut.api.lockedNow(chest.stashGuid), true);

    const tenant = makePlayer("6");
    sut.give(tenant.steamId, sut.api.getProperty(chest.id).keyItem);
    const opened = await sut.api.useKeyAt(tenant);
    assert.equal(opened.ok, true);
    assert.match(opened.message, /destrancado/);
    assert.equal(sut.api.lockedNow(chest.stashGuid), false);
    assert.equal(stash.locked, false);
});

// ---------------------------------------------------------------------------------------------
// Starting up.

test("at start every key type is registered again, and the record's locks stand in the game; the rest as the level built it", () => {
    const world = village();
    const first = load(world);
    first.api.mapRegion("suchdol");
    const casa = Array.from(first.api.listProperties()).find((p) => p.name === "Casa 02");
    const baul = Array.from(first.api.listProperties()).find((p) => p.name === "Baú 01");
    first.api.grantKey(makePlayer("9"), casa.id);
    first.api.grantKey(makePlayer("9"), baul.id);
    first.api.setLocked(casa.id, true);
    first.api.setLocked(baul.id, true);
    const seed = first.saved();

    // A restart: the level builds its doors and chests the way it does, and the server's locks are gone with it.
    world.doors.forEach((door) => { door.locked = false; });
    world.loose.locked = true;
    world.stashes.forEach((stash) => { stash.locked = false; });
    const sut = load({ ...world, seed });
    sut.api.installProperties();

    assert.equal(sut.itemCalls.length, 2, "the two key types that were handed out exist before anybody connects; the other four were never made");
    assert.deepEqual([world.east[0].locked, world.east[1].locked, world.west[0].locked, world.stashes[0].locked], [true, true, false, true], "what was locked on purpose is locked in the game again");
    assert.equal(sut.api.lockedNow(world.east[0].guid), true, "and by the server's record");
    assert.equal(sut.api.lockedNow(world.stashes[0].levelGuid), true);
    assert.equal(sut.api.lockedNow(world.west[0].guid), false, "a property nobody locked follows the level, which built this one open");
    assert.equal(world.loose.locked, true, "a door that is no property is the game's own business");
    const census = sut.timers.filter((timer) => timer.ms === 20_000);
    assert.equal(census.length, 1, "Suchdol holds a census already; only the regions added since are mapped on their own");
    const before = sut.api.listProperties().length;
    census[0].fn();
    assert.equal(sut.api.listProperties().length, before, "Suchdol is not mapped twice, and this village has nothing of Wysoka or Raborsch");
    assert.ok(sut.logs.some((line) => /mapeamento automático \(caixa de reserva.*Wysoka: 0 edifício/.test(line)), "a level whose map names no place uses the boxes");
});

test("a place the level's map names gives a region its outline, and any named place can be mapped by its name", () => {
    const world = village();
    // The map's outline of Raborsch, as Area.location names it: the census looks a little wider than it.
    world.areas.push({ id: "loc-raborsch", name: "SmartArea", location: "Raborsch", doors: [], bounds: { min: { x: 1400, y: 3800, z: 0 }, max: { x: 1600, y: 3900, z: 0 } }, contains: () => false });
    world.areas.push({ id: "loc-sedletz", name: "SmartArea", location: "Sedletz", doors: [], bounds: { min: { x: 100, y: 100, z: 0 }, max: { x: 300, y: 260, z: 0 } }, contains: () => false });
    const sut = load(world);
    const raborsch = sut.api.regionFor("Raborsch");
    assert.deepEqual([raborsch.id, raborsch.name, raborsch.minX, raborsch.maxX, raborsch.minY, raborsch.maxY], ["raborsch", "Raborsch", 1375, 1625, 3775, 3925]);
    assert.equal(raborsch.looseDoors, true, "the fortress's doors are filed too");
    const wysoka = sut.api.regionFor("wysoka");
    assert.deepEqual([wysoka.minX, wysoka.maxX], [250, 540], "no outline on the map: the box");
    const sedletz = sut.api.regionFor("sedletz");
    assert.deepEqual([sedletz.id, sedletz.name, sedletz.minX, sedletz.maxY], ["sedletz", "Sedletz", 75, 285], "a place that is no listed region, by the map's own name");
    assert.equal(sut.api.regionFor("Atlântida"), null);
    assert.deepEqual(Array.from(sut.api.mapLocations(), (place) => place.name), ["Raborsch", "Sedletz"]);
    assert.equal(sut.api.mapRegion("Atlântida"), null);
    assert.equal(sut.api.mapRegion("sedletz").region, "Sedletz");
});

test("every listed region takes the map's outline where the level has one, as regionFor gives it, in one reading of the level (2026-10-25, the chat's reach)", () => {
    const world = village();
    world.areas.push({ id: "loc-raborsch", name: "SmartArea", location: "Raborsch", doors: [], bounds: { min: { x: 1400, y: 3800, z: 0 }, max: { x: 1600, y: 3900, z: 0 } }, contains: () => false });
    world.areas.push({ id: "loc-estalagem", name: "SmartArea", location: "Pschitoky Wagoners' Inn", doors: [], bounds: { min: { x: 2116, y: 1442, z: 0 }, max: { x: 2220, y: 1578, z: 0 } }, contains: () => false });
    world.areas.push({ id: "loc-sedletz", name: "SmartArea", location: "Sedletz", doors: [], bounds: { min: { x: 100, y: 100, z: 0 }, max: { x: 300, y: 260, z: 0 } }, contains: () => false });
    const sut = load(world);
    const regions = Array.from(sut.api.mappedRegions());
    const listed = Array.from(sut.api.REGIONS, (region) => region.id);
    assert.deepEqual(regions.map((region) => region.id).slice(0, listed.length), listed, "the whole list, in its order; a place that is no listed region (Sedletz) is not added");
    assert.deepEqual(regions.map((region) => region.id).slice(listed.length), ["haras-malesov", "estalagem-stara-kutna", "estalagem-pschitoky", "toca-do-diabo"], "then the compounds that lie away from their region (the Devil's Den is 770 m from Minas: a zone of its own too)");
    const box = (region) => [region.minX, region.maxX, region.minY, region.maxY];
    const raborsch = regions.find((region) => region.id === "raborsch");
    assert.deepEqual(box(raborsch), [1375, 1625, 3775, 3925], "the outline, a little wider");
    assert.equal(raborsch.looseDoors, true, "what the list says of the region goes along");
    assert.deepEqual(box(regions.find((region) => region.id === "estalagem-pschitoky")), [2091, 2245, 1417, 1603], "the inn is a zone of its own for the chat, with the map's outline of it");
    assert.deepEqual(box(regions.find((region) => region.id === "haras-malesov")), [395, 485, 700, 775], "no outline on the map: its box");
    assert.deepEqual(box(regions.find((region) => region.id === "toca-do-diabo")), [2850, 2975, 2890, 2990], "the Devil's Den: its box, no outline in this level");
    assert.deepEqual(box(regions.find((region) => region.id === "wysoka")), [250, 540, 2320, 2600], "no outline on the map: the box of the list");
    assert.deepEqual(box(regions.find((region) => region.id === "suchdol")), [430, 900, 3140, 3480], "a region with no names for the map keeps its box");
    for (const region of regions.slice(0, listed.length)) {
        assert.deepEqual(box(region), box(sut.api.regionFor(region.id)), `${region.id}: the same as regionFor gives`);
    }
});

test("a level that cannot list its areas leaves the boxes of the list", () => {
    const world = village();
    world.areas = null;
    const sut = load(world);
    const regions = Array.from(sut.api.mappedRegions());
    assert.equal(regions.length, 20, "the 16 regions of the list and the four compounds away from theirs");
    assert.deepEqual([regions[0].minX, regions[0].maxX], [430, 900]);
});

test("the whole map is listed (2026-10-20): the great town and every village the level has doors in, boxes that do not overlap, each holding the heart the level gives its place", () => {
    const sut = load(village());
    const regions = Array.from(sut.api.REGIONS);
    assert.equal(regions.length, 16);
    assert.deepEqual(regions.map((region) => region.id), ["suchdol", "wysoka", "raborsch", "malesov", "bylany", "bohunowitz", "kuttenberg", "miskowitz", "pschitoky", "grunta", "horschan", "stara-kutna", "stara-lhota", "danemark", "rabstein", "opatowitz"]);
    assert.equal(new Set(regions.map((region) => region.name)).size, 16, "a name each");
    for (let i = 0; i < regions.length; i += 1) {
        const a = regions[i];
        assert.ok(a.maxX > a.minX && a.maxY > a.minY, `${a.id}: a box`);
        for (const b of regions.slice(i + 1)) {
            assert.ok(a.maxX <= b.minX || b.maxX <= a.minX || a.maxY <= b.minY || b.maxY <= a.minY, `${a.id} and ${b.id} overlap`);
        }
    }
    // The points the level itself gives each place (its fast-travel point or its settlement's centre, read out of level.pak).
    const hearts = {
        suchdol: [698, 3288], wysoka: [426, 2489], raborsch: [1579, 3813], malesov: [556, 355], bylany: [1699, 1035], bohunowitz: [1993, 3441],
        kuttenberg: [3182, 974], miskowitz: [1555, 1982], pschitoky: [2301, 1824], grunta: [3216, 2187], horschan: [2617, 2629], "stara-kutna": [3068, 1359],
        "stara-lhota": [597, 922], danemark: [1526, 223], rabstein: [953, 1045], opatowitz: [1790, 2972],
    };
    for (const region of regions) {
        const [x, y] = hearts[region.id];
        assert.ok(x >= region.minX && x <= region.maxX && y >= region.minY && y <= region.maxY, `${region.id} holds its place's heart`);
    }
    // The great town is the largest, and answers to the names the game gives it.
    const area = (region) => (region.maxX - region.minX) * (region.maxY - region.minY);
    assert.equal(regions.reduce((best, region) => (area(region) > area(best) ? region : best)).id, "kuttenberg");
    assert.equal(sut.api.regionFor("Kutná Hora").id, "kuttenberg");
    assert.equal(sut.api.regionFor("Grund").name, "Minas", "the game's English name of Minas (2026-10-26: on the map Grund is Minas, above Stará Kutná)");
    assert.equal(sut.api.regionFor("Minas").id, "grunta", "the id the census, the coach stop and the gardens have always had");
    assert.equal(sut.api.regionFor("Grunta").id, "grunta", "the old name still finds it");
    assert.equal(sut.api.regionFor("Old Kutna").name, "Stará Kutná");
    assert.equal(sut.api.regionFor("Devil's Den"), null, "the Devil's Den is no region: it is a property of Minas (2026-10-26)");
    assert.equal(sut.api.regionFor("Pschitoky Wagoners' Inn"), null, "the inn is no region any more: it is a property of Pschitoky");
    assert.ok(!regions.some((region) => /estalagem|inn\b/i.test(region.id + region.name)));
    // The army camp is left out on purpose; the Devil's Den is the one property of Minas that nobody lives in.
    assert.ok(!regions.some((region) => /zikmund|camp/i.test(region.id + region.name)));
    const minas = regions.find((region) => region.id === "grunta");
    assert.equal(minas.name, "Minas");
    assert.equal(minas.wild, undefined, "Minas is a village people live in");
    assert.deepEqual(Array.from(minas.compounds, (compound) => [compound.name, compound.wild]), [["Toca do Diabo", true]], "its Devil's Den is the wild part");
    // The first start maps each of them once, 20 s in, one after the other.
    sut.api.installProperties();
    assert.equal(sut.timers.filter((timer) => timer.ms === 20_000).length, 1);
});

test("the first start maps Suchdol by itself, a little later, and says what it found", () => {
    const sut = load(village());
    sut.api.installProperties();
    assert.equal(sut.api.listProperties().length, 0);
    const census = sut.timers.filter((timer) => timer.ms === 20_000);
    assert.equal(census.length, 1);

    census[0].fn();
    assert.equal(sut.api.listProperties().length, 6);
    assert.ok(sut.logs.some((line) => /porta solta: AnimDoor\[structures\/defensive.* @ 763,3333/.test(line)), "the doors left out are listed in the log, to judge the census by");
    assert.ok(sut.logs.some((line) => /mapeamento automático/.test(line)));
});

test("a catalog written before houses and chests had a kind still loads, locked as it was, by the record", () => {
    const seed = { casa: { id: "casa", name: "Casa", region: "Suchdol", doorGuid: "7000000000000001", keyItem: "kcdc-property:casa", createdAt: 1, createdBy: "1" } };
    const door = makeDoor("7000000000000001", { locked: true });
    const sut = load({ doors: [door], seed });
    sut.api.installProperties();

    const property = sut.api.getProperty("casa");
    assert.equal(property.kind, "door");
    assert.deepEqual(Array.from(property.doors), ["7000000000000001"]);
    assert.equal(property.locked, true);
    assert.equal(property.lockSet, true, "a property registered before was locked by hand");
    assert.equal(property.keys, 0);
    assert.equal(sut.api.lockedNow(door.guid), true);
    assert.equal(door.locked, true, "and so is the game");
});

// ---------------------------------------------------------------------------------------------
// Looking around and renaming.

test("properties near a point come nearest first and within the radius", () => {
    const { sut } = mapped();
    const near = Array.from(sut.api.propertiesNear({ x: 520, y: 3250, z: 145 }, 100), (entry) => entry.property.name);
    assert.deepEqual(near, ["Casa 01", "Casa 01 · Baú 1", "Baú 01", "Celeiro 01"]);
    const closer = Array.from(sut.api.propertiesNear({ x: 520, y: 3250, z: 145 }, 60), (entry) => entry.property.name);
    assert.deepEqual(closer, ["Casa 01", "Casa 01 · Baú 1", "Baú 01"]);

    const wide = Array.from(sut.api.propertiesNear({ x: 520, y: 3250, z: 145 }, 400), (entry) => entry.property.name);
    assert.equal(wide[0], "Casa 01");
    assert.ok(wide.length > 1);
});

test("renaming keeps the id, shows the new name on the key at once, and refuses a bad name", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");

    assert.equal(sut.api.renameProperty(house.id, "Casa do Ferreiro").ok, true);
    assert.equal(sut.api.getProperty(house.id).name, "Casa do Ferreiro");
    assert.equal(sut.renamed.length, 0, "no key exists yet, so there is no label to change");

    sut.api.grantKey(makePlayer("9"), house.id);
    sut.api.renameProperty(house.id, "Casa do Ferreiro II");
    assert.deepEqual(sut.renamed.at(-1), { item: sut.api.getProperty(house.id).keyItem, name: "Chave: Casa do Ferreiro II" });
    assert.equal(sut.api.getProperty(house.id).name, "Casa do Ferreiro II");
    assert.equal(sut.saved()[house.id].name, "Casa do Ferreiro II");

    assert.equal(sut.api.renameProperty(house.id, "A").ok, false);
    assert.equal(sut.api.renameProperty("nope", "Qualquer").ok, false);
});

test("locking a chest by id makes no key type: nobody has a key until one is made", () => {
    const { world, sut, find } = mapped();
    const chest = find("Baú 01");
    sut.api.setLocked(chest.id, true);
    assert.equal(sut.itemCalls.length, 0);
    assert.equal(world.stashes.find((s) => s.levelGuid === chest.stashGuid).locked, true);
    assert.equal(sut.api.lockedNow(chest.stashGuid), true);
});

test("an administrator can lock or unlock a property by id, and a door that stood open is shut with the lock", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    assert.equal(sut.api.doorStandsOpen(world.east[1].guid), false, "shut");
    world.east[1].setOpen(true);
    assert.equal(sut.api.doorStandsOpen(world.east[1].guid), true, "the world says it stands open (what F is not offered at)");
    assert.equal(sut.api.doorStandsOpen("00000000deadbeef"), false, "a door nobody knows is not open");

    assert.match(sut.api.setLocked(house.id, true).message, /trancada/);
    assert.equal(sut.api.lockedNow(world.east[0].guid), true);
    assert.equal(world.east[0].locked, true);
    assert.equal(world.east[1].open, false, "a lock is turned on a shut door");
    assert.equal(world.east[1].locked, true, "and it is shut and locked in the game");
    assert.match(sut.api.setLocked(house.id, false).message, /destrancada/);
    assert.equal(sut.api.lockedNow(world.east[0].guid), false);
    assert.equal(world.east[0].locked, false);
    assert.equal(sut.api.setLocked("nope", true).ok, false);
});

test("a door the level has not reported at start takes its lock in the game once it is", () => {
    const door = makeDoor("8000000000000001", { locked: false });
    const seed = { casa: { id: "casa", name: "Casa", region: "Suchdol", kind: "house", doorGuid: "8000000000000001", doors: ["8000000000000001"], keyItem: "kcdc-property:casa", locked: true, keys: 1 } };
    const doors = [];
    const sut = load({ doors, seed });
    sut.api.installProperties();
    assert.ok(sut.logs.some((line) => /1 esperando o nível/.test(line)));
    const retry = sut.intervals[0];

    retry.fn();
    assert.equal(door.locked, false, "still nothing there");
    assert.equal(sut.cleared.length, 0);

    doors.push(door);
    retry.fn();
    assert.equal(door.locked, true);
    assert.equal(sut.cleared.length, 1, "done, so the retrying stops");
    assert.equal(sut.api.lockedNow(door.guid), true, "the lock is the record's all along");
});

test("a property that never turns up is reported after the last try, and left to the sweep", () => {
    const seed = { casa: { id: "casa", name: "Casa", region: "Suchdol", kind: "house", doorGuid: "9000000000000001", doors: ["9000000000000001"], keyItem: "kcdc-property:casa", locked: true, keys: 1 } };
    const sut = load({ doors: [], seed });
    sut.api.installProperties();
    for (let attempt = 0; attempt < 24; attempt += 1) sut.intervals[0].fn();
    assert.equal(sut.cleared.length, 1);
    assert.ok(sut.logs.some((line) => /1 propriedade\(s\) o nível ainda não mostrou/.test(line)));
});

test("the sweep keeps the world in line: a lock the level dropped is put back, a locked door found open is shut, and an open door nobody locked is left", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.setLocked(house.id, true);
    world.west[0].setOpen(true);
    // A door stands open while locked: only behind this server's back (a client out of step).
    const open = world.east[1];
    Object.defineProperty(open, "open", { get: () => true, configurable: true });
    open.setOpen = () => { Object.defineProperty(open, "open", { get: () => false, configurable: true }); return true; };

    const { closed, picked } = sut.api.sweepWorld();
    assert.deepEqual(Array.from(closed), [world.east[1].guid], "opened behind the server's back while locked");
    assert.deepEqual(Array.from(picked), []);
    assert.equal(world.west[0].open, true, "an unlocked door that stands open is left so");
});

test("a lock this server set that the game reports open was picked: the record follows, that door only, and the sweep says which", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.setLocked(house.id, true);
    assert.equal(world.east[0].locked, true);
    // The game's own lockpick worked: the door is unlocked in the world.
    world.east[0].locked = false;
    const { picked } = sut.api.sweepWorld();
    assert.deepEqual(Array.from(picked), [world.east[0].guid]);
    assert.equal(sut.api.lockedNow(world.east[0].guid), false, "it stays open");
    assert.equal(sut.api.lockedNow(world.east[1].guid), true, "the other door of the house is still locked");
    assert.equal(world.east[1].locked, true);
    assert.deepEqual(Array.from(sut.api.sweepWorld().picked), [], "said once");
});

// ---------------------------------------------------------------------------------------------
// Owners, descriptions, regions, and the names a door and a chest show.

test("a chest the census finds inside a house is filed under it, and goes by its own part of the name", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    const chest = find("Casa 01 · Baú 1");
    assert.equal(chest.parentId, house.id);
    assert.equal(sut.api.shortName(chest), "Baú 1");
    assert.equal(sut.api.displayName(chest), "Casa 01 · Baú 1");
    assert.deepEqual(Array.from(sut.api.childrenOf(house.id), (p) => p.id), [chest.id]);
    assert.equal(find("Baú 01").parentId, "", "a chest outdoors has no house");
    assert.equal(sut.api.shortName(find("Baú 01")), "Baú 01");
    assert.equal(sut.saved()[chest.id].parentId, house.id, "and it is kept");
});

test("chests filed before houses had chests under them are linked to the house their name says, once, at start", () => {
    const world = village();
    const first = load(world);
    first.api.mapRegion("suchdol");
    const seed = first.saved();
    for (const record of Object.values(seed)) {
        delete record.parentId;
        delete record.ownerSteamId;
        delete record.description;
    }

    const sut = load({ ...world, seed });
    sut.api.installProperties();
    const chest = Array.from(sut.api.listProperties()).find((p) => p.name === "Casa 01 · Baú 1");
    const house = Array.from(sut.api.listProperties()).find((p) => p.name === "Casa 01");
    assert.equal(chest.parentId, house.id);
    assert.equal(chest.ownerSteamId, "", "no owner, no description: the older records get the defaults");
    assert.equal(chest.description, "");
    assert.equal(sut.saved()[chest.id].parentId, house.id, "and the link is written without waiting for the next change");
    const outdoors = Array.from(sut.api.listProperties()).find((p) => p.name === "Baú 01");
    assert.equal(outdoors.parentId, "");
});

test("handing a house to a player makes them its owner, and hands them no key: they take the ones they want", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 01");
    const chest = find("Casa 01 · Baú 1");
    const hans = makePlayer("10", "Hans");

    const result = sut.api.assignOwner(makePlayer("9", "Mauro"), house.id, hans);
    assert.equal(result.ok, true);
    assert.match(result.message, /Casa 01 agora é de Hans\. Quem o novo dono quiser deixar entrar, escolhe no painel/);
    assert.deepEqual({ ...sut.api.ownerOf(house) }, { steamId: "10", name: "Hans" });
    assert.deepEqual({ ...sut.api.ownerOf(chest) }, { steamId: "10", name: "Hans" }, "a chest has its house's owner");
    assert.equal(sut.addCalls.length, 0, "no key goes with it");
    assert.equal(sut.itemCalls.length, 0, "not even a key type");
    assert.equal(sut.api.lockState(sut.api.getProperty(house.id)), "none", "nor is anything locked for it");
    assert.equal(world.west[0].locked, false);
    assert.deepEqual(Array.from(sut.api.propertiesOwnedBy("10"), (p) => p.id).sort(), [chest.id, house.id].sort());
    assert.deepEqual(Array.from(sut.api.propertiesOwnedBy("11")), []);
    assert.equal(sut.saved()[house.id].ownerSteamId, "10");

    assert.equal(sut.api.assignOwner(makePlayer("9", "Mauro"), house.id, hans).ok, true, "handing it again changes nothing");
    assert.equal(sut.addCalls.length, 0);
});

test("the owner goes by the name the character has, not the account's, and the name follows when the character is renamed", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    const hans = makePlayer("10", "Hans");
    hans.characterName = "Henry II";
    sut.api.assignOwner(makePlayer("9", "Mauro"), house.id, hans);
    assert.deepEqual({ ...sut.api.ownerOf(house) }, { steamId: "10", name: "Henry II" }, "what the door shows is the character's name");
    assert.equal(sut.api.labelFor("1000000000000001"), "Casa 01 - Henry II", "the door says it");

    hans.characterName = "Henry II Capon";
    sut.api.noteNickname(hans);
    assert.equal(sut.api.ownerOf(house).name, "Henry II Capon", "a surname given later is there at the next join");
    assert.equal(sut.saved()[house.id].ownerName, "Henry II Capon");
});

test("a chest in a house cannot be given alone, and a player with no Steam id cannot own anything", () => {
    const { sut, find } = mapped();
    const chest = find("Casa 01 · Baú 1");
    const refused = sut.api.assignOwner(makePlayer("9"), chest.id, makePlayer("10", "Hans"));
    assert.equal(refused.ok, false);
    assert.match(refused.message, /é parte de Casa 01/);

    const anonymous = sut.api.assignOwner(makePlayer("9"), find("Casa 02").id, makePlayer("", "Sem Steam"));
    assert.equal(anonymous.ok, false);
    assert.match(anonymous.message, /identificação Steam/);
    assert.equal(sut.api.assignOwner(makePlayer("9"), "nao-existe", makePlayer("10")).ok, false);
});

test("taking the owner off keeps the keys already handed out", () => {
    const { sut, find } = mapped();
    const house = find("Casa 02");
    const hans = makePlayer("10", "Hans");
    sut.api.assignOwner(makePlayer("9"), house.id, hans);
    sut.api.issueKey(hans, house.id, hans, false);
    const cleared = sut.api.clearOwner(house.id);
    assert.equal(cleared.ok, true);
    assert.match(cleared.message, /deixou de ser de Hans/);
    assert.equal(sut.api.ownerOf(house), null);
    assert.equal(sut.saved()[house.id].ownerSteamId, "");
    assert.equal(sut.api.getProperty(house.id).keys, 1, "the key stays where it is");
    assert.equal(sut.api.clearOwner(house.id).ok, false, "nobody to take off");
    assert.equal(sut.api.clearOwner(find("Casa 01 · Baú 1").id).ok, false, "a chest in a house goes with the house");
});

test("a door and a chest are labelled with the property's name and its owner's, and anything else with nothing", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 01");
    assert.equal(sut.api.labelFor("1000000000000001"), "Casa 01");
    assert.equal(sut.api.labelFor("c000000000000004"), "Casa 01 · Baú 1");
    assert.equal(sut.api.labelFor("c000000000000001"), "Baú 01");
    assert.equal(sut.api.labelFor("1000000000000002"), "", "a door that belongs to no property");
    assert.equal(sut.api.labelFor("deadbeefdeadbeef"), "");

    sut.api.assignOwner(makePlayer("9"), house.id, makePlayer("10", "Hans"));
    assert.equal(sut.api.labelFor("1000000000000001"), "Casa 01 - Hans");
    assert.equal(sut.api.labelFor("c000000000000004"), "Casa 01 · Baú 1 - Hans");
    assert.equal(sut.api.labelFor("c000000000000001"), "Baú 01", "a chest outdoors is its own");

    sut.api.renameProperty(house.id, "Casa do Ferreiro");
    assert.equal(sut.api.labelFor("1000000000000001"), "Casa do Ferreiro - Hans", "the label follows a new name at once");
    assert.equal(sut.api.labelFor("c000000000000004"), "Casa do Ferreiro · Baú 1 - Hans");
    assert.ok(world.doors.length > 0);
});

test("an owner who changed their name is called by the new one, once they spawn", () => {
    const { sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.installProperties();
    sut.api.assignOwner(makePlayer("9"), house.id, makePlayer("10", "Hans"));

    sut.handlers.get("playerSpawned")(makePlayer("10", "Hans Capon"));
    assert.equal(sut.api.ownerOf(house).name, "Hans Capon");
    assert.equal(sut.saved()[house.id].ownerName, "Hans Capon");
    sut.handlers.get("playerSpawned")(makePlayer("11", "Katerina"));
    assert.equal(sut.api.ownerOf(house).name, "Hans Capon", "somebody else's arrival changes nothing");
    assert.doesNotThrow(() => sut.handlers.get("playerSpawned")(makePlayer("", "Sem Steam")));
});

test("an owner makes keys of what is theirs, up to a limit; nobody else does; an administrator is not held to it", () => {
    const { sut, find } = mapped();
    const house = find("Casa 02");
    const admin = makePlayer("9", "Mauro");
    const hans = makePlayer("10", "Hans");
    const kat = makePlayer("11", "Katerina");
    sut.api.assignOwner(admin, house.id, hans);
    assert.equal(sut.api.getProperty(house.id).keys, 0, "the owner is handed none");

    const stranger = sut.api.issueKey(kat, house.id, kat, false);
    assert.equal(stranger.ok, false);
    assert.match(stranger.message, /Só o dono/);

    const toKat = sut.api.issueKey(hans, house.id, kat, false);
    assert.equal(toKat.ok, true);
    assert.match(toKat.message, /com Katerina/);
    assert.equal(sut.addCalls.at(-1).steamId, "11");

    const limit = sut.api.OWNER_KEY_LIMIT;
    while (sut.api.getProperty(house.id).keys < limit) {
        assert.equal(sut.api.issueKey(hans, house.id, hans, false).ok, true);
    }
    const over = sut.api.issueKey(hans, house.id, hans, false);
    assert.equal(over.ok, false);
    assert.match(over.message, /limite/);
    assert.equal(sut.api.getProperty(house.id).keys, limit);

    assert.equal(sut.api.issueKey(admin, house.id, kat, true).ok, true, "the administrator's word is enough");
    assert.equal(sut.api.getProperty(house.id).keys, limit + 1);
    assert.equal(sut.api.issueKey(hans, "nao-existe", hans, false).ok, false);
});

test("renaming a house renames the keys of its chests too, and a name cannot carry the separator", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    sut.api.assignOwner(makePlayer("9"), house.id, makePlayer("10", "Hans"));
    sut.api.grantKey(makePlayer("10", "Hans"), house.id);
    sut.api.grantKey(makePlayer("10", "Hans"), find("Casa 01 · Baú 1").id);
    sut.renamed.length = 0;

    const result = sut.api.renameProperty(house.id, "  Forja  ·  do   Ferreiro ");
    assert.equal(result.ok, true);
    assert.equal(sut.api.getProperty(house.id).name, "Forja - do Ferreiro");
    const keys = Object.fromEntries(Array.from(sut.renamed, (entry) => [entry.item, entry.name]));
    assert.equal(keys[sut.api.getProperty(house.id).keyItem], "Chave: Forja - do Ferreiro");
    assert.equal(keys[sut.api.getProperty(find("Casa 01 · Baú 1").id).keyItem], "Chave: Forja - do Ferreiro · Baú 1");
});

test("a description is kept with its blanks collapsed, may be cleared, and has a limit", () => {
    const { sut, find } = mapped();
    const house = find("Casa 02");
    assert.equal(sut.api.describeProperty(house.id, "  Perto   do\nmoinho  ").ok, true);
    assert.equal(sut.api.getProperty(house.id).description, "Perto do moinho");
    assert.equal(sut.saved()[house.id].description, "Perto do moinho");

    const tooLong = sut.api.describeProperty(house.id, "x".repeat(sut.api.DESCRIPTION_MAX + 1));
    assert.equal(tooLong.ok, false);
    assert.equal(sut.api.getProperty(house.id).description, "Perto do moinho", "a refused text changes nothing");

    assert.equal(sut.api.describeProperty(house.id, "   ").ok, true);
    assert.equal(sut.api.getProperty(house.id).description, "");
    assert.equal(sut.api.describeProperty("nao-existe", "x").ok, false);
});

test("a region is made by naming it: it takes the house's chests along, and a chest in a house cannot leave alone", () => {
    const { sut, find } = mapped();
    assert.deepEqual(Array.from(sut.api.regionNames()), ["Suchdol"]);

    const house = find("Casa 01");
    const moved = sut.api.setRegion(house.id, "  Rabštejn ");
    assert.equal(moved.ok, true);
    assert.match(moved.message, /região Rabštejn \(com 1 baú/);
    assert.equal(find("Casa 01").region, "Rabštejn");
    assert.equal(find("Casa 01 · Baú 1").region, "Rabštejn");
    assert.equal(find("Casa 02").region, "Suchdol");
    assert.deepEqual(Array.from(sut.api.regionNames()), ["Rabštejn", "Suchdol"]);
    assert.equal(sut.saved()[house.id].region, "Rabštejn");

    assert.equal(sut.api.setRegion(find("Casa 01 · Baú 1").id, "Outra").ok, false);
    assert.equal(sut.api.setRegion(house.id, "x").ok, false);
    assert.equal(sut.api.setRegion(house.id, "x".repeat(sut.api.REGION_MAX + 1)).ok, false);
    assert.equal(find("Casa 01").region, "Rabštejn", "a refused name changes nothing");
});

// ---------------------------------------------------------------------------------------------
// Castles: one property for everything inside a fortress's walls.

test("the castle of Suchdol is one property with every door inside its walls, and the chests inside under it", () => {
    const world = village();
    const sut = load(world);
    sut.api.mapRegion("suchdol");

    const report = sut.api.mapCastle("suchdol");
    assert.deepEqual({ ...report }, { region: "Suchdol", name: "Castelo de Suchdol", created: true, doors: 1, chests: 1, absorbed: 0 });
    assert.match(sut.api.describeCastle(report), /^Castelo de Suchdol: criado com 1 porta\(s\); 1 baú\(s\) agora são dele\.$/);

    const castle = Array.from(sut.api.listProperties()).find((p) => p.name === "Castelo de Suchdol");
    assert.equal(castle.kind, "house");
    assert.equal(castle.region, "Suchdol");
    assert.deepEqual(Array.from(castle.doors), ["5000000000000001"]);
    assert.equal(castle.doorGuid, "5000000000000001");
    assert.equal(castle.locked, false, "nothing is locked by mapping");
    assert.equal(castle.keys, 0);
    assert.equal(world.loose.locked, false);

    const tower = Array.from(sut.api.listProperties()).find((p) => p.stashGuid === "c000000000000002");
    assert.equal(tower.parentId, castle.id, "the tower's chest is the castle's now");
    assert.equal(tower.name, "Castelo de Suchdol · Baú 1", "and goes by the castle's name");
    assert.equal(sut.api.displayName(tower), "Castelo de Suchdol · Baú 1");
    assert.deepEqual(Array.from(sut.api.childrenOf(castle.id), (p) => p.id), [tower.id]);
    assert.equal(sut.saved()[castle.id].name, "Castelo de Suchdol", "kept on disk");
});

// ---------------------------------------------------------------------------------------------
// Compounds (2026-10-26): the castle of Pschitoky, its inn, the stud farm of Malešov and the Devil's Den.

const fortressDoor = (guid, x, y) => makeDoor(guid, { x, y, name: "AnimDoor[structures/defensive/fortresses/pritoky_fortress1:Door/door_village_left43[x]]" });
const KORAND = makePlayer("66", "Korand");

/** Pschitoky as the live catalog stood: a house east of the fortress with its chest, the fortress's chests put under it by the tidying, and the old inn region. */
function pschitoky() {
    const fort = [fortressDoor("6000000000000001", 2268, 1808), fortressDoor("6000000000000002", 2262, 1802)];
    const house = makeDoor("6000000000000003", { x: 2291, y: 1781, name: "Door/front[structures/living/houses/house_1s_3r_d_wb14]" });
    const innDoors = [makeDoor("7000000000000001", { x: 2181, y: 1523, name: "Door/front[structures/living/houses/unique/kutna_hora/chmelna/chmelna_12_house1]" }), makeDoor("7000000000000002", { x: 2186, y: 1518, name: "Door/storeroom" }), makeDoor("7000000000000003", { x: 2155, y: 1496, name: "AnimDoor[Door/door_village_right25_x]" })];
    const stashes = [
        makeStash("d000000000000001", { x: 2262, y: 1808 }),
        makeStash("d000000000000002", { x: 2268, y: 1804 }),
        makeStash("d000000000000003", { x: 2288, y: 1785 }),
        makeStash("e000000000000001", { x: 2158, y: 1520 }),
        makeStash("e000000000000002", { x: 2188, y: 1518 }),
        makeStash("e000000000000003", { x: 2152, y: 1496 }),
        makeStash("b000000000000009", { x: 2170, y: 1520, name: "Stash12[Stash/barrel_with_arrows3_x]" }),
    ];
    const areas = [makeArea("p1", "SmartArea[structures/living/houses/house_1s_3r_d_wb14_1]", [[house, "entrance"]], [2285, 2295, 1775, 1790])];
    return { doors: [...fort, house, ...innDoors], stashes, areas, fort, house, innDoors };
}

/** The state the live server had: the village mapped, the tidying done, the old inn region with a house and its chests, Pschitoky ceded to its lord. */
function pschitokyAsItWas(world) {
    const seed = {};
    const base = (id, name, region, kind, extra) => ({ id, name, region, kind, doorGuid: "", doors: [], stashGuid: "", keyItem: "", x: 0, y: 0, z: 0, createdAt: 1, createdBy: "census", auto: true, keys: 0, locked: false, parentId: "", ownerSteamId: "", ownerName: "", description: "", ...extra });
    seed["pschitoky-casa-01"] = base("pschitoky-casa-01", "Casa 01", "Pschitoky", "house", { doorGuid: "6000000000000003", doors: ["6000000000000003"], x: 2291, y: 1781, z: 128, ownerSteamId: "66", ownerName: "Korand", keys: 1, locked: true });
    seed["pschitoky-casa-01-bau-1"] = base("pschitoky-casa-01-bau-1", "Casa 01 · Baú 1", "Pschitoky", "chest", { stashGuid: "d000000000000003", parentId: "pschitoky-casa-01", x: 2288, y: 1785, z: 128 });
    seed["pschitoky-casa-01-bau-3"] = base("pschitoky-casa-01-bau-3", "Casa 01 · Baú 3", "Pschitoky", "chest", { stashGuid: "d000000000000001", parentId: "pschitoky-casa-01", x: 2262, y: 1808, z: 134 });
    seed["pschitoky-casa-01-bau-7"] = base("pschitoky-casa-01-bau-7", "Casa 01 · Baú 7", "Pschitoky", "chest", { stashGuid: "d000000000000002", parentId: "pschitoky-casa-01", x: 2268, y: 1804, z: 134 });
    seed["estalagem-pschitoky-casa-01"] = base("estalagem-pschitoky-casa-01", "Casa 01", "Estalagem de Pschitoky", "house", { doorGuid: "7000000000000001", doors: ["7000000000000001", "7000000000000002"], x: 2181, y: 1523, z: 106 });
    [["e000000000000002", "Baú 5", 2188, 1518], ["e000000000000001", "Baú 8", 2158, 1520], ["e000000000000003", "Baú 6", 2152, 1496]].forEach(([guid, label, x, y], at) => {
        const id = `estalagem-pschitoky-casa-01-bau-${at + 1}`;
        seed[id] = base(id, `Casa 01 · ${label}`, "Estalagem de Pschitoky", "chest", { stashGuid: guid, parentId: "estalagem-pschitoky-casa-01", x, y, z: 111 });
    });
    const sut = load({ ...world, seed });
    return sut;
}

test("Pschitoky has a castle of its own: its doors, and the chests of the fortress taken from the house the tidying had put them under", () => {
    const world = pschitoky();
    const sut = pschitokyAsItWas(world);
    sut.api.cedeRegion(CROWN, "Pschitoky", KORAND);
    assert.equal(sut.api.REGIONS.find((region) => region.id === "pschitoky").fortress.minX, 2240);

    const report = sut.api.mapCastle("pschitoky");
    assert.deepEqual({ ...report }, { region: "Pschitoky", name: "Castelo de Pschitoky", created: true, doors: 2, chests: 2, absorbed: 0 });
    const all = Array.from(sut.api.listProperties());
    const castle = all.find((p) => p.name === "Castelo de Pschitoky");
    assert.deepEqual(Array.from(castle.doors).sort(), ["6000000000000001", "6000000000000002"]);
    assert.equal(castle.ownerSteamId, "66", "the lord of Pschitoky has it, as the rest of the village");
    const fortress = all.filter((p) => p.parentId === castle.id).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(fortress.map((p) => [p.name, p.stashGuid]), [["Castelo de Pschitoky · Baú 1", "d000000000000001"], ["Castelo de Pschitoky · Baú 2", "d000000000000002"]], "west to east, renamed, out of Casa 01");
    assert.equal(sut.api.getProperty("pschitoky-casa-01-bau-1").parentId, "pschitoky-casa-01", "the chest by the house stays the house's");
    assert.equal(sut.api.getProperty("pschitoky-casa-01").locked, true, "and the house is left as it was");

    const again = sut.api.mapCastle("pschitoky");
    assert.deepEqual({ ...again }, { region: "Pschitoky", name: "Castelo de Pschitoky", created: false, doors: 2, chests: 0, absorbed: 0 });
});

test("the inn of Pschitoky is a property of Pschitoky, not a region: its old house and chests are folded into one property, renamed, in the village's region", () => {
    const world = pschitoky();
    const sut = pschitokyAsItWas(world);
    sut.api.cedeRegion(CROWN, "Pschitoky", KORAND);
    assert.deepEqual(Array.from(sut.api.regionNames()).sort(), ["Estalagem de Pschitoky", "Pschitoky"]);

    const reports = sut.api.mapCompounds("pschitoky");
    assert.equal(reports.length, 1);
    assert.deepEqual({ ...reports[0] }, { region: "Pschitoky", name: "Estalagem de Pschitoky", created: true, doors: 3, chests: 3, absorbed: 1 });
    assert.deepEqual(Array.from(sut.api.regionNames()), ["Pschitoky"], "the inn's own region is gone");

    const all = Array.from(sut.api.listProperties());
    const inn = all.find((p) => p.name === "Estalagem de Pschitoky");
    assert.equal(inn.region, "Pschitoky");
    assert.equal(inn.kind, "house");
    assert.deepEqual(Array.from(inn.doors).sort(), ["7000000000000001", "7000000000000002", "7000000000000003"], "every door inside the place, the loose one too");
    assert.equal(inn.ownerSteamId, "66", "the village's lord has it");
    assert.equal(sut.api.getProperty("estalagem-pschitoky-casa-01"), null, "the old house is folded in");
    const chests = all.filter((p) => p.parentId === inn.id).sort((a, b) => a.name.localeCompare(b.name));
    assert.deepEqual(chests.map((p) => [p.name, p.region]), [["Estalagem de Pschitoky · Baú 1", "Pschitoky"], ["Estalagem de Pschitoky · Baú 2", "Pschitoky"], ["Estalagem de Pschitoky · Baú 3", "Pschitoky"]]);
    assert.deepEqual(chests.map((p) => p.stashGuid), ["e000000000000003", "e000000000000001", "e000000000000002"], "west to east");
    assert.ok(chests.every((p) => p.ownerSteamId === ""), "a chest has the property's owner, none of its own");

    const again = sut.api.mapCompounds("pschitoky")[0];
    assert.deepEqual({ ...again }, { region: "Pschitoky", name: "Estalagem de Pschitoky", created: false, doors: 3, chests: 0, absorbed: 0 }, "safe to run again");
    assert.equal(all.filter((p) => p.name === "Estalagem de Pschitoky").length, 1);
});

test("the stud farm of Malešov and the Devil's Den are one property each, from scratch, with every door inside and every chest under it", () => {
    const farm = [makeDoor("8000000000000001", { x: 441, y: 731, z: 115, name: "Door/front[structures/living/houses/house_2s_9r_b1]" }), makeDoor("8000000000000002", { x: 465, y: 733, z: 115, name: "Door/barn[structures/industrial/barns/barn_s2]" }), makeDoor("8000000000000003", { x: 438, y: 743, z: 115, name: "Door/stable[structures/industrial/stables/stable_i3]" })];
    const den = [makeDoor("9000000000000001", { x: 2925, y: 2933, z: 106, name: "AnimDoor[structures/municipal/pubs/unique/certovka/certovka_inn1:Door/a[x]]" }), makeDoor("9000000000000002", { x: 2913, y: 2953, z: 106, name: "AnimDoor[structures/industrial/barns/barn_t_short3:Door/b[x]]" })];
    const elsewhere = makeDoor("a000000000000001", { x: 570, y: 290, z: 111, name: "Door/front[structures/living/houses/house_1s_3r_g1]" });
    const stashes = [
        makeStash("f000000000000001", { x: 442, y: 717 }),
        makeStash("f000000000000002", { x: 470, y: 729 }),
        makeStash("f000000000000003", { x: 2921, y: 2931 }),
        makeStash("f000000000000004", { x: 2857, y: 2974 }),
        makeStash("f000000000000005", { x: 2900, y: 2900, name: "Stash12[Stash/barrel_with_arrows3_x]" }),
        makeStash("f000000000000006", { x: 570, y: 280 }),
    ];
    const sut = load({ doors: [...farm, ...den, elsewhere], stashes, areas: [] });

    const haras = sut.api.mapCompounds("malesov")[0];
    assert.deepEqual({ ...haras }, { region: "Malešov", name: "Haras de Malešov", created: true, doors: 3, chests: 2, absorbed: 0 });
    const toca = sut.api.mapCompounds("minas")[0];
    assert.deepEqual({ ...toca }, { region: "Minas", name: "Toca do Diabo", created: true, doors: 2, chests: 2, absorbed: 0 });
    assert.deepEqual(Array.from(sut.api.mapCompounds("Minas"))[0].created, false, "the name on the map finds the same region again, and nothing is filed twice");

    const all = Array.from(sut.api.listProperties());
    assert.deepEqual(all.filter((p) => p.parentId === "").map((p) => [p.name, p.region, p.kind]).sort(), [["Haras de Malešov", "Malešov", "house"], ["Toca do Diabo", "Minas", "house"]]);
    assert.ok(!all.some((p) => p.stashGuid === "f000000000000006"), "a chest of the village itself is no part of it");

    // The census of Minas has nothing left to file: all of it is the one property's.
    const census = sut.api.mapRegion("minas");
    assert.equal(census.housesAdded + census.chestsAdded + census.looseDoorsAdded, 0);
    assert.equal(sut.api.mapCompounds("wysoka"), null, "a region with no compounds");
    assert.deepEqual(sut.api.mapCompounds("narnia"), null);
});

test("four regions have places of their own (Malešov, Kuttenberg, Pschitoky, Minas), four in all, and the start files them twice, after the castles", () => {
    const sut = load({ doors: [], stashes: [], areas: [] });
    sut.api.installProperties();
    assert.equal(sut.timers.filter((timer) => timer.ms === 30_000).length, 1);
    assert.equal(sut.timers.filter((timer) => timer.ms === 120_000).length, 1);
    const compounds = Array.from(sut.api.REGIONS).filter((region) => region.compounds !== undefined).map((region) => region.id);
    assert.deepEqual(compounds, ["malesov", "kuttenberg", "pschitoky", "grunta"]);
    const places = Array.from(sut.api.REGIONS).flatMap((region) => Array.from(region.compounds ?? [], (compound) => compound.name)).sort();
    assert.deepEqual(places, ["Estalagem de Pschitoky", "Estalagem de Stará Kutná", "Haras de Malešov", "Toca do Diabo"]);
});

test("mapping a castle again adds only what is new: a door and a chest that appear later", () => {
    const world = village();
    const sut = load(world);
    sut.api.mapRegion("suchdol");
    sut.api.mapCastle("suchdol");

    const again = sut.api.mapCastle("suchdol");
    assert.deepEqual({ ...again }, { region: "Suchdol", name: "Castelo de Suchdol", created: false, doors: 1, chests: 0, absorbed: 0 });

    world.doors.push(makeDoor("5000000000000002", { x: 790, y: 3380, name: "AnimDoor[structures/defensive/fortresses/suchdol1:Door/door_hall[x]]" }));
    world.stashes.push(makeStash("c000000000000010", { x: 780, y: 3370 }));
    const later = sut.api.mapCastle("suchdol");
    assert.equal(later.doors, 2);
    assert.equal(later.chests, 1);
    const castle = Array.from(sut.api.listProperties()).find((p) => p.name === "Castelo de Suchdol");
    assert.deepEqual(Array.from(castle.doors).sort(), ["5000000000000001", "5000000000000002"]);
    assert.ok(Array.from(sut.api.listProperties(), (p) => p.name).includes("Castelo de Suchdol · Baú 2"));
    assert.equal(Array.from(sut.api.listProperties()).filter((p) => p.name === "Castelo de Suchdol").length, 1, "never a second castle");
});

test("a chest somebody has named keeps its name when it moves under the castle", () => {
    const sut = load(village());
    sut.api.mapRegion("suchdol");
    const tower = Array.from(sut.api.listProperties()).find((p) => p.stashGuid === "c000000000000002");
    assert.equal(sut.api.renameProperty(tower.id, "Arca do Tesouro").ok, true);

    sut.api.mapCastle("suchdol");
    const moved = sut.api.getProperty(tower.id);
    assert.equal(moved.name, "Arca do Tesouro");
    assert.equal(sut.api.displayName(moved), "Castelo de Suchdol · Arca do Tesouro");
});

test("a cutscene's door inside the walls is never the castle's, and a plain door there is", () => {
    const sut = load(strayDoors());
    const report = sut.api.mapCastle("suchdol");
    const castle = Array.from(sut.api.listProperties()).find((p) => p.name === "Castelo de Suchdol");
    assert.equal(report.doors, 1);
    assert.deepEqual(Array.from(castle.doors), ["a000000000000006"]);
});

test("a door a script or a world file hung (KCDC 1.7.2) is never filed by the census, in a castle or loose: its GUID lasts only until the server stops", () => {
    const withHung = () => {
        const fixture = strayDoors();
        const hung = makeDoor("a000000000000009", { x: 773, y: 3359, name: "spawned_door_1" });
        hung.spawned = true;
        fixture.doors.push(hung);
        return fixture;
    };
    const castleSut = load(withHung());
    castleSut.api.mapCastle("suchdol");
    const castle = Array.from(castleSut.api.listProperties()).find((p) => p.name === "Castelo de Suchdol");
    assert.deepEqual(Array.from(castle.doors), ["a000000000000006"], "the hung door inside the walls is not the castle's");

    const regionSut = load(withHung());
    const report = regionSut.api.mapRegion("suchdol");
    assert.equal(report.looseDoorsSeen, 8, "nor is it a loose door seen");
    assert.ok(!Array.from(regionSut.api.listProperties()).some((p) => Array.from(p.doors).includes("a000000000000009")));
});

/** Raborsch's fortress as the census filed it: loose "Fortaleza" doors, and chests inside the walls. */
function raborschCastle() {
    const doors = [
        makeDoor("d000000000000001", { x: 1421, y: 3852, name: "AnimDoor[structures/defensive/fortresses/ratborz:Door/door_village_left1[x]]" }),
        makeDoor("d000000000000002", { x: 1430, y: 3828, name: "AnimDoor[structures/defensive/fortresses/ratborz:Door/door_village_left2[x]]" }),
        makeDoor("d000000000000003", { x: 1440, y: 3840, name: "AnimDoor[Door/door_village_right3_x]" }),
        makeDoor("d000000000000009", { x: 1600, y: 3900, name: "AnimDoor[Door/door_village_right9_x]" }),
    ];
    const stashes = [makeStash("e000000000000001", { x: 1425, y: 3830 }), makeStash("e000000000000002", { x: 1438, y: 3850 })];
    return { doors, areas: [], stashes };
}

test("in Raborsch the loose doors nobody holds are folded into the castle; a locked one, or one with keys, stays its own", () => {
    const world = raborschCastle();
    const sut = load(world);
    sut.api.mapRegion("raborsch");
    const loose = Array.from(sut.api.listProperties()).filter((p) => p.kind === "door");
    assert.equal(loose.length, 4, "the census filed every loose door, the fortress's included");
    const kept = loose.find((p) => p.doors.includes("d000000000000003"));
    sut.api.setLocked(kept.id, true);

    const report = sut.api.mapCastle("raborsch");
    assert.equal(report.created, true);
    assert.equal(report.absorbed, 2, "the two fortress doors nobody locked");
    assert.equal(report.doors, 2);
    assert.equal(report.chests, 2);
    const castle = Array.from(sut.api.listProperties()).find((p) => p.name === "Castelo de Raborsch");
    assert.deepEqual(Array.from(castle.doors).sort(), ["d000000000000001", "d000000000000002"]);
    assert.ok(sut.api.getProperty(kept.id), "the locked door is still its own property");
    assert.ok(!castle.doors.includes("d000000000000003"));
    assert.ok(Array.from(sut.api.listProperties()).some((p) => p.doors.includes("d000000000000009") && p.kind === "door"), "a door outside the walls is not touched");
    assert.equal(Array.from(sut.api.listProperties()).filter((p) => p.parentId === castle.id).length, 2);
    assert.match(sut.api.describeCastle(report), /2 porta\(s\) soltas foram juntadas a ele/);
});

test("a region with no walls, or no region at all, has no castle", () => {
    const sut = load(village());
    assert.equal(sut.api.mapCastle("wysoka"), null);
    assert.equal(sut.api.mapCastle("narnia"), null);
});

test("walls with no door the level has told about yet make no castle", () => {
    const sut = load({ doors: [], areas: [], stashes: [] });
    const report = sut.api.mapCastle("suchdol");
    assert.equal(report.doors, 0);
    assert.equal(report.created, false);
    assert.ok(!Array.from(sut.api.listProperties()).some((p) => p.name === "Castelo de Suchdol"));
});

test("at start the castles are mapped by themselves, after the census, and again later", () => {
    const sut = load(village());
    sut.api.installProperties();
    const census = sut.timers.find((timer) => timer.ms === 20_000);
    const castles = sut.timers.filter((timer) => timer.ms === 30_000 || timer.ms === 120_000);
    assert.equal(castles.length, 2);

    census.fn();
    castles[0].fn();
    assert.ok(Array.from(sut.api.listProperties(), (p) => p.name).includes("Castelo de Suchdol"));
    assert.ok(sut.logs.some((line) => /Castelo de Suchdol: criado com 1 porta/.test(line)));

    const lines = sut.logs.length;
    castles[1].fn();
    assert.equal(sut.logs.length, lines, "nothing new later: nothing written");
});

test("a chest inside the walls that has keys out, or an owner, stays its own", () => {
    const sut = load(village());
    sut.api.mapRegion("suchdol");
    const tower = Array.from(sut.api.listProperties()).find((p) => p.stashGuid === "c000000000000002");
    sut.api.grantKey(makePlayer("9"), tower.id);

    const report = sut.api.mapCastle("suchdol");
    assert.equal(report.chests, 0);
    assert.equal(sut.api.getProperty(tower.id).parentId, "");
    assert.equal(sut.api.getProperty(tower.id).name, "Baú 02 (Torre)");
});

// ---------------------------------------------------------------------------------------------
// Vendors' houses.

test("a house kept for a vendor is named for them while it has the census's name, says whose it is, and is never a player's", () => {
    const { sut, find } = mapped();
    const house = find("Casa 01");
    const chest = find("Casa 01 · Baú 1");

    assert.equal(sut.api.reserveForNpc(house.id, "Mestre Ferreiro", "Casa do Ferreiro"), true);
    assert.equal(sut.api.getProperty(house.id).name, "Casa do Ferreiro");
    assert.equal(sut.api.npcOf(sut.api.getProperty(house.id)), "Mestre Ferreiro");
    assert.equal(sut.api.npcOf(sut.api.getProperty(chest.id)), "Mestre Ferreiro", "a chest is its house's");
    assert.equal(sut.api.displayName(sut.api.getProperty(chest.id)), "Casa do Ferreiro · Baú 1");
    assert.equal(sut.saved()[house.id].npc, "Mestre Ferreiro", "kept on disk");
    assert.equal(sut.api.reserveForNpc(house.id, "Mestre Ferreiro", "Casa do Ferreiro"), false, "nothing to change the second time");

    const refused = sut.api.assignOwner(makePlayer("9", "Mauro"), house.id, makePlayer("10", "Hans"));
    assert.equal(refused.ok, false);
    assert.match(refused.message, /Casa do Ferreiro é a casa de Mestre Ferreiro \(NPC\)/);
    assert.equal(sut.api.ownerOf(sut.api.getProperty(house.id)), null);
});

test("a house somebody has named keeps its name when a vendor moves in", () => {
    const { sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.renameProperty(house.id, "Casa Azul");
    sut.api.reserveForNpc(house.id, "Boticário", "Casa do Boticário");
    assert.equal(sut.api.getProperty(house.id).name, "Casa Azul");
    assert.equal(sut.api.getProperty(house.id).npc, "Boticário");
});

test("the houses of vendors who are gone, or live elsewhere now, go back to the catalog", () => {
    const { sut, find } = mapped();
    const kept = find("Casa 01");
    const left = find("Casa 02");
    sut.api.reserveForNpc(kept.id, "Mestre Ferreiro", "Casa do Ferreiro");
    sut.api.reserveForNpc(left.id, "Radek, o ferreiro", "Casa do Ferreiro");

    assert.equal(sut.api.releaseNpcHomes(new Set([kept.id])), 1);
    assert.equal(sut.api.getProperty(left.id).npc, undefined);
    assert.equal(sut.api.getProperty(kept.id).npc, "Mestre Ferreiro");
    assert.equal(sut.api.assignOwner(makePlayer("9", "Mauro"), left.id, makePlayer("10", "Hans")).ok, true, "free to be given again");
    assert.equal(sut.api.releaseNpcHomes(new Set([kept.id])), 0);
});

// ---------------------------------------------------------------------------------------------
// Who locked it, and one door of a house at a time.

const D1 = "dddd000000000001";
const D2 = "dddd000000000002";
const D3 = "dddd000000000003";

function record(over) {
    return { id: "casa-grande", name: "Casa Grande", region: "Suchdol", kind: "house", doorGuid: D1, doors: [D1, D2, D3], stashGuid: "", keyItem: "", x: 1, y: 2, z: 3, createdAt: 1, createdBy: "census", auto: true, keys: 0, locked: false, parentId: "", ownerSteamId: "9", ownerName: "Hans", description: "", ...over };
}

function castle(over = {}, doorOver = {}) {
    const doors = [makeDoor(D1, doorOver), makeDoor(D2, doorOver), makeDoor(D3, doorOver)];
    const stash = makeStash("c000000000000001");
    const seed = { "casa-grande": record(over), "casa-grande-bau-1": record({ id: "casa-grande-bau-1", name: "Casa Grande · Baú 1", kind: "chest", doorGuid: "", doors: [], stashGuid: stash.levelGuid, parentId: "casa-grande" }) };
    const sut = load({ doors, stashes: [stash], seed });
    return { sut, doors, stash };
}

test("a property's lock is the level's until somebody sets one; what the game opens there is the game's", () => {
    const { sut, doors, stash } = castle({}, { locked: true });
    sut.api.sweepWorld();
    assert.deepEqual(doors.map((door) => door.locked), [true, true, true], "left as the level built them");
    assert.equal(sut.api.lockedNow(D1), true, "locked as the level built it");
    assert.equal(sut.api.lockedNow(stash.levelGuid), false, "a chest the level built unlocked");
    assert.equal(sut.api.lockedNow("nao-existe"), null);

    // A level key, a lockpick, a bolt drawn from inside: the game opened it, and the server reads it so.
    doors[1].locked = false;
    sut.api.unlockPart(D2);
    assert.equal(sut.api.lockedNow(D2), false);
    assert.equal(sut.api.lockState(sut.api.getProperty("casa-grande")), "part");
    assert.equal(sut.api.getProperty("casa-grande").lockSet, undefined, "nothing written down: a restart shuts it again, as the level would");
    assert.deepEqual(Array.from(sut.api.sweepWorld().picked), [], "the level's own lock, opened in the game, is no pick");

    sut.api.setLocked("casa-grande", false);
    assert.equal(sut.api.getProperty("casa-grande").lockSet, true, "set on purpose: the record decides from now on");
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, false, false]);
    sut.api.unlockPart(D3);
    sut.api.setDoorLocked("casa-grande", 2, true);
    sut.api.unlockPart(D3);
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, false, false], "forcing a door of a record's house is written to it");
    assert.equal(sut.saved()["casa-grande"].locked, false);
});

test("the doors of a house are named and counted like its chests: the entrance, then Porta 2, Porta 3", () => {
    const { sut, doors } = castle();
    const house = sut.api.getProperty("casa-grande");
    assert.deepEqual(Array.from(sut.api.doorLines(house), (line) => line.name), ["Entrada", "Porta 2", "Porta 3"]);
    doors[1].locked = true;
    assert.deepEqual(Array.from(sut.api.doorLines(house), (line) => line.locked), [false, true, false], "a house nobody locked on purpose reads as the level has it");
    doors[1].locked = false;
    sut.api.setDoorLocked("casa-grande", 1, true);
    assert.deepEqual(Array.from(sut.api.doorLines(sut.api.getProperty("casa-grande")), (line) => line.locked), [false, true, false], "as the server keeps them");
    assert.equal(sut.api.doorName(house, 0), "Entrada");
    assert.equal(sut.api.doorIndexOf(house, D3), 2);
    assert.equal(sut.api.doorIndexOf(house, "x"), -1);
    assert.equal(sut.api.labelFor(D2), "Casa Grande · Porta 2 - Hans", "the prompt at a door says which door it is");
    assert.equal(sut.api.labelFor(D1), "Casa Grande · Entrada - Hans");
});

test("a door the census filed on its own says what it is and what it stands by, so a list tells a gate from a house door", () => {
    const LOOSE = "e100000000000001";
    const GATE = "e100000000000002";
    const FAR = "e100000000000003";
    const doors = [
        makeDoor(D1, { x: 100, y: 100 }),
        makeDoor(LOOSE, { x: 103, y: 100, name: "AnimDoor[Door/door_village_right60_242162d7]" }),
        makeDoor(GATE, { x: 130, y: 100, name: "AnimDoor[structures/farm/fence_gate_01:Door/gate_wood02[x]]" }),
        makeDoor(FAR, { x: 900, y: 900, name: "AnimDoor[structures/industrial/barns/barn_r4:Door/door_village_right1[x]]" }),
    ];
    const plain = (id, name, guid) => record({ id, name, kind: "door", doorGuid: guid, doors: [guid], ownerSteamId: "", ownerName: "", x: doors.find((d) => d.guid === guid).position.x, y: doors.find((d) => d.guid === guid).position.y });
    const seed = {
        "casa-06": record({ id: "casa-06", name: "Casa 06", doorGuid: D1, doors: [D1], x: 100, y: 100, ownerSteamId: "", ownerName: "" }),
        "celeiro-01": record({ id: "celeiro-01", name: "Celeiro 01", doorGuid: D2, doors: [D2], x: 150, y: 100, ownerSteamId: "", ownerName: "" }),
        "porta-08": plain("porta-08", "Porta 08", LOOSE),
        "porta-09": plain("porta-09", "Porta 09", GATE),
        "porta-10": plain("porta-10", "Porta 10", FAR),
    };
    const sut = load({ doors, seed });
    const named = (id) => sut.api.displayName(sut.api.getProperty(id));
    assert.equal(named("porta-08"), "Porta 08 (junto da Casa 06)", "a plain village door: only what it stands by");
    assert.equal(named("porta-09"), "Porta 09 (portão, a 20 m do Celeiro 01)", "a gate by the level's own word, the nearest building, with its article");
    assert.equal(named("porta-10"), "Porta 10 (celeiro)", "nothing within eighty metres to stand by, and the word the level gives");
    assert.equal(named("casa-06"), "Casa 06", "a house is called what it is");
    assert.equal(sut.api.labelFor(LOOSE), "Porta 08 (junto da Casa 06)", "the prompt at the door says it too");
    assert.equal(sut.api.doorWordOf("AnimDoor[x:Door/toilet_door_1]"), "latrina");
    assert.equal(sut.api.doorWordOf("AnimDoor[x:Door/door_village_left12]"), "");
});

test("a house of one door is called by its own name, with no door named under it", () => {
    const sut = load({ doors: [makeDoor(D1)], seed: { casa: record({ id: "casa", name: "Casa 01", doorGuid: D1, doors: [D1] }) } });
    assert.equal(sut.api.labelFor(D1), "Casa 01 - Hans");
});

test("one door is locked on its own, the others stay as they were, and the property reads as partly shut", () => {
    const { sut, doors } = castle();
    const result = sut.api.setDoorLocked("casa-grande", 1, true);
    assert.equal(result.ok, true);
    assert.match(result.message, /Porta 2 de Casa Grande: trancada/);
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, true, false]);
    assert.deepEqual(doors.map((door) => door.locked), [false, true, false], "locked in the game as in the record");

    const house = sut.api.getProperty("casa-grande");
    assert.equal(house.locked, false, "the whole is not shut");
    assert.equal(sut.api.lockState(house), "part");
    assert.deepEqual(sut.saved()["casa-grande"].doorLocks, { [D1]: false, [D2]: true, [D3]: false }, "kept, so a restart puts it back");
    assert.equal(sut.itemCalls.length, 0, "a lock needs no key type");

    sut.api.setDoorLocked("casa-grande", 0, true);
    sut.api.setDoorLocked("casa-grande", 2, true);
    assert.equal(sut.api.getProperty("casa-grande").locked, true, "every door shut is the property shut");
    assert.equal(sut.api.lockState(sut.api.getProperty("casa-grande")), "all");
    assert.equal(sut.saved()["casa-grande"].doorLocks, undefined, "alike again: no marks to keep");

    sut.api.setDoorLocked("casa-grande", 1, false);
    assert.equal(sut.api.getProperty("casa-grande").locked, false);
    assert.equal(sut.api.lockState(sut.api.getProperty("casa-grande")), "part");
});

test("a door that is not there, and a property that is not there, are told so", () => {
    const { sut } = castle();
    assert.match(sut.api.setDoorLocked("casa-grande", 7, true).message, /Essa porta não existe/);
    assert.match(sut.api.setDoorLocked("casa-grande", -1, true).message, /Essa porta não existe/);
    assert.match(sut.api.setDoorLocked("nada", 0, true).message, /Propriedade não encontrada/);
    assert.equal(sut.api.setDoorLocked("nada", 0, true).ok, false);
});

test("locking or unlocking the whole property clears the marks of the doors, and a key out changes nothing", () => {
    const { sut, doors } = castle();
    sut.api.setDoorLocked("casa-grande", 1, true);
    sut.api.setLocked("casa-grande", false);
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, false, false]);
    assert.equal(sut.saved()["casa-grande"].doorLocks, undefined);

    sut.api.setDoorLocked("casa-grande", 2, true);
    assert.equal(sut.api.grantKey(makePlayer("9", "Hans"), "casa-grande").ok, true);
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, false, true], "a key is just a key");
    assert.deepEqual(doors.map((door) => door.locked), [false, false, true]);
});

test("at start each door keeps its own mark, and a house kept shut only by a door is not forgotten", () => {
    const first = castle();
    first.sut.api.setDoorLocked("casa-grande", 1, true);
    const seed = first.sut.saved();

    const doors = [makeDoor(D1), makeDoor(D2), makeDoor(D3)];
    const sut = load({ doors, stashes: [makeStash("c000000000000001")], seed });
    sut.api.installProperties();
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, true, false]);
    assert.deepEqual(doors.map((door) => door.locked), [false, true, false], "and in the game");
    assert.ok(sut.logs.some((line) => /1 com tranca posta à mão/.test(line)), sut.logs.join(" | "));
});

test("marks that do not fit the doors are dropped when the file is read: stale guids, or marks that are all alike", () => {
    const stale = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(D3)], seed: { "casa-grande": record({ doorLocks: { [D1]: true, "outra": false } }) } });
    assert.equal(stale.api.getProperty("casa-grande").doorLocks, undefined);
    const alike = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(D3)], seed: { "casa-grande": record({ doorLocks: { [D1]: true, [D2]: true, [D3]: true } }) } });
    assert.equal(alike.api.getProperty("casa-grande").doorLocks, undefined);
    const fine = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(D3)], seed: { "casa-grande": record({ doorLocks: { [D1]: true, [D2]: false, [D3]: false } }) } });
    assert.deepEqual({ ...fine.api.getProperty("casa-grande").doorLocks }, { [D1]: true, [D2]: false, [D3]: false });
});

// ---------------------------------------------------------------------------------------------
// A region ceded whole.

function region(over = {}) {
    const unowned = (id, name, extra = {}) => record({ id, name, doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", ...extra });
    const seed = {
        "casa-01": unowned("casa-01", "Casa 01"),
        "casa-01-bau-1": unowned("casa-01-bau-1", "Casa 01 · Baú 1", { kind: "chest", parentId: "casa-01" }),
        "casa-01-bau-2": unowned("casa-01-bau-2", "Casa 01 · Baú 2", { kind: "chest", parentId: "casa-01" }),
        "casa-02": unowned("casa-02", "Casa 02", { ownerSteamId: "77", ownerName: "Hans" }),
        "casa-03": unowned("casa-03", "Casa do Ferreiro", { npc: "Mestre Ferreiro" }),
        "casa-03-bau-1": unowned("casa-03-bau-1", "Casa do Ferreiro · Baú 1", { kind: "chest", parentId: "casa-03" }),
        "casa-04": unowned("casa-04", "Casa 04"),
        "wysoka-01": unowned("wysoka-01", "Casa 01", { region: "Wysoka" }),
        ...over,
    };
    return load({ seed });
}

const LORD = makePlayer("55", "Radovan");
const CROWN = makePlayer("1", "Mauro");

test("what a region would give is counted without changing anything: the free houses and their chests, the vendors' homes, what others own", () => {
    const sut = region();
    const would = sut.api.previewRegion("Suchdol", "55");
    assert.deepEqual({ ...would }, { given: 2, chests: 2, npc: 1, kept: 1 });
    assert.equal(sut.api.getProperty("casa-01").ownerSteamId, "");
    assert.equal(sut.files.has("playerdata/regions.json"), false);
    assert.deepEqual({ ...sut.api.previewRegion("Suchdol", "77") }, { given: 2, chests: 2, npc: 1, kept: 0 }, "what the lord already holds is not 'kept from' them");
});

test("a region is named without minding accents or case, and an unknown one is none", () => {
    const sut = region();
    assert.equal(sut.api.regionNamed("suchdol"), "Suchdol");
    assert.equal(sut.api.regionNamed("  WYSOKA "), "Wysoka");
    assert.equal(sut.api.regionNamed("Praga"), null);
    assert.equal(sut.api.regionNamed(""), null);
});

test("ceding a region makes the player the owner of what nobody owned, leaves the vendors' homes and what others own, and keeps the lord", () => {
    const sut = region();
    const report = sut.api.cedeRegion(CROWN, "suchdol", LORD);
    assert.equal(report.ok, true);
    assert.deepEqual([report.given, report.chests, report.npc, report.kept], [2, 2, 1, 1]);
    assert.match(report.message, /Suchdol agora é de Radovan: 2 propriedades \(e 2 baús\); 1 casa de NPC continua dos moradores; 1 já tinha dono e não mudou\./);

    assert.equal(sut.api.getProperty("casa-01").ownerSteamId, "55");
    assert.equal(sut.api.getProperty("casa-04").ownerName, "Radovan");
    assert.equal(sut.api.ownerOf(sut.api.getProperty("casa-01-bau-1")).steamId, "55", "a chest is its house's");
    assert.equal(sut.api.getProperty("casa-02").ownerSteamId, "77", "what somebody owns stays theirs");
    assert.equal(sut.api.getProperty("casa-03").ownerSteamId, "", "a vendor's house is never given");
    assert.equal(sut.api.getProperty("wysoka-01").ownerSteamId, "", "another region is untouched");

    assert.equal(sut.api.regionLordOf("Suchdol").steamId, "55");
    assert.equal(sut.api.regionLordOf("Suchdol").by, "Mauro");
    assert.equal(sut.api.regionLordOf("Wysoka"), null);
    assert.deepEqual(Array.from(sut.api.regionsLordedBy("55")), ["Suchdol"]);
    assert.equal(JSON.parse(sut.files.get("playerdata/regions.json")).Suchdol.steamId, "55");
    assert.equal(sut.saved()["casa-01"].ownerSteamId, "55", "kept on disk");
    assert.equal(sut.itemCalls.length, 0, "no key type is made for each of them: an owner needs none");
});

test("what the lord does not own in their region is listed to them as the domain, to be read and not touched", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    const domain = Array.from(sut.api.domainOf("55"), (property) => property.id).sort();
    assert.deepEqual(domain, ["casa-02", "casa-03", "casa-03-bau-1"], "somebody else's house and the vendor's, with its chest; never the lord's own, never another region's");
    assert.deepEqual(Array.from(sut.api.domainOf("77"), (property) => property.id), [], "a player who holds no region has no domain");

    // The server refuses what the page does not offer.
    assert.equal(sut.api.assignOwner(CROWN, "casa-03", makePlayer("66", "Hans")).ok, false, "a vendor's house is not given");
    assert.match(sut.api.assignOwner(CROWN, "casa-03", makePlayer("66", "Hans")).message, /é a casa de Mestre Ferreiro \(NPC\)/);
});

test("a lord takes back a house of their region whose owner has not entered for seven days; before that, and for anybody else's region, it is refused (2026-11-02)", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    const DAY = 24 * 60 * 60_000;
    const now = 100 * DAY;
    // casa-02 is Hans's (77): seen five days ago, then nine.
    let seen = { 77: now - 5 * DAY };
    const seenAt = (steamId) => seen[steamId] ?? null;
    const early = sut.api.reclaimHouse(LORD, "casa-02", seenAt, now);
    assert.equal(early.ok, false);
    assert.match(early.message, /entrou há 5 dias: você só retoma .* depois de 7 dias sem .* entrar\. Antes disso, só um administrador\./);
    assert.equal(sut.api.getProperty("casa-02").ownerSteamId, "77");

    assert.equal(sut.api.reclaimHouse(makePlayer("88", "Outro"), "casa-02", () => null, now).ok, false, "not a lord of Suchdol");
    assert.match(sut.api.reclaimHouse(LORD, "casa-03", seenAt, now).message, /\(NPC\)/, "a vendor's house is never taken");
    assert.match(sut.api.reclaimHouse(LORD, "casa-01", seenAt, now).message, /já é sua/);

    seen = { 77: now - 9 * DAY };
    const taken = sut.api.reclaimHouse(LORD, "casa-02", seenAt, now);
    assert.equal(taken.ok, true);
    assert.match(taken.message, /voltou para as suas mãos: .* não entrava havia 9 dias/);
    assert.equal(sut.api.getProperty("casa-02").ownerSteamId, "55", "the lord's now");
    assert.equal(sut.api.getProperty("casa-02").ownerName, "Radovan");
    assert.equal(sut.saved()["casa-02"].ownerSteamId, "55", "kept on disk");
    assert.ok(!Array.from(sut.api.domainOf("55"), (property) => property.id).includes("casa-02"), "off the domain: it is theirs");

    // One with no character at all is long gone.
    assert.equal(sut.api.daysAway(null, now), 999);
    assert.equal(sut.api.daysAway(now - 36 * 60 * 60_000, now), 1);
});

test("a player's lands for the hierarchy: by region, their houses and chests, and the regions held whole", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.landSummary("55"))), [{ region: "Suchdol", houses: 2, chests: 2, whole: true }]);
    sut.api.assignOwner(CROWN, "wysoka-01", LORD);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.landSummary("55"))), [{ region: "Suchdol", houses: 2, chests: 2, whole: true }, { region: "Wysoka", houses: 1, chests: 0, whole: false }]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.landSummary("77"))), [{ region: "Suchdol", houses: 1, chests: 0, whole: false }]);
    assert.deepEqual(Array.from(sut.api.landSummary("")), []);
});

test("a region that a lord holds whole takes in what a census finds later, and a lord who left keeps their name current", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    assert.equal(sut.api.adoptForLord("Wysoka"), 0, "no lord, nothing to adopt");
    assert.equal(sut.api.adoptForLord("Suchdol"), 0, "nothing new yet");

    // The census files a house that was not there.
    sut.api.getProperty("casa-04").ownerSteamId = "";
    assert.equal(sut.api.adoptForLord("Suchdol"), 1);
    assert.equal(sut.api.getProperty("casa-04").ownerSteamId, "55");

    sut.api.noteNickname({ steamId: "55", nickname: "Radovan Novo" });
    assert.equal(sut.api.regionLordOf("Suchdol").name, "Radovan Novo");
    assert.equal(sut.api.getProperty("casa-04").ownerName, "Radovan Novo");
});

test("removing the lord of a region takes the region and the properties the lord holds in it; what others own there, and what the lord owns elsewhere, stays (2026-10-28)", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    sut.api.assignOwner(CROWN, "wysoka-01", LORD);
    const owner = (id) => sut.api.getProperty(id).ownerSteamId;
    assert.deepEqual([owner("casa-01"), owner("casa-04"), owner("casa-02"), owner("wysoka-01")], ["55", "55", "77", "55"]);

    const would = sut.api.previewRelease("Suchdol");
    assert.deepEqual([would.lord.steamId, would.released, would.kept], ["55", 2, 1], "counted first: two houses are the lord's, Hans's one is not");
    assert.equal(owner("casa-01"), "55", "and counting changes nothing");
    assert.equal(sut.api.regionLordOf("Suchdol").steamId, "55");

    const report = sut.api.releaseRegion("suchdol");
    assert.equal(report.ok, true);
    assert.equal(report.lord.steamId, "55");
    assert.deepEqual([report.released, report.kept], [2, 1]);
    assert.equal(report.message, "Suchdol deixou de ser de Radovan: 2 propriedade(s) dele ficaram sem dono e 1 de outros donos continuam.");

    assert.deepEqual([owner("casa-01"), owner("casa-04")], ["", ""], "what the lord held in the region goes back to nobody");
    assert.equal(sut.api.getProperty("casa-04").ownerName, "");
    assert.equal(sut.api.ownerOf(sut.api.getProperty("casa-01")), null);
    assert.equal(sut.api.ownerOf(sut.api.getProperty("casa-01-bau-1")), null, "a chest follows its house");
    assert.equal(owner("casa-02"), "77", "what somebody else owns there stays theirs");
    assert.equal(owner("casa-03"), "", "the vendor's house was never anybody's");
    assert.equal(owner("wysoka-01"), "55", "and what the lord owns in another region is not touched");
    assert.equal(sut.saved()["casa-01"].ownerSteamId, "", "kept on disk");
    assert.equal(sut.saved()["casa-02"].ownerSteamId, "77");

    assert.equal(sut.api.regionLordOf("Suchdol"), null);
    assert.deepEqual(Array.from(sut.api.regionsLordedBy("55")), []);
    assert.equal(JSON.parse(sut.files.get("playerdata/regions.json")).Suchdol, undefined, "and the file says so");
    assert.deepEqual(Array.from(sut.api.domainOf("55")), [], "nothing is left in their domain to look at");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.landSummary("55"))), [{ region: "Wysoka", houses: 1, chests: 0, whole: false }], "only what they own elsewhere is left of their lands");

    // What the census finds later goes to nobody now.
    assert.equal(sut.api.adoptForLord("Suchdol"), 0);
    assert.equal(owner("casa-04"), "");
});

test("a lord that holds nothing in the region just loses the region, and a region with no lord has nothing to release (the administrator's test of 2026-10-28)", () => {
    const sut = region();
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    sut.api.clearOwner("casa-01");
    sut.api.clearOwner("casa-04");
    const report = sut.api.releaseRegion("Suchdol");
    assert.deepEqual([report.ok, report.released, report.kept], [true, 0, 1]);

    // The way out of the case that came first: a region left without a lord with a hundred properties in the administrator's name is ceded
    // to them again and released at once.
    const mess = region();
    mess.api.cedeRegion(CROWN, "Suchdol", CROWN);
    assert.equal(mess.api.getProperty("casa-01").ownerSteamId, "1");
    const first = mess.api.releaseRegion("Suchdol");
    assert.deepEqual([first.released, first.kept], [2, 1]);
    assert.equal(mess.api.getProperty("casa-01").ownerSteamId, "");
});

test("a region with no lord, or that is none, is told and nothing is written", () => {
    const sut = region();
    const none = sut.api.releaseRegion("Suchdol");
    assert.deepEqual([none.ok, none.lord, none.released, none.kept], [false, null, 0, 0]);
    assert.equal(none.message, "Suchdol não tem senhor.");
    assert.match(sut.api.releaseRegion("Praga").message, /Não conheço a região 'Praga'/);
    assert.equal(sut.files.has("playerdata/regions.json"), false);

    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    sut.api.releaseRegion("Suchdol");
    assert.equal(sut.api.releaseRegion("Suchdol").ok, false, "a second time there is nobody to remove");
    // Another region's lord is not touched.
    sut.api.cedeRegion(CROWN, "Wysoka", LORD);
    sut.api.releaseRegion("Suchdol");
    assert.equal(sut.api.regionLordOf("Wysoka").steamId, "55");
});

test("a region that is none, a player with no Steam id and a second lord are told or handled", () => {
    const sut = region();
    assert.equal(sut.api.cedeRegion(CROWN, "Praga", LORD).ok, false);
    assert.match(sut.api.cedeRegion(CROWN, "Praga", LORD).message, /Não conheço a região 'Praga'/);
    assert.equal(sut.api.cedeRegion(CROWN, "Suchdol", makePlayer("", "Sem Steam")).ok, false);
    assert.equal(sut.api.regionLordOf("Suchdol"), null);

    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    const second = makePlayer("56", "Katerina");
    const again = sut.api.cedeRegion(CROWN, "Suchdol", second);
    assert.equal(again.ok, true);
    assert.deepEqual([again.given, again.kept], [0, 3], "what the first lord owns is theirs now: it stays");
    assert.equal(sut.api.regionLordOf("Suchdol").steamId, "56", "the title of the region passes on");
    assert.deepEqual(Array.from(sut.api.regionsLordedBy("55")), []);
});

// ---------------------------------------------------------------------------------------------
// A key to one door of a house.

test("a key to one door is its own item, made the first time and kept: it opens that door and none of the others", () => {
    const { sut } = castle({ ownerSteamId: "10", ownerName: "Hans" });
    const hans = makePlayer("10", "Hans");
    const kat = makePlayer("11", "Katerina");

    const first = sut.api.issueDoorKey(hans, "casa-grande", 1, kat, false);
    assert.equal(first.ok, true, first.message);
    assert.match(first.message, /Porta 2 de Casa Grande com Katerina: abre só essa porta/);
    const house = sut.api.getProperty("casa-grande");
    const item = house.doorKeys[D2];
    assert.equal(item, "kcdc-property:casa-grande:door2");
    assert.notEqual(item, house.keyItem, "not the house's key");
    assert.deepEqual(sut.addCalls.at(-1), { steamId: "11", item, amount: 1 });
    assert.equal(house.keys, 1, "it counts as a key made");
    assert.equal(sut.saved()["casa-grande"].doorKeys[D2], item, "and is kept on disk");

    sut.api.issueDoorKey(hans, "casa-grande", 1, kat, false);
    assert.equal(sut.itemCalls.filter((call) => call.id === "kcdc-property:casa-grande:door2").length, 1, "made once, not each time");

    assert.equal(sut.api.holdsKeyOf(kat, house, D2), true, "the door's key opens that door");
    assert.equal(sut.api.holdsKeyOf(kat, house, D1), false, "not the entrance");
    assert.equal(sut.api.holdsKeyOf(kat, house, D3), false, "nor the other door");
    assert.equal(sut.api.holdsKeyOf(kat, house), false, "and it is no key to the house as a whole");
    assert.equal(sut.api.holdsKeyOf(kat, sut.api.getProperty("casa-grande-bau-1"), D2), false, "nor to the chest");
});

test("a door key follows the same rules as a house key: the owner or an administrator, the limit counted together, a door that is there", () => {
    const { sut } = castle({ ownerSteamId: "10", ownerName: "Hans" });
    const hans = makePlayer("10", "Hans");
    const kat = makePlayer("11", "Katerina");
    const admin = makePlayer("9", "Mauro");

    const stranger = sut.api.issueDoorKey(kat, "casa-grande", 0, kat, false);
    assert.equal(stranger.ok, false);
    assert.match(stranger.message, /Só o dono/);
    assert.equal(sut.api.issueDoorKey(hans, "casa-grande", 7, kat, false).ok, false, "no such door");
    assert.equal(sut.api.issueDoorKey(hans, "casa-grande", -1, kat, false).ok, false);
    assert.equal(sut.api.issueDoorKey(hans, "casa-grande", 0.5, kat, false).ok, false);
    assert.equal(sut.api.issueDoorKey(hans, "nao-existe", 0, kat, false).ok, false);
    assert.equal(sut.api.issueDoorKey(hans, "casa-grande-bau-1", 0, kat, false).ok, false, "a chest has no doors");

    // 8 keys, the house's and the doors' together.
    for (let n = 0; n < 4; n += 1) sut.api.issueKey(hans, "casa-grande", hans, false);
    for (let n = 0; n < 4; n += 1) assert.equal(sut.api.issueDoorKey(hans, "casa-grande", n % 3, hans, false).ok, true);
    const over = sut.api.issueDoorKey(hans, "casa-grande", 0, hans, false);
    assert.equal(over.ok, false);
    assert.match(over.message, /limite/);
    assert.equal(sut.api.issueDoorKey(admin, "casa-grande", 0, kat, true).ok, true, "the administrator's word is enough");
});

test("the keys of single doors are made again at every start, as the house keys are", () => {
    const first = castle({ ownerSteamId: "10", ownerName: "Hans" });
    first.sut.api.issueDoorKey(makePlayer("10", "Hans"), "casa-grande", 2, makePlayer("11", "Katerina"), false);
    const seed = first.sut.saved();

    const doors = [makeDoor(D1), makeDoor(D2), makeDoor(D3)];
    const sut = load({ doors, stashes: [makeStash("c000000000000001")], seed });
    sut.api.installProperties();
    assert.ok(sut.itemCalls.some((call) => call.id === "kcdc-property:casa-grande:door3"), "registered again");
    assert.equal(sut.api.getProperty("casa-grande").doorKeys[D3], "kcdc-property:casa-grande:door3");
});

test("door keys that do not fit the doors are dropped when the file is read", () => {
    const sut = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(D3)], seed: { "casa-grande": record({ doorKeys: { [D2]: "item-2", "outra": "item-x", [D3]: "" } }) } });
    assert.deepEqual({ ...sut.api.getProperty("casa-grande").doorKeys }, { [D2]: "item-2" });
    const none = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(D3)], seed: { "casa-grande": record({ doorKeys: { "outra": "item-x" } }) } });
    assert.equal(none.api.getProperty("casa-grande").doorKeys, undefined);
});

test("a door of a property left open with nobody near is closed after two minutes, for everybody; somebody near keeps it open, a door shut is forgotten", () => {
    const { world, sut } = mapped();
    const door = world.west[0];
    const at = door.position;
    const far = [{ position: { x: at.x + 200, y: at.y, z: at.z } }];
    const near = [{ position: { x: at.x + 3, y: at.y, z: at.z } }];
    const T = 10_000_000;

    door.setOpen(true);
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T, far)), [], "the first look only starts the count");
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T + 60_000, far)), []);
    assert.equal(door.open, true);
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T + 119_000, near)), [], "somebody at the door starts it over");
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T + 130_000, far)), [], "counted again from the next look");
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T + 130_000 + 120_000, far)), [door.guid]);
    assert.equal(door.open, false);

    door.setOpen(true);
    sut.api.closeIdleDoors(T + 400_000, far);
    door.setOpen(false);
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(T + 600_000, far)), [], "a door that was shut meanwhile is not counted against");
    assert.equal(sut.api.idleDoors.closeAfterMs, 120_000);
});

// ---------------------------------------------------------------------------------------------
// Tidying what the census left loose.

/** A house with its own chest, and what stands near it without belonging to its areas: a chest, a plain door, a far chest. */
function looseWorld() {
    const front = makeDoor("1000000000000001", { x: 520, y: 3250, name: "Door/front[structures/living/houses/house_1s_3r_c6]" });
    const pub = "structures/municipal/pubs/unique/tachov/tachov_tavern_noshed1";
    const pubDoor = makeDoor("a000000000000001", { x: 625, y: 3250, name: `AnimDoor[${pub}:Door/door_village_left65[${pub}]]` });
    const plain = makeDoor("a000000000000004", { x: 540, y: 3240, name: "AnimDoor[Door/door_village_right61_57e575a0]" });
    const areas = [makeArea("a1", "SmartArea[structures/living/houses/house_1s_3r_c6_1]", [[front, "entrance"]], [500, 545, 3235, 3265])];
    const stashes = [
        makeStash("c000000000000001", { x: 550, y: 3250 }), // 30 m from the house
        makeStash("c000000000000002", { x: 600, y: 3250 }), // 80 m from the house, 25 m from the pub
        makeStash("c000000000000003", { x: 880, y: 3250 }), // far from everything
    ];
    return { doors: [front, pubDoor, plain], areas, stashes };
}

test("tidyLoose puts a loose chest under the nearest building and folds a loose door into its doors", () => {
    const sut = load(looseWorld());
    sut.api.mapRegion("suchdol", { looseDoors: true });
    const before = Array.from(sut.api.listProperties(), (p) => p.name).sort();
    assert.ok(before.includes("Baú 01") && before.includes("Baú 02") && before.includes("Baú 03"), "three loose chests");
    assert.ok(before.includes("Porta 01"), "and loose doors");

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.equal(done.chests, 2, "the one by the house and the one by the pub");
    assert.ok(byName["Casa 01 · Baú 1"], "the chest 30 m from the house is its own now");
    assert.equal(byName["Casa 01 · Baú 1"].parentId, byName["Casa 01"].id);
    assert.ok(byName["Taverna 01 · Baú 1"], "the chest 25 m from the pub, 80 m from the house, goes to the pub");
    assert.ok(byName["Baú 03"] && byName["Baú 03"].parentId === "", "a chest far from every building stays loose");
    assert.ok(Array.from(byName["Casa 01"].doors).includes("a000000000000004"), "the plain door 22 m away is a door of the house now");
    assert.ok(!byName["Porta 01"], "and its own record is gone");
    assert.equal(done.doors >= 1, true);
});

test("tidyLoose leaves a chest with a key where it is, and runs twice without harm", () => {
    const sut = load(looseWorld());
    sut.api.mapRegion("suchdol", { looseDoors: true });
    const keyed = Array.from(sut.api.listProperties()).find((p) => p.name === "Baú 01");
    sut.api.assignOwner(makePlayer("1", "Admin"), keyed.id, makePlayer("7656", "Dono"));

    sut.api.tidyLoose();
    const after = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.ok(after["Baú 01"] && after["Baú 01"].parentId === "", "an owned chest stays where its owner has it");

    const again = sut.api.tidyLoose();
    assert.equal(again.chests + again.doors, 0, "nothing is left to move the second time");
    assert.equal(sut.saved()[keyed.id].parentId, "");
});

test("tidyLoose takes the chests and doors the cession stamped on the lord, but not into a house another player owns", () => {
    const sut = load(looseWorld());
    sut.api.mapRegion("suchdol", { looseDoors: true });
    const house = Array.from(sut.api.listProperties()).find((p) => p.name === "Casa 01");
    sut.api.assignOwner(CROWN, house.id, makePlayer("77", "Vizinho"));
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    const stamped = Array.from(sut.api.listProperties()).filter((p) => p.parentId === "" && p.kind !== "house");
    assert.ok(stamped.length >= 4 && stamped.every((p) => p.ownerSteamId === "55"), "the lord has them all");

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.ok(byName["Taverna 01 · Baú 1"], "the chest by the pub (the lord's, as the pub is) goes in");
    assert.ok(byName["Baú 01"] && byName["Baú 01"].parentId === "", "the chest by the neighbour's house does not become the neighbour's");
    assert.ok(!Array.from(byName["Casa 01"].doors).includes("a000000000000004"), "nor the door");
    assert.ok(byName["Porta 01"], "it stays a door of its own");
    assert.equal(done.chests, 1);
    assert.equal(done.doors, 0);
});

test("the castle's gates are the ones in and by its walls, worked by its owner or the lord of its lands, in one go", () => {
    const toggles = [];
    const gate = (guid, x, y, cycle = "closed") => ({ guid, position: { x, y, z: 140 }, cycle, toggle: (open) => { toggles.push([guid, open]); return { accepted: cycle !== (open ? "open" : "closed"), seconds: 3.2 }; } });
    const gates = [gate("g1", 780, 3330), gate("g2", 770, 3300), gate("far", 1500, 3900)];
    const sut = load({ ...village(), gates });
    sut.api.mapRegion("suchdol");
    sut.api.mapCastle("suchdol");
    const castle = Array.from(sut.api.listProperties()).find((p) => p.name === "Castelo de Suchdol");
    const house = Array.from(sut.api.listProperties()).find((p) => p.name === "Casa 01");

    assert.deepEqual(Array.from(sut.api.castleGates(castle), (g) => g.guid), ["g1", "g2"], "the ones by the walls, not Raborsch's");
    assert.deepEqual(Array.from(sut.api.castleGates(house)), [], "a house has none");
    assert.equal(sut.api.gatesOpen(castle), false);
    assert.equal(sut.api.gatesOpen(house), null);

    const stranger = makePlayer("90", "Estranho");
    assert.equal(sut.api.setCastleGates(stranger, castle, true).ok, false);
    assert.equal(toggles.length, 0);

    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    const fresh = sut.api.getProperty(castle.id);
    const opened = sut.api.setCastleGates(LORD, fresh, true);
    assert.equal(opened.ok, true);
    assert.match(opened.message, /^Abrindo os portões de Castelo de Suchdol \(4 s\)\.$/);
    assert.deepEqual(toggles.map((t) => t.join(":")), ["g1:true", "g2:true"]);
    assert.equal(sut.api.setCastleGates(stranger, fresh, true, true).ok, true, "an administrator may");
    assert.equal(sut.api.setCastleGates(makePlayer("91", "Outro"), house, true).ok, false, "a house has no gates");
});

// 2026-10-19: "os portões só podem fechar se forem fechados manualmente pelo dono" -- the server keeps no gate past a restart.
test("the castles' gates are put back as their lords left them: open when nobody chose, shut only when closed on purpose", () => {
    const gate = (guid, x, y, cycle) => {
        const made = { guid, kind: "portcullis", position: { x, y, z: 140 }, cycle, moving: false, toggles: [], toggle: (open) => { made.toggles.push(open); made.cycle = open ? "opening" : "closing"; return { accepted: true, seconds: 7 }; } };
        return made;
    };
    const shutAtStart = gate("g1", 780, 3330, "closed");
    const keptShut = gate("g2", 770, 3300, "closed");
    const elsewhere = gate("far", 3000, 900, "closed");
    const sut = load({ ...village(), gates: [shutAtStart, keptShut, elsewhere] });
    sut.api.rememberGate("g2", false);
    assert.equal(sut.api.keepGates(true), 1, "the one nobody chose for is opened");
    assert.deepEqual(shutAtStart.toggles, [true]);
    assert.deepEqual(keptShut.toggles, [], "the lord's shut gate stays shut");
    assert.deepEqual(elsewhere.toggles, [], "a gate of no castle is left alone");
    assert.ok(sut.logs.some((line) => /portões dos castelos: Suchdol portcullis g1 aberto \(padrão\); Suchdol portcullis g2 fechado \(escolhido\); 1 posto\(s\) de volta/.test(line)), sut.logs.join(" | "));
    assert.equal(sut.api.keepGates(), 0, "opening already: nothing to do");

    // The choice is written down, so the next start reads it.
    sut.api.rememberGate("g1", false);
    const again = load({ ...village(), gates: [gate("g1", 780, 3330, "open")], disk: sut.disk });
    assert.equal(again.api.keepGates(), 1, "shut, as it was left");
});

// 2026-10-18: "as portas que ligam propriedade são da propriedade" -- the doors the census left loose in Suchdol had their lock
// set on purpose (open), or stood at houses players own, and the tidy skipped every one of them.
function tidyWorld() {
    const at = (id, name, kind, x, y, extra = {}) => ({ id, name, region: "Suchdol", kind, doorGuid: "", doors: [], stashGuid: "", keyItem: "", x, y, z: 145, createdAt: 0, createdBy: "census", auto: true, keys: 0, locked: false, parentId: "", ownerSteamId: "", ownerName: "", description: "", ...extra });
    const door = (n, x, y, owner, extra = {}) => at(`porta-${n}`, `Porta 0${n}`, "door", x, y, { doorGuid: `d00000000000000${n}`, doors: [`d00000000000000${n}`], ownerSteamId: owner, ownerName: owner, lockSet: true, ...extra });
    const seed = {};
    for (const p of [
        at("casa-01", "Casa 01", "house", 100, 100, { doorGuid: "e000000000000001", doors: ["e000000000000001"], ownerSteamId: "55", ownerName: "Radovan", lockSet: true }),
        at("casa-01-bau-1", "Casa 01 · Baú 1", "chest", 100, 140, { stashGuid: "c000000000000011", parentId: "casa-01" }),
        at("casa-02", "Casa 02", "house", 300, 100, { doorGuid: "e000000000000002", doors: ["e000000000000002"], ownerSteamId: "77", ownerName: "Tedrick" }),
        at("casa-03", "Casa 03", "house", 500, 100, { doorGuid: "e000000000000003", doors: ["e000000000000003"], ownerSteamId: "88", ownerName: "Dondolfo" }),
        door(1, 103, 100, "55"),
        door(2, 104, 101, "55", { locked: true }),
        door(3, 308, 100, "55"),
        door(4, 320, 100, "55"),
        door(5, 504, 100, "88"),
        door(6, 305, 100, "88"),
        at("bau-01", "Baú 01", "chest", 100, 175, { stashGuid: "c000000000000001", ownerSteamId: "55" }),
        at("bau-02", "Baú 02", "chest", 300, 110, { stashGuid: "c000000000000002", ownerSteamId: "55" }),
    ]) {
        seed[p.id] = p;
    }
    const sut = load({ seed });
    sut.files.set("playerdata/regions.json", JSON.stringify({ Suchdol: { steamId: "55", name: "Radovan", at: 0, by: "Mauro" } }));
    return sut;
}

test("tidyLoose folds every door that opens into a building into it, its lock set on purpose or not, and keeps the door's own mark", () => {
    const sut = tidyWorld();
    const done = sut.api.tidyLoose();
    const saved = sut.saved();
    assert.deepEqual(Array.from(saved["casa-01"].doors).sort(), ["d000000000000001", "d000000000000002", "e000000000000001"], "the lord's two doors by the lord's house, though their lock was set");
    assert.deepEqual(saved["casa-01"].doorLocks, { d000000000000002: true }, "the one kept shut stays shut among the house's doors");
    assert.ok(Array.from(saved["casa-02"].doors).includes("d000000000000003"), "the lord's door right at Tedrick's house (8 m) is a door of that house");
    assert.ok(!Array.from(saved["casa-02"].doors).includes("d000000000000004"), "not one 20 m from it");
    assert.ok(saved["porta-4"], "which stays a door of its own");
    assert.ok(Array.from(saved["casa-03"].doors).includes("d000000000000005"), "Dondolfo's own door goes into Dondolfo's own house");
    assert.ok(saved["porta-6"] && !Array.from(saved["casa-02"].doors).includes("d000000000000006"), "but his door by Tedrick's house is still his");
    assert.equal(done.doors, 4);
    assert.match(done.moved.join("; "), /Porta 01 -> Casa 01 \(3\.0 m\)/);
});

test("tidyLoose measures a loose chest to the building's own chests too, and never puts one into a house another player owns", () => {
    const sut = tidyWorld();
    const done = sut.api.tidyLoose();
    const saved = sut.saved();
    assert.equal(saved["bau-01"].parentId, "casa-01", "75 m from where the house was put, 35 m from its chest");
    assert.equal(saved["bau-01"].name, "Casa 01 · Baú 2");
    assert.equal(saved["bau-02"].parentId, "", "the chest by Tedrick's house does not become Tedrick's");
    assert.equal(done.chests, 1);
    const again = sut.api.tidyLoose();
    assert.equal(again.chests + again.doors, 0, "nothing moves the second time");
});

test("the key to a house opens the chests in it too; the key to one of its doors does not", () => {
    const { sut } = castle({ ownerSteamId: "10", ownerName: "Hans" });
    const hans = makePlayer("10", "Hans");
    const kat = makePlayer("11", "Katerina");
    const erik = makePlayer("12", "Erik");
    const chest = sut.api.getProperty("casa-grande-bau-1");
    assert.equal(sut.api.holdsKeyOf(kat, chest), false);
    assert.equal(sut.api.issueKey(hans, "casa-grande", kat, false).ok, true);
    assert.equal(sut.api.holdsKeyOf(kat, chest), true, "the house's key opens its chest (2026-10-18: the castle's key could not)");
    assert.equal(sut.api.issueDoorKey(hans, "casa-grande", 1, erik, false).ok, true);
    assert.equal(sut.api.holdsKeyOf(erik, chest), false, "a door's own key is no key to the chests");
});

test("a catalog filed before the map's own name was used reads Grunta as Minas, and the Devil's Den joins it with no second filing (2026-10-26)", () => {
    const record = (id, name, region, extra = {}) => ({ id, name, region, kind: "house", doorGuid: "", doors: [], keyItem: "", x: 3200, y: 2200, z: 95, createdAt: 1, createdBy: "census", auto: true, keys: 0, locked: false, parentId: "", ownerSteamId: "", ownerName: "", description: "", ...extra });
    const seed = {
        "casa-01": record("casa-01", "Casa 01", "Grunta"),
        "taverna-de-grunta": record("taverna-de-grunta", "Taverna de Grunta", "Grunta", { npc: "Taberneiro" }),
        "taverna-de-grunta-bau-1": record("taverna-de-grunta-bau-1", "Taverna de Grunta · Baú 1", "Grunta", { kind: "chest", parentId: "taverna-de-grunta", stashGuid: "f000000000000001" }),
        "minas-toca-do-diabo": record("minas-toca-do-diabo", "Toca do Diabo", "Minas", { x: 2912, y: 2937 }),
        "minas-toca-do-diabo-bau-1": record("minas-toca-do-diabo-bau-1", "Toca do Diabo · Baú 1", "Minas", { kind: "chest", parentId: "minas-toca-do-diabo", stashGuid: "f000000000000002", x: 2921, y: 2931 }),
        "casa-01-suchdol": record("casa-01-suchdol", "Casa 01", "Suchdol", { x: 520, y: 3250 }),
    };
    const sut = load({ doors: [], stashes: [], areas: [], seed });
    sut.api.installProperties();
    const all = Array.from(sut.api.listProperties());
    assert.deepEqual(all.map((p) => [p.region, p.name]).sort(), [
        ["Minas", "Casa 01"], ["Minas", "Taverna de Minas"], ["Minas", "Taverna de Minas · Baú 1"], ["Minas", "Toca do Diabo"], ["Minas", "Toca do Diabo · Baú 1"], ["Suchdol", "Casa 01"],
    ], "one region of the old village and the den, with the word changed in the names that carried it, and no other region touched");
    assert.deepEqual(Array.from(sut.api.regionNames()), ["Minas", "Suchdol"]);
    assert.equal(sut.saved()["casa-01"].region, "Minas", "the file says so after the start");
    assert.equal(sut.saved()["taverna-de-grunta"].name, "Taverna de Minas");
    assert.equal(sut.api.getProperty("taverna-de-grunta").npc, "Taberneiro", "what the record says of a vendor's house is kept");
});

test("the sweep goes through the catalog a fifth at a time: every property once in five turns, none twice, and the whole-catalog call still does all (2026-10-26)", () => {
    const { world, sut } = mapped();
    const doors = [...world.west, ...world.east];
    for (const door of doors) door.setOpen(true);
    const at = doors[0].position;
    const far = [{ position: { x: at.x + 5000, y: at.y, z: at.z } }];
    const T = 20_000_000;
    const parts = [0, 1, 2, 3, 4].map((index) => ({ index, of: 5 }));
    for (const part of parts) sut.api.closeIdleDoors(T, far, part);
    const closedBy = parts.map((part) => Array.from(sut.api.closeIdleDoors(T + 121_000, far, part)));
    const all = closedBy.flat();
    assert.equal(new Set(all).size, all.length, "no door closed by two parts");
    const owned = new Set(Array.from(sut.api.listProperties()).flatMap((property) => Array.from(property.doors)));
    assert.deepEqual([...all].sort(), doors.map((door) => door.guid).filter((guid) => owned.has(guid)).sort(), "together they closed every open door of a property");
    assert.ok(closedBy.filter((list) => list.length > 0).length >= 2, "and not all in one turn");

    // The whole catalog in one call, as the admin tools and the tests ask for it.
    for (const door of doors) door.setOpen(true);
    sut.api.closeIdleDoors(T + 500_000, far);
    assert.equal(Array.from(sut.api.closeIdleDoors(T + 500_000 + 121_000, far)).length, all.length);
});

test("installed, the sweep runs every second over a fifth of the catalog, so that a property is still looked at every five seconds", () => {
    const { sut } = mapped();
    sut.api.installProperties();
    const sweeps = sut.intervals.filter((timer) => timer.ms === 1_000);
    assert.equal(sweeps.length, 1);
    assert.equal(sut.intervals.filter((timer) => timer.ms === 5_000).length, 0, "no turn of five seconds over the whole catalog");
});

// ---------------------------------------------------------------------------------------------
// Tidying by the level's private areas, and the longer reach (2026-10-28: "os mapeamentos de Kuttenberg estão errados, tem baú avulso e porta também; tudo é propriedade").

/** A level area labelled the way the trespass areas of the level are (`private`), with the bounds the engine reports. */
function makePrivateArea(id, name, box, { labels = ["private", "personal", "interior"], links = [] } = {}) {
    return {
        ...makeArea(id, name, links, box),
        kind: "level",
        labels,
        bounds: { min: { x: box[0], y: box[2], z: 0 }, max: { x: box[1], y: box[3], z: 200 } },
    };
}

/** A chest or a door of the catalog standing alone, as the census leaves it. */
function loneChest(guid, name, x, y, over = {}) {
    return record({ id: guid, name, kind: "chest", doorGuid: "", doors: [], stashGuid: guid, x, y, z: 30, ownerSteamId: "", ownerName: "", ...over });
}

function loneDoor(guid, name, x, y, over = {}) {
    return record({ id: guid, name, kind: "door", doorGuid: guid, doors: [guid], stashGuid: "", x, y, z: 30, ownerSteamId: "", ownerName: "", ...over });
}

test("two chests in a shed's private area, with no door the level links, are one place of their own: 'Galpão 01' with both under it", () => {
    const shed = makePrivateArea("p-shed", "WH_TriggerArea34[structures/industrial/sheds/shed_kh_b2_5d4e]", [875, 895, 3195, 3215], { labels: ["private", "personal", "interior", "animals_publicSpace"] });
    const c1 = makeStash("c000000000000011", { x: 880, y: 3200 });
    const c2 = makeStash("c000000000000012", { x: 888, y: 3208 });
    const seed = { c000000000000011: loneChest("c000000000000011", "Baú 121 (Galpão)", 880, 3200), c000000000000012: loneChest("c000000000000012", "Baú 122 (Galpão)", 888, 3208) };
    const sut = load({ stashes: [c1, c2], areas: [shed], seed });

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.equal(done.places, 1);
    assert.equal(done.chests, 2);
    const place = byName["Galpão 01"];
    assert.ok(place, "the shed is a property now");
    assert.equal(place.kind, "house");
    assert.equal(place.region, "Suchdol");
    assert.deepEqual(Array.from(place.doors), []);
    assert.equal(place.doorGuid, "");
    assert.equal(byName["Galpão 01 · Baú 1"].parentId, place.id);
    assert.equal(byName["Galpão 01 · Baú 2"].parentId, place.id);
    assert.ok(!byName["Baú 121 (Galpão)"], "the chests are named after the place");
    assert.ok(done.moved.some((line) => /Galpão 01 <- WH_TriggerArea34/.test(line)), "and the log says why");

    const again = sut.api.tidyLoose();
    assert.equal(again.chests + again.doors + again.places, 0, "nothing is left to do the second time");
});

test("a smithy's yard, a door and a chest in a private area: 'Ferraria 01', named by the prefab of its door, with the door as its entrance", () => {
    const smithy = "AnimDoor[structures/industrial/smitheries/unique/nebakov/smithery2:Door/door_village_left36[x]]";
    const door = makeDoor("d000000000000013", { x: 850, y: 3200, z: 30, name: smithy });
    const chest = makeStash("c000000000000013", { x: 856, y: 3206, name: "stash[hostinaProChude_wineChest_5d5a]" });
    const yard = makePrivateArea("p-yard", "kkut_trespassPach14Area_1", [840, 870, 3190, 3225], { labels: ["private", "prohibited", "suppressHorseCall"] });
    const seed = { d000000000000013: loneDoor("d000000000000013", "Porta 13", 850, 3200), c000000000000013: loneChest("c000000000000013", "Baú 23", 856, 3206) };
    const sut = load({ doors: [door], stashes: [chest], areas: [yard], seed });

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    const place = byName["Ferraria 01"];
    assert.ok(place, "named for what it is, as the census names a smithy");
    assert.equal(done.places, 1);
    assert.equal(done.doors, 1);
    assert.equal(done.chests, 1);
    assert.deepEqual(Array.from(place.doors), ["d000000000000013"]);
    assert.equal(place.doorGuid, "d000000000000013");
    assert.ok(!byName["Porta 13"], "the loose door is a door of the place");
    assert.equal(byName["Ferraria 01 · Baú 1"].parentId, place.id);
});

test("a loose chest in the area the level links to a building's doors goes under that building, a gate tower's for one", () => {
    const gate = makeDoor("d000000000000014", { x: 700, y: 3200, z: 30, name: "AnimDoor[structures/defensive/walls/unique/kutna_hora/gate:Door/d[x]]" });
    const tower = makePrivateArea("p-gate", "AreaUnion3[structures/defensive/walls/unique/kutna_hora/gate]", [690, 710, 3190, 3210], { labels: ["private", "prohibited", "interior"], links: [[gate, "entrance"]] });
    const chest = makeStash("c000000000000014", { x: 703, y: 3203 });
    const seed = {
        "fortaleza-01": record({ id: "fortaleza-01", name: "Fortaleza 01", doorGuid: "d000000000000014", doors: ["d000000000000014"], x: 700, y: 3200, ownerSteamId: "", ownerName: "" }),
        c000000000000014: loneChest("c000000000000014", "Baú 40", 703, 3203),
    };
    const sut = load({ doors: [gate], stashes: [chest], areas: [tower], seed });

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.equal(done.places, 0, "the tower is a property already");
    assert.equal(byName["Fortaleza 01 · Baú 1"].parentId, "fortaleza-01");
});

test("an area the level does not mark private makes no place, and a place is never made of what a player holds or what has a key out", () => {
    const open = makePrivateArea("p-open", "kkut_gossipAreaNamet_1", [875, 895, 3195, 3215], { labels: [] });
    const own = makePrivateArea("p-own", "TriggerArea6[structures/living/houses/wooden/small_roof_to_g]", [695, 705, 3295, 3305]);
    const a = makeStash("c000000000000015", { x: 880, y: 3200 });
    const b = makeStash("c000000000000016", { x: 700, y: 3300 });
    const c = makeStash("c000000000000017", { x: 701, y: 3301 });
    const seed = {
        c000000000000015: loneChest("c000000000000015", "Baú 31", 880, 3200),
        c000000000000016: loneChest("c000000000000016", "Baú 32", 700, 3300, { ownerSteamId: "9", ownerName: "Hans" }),
        c000000000000017: loneChest("c000000000000017", "Baú 33", 701, 3301, { keys: 1 }),
    };
    const sut = load({ stashes: [a, b, c], areas: [open, own], seed });

    const done = sut.api.tidyLoose();

    assert.equal(done.places, 0);
    assert.equal(done.chests, 0);
    assert.ok(Array.from(sut.api.listProperties()).every((p) => p.parentId === ""));
});

test("a free chest or door joins the nearest free building from farther than it did (120 m and 60 m), unless a building another player owns is nearer and close", () => {
    const home = makeDoor("d000000000000018", { x: 520, y: 3250, z: 30, name: "Door/front[structures/living/houses/house_1s_3r_c6]" });
    const far = makeStash("c000000000000018", { x: 520, y: 3345 }); // 95 m
    const farther = makeStash("c000000000000019", { x: 520, y: 3400 }); // 150 m
    const near = makeDoor("d000000000000019", { x: 520, y: 3305, z: 30, name: "AnimDoor[Door/door_village_right61]" }); // 55 m
    const seed = {
        casa: record({ id: "casa", name: "Casa 01", doorGuid: "d000000000000018", doors: ["d000000000000018"], x: 520, y: 3250, ownerSteamId: "", ownerName: "" }),
        c000000000000018: loneChest("c000000000000018", "Baú 41", 520, 3345),
        c000000000000019: loneChest("c000000000000019", "Baú 42", 520, 3400),
        d000000000000019: loneDoor("d000000000000019", "Porta 41", 520, 3305),
    };
    const sut = load({ doors: [home, near], stashes: [far, farther], seed });

    const done = sut.api.tidyLoose();

    const byName = Object.fromEntries(Array.from(sut.api.listProperties(), (p) => [p.name, p]));
    assert.ok(byName["Casa 01 · Baú 1"], "95 m is within reach now");
    assert.ok(byName["Baú 42"] && byName["Baú 42"].parentId === "", "150 m is not");
    assert.ok(Array.from(byName["Casa 01"].doors).includes("d000000000000019"), "a door 55 m off is a door of the house");
    assert.equal(done.places, 0);

    // The same, with a neighbour's house nearer to the chest: it stays where it is.
    const neighbour = makeDoor("d00000000000001a", { x: 520, y: 3330, z: 30, name: "Door/front[structures/living/houses/house_1s_4r_d]" });
    const seed2 = {
        casa: record({ id: "casa", name: "Casa 01", doorGuid: "d000000000000018", doors: ["d000000000000018"], x: 520, y: 3250, ownerSteamId: "", ownerName: "" }),
        vizinho: record({ id: "vizinho", name: "Casa 02", doorGuid: "d00000000000001a", doors: ["d00000000000001a"], x: 520, y: 3330, ownerSteamId: "77", ownerName: "Vizinho" }),
        c000000000000018: loneChest("c000000000000018", "Baú 41", 520, 3345),
    };
    const sut2 = load({ doors: [home, neighbour], stashes: [far], seed: seed2 });
    const again = sut2.api.tidyLoose();
    assert.equal(again.chests, 0, "15 m from the neighbour's house: most likely the neighbour's");
});

test("a place made for an area goes to the lord of a ceded region, as everything new there does", () => {
    const shed = makePrivateArea("p-shed2", "WH_TriggerArea34[structures/industrial/sheds/shed_kh_b2_5d4e]", [875, 895, 3195, 3215]);
    const c1 = makeStash("c000000000000021", { x: 880, y: 3200 });
    const seed = { c000000000000021: loneChest("c000000000000021", "Baú 51", 880, 3200) };
    const sut = load({ stashes: [c1], areas: [shed], seed });
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);

    sut.api.tidyLoose();

    const place = Array.from(sut.api.listProperties()).find((p) => p.name === "Galpão 01");
    assert.ok(place);
    assert.equal(place.ownerSteamId, "55", "the lord's, like the rest of the region");
    const chest = Array.from(sut.api.listProperties()).find((p) => p.name === "Galpão 01 · Baú 1");
    assert.equal(chest.parentId, place.id);
});

// ---------------------------------------------------------------------------------------------
// Access instead of keys (2026-10-28: "ao invés de chaves vamos usar dar acesso: o dono escolhe um jogador; no painel, duas abas, as dele e as que ele tem acesso").

/** Casa 01 (with its chest) handed to Ana. */
function ownedByAna() {
    const { sut, find, world } = mapped();
    const house = find("Casa 01");
    const chest = find("Casa 01 · Baú 1");
    const ana = makePlayer("10", "Ana");
    sut.api.assignOwner(makePlayer("9", "Mauro"), house.id, ana);
    return { sut, find, world, house, chest, ana, bruno: makePlayer("11", "Bruno"), carla: makePlayer("12", "Carla"), admin: makePlayer("9", "Mauro") };
}

test("the owner gives a player access: it is the house's, its chest follows it, it is written to the record, and it stands for the key", () => {
    const { sut, house, chest, ana, bruno, carla } = ownedByAna();
    assert.equal(sut.api.hasAccess("11", house), false);

    const result = sut.api.grantAccess(ana, house.id, bruno, false);

    assert.equal(result.ok, true);
    assert.match(result.message, /Bruno agora tem acesso a Casa 01: abre, tranca e destranca as portas e os baús\./);
    assert.equal(result.steamId, "11");
    assert.equal(sut.api.hasAccess("11", house), true);
    assert.equal(sut.api.hasAccess("11", chest), true, "a chest in the house is the house's");
    assert.equal(sut.api.hasAccess("12", house), false);
    assert.equal(sut.api.hasAccess("", house), false, "no Steam id, no access");
    assert.deepEqual(Array.from(sut.api.accessOf(chest), (grant) => grant.name), ["Bruno"], "the chest shows the house's list");
    assert.deepEqual(Array.from(sut.saved()[house.id].access, (grant) => grant.steamId), ["11"]);
    assert.ok(!("access" in sut.saved()[chest.id]), "kept on the house alone");
    assert.equal(sut.addCalls.length, 0, "no key is made");

    assert.equal(sut.api.holdsKeyOf(bruno, house), true, "access stands for the key");
    assert.equal(sut.api.holdsKeyOf(bruno, chest), true);
    assert.equal(sut.api.holdsKeyOf(bruno, house, "1000000000000001"), true, "for any door of the house");
    assert.equal(sut.api.holdsKeyOf(carla, house), false, "and a player with none still has no key");
});

test("only the owner gives access (an administrator may too), never twice, never to the owner or to a player with no Steam id, and not beyond the limit", () => {
    const { sut, house, chest, ana, bruno, carla, admin } = ownedByAna();
    const stranger = makePlayer("13", "Katerina");

    const refused = sut.api.grantAccess(stranger, house.id, bruno, false);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /Só o dono pode dar acesso a essa propriedade\./);
    assert.equal(sut.api.hasAccess("11", house), false);

    assert.equal(sut.api.grantAccess(admin, chest.id, bruno, true).ok, true, "an administrator gives it, and asking through the chest is asking through the house");
    assert.deepEqual(Array.from(sut.api.accessOf(house), (grant) => grant.steamId), ["11"]);
    assert.equal(sut.api.grantAccess(bruno, house.id, carla, false).ok, false, "someone with access does not pass it on");
    assert.match(sut.api.grantAccess(ana, house.id, bruno, false).message, /Bruno já tem acesso a Casa 01\./);
    assert.match(sut.api.grantAccess(ana, house.id, ana, false).message, /Ana já é o dono de Casa 01\./);
    assert.match(sut.api.grantAccess(ana, house.id, makePlayer("", "Sem"), false).message, /Sem não tem identificação Steam/);
    assert.equal(sut.api.grantAccess(ana, "nao-existe", carla, false).message, "Propriedade não encontrada.");

    for (let n = 1; n < sut.api.ACCESS_LIMIT; n += 1) {
        assert.equal(sut.api.grantAccess(ana, house.id, makePlayer(`2${n}`, `Amigo ${n}`), false).ok, true);
    }
    assert.equal(sut.api.accessOf(house).length, sut.api.ACCESS_LIMIT);
    const full = sut.api.grantAccess(ana, house.id, carla, false);
    assert.equal(full.ok, false);
    assert.match(full.message, /Casa 01 já tem 12 pessoas com acesso, o limite\./);
});

test("a vendor's house is never given access to, whoever asks", () => {
    const seed = { casa: record({ id: "casa", name: "Casa do Ferreiro", doors: [D1], doorGuid: D1, npc: "Ferreiro", ownerSteamId: "", ownerName: "" }) };
    const sut = load({ doors: [makeDoor(D1)], seed });
    const result = sut.api.grantAccess(makePlayer("9", "Mauro"), "casa", makePlayer("11", "Bruno"), true);
    assert.equal(result.ok, false);
    assert.match(result.message, /Casa do Ferreiro é a casa de Ferreiro \(NPC\): não se dá acesso a ela\./);
    assert.deepEqual(Array.from(sut.api.propertiesSharedWith("11")), []);
});

test("the owner takes access back by its place in the list and the name (a list that moved is read by the name); the last one leaves no field behind", () => {
    const { sut, house, chest, ana, bruno, carla } = ownedByAna();
    const stranger = makePlayer("13", "Katerina");
    sut.api.grantAccess(ana, house.id, bruno, false);
    sut.api.grantAccess(ana, house.id, carla, false);

    assert.equal(sut.api.revokeAccess(stranger, house.id, 0, "Bruno", false).ok, false);
    assert.match(sut.api.revokeAccess(stranger, house.id, 0, "Bruno", false).message, /Só o dono pode tirar o acesso\./);
    assert.equal(sut.api.hasAccess("11", house), true, "a stranger takes nothing");

    const first = sut.api.revokeAccess(ana, house.id, 0, "Bruno", false);
    assert.equal(first.ok, true);
    assert.equal(first.steamId, "11");
    assert.match(first.message, /Bruno não tem mais acesso a Casa 01\./);
    assert.equal(sut.api.hasAccess("11", house), false);
    assert.equal(sut.api.hasAccess("12", house), true);

    // Bruno is back at the end of the list; the page, drawn before, still names place 0.
    sut.api.grantAccess(ana, house.id, bruno, false);
    const moved = sut.api.revokeAccess(ana, chest.id, 0, "Bruno", false);
    assert.equal(moved.steamId, "11", "found by the name, through the chest's id");
    assert.equal(sut.api.hasAccess("12", house), true);

    assert.equal(sut.api.revokeAccess(ana, house.id, 0, "Carla", false).ok, true);
    assert.ok(!("access" in sut.saved()[house.id]), "an empty list is no field");
    assert.equal(sut.api.revokeAccess(ana, house.id, 0, "Carla", false).message, "Essa pessoa não tem mais acesso.");
});

test("whoever was given access may let go of it, once", () => {
    const { sut, house, ana, bruno } = ownedByAna();
    sut.api.grantAccess(ana, house.id, bruno, false);

    const done = sut.api.leaveAccess("11", house.id);
    assert.equal(done.ok, true);
    assert.equal(done.message, "Você deixou de ter acesso a Casa 01.");
    assert.equal(sut.api.hasAccess("11", house), false);
    assert.equal(sut.api.leaveAccess("11", house.id).message, "Você não tem acesso a essa propriedade.");
    assert.equal(sut.api.leaveAccess("11", "nao-existe").message, "Propriedade não encontrada.");
});

test("what a player was given access to is the houses with their chests, sorted, and nothing that is theirs or only the chest of a house they are not in", () => {
    const { sut, find, house, ana, bruno, carla } = ownedByAna();
    const other = find("Casa 02");
    sut.api.assignOwner(makePlayer("9", "Mauro"), other.id, carla);
    sut.api.grantAccess(ana, house.id, bruno, false);
    sut.api.grantAccess(carla, other.id, bruno, false);

    const shared = Array.from(sut.api.propertiesSharedWith("11"), (property) => property.name);
    assert.ok(shared.includes("Casa 01") && shared.includes("Casa 02") && shared.includes("Casa 01 · Baú 1"), shared.join("|"));
    assert.equal(shared.indexOf("Casa 01") < shared.indexOf("Casa 01 · Baú 1"), true, "the house, then its chest");
    assert.deepEqual(Array.from(sut.api.propertiesSharedWith("12"), (property) => property.name), [], "Carla was given none");
    assert.deepEqual(Array.from(sut.api.propertiesSharedWith("")), []);
    assert.deepEqual(Array.from(sut.api.propertiesOwnedBy("11")), [], "access is no ownership");
});

test("the access an owner gave goes when the property changes hands, is taken off, or its owner's character is deleted; what a deleted character was given goes with them", () => {
    const { sut, house, ana, bruno, carla, admin } = ownedByAna();
    sut.api.grantAccess(ana, house.id, bruno, false);
    sut.api.grantAccess(ana, house.id, carla, false);

    // Handed to Carla: the access Ana gave is Ana's, and goes.
    assert.equal(sut.api.assignOwner(admin, house.id, carla).ok, true);
    assert.deepEqual(Array.from(sut.api.accessOf(house)), []);
    assert.ok(!("access" in sut.saved()[house.id]));

    // Taken off: the same.
    sut.api.grantAccess(carla, house.id, bruno, false);
    assert.equal(sut.api.clearOwner(house.id).ok, true);
    assert.deepEqual(Array.from(sut.api.accessOf(house)), []);
    assert.match(sut.api.clearOwner(house.id).message, /já está sem dono/);

    // A deleted character: its own properties lose their lists, and so does what it was given elsewhere.
    sut.api.assignOwner(admin, house.id, ana);
    sut.api.grantAccess(ana, house.id, bruno, false);
    const gone = sut.api.releaseAllOf("11");
    assert.equal(gone.properties, 0, "Bruno owned nothing");
    assert.equal(sut.api.hasAccess("11", house), false, "what Bruno was given goes with him");
    assert.equal(sut.api.propertiesSharedWith("11").length, 0);
    sut.api.grantAccess(ana, house.id, bruno, false);
    assert.equal(sut.api.releaseAllOf("10").properties >= 1, true);
    assert.deepEqual(Array.from(sut.api.accessOf(house)), [], "and what Ana gave goes with her");
});

test("access is read back as it was saved, with a list that is not one, a repeat, an empty id and anything past the limit left out; a renamed character is renamed in it", () => {
    const { sut, house, ana, bruno } = ownedByAna();
    sut.api.grantAccess(ana, house.id, bruno, false);
    const saved = sut.saved();

    saved[house.id].access.push({ steamId: "11", name: "Repetido", at: 1 }, { steamId: "", name: "Sem id", at: 1 }, "lixo", null, { steamId: 5 });
    for (let n = 0; n < 30; n += 1) {
        saved[house.id].access.push({ steamId: `3${n}`, name: `Extra ${n}`, at: n });
    }
    saved["casa-bau-fantasma"] = record({ id: "casa-bau-fantasma", name: "Outra", kind: "house", doors: [], doorGuid: "", access: "nada" });
    sut.files.set("playerdata/properties.json", JSON.stringify(saved));

    const reread = load({ ...village(), seed: saved });
    const list = Array.from(reread.api.accessOf(reread.api.getProperty(house.id)), (grant) => grant.steamId);
    assert.equal(list.length, reread.api.ACCESS_LIMIT);
    assert.deepEqual(list.slice(0, 3), ["11", "30", "31"]);
    assert.equal(new Set(list).size, list.length, "each player once");
    assert.deepEqual(Array.from(reread.api.accessOf(reread.api.getProperty("casa-bau-fantasma"))), []);

    // The name follows the character, as the owner's does.
    bruno.characterName = "Bruno Sedlak";
    reread.api.noteNickname(bruno);
    assert.equal(reread.api.accessOf(reread.api.getProperty(house.id))[0].name, "Bruno Sedlak");
});

// What a deleted character takes with it (releaseAllOf, 2026-10-31): two lords deleted their characters and 270 chests were emptied, the castle's and the villagers' among them.
test("deleting a character empties the chests of a house nobody else used, and leaves what is in the chests of a lord's lands and of a house others had access to (2026-10-31)", () => {
    const stash = (id) => ({ stashGuid: `guid-${id}` });
    const sut = region({
        "casa-01-bau-1": record({ id: "casa-01-bau-1", name: "Casa 01 · Baú 1", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", kind: "chest", parentId: "casa-01", ...stash("c1") }),
        "casa-01-bau-2": record({ id: "casa-01-bau-2", name: "Casa 01 · Baú 2", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", kind: "chest", parentId: "casa-01", ...stash("c2") }),
        "casa-05": record({ id: "casa-05", name: "Casa 05", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", region: "Raborsch" }),
        "casa-05-bau-1": record({ id: "casa-05-bau-1", name: "Casa 05 · Baú 1", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", kind: "chest", parentId: "casa-05", region: "Raborsch", ...stash("r1") }),
        "casa-06": record({ id: "casa-06", name: "Casa 06", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", region: "Raborsch" }),
        "casa-06-bau-1": record({ id: "casa-06-bau-1", name: "Casa 06 · Baú 1", doorGuid: "", doors: [], ownerSteamId: "", ownerName: "", kind: "chest", parentId: "casa-06", region: "Raborsch", ...stash("r2") }),
    });
    // The lord of Suchdol owns the houses there (what the region ceded) and a house of his own in Raborsch; a villager of Raborsch owns another one and gave a neighbour access to it.
    sut.api.cedeRegion(CROWN, "Suchdol", LORD);
    sut.api.assignOwner(CROWN, "casa-05", LORD);
    const lord = sut.api.releaseAllOf(LORD.steamId);
    assert.equal(lord.regions, 1);
    assert.deepEqual(Array.from(lord.chests), ["guid-r1"], "his own house in Raborsch, which nobody else used: emptied");
    assert.equal(lord.kept, 2, "the two chests of Casa 01, in the lands he was the lord of, keep what they hold");
    assert.equal(sut.api.getProperty("casa-01").ownerSteamId, "", "the houses are nobody's all the same");
    assert.equal(sut.api.getProperty("casa-05").ownerSteamId, "");
    assert.equal(sut.api.regionLordOf("Suchdol"), null);

    const villager = makePlayer("88", "Aldeão");
    const neighbour = makePlayer("99", "Vizinho");
    sut.api.assignOwner(CROWN, "casa-06", villager);
    assert.equal(sut.api.grantAccess(villager, "casa-06", neighbour, false).ok, true);
    const shared = sut.api.releaseAllOf("88");
    assert.deepEqual([Array.from(shared.chests), shared.kept, shared.properties], [[], 1, 1], "a house others were given access to keeps what is in its chest");

    const alone = sut.api.releaseAllOf("nobody");
    assert.deepEqual([alone.properties, alone.regions, Array.from(alone.chests), alone.kept], [0, 0, [], 0]);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.releaseAllOf(""))), { properties: 0, regions: 0, chests: [], kept: 0 });
});

// The doors the census left out of a house (properties.ts `attachDoors`, `MISSED_DOORS`, 2026-11-04: "na casa do caçador em Suchdol ficou faltando mapear duas portas").

const H1 = "4c8bec9ae70b75e0";
const H2 = "4d19407bf0d84fa8";
const H3 = "48942897dc0d5aae";
const hunterHouse = (over = {}) => record({ id: "suchdol-casa-03", name: "Casa do Caçador", doorGuid: D1, doors: [D1, D2], locked: true, lockSet: true, ...over });

test("attachDoors joins doors of the level to a house, locked as the house is; the ones it has, another property's and the ones the level lacks are left out and said", () => {
    const doors = [makeDoor(D1, { locked: true }), makeDoor(D2, { locked: true }), makeDoor(H1), makeDoor(H2), makeDoor(H3), makeDoor(D3)];
    const sut = load({ doors, seed: { "suchdol-casa-03": hunterHouse(), vizinha: record({ id: "vizinha", name: "Vizinha", doorGuid: D3, doors: [D3] }) } });
    const report = sut.api.attachDoors("suchdol-casa-03", [H1, D1, D3, "ffff000000000000", H2]);
    assert.deepEqual(Array.from(report.added), [H1, H2], "the two that were the level's and nobody's");
    assert.match(report.message, /2 porta\(s\) nova\(s\); deixei de fora: .*já é de Vizinha; ffff000000000000: o nível não tem essa porta/);
    assert.deepEqual(Array.from(sut.api.getProperty("suchdol-casa-03").doors), [D1, D2, H1, H2]);
    assert.equal(doors[2].locked, true, "a house locked on purpose locks its new doors");
    assert.equal(doors[3].locked, true);
    assert.equal(doors[4].locked, false, "a door not joined is left as the level has it");
    const again = sut.api.attachDoors("suchdol-casa-03", [H1, H2]);
    assert.equal(again.added.length, 0);
    assert.match(again.message, /nenhuma porta nova/);
    assert.equal(sut.api.attachDoors("não-existe", [H1]).ok, false);
    assert.equal(sut.api.propertyOfDoor(H1).id, "suchdol-casa-03", "and the door finds its house");
});

test("a chest takes no door", () => {
    const stash = makeStash("c000000000000001");
    const sut = load({ doors: [makeDoor(H1)], stashes: [stash], seed: { bau: record({ id: "bau", name: "Baú", kind: "chest", doorGuid: "", doors: [], stashGuid: stash.levelGuid }) } });
    const report = sut.api.attachDoors("bau", [H1]);
    assert.equal(report.ok, false);
    assert.deepEqual(Array.from(sut.api.getProperty("bau").doors), []);
});

test("at every start the three doors the census left out of the hunter's house join it, once, and are locked with it; a start with no such house, or without the doors, does nothing", () => {
    const doors = [makeDoor(D1, { locked: true }), makeDoor(D2, { locked: true }), makeDoor(H1), makeDoor(H2), makeDoor(H3)];
    const sut = load({ doors, seed: { "suchdol-casa-03": hunterHouse() } });
    sut.api.installProperties();
    assert.deepEqual(Array.from(sut.api.getProperty("suchdol-casa-03").doors), [D1, D2, H1, H2, H3]);
    assert.ok(sut.logs.some((line) => /Casa do Caçador: 3 porta\(s\) nova\(s\)/.test(line)));
    assert.ok(doors.slice(2).every((door) => door.locked === true), "all three locked with the house");
    const logs = sut.logs.length;
    sut.api.installProperties();
    assert.equal(sut.logs.slice(logs).some((line) => /porta\(s\) nova\(s\)/.test(line)), false, "the second start finds nothing to add");
    assert.deepEqual(Array.from(sut.api.getProperty("suchdol-casa-03").doors), [D1, D2, H1, H2, H3], "and nothing twice");

    const elsewhere = load({ doors, seed: { outra: record({ id: "outra", name: "Outra" }) } });
    assert.doesNotThrow(() => elsewhere.api.installProperties());
    assert.deepEqual(Array.from(elsewhere.api.getProperty("outra").doors), [D1, D2, D3]);
    const partly = load({ doors: [makeDoor(D1), makeDoor(D2), makeDoor(H2)], seed: { "suchdol-casa-03": hunterHouse() } });
    partly.api.installProperties();
    assert.deepEqual(Array.from(partly.api.getProperty("suchdol-casa-03").doors), [D1, D2, H2], "a door the level has not reported is tried at the next start");
});
