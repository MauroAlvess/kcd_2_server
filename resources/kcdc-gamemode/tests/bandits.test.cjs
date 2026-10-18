const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const place = (name, layer, x, y, z = 100, soul = `soul-${name}`) => ({ name, guid: name, level: "kutnohorsko", layer, soul, actorClass: "NPC", position: { x, y, z }, rotation: { w: 1, x: 0, y: 0, z: 0 } });

const KOPEC = "Main/kkop_kopecVysoka/series_banditCamp/banditCamp/_script/npc";
const RAB = "Main/krab_rabstejnsko/bandit_camp/script/npc";
const QUEST = "Main/_quest/side/zakopanyZitrek/streamed/bandit_1";

/** What the game lists as equippable: everything a bandit wears or wields. */
const GEAR = ["TunicLong04_m01_D", "TunicLong05_m01_E", "TunicLong04_m02_D", "HoseSeparate01_m01_E", "HoseSeparate04_m01_E", "Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E", "Coat03_m01_E", "Coat03_m02_E", "axeWork01", "maceClub", "shortswordCleaver", "bow_b", "arrow_crude"];
const HEADS = new Set(["Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E"]);

/** Rows as the game got them (class GUIDs), back to the names they were asked for. */
const plain = (rows) => rows.map((row) => ({ ...row, item: row.item.replace(/^(cls|obj):/, "") }));

/** Placements of two real camps, a quest hideout, a villager and a cutscene bandit. */
function placements() {
    return [
        place("kkop_bandit_1", KOPEC, 1065, 2441),
        place("kkop_bandit_2", KOPEC, 1066, 2443),
        place("kkop_bandit_3", KOPEC, 1068, 2445),
        place("kkop_bandit_4", KOPEC, 1064, 2444),
        place("kkop_bandit_5", KOPEC, 1067, 2442),
        place("kkop_bandit_6", KOPEC, 1066, 2441),
        place("krab_man_28", RAB, 598, 1380),
        place("krab_man_29", RAB, 599, 1381),
        place("zakopanyZitrek_bandit_1", QUEST, 1296, 1340),
        place("kmal_farmer", "Main/kmal_malesov/village/_script/npc", 570, 280),
        place("cin_bandit", "cinematics/_mainquests/m31/bandits", 1065, 2441),
    ];
}

/**
 * `refuseWorn(rows)` says whether the game turns down a bandit's stock (as a body that will not wear something);
 * `unknown` lists names the game's tables do not have.
 */
function load({ placementList = placements(), stashes = [], properties = [], refuseWorn = () => false, unknown = [], animalPoints = [], navigation = { ready: false, closestPoint: () => null }, files: initialFiles = {} } = {}) {
    const npcs = new Map();
    const handlers = new Map();
    const timeouts = [];
    const intervals = [];
    const logs = [];
    const created = [];
    const stocked = new Map();
    const players = [];
    const clock = { now: 0 };
    const scratch = { made: 0, destroyed: 0 };
    let nextId = 1000;
    let r = 0;
    const randoms = { list: [] };
    const files = new Map(Object.entries(initialFiles));

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./properties.js") return { propertyOfStash: (guid) => (properties.includes(guid) ? { kind: "chest" } : null) };
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
                    write: (file, body) => files.set(file, JSON.stringify(body)),
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
        clearTimeout() {},
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        Navigation: navigation,
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => players },
        Inventory: {
            classes: () => GEAR.map((name) => ({ id: `cls:${name}`, name, nameKey: "", category: "Armor", maximumQuality: 4, quest: false })),
            set: (npc, request) => {
                // Like the server: a name is not a class.
                if (request.items.some((row) => !/^(cls|obj):/.test(row.item))) return { ok: false, code: "invalidItem" };
                if (refuseWorn(plain(request.items))) return { ok: false, code: "invalidEquipment" };
                stocked.set(npc.id, JSON.parse(JSON.stringify(request.items)));
                return { ok: true, code: "" };
            },
        },
        Stash: {
            all: () => stashes,
            find: (guid) => stashes.find((stash) => stash.levelGuid === guid) ?? null,
            createVirtual: () => {
                scratch.made += 1;
                let rows = [];
                return {
                    setInventory(request) { rows = request.items; return { ok: true, code: "" }; },
                    addItem({ item, amount }) {
                        if (unknown.includes(item)) return { ok: false, code: "invalidItem" };
                        rows = [{ id: "row-1", item: `obj:${item}`, amount }];
                        return { ok: true, code: "" };
                    },
                    getInventory: () => ({ revision: 1, items: rows }),
                    destroy() { scratch.destroyed += 1; },
                };
            },
        },
        Npc: {
            placements: () => placementList,
            animalSpawnpoints: () => animalPoints,
            create: (options) => {
                const npc = {
                    id: nextId++,
                    options,
                    alive: true,
                    status: "idle",
                    position: { x: options.position.x, y: options.position.y, z: options.position.z },
                    attacks: [],
                    moves: [],
                    holds: 0,
                    removed: false,
                    attack(target, opts) { this.attacks.push({ target: target.id, opts }); this.status = "running"; return true; },
                    hold() { this.holds += 1; this.status = "idle"; },
                    say(text) { (this.said ??= []).push(text); return true; },
                    moveTo(target, opts) { this.moves.push({ target, opts }); this.status = "running"; return true; },
                    remove() { this.removed = true; npcs.delete(this.id); handlers.get("npcDestroy")?.(this); },
                };
                npcs.set(npc.id, npc);
                created.push(npc);
                return npc;
            },
            getById: (id) => npcs.get(id) ?? null,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/bandits.js"), "utf8"), context);
    // A fixed sequence that still varies, so loot draws are not all the same item.
    let seed = 12345;
    const lcg = () => {
        seed = (seed * 1103515245 + 12345) % 2147483648;
        return seed / 2147483648;
    };
    const random = () => (r < randoms.list.length ? randoms.list[r++] : lcg());
    const camps = new context.exports.BanditCamps(context.exports.banditSettings, () => clock.now, random);
    const addPlayer = (id, x, y, over = {}) => {
        const player = { id, steamId: `7656119800000000${id}`, nickname: `p${id}`, ready: true, alive: true, canAct: true, virtualWorld: 0, position: { x, y, z: 100 }, ...over };
        players.push(player);
        return player;
    };
    return { api: context.exports, camps, npcs, handlers, timeouts, intervals, logs, created, stocked, players, clock, addPlayer, randoms, context, scratch, files };
}

const chestStash = (guid, name, x, y, refuse = () => false) => ({
    levelGuid: guid,
    name,
    position: { x, y, z: 100 },
    isOpen: false,
    filled: [],
    setInventory(request) {
        if (request.items.some((row) => !/^(cls|obj):/.test(row.item))) return { ok: false, code: "invalidItem" };
        if (refuse(plain(request.items))) return { ok: false, code: "invalidItem" };
        this.filled.push(plain(JSON.parse(JSON.stringify(request.items))));
        return { ok: true, code: "" };
    },
});

test("the level's bandit placements become camps; villagers and cutscenes do not", () => {
    const sut = load();
    assert.equal(sut.camps.discover(placements()), 3);
    const names = Array.from(sut.camps.camps, (camp) => camp.name);
    assert.deepEqual(names, ["Kopec Vysoká", "Rabštejnsko", "Esconderijo 1"]);
    const kopec = sut.camps.camps[0];
    assert.ok(Math.abs(kopec.center.x - 1066) < 1 && Math.abs(kopec.center.y - 2442.7) < 1);
    assert.equal(kopec.slots.length, 6, "six placements, six bandits (a camp holds up to eight)");
    assert.equal(sut.camps.camps[1].slots.length, 5, "two placements, at least five bandits");
    assert.equal(sut.camps.camps[2].slots.length, 5);
    assert.deepEqual(Array.from(kopec.slots, (slot) => slot.archer), [false, false, false, false, false, true], "one archer for a camp this size");
    assert.equal(kopec.slots[0].spot.soul, "soul-kkop_bandit_1", "the level's own bandit soul");
});

test("two camps in one region are numbered from west to east", () => {
    const list = [
        place("east_1", KOPEC, 1265, 2441),
        place("east_2", KOPEC, 1266, 2442),
        place("east_3", KOPEC, 1267, 2443),
        place("west_1", KOPEC, 1065, 2441),
        place("west_2", KOPEC, 1066, 2442),
        place("west_3", KOPEC, 1067, 2443),
        place("krab_man_28", RAB, 598, 1380),
    ];
    const sut = load({ placementList: list });
    sut.camps.discover(list);
    const byName = new Map(Array.from(sut.camps.camps, (camp) => [camp.name, camp.center.x]));
    assert.deepEqual([...byName.keys()].sort(), ["Kopec Vysoká 1", "Kopec Vysoká 2", "Rabštejnsko"]);
    assert.ok(byName.get("Kopec Vysoká 1") < byName.get("Kopec Vysoká 2"), "1 is the western one");
});

test("with no bandits in the catalog the camps found in the level data are used", () => {
    const sut = load({ placementList: [] });
    assert.equal(sut.camps.discover([]), 5);
    assert.deepEqual(Array.from(sut.camps.camps, (camp) => camp.name), ["Grunta", "Vrchlicko (moinho)", "Kopec Vysoká", "Rabštejnsko", "Mezholezsko"]);
    assert.equal(sut.camps.camps[0].slots[0].spot.soul, "bandit");
});

test("item names go to the game as class GUIDs: worn things from the equippable list, the rest through a scratch stash", () => {
    const sut = load({ unknown: ["nonsense"] });
    const guids = sut.api.resolveItems(["TunicLong04_m01_D", "bow_b", "bread", "money", "nonsense"]);
    assert.equal(guids.get("tuniclong04_m01_d"), "cls:TunicLong04_m01_D");
    assert.equal(guids.get("bow_b"), "cls:bow_b");
    assert.equal(guids.get("bread"), "obj:bread");
    assert.equal(guids.get("money"), "obj:money");
    assert.equal(guids.has("nonsense"), false, "a name the game does not know is left out");
    assert.deepEqual([sut.scratch.made, sut.scratch.destroyed], [1, 1], "one scratch stash, thrown away after");
});

test("a bandit is tougher than an ordinary man, and wears and carries only plain things", () => {
    const sut = load();
    sut.camps.discover(placements());
    assert.equal(sut.camps.spawnAll(), 16);
    const melee = sut.created[0];
    assert.equal(melee.options.health, 180);
    assert.equal(melee.options.maxHealth, 180);
    assert.equal(melee.options.lootable, true);
    assert.equal(melee.options.nametag, false);
    assert.equal(melee.options.interactable, false);

    const allowed = new Set([...GEAR, "money", "bread", "apple", "carrot"]);
    for (const npc of sut.created) {
        const raw = sut.stocked.get(npc.id);
        assert.ok(raw.every((row) => /^(cls|obj):/.test(row.item)), "sent as class GUIDs");
        const items = plain(raw);
        assert.ok(items.every((row) => allowed.has(row.item)), `only plain things: ${JSON.stringify(items.map((row) => row.item))}`);
        const money = items.find((row) => row.item === "money");
        assert.ok(money.amount >= 50 && money.amount <= 200, "5 to 20 coins as the game shows them");
        assert.ok(items.some((row) => /^Tunic/.test(row.item) && row.equipped === 1), "dressed");
    }
    const archer = sut.created[5];
    const bow = plain(sut.stocked.get(archer.id));
    assert.ok(bow.some((row) => row.item === "bow_b" && row.equipped === 1));
    assert.ok(bow.some((row) => row.item === "arrow_crude" && row.equipped === row.amount && row.amount >= 10));
    assert.ok(plain(sut.stocked.get(melee.id)).some((row) => ["axeWork01", "maceClub", "shortswordCleaver"].includes(row.item) && row.equipped === 1));
    assert.deepEqual(Array.from(sut.camps.report()), [], "nothing refused");
});

test("a garment the body will not wear is left off; the bandit keeps the rest and the log names it", () => {
    const sut = load({ refuseWorn: (rows) => rows.some((row) => HEADS.has(row.item) && row.equipped > 0) });
    sut.camps.discover(placements());
    assert.equal(sut.camps.spawnAll(), 16);
    for (const npc of sut.created) {
        const items = plain(sut.stocked.get(npc.id));
        assert.ok(items.some((row) => /^Tunic/.test(row.item) && row.equipped === 1), "still dressed");
        assert.ok(!items.some((row) => HEADS.has(row.item)), "without the hood or cap");
        assert.ok(items.some((row) => row.item === "money"), "money and food still go in");
    }
    const report = Array.from(sut.camps.report());
    assert.equal(report.length, 1);
    assert.match(report[0], /^o jogo não vestiu: (Hood04_m01_E|Cap03_m01_E|Hood04_m03_E) \(\d+x\)/);
});

test("when the body takes none of it, the bandit keeps the clothes its soul came with", () => {
    const sut = load({ refuseWorn: (rows) => rows.some((row) => row.equipped > 0) });
    sut.camps.discover(placements());
    assert.equal(sut.camps.spawnAll(), 16, "still standing there");
    assert.equal(sut.stocked.size, 0, "nothing set, so nothing stripped");
    assert.deepEqual(Array.from(sut.camps.report()), ["recusado por inteiro: roupa e arma: invalidEquipment (16x)"]);
});

test("a name the game does not know is left out and named in the log", () => {
    const sut = load({ unknown: ["money"] });
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    for (const npc of sut.created) {
        assert.ok(!plain(sut.stocked.get(npc.id)).some((row) => row.item === "money"));
    }
    assert.ok(Array.from(sut.camps.report()).includes("nomes que o jogo não conhece: money"));
});

test("a player who comes close is attacked, the archer shoots, and the whole camp joins in", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const ids = Array.from(kopec.slots, (slot) => slot.npcId);
    // In aggro range of the first bandit only (the camp is ~3 m wide, so everyone is close anyway; move the others away).
    sut.npcs.get(ids[1]).position = { x: 1066 + 40, y: 2442, z: 100 };
    const player = sut.addPlayer(1, 1066, 2442 - 20);

    sut.camps.tick();
    const first = sut.npcs.get(ids[0]);
    assert.deepEqual(first.attacks.at(-1).target, 1);
    const far = sut.npcs.get(ids[1]);
    sut.camps.tick();
    assert.equal(far.attacks.at(-1)?.target, 1, "a bandit 40 m off joins the fight the camp is in");
    const archer = sut.npcs.get(ids[5]);
    assert.equal(archer.attacks.at(-1).opts.weapon, "bow");
    assert.ok(player);
});

test("an archer who cannot shoot fights hand to hand", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const slot = sut.camps.camps[0].slots[5];
    const archer = sut.npcs.get(slot.npcId);
    archer.attack = function (target, opts) {
        this.attacks.push({ target: target.id, opts });
        return opts?.weapon !== "bow";
    };
    sut.addPlayer(1, 1066, 2442 - 20);
    sut.camps.tick();
    assert.deepEqual(archer.attacks.map((attack) => attack.opts?.weapon ?? "melee"), ["bow", "melee"]);
    assert.equal(slot.target, 1);
});

test("bandits do not chase past their camp: out of the leash they stop and walk home", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const npc = sut.npcs.get(kopec.slots[0].npcId);
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    sut.camps.tick();
    assert.equal(npc.attacks.length, 1);

    // The fight drifted: the bandit followed, and the player is now 70 m from the camp.
    npc.position = { x: 1066, y: 2442 - 50, z: 100 };
    player.position = { x: 1066, y: 2442 - 70, z: 100 };
    sut.clock.now += 61_000;
    npc.status = "idle";
    sut.camps.tick();
    assert.ok(npc.holds >= 1, "it lets go");
    assert.ok(npc.moves.length >= 1, "and walks back");
    assert.equal(npc.moves.at(-1).opts.pathfinding, "server");
});

test("a bandit's blow on a player is heavier; anyone else's is not", () => {
    const sut = load({ placementList: placements() });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    const bandit = sut.created[0];
    const hit = { damage: 10 };
    sut.handlers.get("playerHit")({}, bandit, hit);
    assert.equal(hit.damage, 16);

    const other = { damage: 10 };
    sut.handlers.get("playerHit")({}, { id: 99999 }, other);
    assert.equal(other.damage, 10);
    const fromPlayer = { damage: 10 };
    sut.handlers.get("playerHit")({}, { id: bandit.id, steamId: "x" }, fromPlayer);
    assert.equal(fromPlayer.damage, 10, "a player who happens to share an id is not a bandit");
    assert.ok(sut.logs.some((line) => /16 bandido\(s\) em 3 acampamento\(s\)/.test(line)));
});

test("hitting one bandit sets the whole camp on the attacker, even from out of sight", () => {
    const sut = load({ placementList: placements() });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    const camp = sut.api.banditCamps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    const player = sut.addPlayer(1, 1066 + 50, 2442);
    sut.handlers.get("npcDamage")(sut.npcs.get(ids[2]), player, 5);
    sut.intervals[0].fn();
    for (const id of ids) {
        assert.equal(sut.npcs.get(id).attacks.at(-1)?.target, 1, `bandit ${id} turned on the attacker`);
    }
});

test("a dead bandit's body stays for ten minutes and is cleared when nobody is near; it comes back after thirty", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[1];
    const slot = camp.slots[0];
    const corpse = sut.npcs.get(slot.npcId);
    corpse.alive = false;
    sut.camps.died(corpse.id);

    sut.clock.now = 9 * 60_000;
    sut.camps.tick();
    assert.equal(corpse.removed, false, "still there to be searched");

    const looter = sut.addPlayer(1, 598, 1380 + 30);
    sut.clock.now = 11 * 60_000;
    sut.camps.tick();
    assert.equal(corpse.removed, false, "not with somebody standing by it");

    sut.players.length = 0;
    sut.camps.tick();
    assert.equal(corpse.removed, true);
    assert.equal(slot.state, "dead");

    sut.clock.now = 29 * 60_000;
    sut.camps.tick();
    assert.equal(slot.state, "dead", "not yet");
    const watcher = sut.addPlayer(2, 598, 1380 + 60);
    sut.clock.now = 31 * 60_000;
    sut.camps.tick();
    assert.equal(slot.state, "dead", "nobody comes back in front of a player");
    sut.players.length = 0;
    sut.camps.tick();
    assert.equal(slot.state, "alive");
    assert.notEqual(slot.npcId, corpse.id);
    assert.ok(looter && watcher);
});

test("the camp chests are filled with guild goods and sometimes clothes, the catalog's chests are left alone", () => {
    const stashes = [
        chestStash("c1", "stash[Chest/chest3_x]", 1070, 2445),
        chestStash("c2", "Stash12[Stash/barrel_with_arrows29_x]", 1060, 2440),
        chestStash("c3", "stash[Chest/chest9_x]", 1200, 2445),
        chestStash("c4", "stash[Chest/chest1_x]", 1065, 2440),
        chestStash("", "spawned_stash_1", 1066, 2442),
        chestStash("c5", "DeadBody", 1066, 2442),
        chestStash("c6", "Stash2[Stash/bee_hive3_x]", 1066, 2443),
        chestStash("c7", "stash[Quest/dlc_box_x]", 1066, 2443),
    ];
    const sut = load({ stashes, properties: ["c4"] });
    sut.camps.discover(placements());
    const filled = sut.camps.stockChests(true);
    assert.equal(filled, 2, "the chest and the arrow barrel at Kopec; the far chest, the catalog chest, the scripted one, a corpse, a beehive and a quest box are not");
    assert.deepEqual(Array.from(sut.camps.camps[0].chests), ["c1", "c2"]);

    const guild = new Set(sut.api.CHEST_LOOT.flatMap((entry) => entry.items));
    for (const rows of stashes[0].filled) {
        assert.ok(rows.length >= 3 && rows.length <= 7);
        const goods = rows.filter((row) => guild.has(row.item));
        assert.ok(goods.length >= 3, "three to six kinds of guild goods");
        assert.ok(rows.length - goods.length <= 1, "at most one piece of clothing besides");
        assert.equal(new Set(rows.map((row) => row.item)).size, rows.length, "no item twice");
    }
});

test("a chest that will not take one good still gets the rest, and that good is not offered again", () => {
    const refuse = (rows) => rows.some((row) => row.item === "bsmt_ironBad");
    const stashes = [chestStash("c1", "stash[Chest/chest3_x]", 1070, 2445, refuse), chestStash("c2", "stash[Chest/chest4_x]", 1062, 2441, refuse)];
    const sut = load({ stashes });
    sut.camps.discover(placements());
    // What each chest holds after each fill: the last lot it took.
    const finals = stashes.map(() => []);
    for (let round = 0; round < 12; round += 1) {
        assert.equal(sut.camps.stockChests(true), 2, "every fill goes in");
        stashes.forEach((stash, index) => finals[index].push(stash.filled.at(-1)));
    }
    assert.ok(sut.camps.refusedLoot.has("bsmt_ironBad"));
    for (const held of finals) {
        assert.equal(held.length, 12);
        assert.ok(held.every((rows) => rows.length >= 2 && !rows.some((row) => row.item === "bsmt_ironBad")));
    }
    assert.ok(Array.from(sut.camps.report()).includes("os baús não aceitaram: bsmt_ironBad"));
});

test("camp chests are filled again after an hour, and only while nobody is around", () => {
    const chest = chestStash("c1", "stash[Chest/chest3_x]", 1070, 2445);
    const sut = load({ stashes: [chest] });
    sut.camps.discover(placements());
    sut.camps.stockChests(true);
    assert.equal(chest.filled.length, 1);

    sut.clock.now = 59 * 60_000;
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1);

    sut.clock.now = 61 * 60_000;
    sut.addPlayer(1, 1070, 2445 + 30);
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1, "not with a player at the camp");
    sut.players.length = 0;
    chest.isOpen = true;
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1, "not while somebody has it open");
    chest.isOpen = false;
    sut.clock.now = 125 * 60_000;
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 2);
});

test("an administrator's restock brings every dead bandit back and fills the chests now", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const slot = sut.camps.camps[0].slots[0];
    sut.npcs.get(slot.npcId).alive = false;
    sut.camps.died(slot.npcId);
    const { spawned } = sut.camps.restockNow();
    assert.equal(spawned, 1);
    assert.equal(slot.state, "alive");
    assert.equal(Array.from(sut.camps.describe())[0].includes("6/6 vivos"), true);
});

test("stopping removes every bandit", () => {
    const sut = load({ placementList: placements() });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    assert.equal(sut.npcs.size, 16);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.npcs.size, 0);
});

// ---------------------------------------------------------------------------------------------
// The hideouts the script adds in the wild.

/** Markers on a 500 m grid, ten by ten. */
function grid() {
    const list = [];
    for (let i = 0; i < 10; i += 1) {
        for (let j = 0; j < 10; j += 1) list.push({ guid: `m-${i}-${j}`, position: { x: i * 500, y: j * 500, z: 100 } });
    }
    return list;
}

/** A mesh that walks anywhere, except where `blocked` says no. */
const mesh = (blocked = () => false) => ({
    project: (at) => (blocked(at) ? null : { x: at.x, y: at.y, z: at.z }),
    around: (centre, radius) => ({ x: centre.x + radius / 2, y: centre.y, z: centre.z }),
});

const flatDistance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

test("a name always gives the same number, so the hideouts are the same on every start", () => {
    const { api } = load();
    assert.equal(api.stableHash("abc"), api.stableHash("abc"));
    assert.notEqual(api.stableHash("abc"), api.stableHash("abd"));
    assert.ok(api.stableHash("a-guid-of-the-level") >= 0);
});

test("hideouts keep clear of people, of the level's camps and of each other, and are no more than twenty", () => {
    const sut = load();
    sut.camps.discover(placements());
    const camps = Array.from(sut.camps.camps, (camp) => camp.center);
    const people = [{ x: 2000, y: 2000, z: 100 }, { x: 3500, y: 500, z: 100 }];
    const added = sut.camps.addWild(grid(), people, mesh());
    const wild = sut.camps.camps.slice(3);
    assert.equal(added, wild.length);
    assert.ok(added >= 6 && added <= 20, `a fair number of hideouts: ${added}`);
    for (const camp of wild) {
        assert.ok(people.every((person) => flatDistance(person, camp.center) >= 300), "away from the people");
        assert.ok(camps.every((other) => flatDistance(other, camp.center) >= 450), "away from the level's camps");
        assert.ok(wild.every((other) => other === camp || flatDistance(other.center, camp.center) >= 650), "away from one another");
    }
});

test("the same markers give the same hideouts, whatever order they come in", () => {
    const one = load();
    one.camps.discover(placements());
    one.camps.addWild(grid(), [], mesh());
    const other = load();
    other.camps.discover(placements());
    other.camps.addWild(grid().reverse(), [], mesh());
    const centres = (sut) => Array.from(sut.camps.camps, (camp) => `${camp.name}@${camp.center.x},${camp.center.y}`);
    assert.deepEqual(centres(one), centres(other));
});

test("a marker that cannot be walked to is passed over, and the hideouts are numbered on from the level's own", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addWild(grid(), [], mesh((at) => at.x < 1000));
    const wild = sut.camps.camps.slice(3);
    assert.ok(wild.length > 0);
    assert.ok(wild.every((camp) => camp.center.x >= 1000), "none on ground the mesh does not have");
    assert.deepEqual(Array.from(wild, (camp) => camp.name), Array.from(wild, (_camp, index) => `Esconderijo ${index + 2}`), "the quest hideout was number 1");
});

test("a hideout holds three to five bandits in the souls the level's own bandits come in, with an archer", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addWild(grid(), [], mesh());
    const own = new Set(["soul-kkop_bandit_1", "soul-kkop_bandit_2", "soul-kkop_bandit_3", "soul-kkop_bandit_4", "soul-kkop_bandit_5", "soul-kkop_bandit_6", "soul-krab_man_28", "soul-krab_man_29", "soul-zakopanyZitrek_bandit_1"]);
    for (const camp of sut.camps.camps.slice(3)) {
        assert.ok(camp.slots.length >= 3 && camp.slots.length <= 5, `${camp.name}: ${camp.slots.length}`);
        assert.equal(camp.slots.filter((slot) => slot.archer).length, sut.api.archersFor(camp.slots.length));
        assert.ok(camp.slots.every((slot) => own.has(slot.spot.soul)), "the level's own souls");
        assert.ok(camp.slots.every((slot) => flatDistance(slot.spot.position, camp.center) <= 7 + 0.01), "standing about the centre");
    }
});

test("where the level puts people everywhere, or marks nothing, there are no hideouts", () => {
    const crowded = load();
    crowded.camps.discover(placements());
    const everywhere = grid().map((marker) => marker.position);
    assert.equal(crowded.camps.addWild(grid(), everywhere, mesh()), 0);
    const empty = load();
    empty.camps.discover(placements());
    assert.equal(empty.camps.addWild([], [], mesh()), 0);
    assert.equal(empty.camps.camps.length, 3);
});

test("one archer for every four bandits of a camp of three or more", () => {
    const { api } = load();
    assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8].map((count) => api.archersFor(count)), [0, 0, 1, 1, 1, 1, 1, 2]);
});

test("a camp of eight has two archers, at the end of its line", () => {
    const list = [];
    for (let index = 0; index < 8; index += 1) list.push(place(`kkop_bandit_${index}`, KOPEC, 1065 + index, 2441));
    const sut = load({ placementList: list });
    sut.camps.discover(list);
    assert.deepEqual(Array.from(sut.camps.camps[0].slots, (slot) => slot.archer), [false, false, false, false, false, false, true, true]);
});

test("installing puts the hideouts in once the navigation mesh is ready, on wild markers away from villagers", () => {
    const nav = { ready: false, closestPoint: (at) => ({ x: at.x, y: at.y, z: at.z }), randomPoint: (centre, radius) => ({ x: centre.x + radius / 2, y: centre.y, z: centre.z }) };
    const animalPoints = grid().map((marker, index) => ({ ...marker, count: 3, actorClass: index % 3 === 0 ? "CattleCow" : "Boar", soul: "s" }));
    // A village's people: one at the first marker of the grid that is not a pasture's, so that no hideout is hidden near it.
    const villagers = [place("kmal_farmer", "Main/kmal_malesov/village/_script/npc", 500, 500)];
    const sut = load({ placementList: [...placements(), ...villagers], animalPoints, navigation: nav });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    assert.equal(sut.api.banditCamps.camps.length, 3, "no mesh yet: only the level's camps");
    assert.equal(sut.timeouts.length, 2, "and a wait for the mesh");
    assert.equal(sut.timeouts[1].ms, 10_000);

    nav.ready = true;
    sut.timeouts[1].fn();
    const camps = sut.api.banditCamps.camps;
    assert.ok(camps.length > 3, "hideouts added");
    const boars = animalPoints.filter((point) => point.actorClass === "Boar").map((point) => `${point.position.x},${point.position.y}`);
    assert.ok(camps.slice(3).every((camp) => boars.includes(`${camp.center.x},${camp.center.y}`)), "on wild markers, never a pasture's");
    assert.ok(camps.slice(3).every((camp) => flatDistance(camp.center, { x: 500, y: 500 }) >= 300), "away from the villager");
    assert.ok(sut.logs.some((line) => /bandits: \d+ esconderijo\(s\) na mata/.test(line)));
    assert.ok(sut.npcs.size > 16, "and their bandits stand in the world");
});

test("hideouts give up when the mesh never comes", () => {
    const nav = { ready: false, closestPoint: () => null, randomPoint: () => null };
    const sut = load({ placementList: placements(), animalPoints: grid().map((marker) => ({ ...marker, count: 3, actorClass: "Boar", soul: "s" })), navigation: nav });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    for (let round = 1; round <= 12; round += 1) sut.timeouts[round].fn();
    assert.equal(sut.api.banditCamps.camps.length, 3);
    assert.ok(sut.logs.some((line) => /sem esconderijos na mata/.test(line)));
    assert.equal(sut.timeouts.length, 13, "no wait after the last try");
});

test("stopping the resource stops a wait for the mesh", () => {
    const nav = { ready: false, closestPoint: () => null, randomPoint: () => null };
    const cleared = [];
    const sut = load({ placementList: placements(), animalPoints: [], navigation: nav });
    sut.context.clearTimeout = (id) => cleared.push(id);
    sut.api.installBandits();
    sut.timeouts[0].fn();
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.ok(cleared.includes(2), "the pending wait is cleared");
});

// ---------------------------------------------------------------------------------------------
// How hard they are, and what they shout.

test("three levels of aggression change how far they see, how hard they hit and how long a camp is roused; the middle one is how they were", () => {
    const sut = load();
    const { AGGRESSION, banditSettings, setAggression, aggressionLevel } = sut.api;
    assert.equal(aggressionLevel(), "media");
    assert.deepEqual([banditSettings.aggroRadius, banditSettings.damageMultiplier, banditSettings.alarmMs], [28, 1.6, 60_000], "unchanged from before there was a choice");

    setAggression("alta");
    assert.deepEqual([banditSettings.aggroRadius, banditSettings.damageMultiplier, banditSettings.alarmMs], [42, 2, 120_000]);
    setAggression("baixa");
    assert.deepEqual([banditSettings.aggroRadius, banditSettings.damageMultiplier, banditSettings.alarmMs], [16, 1.2, 30_000]);
    assert.ok(AGGRESSION.baixa.aggroRadius < AGGRESSION.media.aggroRadius && AGGRESSION.media.aggroRadius < AGGRESSION.alta.aggroRadius);
    assert.deepEqual(JSON.parse(sut.files.get("playerdata/bandits.json")), { aggression: "baixa" });
});

test("the level kept is read at the start, and a file that says nonsense leaves the middle one", () => {
    const low = load({ files: { "playerdata/bandits.json": JSON.stringify({ aggression: "baixa" }) } });
    low.api.installBandits();
    assert.equal(low.api.aggressionLevel(), "baixa");
    assert.equal(low.api.banditSettings.aggroRadius, 16);

    const odd = load({ files: { "playerdata/bandits.json": JSON.stringify({ aggression: "furiosa" }) } });
    odd.api.installBandits();
    assert.equal(odd.api.aggressionLevel(), "media");
});

test("a bandit who sees somebody shouts once, the camp roused shouts its own call, and a blow makes him curse; none shouts again within twenty seconds", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const ids = Array.from(sut.camps.camps[0].slots, (slot) => slot.npcId);
    ids.slice(1).forEach((id) => { sut.npcs.get(id).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    const first = sut.npcs.get(ids[0]);

    sut.camps.tick();
    assert.equal(first.said.length, 1);
    assert.ok(sut.api.BARKS.sight.includes(first.said[0]), first.said[0]);
    sut.camps.tick();
    assert.equal(first.said.length, 1, "once, not every tick");

    sut.clock.now += 21_000;
    sut.camps.hit(first.id, player);
    assert.equal(first.said.length, 2);
    assert.ok(sut.api.BARKS.hurt.includes(first.said[1]), first.said[1]);
    sut.camps.hit(first.id, player);
    assert.equal(first.said.length, 2, "twenty seconds between shouts");
});

test("a bandit who is roused by his camp's alarm answers with the alarm call", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    camp.alarm = { targetId: player.id, until: sut.clock.now + 60_000 };
    sut.camps.tick();
    const roused = sut.npcs.get(ids[1]);
    assert.ok(roused.said?.length >= 1);
    assert.ok(sut.api.BARKS.alarm.includes(roused.said[0]), roused.said[0]);
});
