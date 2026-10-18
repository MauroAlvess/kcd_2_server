const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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
function load({ doors = [], stashes = [], areas = [], seed = null } = {}) {
    const disk = fakeDisk();
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
    const farAway = makeDoor("4000000000000001", { x: 3200, y: 500, name: "Door/front[structures/living/houses/house_far]" });
    // A door of the fortress: the castle's own, which the census leaves out unless asked.
    const loose = makeDoor("5000000000000001", { x: 763, y: 3333, name: "AnimDoor[structures/defensive/fortresses/suchdol1:Door/door_village_right29[x]]" });
    const doors = [...west, ...east, barn, farAway, loose];
    const areas = [
        makeArea("a2", "SmartArea64[structures/living/houses/house_1s_4r_d_1]", [[east[0], "entrance"], [east[1], "storage"]], [680, 720, 3280, 3320]),
        makeArea("a1", "SmartArea[structures/living/houses/house_1s_3r_c6_1]", [[west[0], "entrance"], [west[1], "basic"]], [500, 545, 3235, 3265]),
        makeArea("a3", "WH_TriggerArea22[structures/industrial/barns/barn_r4_1]", [[barn, "entrance"]], [600, 620, 3250, 3270]),
        makeArea("a4", "SmartArea[structures/living/houses/house_far_1]", [[farAway, "entrance"]], [3190, 3210, 490, 510]),
        // A tower: an area with no door of its own, which only gives a hint to the chests standing in it.
        makeArea("a5", "TriggerArea[structures/military/tower_1]", [], [790, 810, 3340, 3360]),
    ];
    const stashes = [
        makeStash("c000000000000001", { x: 560, y: 3240 }),
        makeStash("c000000000000002", { x: 800, y: 3350 }),
        makeStash("c000000000000004", { x: 525, y: 3252 }),
        makeStash("b000000000000001", { x: 600, y: 3240, name: "Stash12[Stash/barrel_with_arrows29_x]" }),
        makeStash("c000000000000003", { x: 3300, y: 600 }),
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

test("a chest locked by the server stays unlocked in the game, which then offers only its own Abrir", () => {
    const { world, sut, find } = mapped();
    const chest = find("Baú 01");

    sut.api.setLocked(chest.id, true);
    const stash = world.stashes.find((s) => s.levelGuid === chest.stashGuid);
    assert.equal(stash.locked, false);
    assert.equal(sut.api.lockedNow(chest.stashGuid), true);
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
    assert.equal(world.east[0].locked, false, "the game never holds the lock");
    assert.equal(world.east[1].locked, false);

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

test("at start every key type is registered again, every door and chest of a property is unlocked in the game, and the record keeps the locks", () => {
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

    // A restart: the level builds its doors and chests the way it does, some of them locked.
    world.doors.forEach((door) => { door.locked = true; });
    world.stashes.forEach((stash) => { stash.locked = true; });
    const sut = load({ ...world, seed });
    sut.api.installProperties();

    assert.equal(sut.itemCalls.length, 2, "the two key types that were handed out exist before anybody connects; the other four were never made");
    assert.deepEqual([world.east[0].locked, world.east[1].locked, world.west[0].locked, world.stashes[0].locked], [false, false, false, false], "unlocked in the game");
    assert.equal(sut.api.lockedNow(world.east[0].guid), true, "and locked by the server's record");
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
    assert.equal(door.locked, false, "and the game is not told");
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

test("locking a chest by id makes no key type: the lock is the server's, and nobody has a key until one is made", () => {
    const { world, sut, find } = mapped();
    const chest = find("Baú 01");
    sut.api.setLocked(chest.id, true);
    assert.equal(sut.itemCalls.length, 0);
    assert.equal(world.stashes.find((s) => s.levelGuid === chest.stashGuid).locked, false);
    assert.equal(sut.api.lockedNow(chest.stashGuid), true);
});

test("an administrator can lock or unlock a property by id, and a door that stood open is shut with the lock", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    world.east[1].setOpen(true);

    assert.match(sut.api.setLocked(house.id, true).message, /trancada/);
    assert.equal(sut.api.lockedNow(world.east[0].guid), true);
    assert.equal(world.east[0].locked, false);
    assert.equal(world.east[1].open, false, "a lock is turned on a shut door");
    assert.match(sut.api.setLocked(house.id, false).message, /destrancada/);
    assert.equal(sut.api.lockedNow(world.east[0].guid), false);
    assert.equal(sut.api.setLocked("nope", true).ok, false);
});

test("a door the level has not reported at start is unlocked in the game once it is", () => {
    const door = makeDoor("8000000000000001", { locked: true });
    const seed = { casa: { id: "casa", name: "Casa", region: "Suchdol", kind: "house", doorGuid: "8000000000000001", doors: ["8000000000000001"], keyItem: "kcdc-property:casa", locked: true, keys: 1 } };
    const doors = [];
    const sut = load({ doors, seed });
    sut.api.installProperties();
    assert.ok(sut.logs.some((line) => /1 esperando o nível/.test(line)));
    const retry = sut.intervals[0];

    retry.fn();
    assert.equal(door.locked, true, "still nothing there");
    assert.equal(sut.cleared.length, 0);

    doors.push(door);
    retry.fn();
    assert.equal(door.locked, false);
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

test("the sweep keeps the world in line: what the level reports late, and a locked door found open, which it shuts", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.setLocked(house.id, true);
    world.east[0].locked = true;
    world.east[1].setOpen(true);
    world.west[0].setOpen(true);

    const closed = Array.from(sut.api.sweepWorld());
    assert.equal(world.east[0].locked, false);
    assert.deepEqual(closed, [world.east[1].guid], "opened behind the server's back while locked");
    assert.equal(world.west[0].open, true, "an unlocked door that stands open is left so");
});

test("a lockpicking holds a real lock on in the game until it is let go, and the sweep leaves it alone meanwhile", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    sut.api.setLocked(house.id, true);

    assert.equal(sut.api.holdShut(world.east[0].guid, true), true);
    assert.equal(world.east[0].locked, true);
    sut.api.sweepWorld();
    assert.equal(world.east[0].locked, true, "held for the minigame");
    assert.equal(sut.api.holdShut(world.east[0].guid, false), true);
    assert.equal(world.east[0].locked, false);
    assert.equal(sut.api.holdShut("deadbeefdeadbeef", true), false, "nothing the level has reported");
    assert.equal(sut.api.lockpickableOf(world.east[0].guid), true);
    assert.equal(sut.api.lockpickableOf("deadbeefdeadbeef"), false);
});


test("a look holds a real lock on in the game for as long as it lasts, which the sweep and a lock from the menu leave alone", () => {
    const { world, sut, find } = mapped();
    const house = find("Casa 02");
    const guid = world.east[0].guid;

    assert.equal(sut.api.holdGaze(guid, true), true);
    assert.equal(world.east[0].locked, true);
    sut.api.sweepWorld();
    assert.equal(world.east[0].locked, true, "the sweep keeps the world open to everybody, but not under a look");
    sut.api.setLocked(house.id, false);
    assert.equal(world.east[0].locked, true, "nor does the menu's own unlocking take it off under the player's eyes");

    assert.equal(sut.api.holdGaze(guid, false), true);
    assert.equal(world.east[0].locked, false, "the world is open again");
    assert.equal(sut.api.holdGaze(guid, false), false, "a look that was not held has nothing to let go");
    assert.equal(sut.api.holdGaze("deadbeefdeadbeef", true), false, "nothing the level has reported");
});

test("a lockpicking keeps its lock through a look, and a look cannot take a door a lockpicking holds", () => {
    const { world, sut } = mapped();
    const guid = world.east[0].guid;
    assert.equal(sut.api.holdShut(guid, true), true);
    assert.equal(sut.api.holdGaze(guid, true), false, "held for the minigame already");
    sut.api.holdShut(guid, false);

    assert.equal(sut.api.holdGaze(guid, true), true);
    assert.equal(sut.api.holdShut(guid, true), true, "a picking begun under a look");
    assert.equal(sut.api.holdGaze(guid, false), true);
    assert.equal(world.east[0].locked, true, "the look lets go and the picking's lock stays");
    assert.equal(sut.api.holdShut(guid, false), true);
    assert.equal(world.east[0].locked, false);
});

test("a door that was opened by hand while it was held is not locked again when the look lets go", () => {
    const { world, sut } = mapped();
    const guid = world.east[0].guid;
    sut.api.holdGaze(guid, true);
    world.east[0].setOpen(true);
    assert.equal(world.east[0].locked, false, "opening a locked door unlocks it, as the game's own Open does");
    sut.api.holdGaze(guid, false);
    assert.equal(world.east[0].locked, false);
    assert.equal(world.east[0].open, true);
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
    assert.match(result.message, /Casa 01 agora é de Hans\. As chaves ficam no painel/);
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

test("a property's lock is the level's until somebody sets one; what is forced or unbolted stays open only until the next start", () => {
    const { sut, doors, stash } = castle({}, { locked: true });
    sut.api.sweepWorld();
    assert.deepEqual(doors.map((door) => door.locked), [false, false, false], "unlocked in the game");
    assert.equal(sut.api.lockedNow(D1), true, "locked as the level built it");
    assert.equal(sut.api.lockedNow(stash.levelGuid), false, "a chest the level built unlocked");
    assert.equal(sut.api.lockedNow("nao-existe"), null);

    sut.api.unlockPart(D2);
    assert.equal(sut.api.lockedNow(D2), false, "forced, or unbolted from inside");
    assert.equal(sut.api.lockState(sut.api.getProperty("casa-grande")), "part");
    assert.equal(sut.api.getProperty("casa-grande").lockSet, undefined, "nothing written down: a restart shuts it again, as the level would");

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
    assert.deepEqual(Array.from(sut.api.doorLines(house), (line) => line.locked), [false, false, false], "the world's lock is not the server's");
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
    assert.deepEqual(doors.map((door) => door.locked), [false, false, false], "unlocked in the game");

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
    assert.deepEqual(doors.map((door) => door.locked), [false, false, false]);
});

test("at start each door keeps its own mark, and a house kept shut only by a door is not forgotten", () => {
    const first = castle();
    first.sut.api.setDoorLocked("casa-grande", 1, true);
    const seed = first.sut.saved();

    const doors = [makeDoor(D1), makeDoor(D2), makeDoor(D3)];
    const sut = load({ doors, stashes: [makeStash("c000000000000001")], seed });
    sut.api.installProperties();
    assert.deepEqual([D1, D2, D3].map((guid) => sut.api.lockedNow(guid)), [false, true, false]);
    assert.deepEqual(doors.map((door) => door.locked), [false, false, false]);
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

test("a door held shut for a lockpicking is not touched by the idle close", () => {
    const { world, sut } = mapped();
    const door = world.west[0];
    door.setOpen(true);
    sut.api.holdShut(door.guid, true);
    sut.api.closeIdleDoors(1_000, []);
    assert.deepEqual(Array.from(sut.api.closeIdleDoors(1_000_000, [])), []);
    assert.equal(door.open, true);
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
