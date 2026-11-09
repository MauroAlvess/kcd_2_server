const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// What an NPC says (src/server/npc-speech.ts, 2026-11-02), stood in for: said over the body as before, and recorded with its author.
const SPEECH = {
    speak: (npc, author, text, options = {}) => {
        if (typeof npc.say === "function") npc.say(text);
        (globalThis.__spoken ??= []).push({ npc: npc.id, author, text, to: (options.to ?? []).map((player) => player.id), radiusM: options.radiusM });
        return 1;
    },
    splitSpeaker: (line, fallback) => {
        const at = line.indexOf(": ");
        return at > 0 && at <= 60 && !/[.!?]/.test(line.slice(0, at)) ? { author: line.slice(0, at), text: line.slice(at + 2) } : { author: fallback, text: line };
    },
    turnBackAfterTalk: (npc, player, yaw) => { (globalThis.__turnBacks ??= []).push([npc.id, player.id, yaw]); },
    faceAhead: () => true,
};


// The real rules of what armour fits together (src/server/equipment-rules.ts): they require nothing.
const rulesSandbox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/equipment-rules.js"), "utf8"), rulesSandbox);
const RULES = rulesSandbox.exports;

const place = (name, layer, x, y, z = 100, soul = `soul-${name}`) => ({ name, guid: name, level: "kutnohorsko", layer, soul, actorClass: "NPC", position: { x, y, z }, rotation: { w: 1, x: 0, y: 0, z: 0 } });

const KOPEC = "Main/kkop_kopecVysoka/series_banditCamp/banditCamp/_script/npc";
const RAB = "Main/krab_rabstejnsko/bandit_camp/script/npc";
const QUEST = "Main/_quest/side/zakopanyZitrek/streamed/bandit_1";
// The level's other camps of enemies, which had tents and nobody at them (2026-10-24).
const POACHERS = "Main/ksuc_suchdol/poachersCamp/_script/npc/poachers";
const HUNTERS = "Main/klor_lorec/series_treasureHuntersCamp/default/_script/npc";
const DESERTERS = "Main/kpri_pritoky/_poi_stodolaZikmundoviZbehove/_script/npc/other";
const POACHERS_2 = "Main/kvrc_vrchlicko/poi_pytlackyTabor/_script/npc/other";

/** What the game lists as equippable: everything a bandit wears or wields. */
const NEW_ARMOUR = ["GambesonShort01_m02_D2", "GambesonShort01_m04_D2", "GambesonShort02_m03_E1", "GambesonLong01_m01_C3", "GambesonLong01_m15_C3", "CoifSmall02_m01_E1", "CoifSmall01_m02_C2", "CoifLarge02_m03_C3", "CoifMail02_m01_B3", "CoifMail02_m03_B3", "KettleHat02_m01_D2", "SkullCap04_m01_C3", "SkullCap04_m02_C3", "KettleHat04_m01_B4", "MailLong02_m01_C2", "MailShort01_m01_C4", "MailShort02_m01_C1", "ArmPlate01_m01_C2", "BrigandineArm01_m01_D1", "BootsAnkle03_m01_D", "BootsAnkle01_m01_C", "Gloves05_m01_B2", "BascinetOpen08_m01_B3", "Brigandine02_m04_E2", "Gauntlets04_m01_C2", "shortswordCommon", "axeBattle01", "mace01", "huntingSwordFalchion", "longswordCommon", "maceHetman", "axeFancy", "warhammer03", "BascinetOpen09_m01_B1"];
const GEAR = ["TunicLong04_m01_D", "TunicLong05_m01_E", "TunicLong04_m02_D", "HoseSeparate01_m01_E", "HoseSeparate04_m01_E", "Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E", "Coat03_m01_E", "Coat03_m02_E", "axeWork01", "maceClub", "shortswordCleaver", "bow_b", "arrow_crude", ...NEW_ARMOUR];
const HEADS = new Set(["Hood04_m01_E", "Cap03_m01_E", "Hood04_m03_E"]);
/** A veteran's battered kit (2026-10-21). */
const VETERAN_KIT = [...NEW_ARMOUR];

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
function load({ placementList = placements(), stashes = [], properties = [], refuseWorn = () => false, unknown = [], gearMissing = [], animalPoints = [], navigation = { ready: false, closestPoint: () => null }, files: initialFiles = {}, horses = null } = {}) {
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
    const removedFrom = [];
    const chats = [];

    const context = {
        exports: {},
        require: (id) => {
            if (id === "./equipment-rules.js") return RULES;
            if (id === "./npc-speech.js") return SPEECH;
            // A fallen man's purse shared by whoever fought him (2026-11-02): what each was given, in the game's units.
            if (id === "./money.js") {
                const purse = (holder) => (context.Inventory.get(holder)?.items ?? []).filter((row) => row.name === "money");
                return {
                    coins: (units) => `${units / 10} moedas`,
                    giveMoney: (player, units) => { (globalThis.__given ??= []).push([player.id, units]); return true; },
                    moneyOf: (holder) => purse(holder).reduce((sum, row) => sum + row.amount, 0),
                    takeMoney: (holder, units) => units <= 0 || context.Inventory.remove(holder, { units: purse(holder).map((row) => ({ id: row.id, amount: row.amount })) }).ok,
                };
            }
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
        Chat: { sendToPlayer: (player, text) => chats.push([player.id, text]) },
        ...(horses === null ? {} : { Horse: { all: () => horses, getById: (id) => horses.find((horse) => horse.id === id) ?? null } }),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => players, getById: (id) => players.find((player) => player.id === id) ?? null },
        Inventory: {
            classes: () => GEAR.filter((name) => !gearMissing.includes(name)).map((name) => ({ id: `cls:${name}`, name, nameKey: "", category: "Armor", maximumQuality: 4, quest: false })),
            set: (npc, request) => {
                // Like the server: a name is not a class.
                if (request.items.some((row) => !/^(cls|obj):/.test(row.item))) return { ok: false, code: "invalidItem" };
                if (refuseWorn(plain(request.items))) return { ok: false, code: "invalidEquipment" };
                stocked.set(npc.id, JSON.parse(JSON.stringify(request.items)));
                return { ok: true, code: "" };
            },
            get: (npc) => (stocked.has(npc.id) ? { revision: 1, items: stocked.get(npc.id).map((row, index) => ({ id: `row-${index}`, equipped: 0, name: String(row.item).replace(/^(cls|obj):/, ""), ...row })) } : null),
            remove: (npc, request) => {
                const rows = stocked.get(npc.id) ?? [];
                const gone = new Set(request.units.map((unit) => Number(unit.id.slice(4))));
                stocked.set(npc.id, rows.filter((_row, index) => !gone.has(index)));
                removedFrom.push([npc.id, request.units.length]);
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
                    attack(target, opts) { this.attacks.push({ target: target.id, opts }); this.status = "running"; this.intent = "attack"; return true; },
                    hold() { this.holds += 1; this.status = "idle"; this.intent = "hold"; },
                    lookAt(target) { (this.looks ??= []).push(target.id); return true; },
                    pin(player) { (this.pins ??= []).push(player === null ? null : player.id); },
                    say(text) { (this.said ??= []).push(text); return true; },
                    flee(from, opts) { (this.flees ??= []).push({ from: typeof from === "object" && from !== null && "id" in from ? from.id : from, opts }); this.status = "running"; this.intent = "flee"; return true; },
                    moveTo(target, opts) { this.moves.push({ target, opts }); this.status = "running"; this.intent = "moveTo"; return true; },
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
    return { api: context.exports, camps, npcs, handlers, timeouts, intervals, logs, created, stocked, players, clock, addPlayer, randoms, context, scratch, files, removedFrom, chats };
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

test("the level's other camps of enemies -- poachers, treasure hunters, deserters -- are camps too, named by their region", () => {
    const list = [
        place("ksuc_poacher_1", POACHERS, 805, 3845),
        place("ksuc_poacher_2", POACHERS, 806, 3846),
        place("ksuc_poacher_3", POACHERS, 804, 3844),
        place("klor_treasureHunter_2", HUNTERS, 3750, 1113),
        place("klor_treasureHunter_3", HUNTERS, 3752, 1112),
        place("klor_treasureHunter_4", HUNTERS, 3751, 1114),
        place("kpri_man_39", DESERTERS, 2300, 2090),
        place("kpri_man_40", DESERTERS, 2302, 2091),
        place("kvrc_poacher_1", POACHERS_2, 1477, 237),
        place("kvrc_poacher_2", POACHERS_2, 1478, 238),
        // The people of the same regions are none of these.
        place("kpri_farmer_1", "Main/kpri_pritoky/village/_script/npc", 2400, 2150),
        place("ksuc_cook", "Main/ksuc_suchdol/village/_script/npc", 900, 3900),
        place("klor_man_1", "Main/klor_lorec/village/_script/npc", 3800, 1200),
    ];
    const sut = load({ placementList: list });
    assert.equal(sut.camps.discover(list), 4);
    assert.deepEqual(Array.from(sut.camps.camps, (camp) => camp.name).sort(), ["Lorec", "Přítoky", "Suchdol", "Vrchlicko"]);
    const suchdol = sut.camps.camps.find((camp) => camp.name === "Suchdol");
    assert.equal(suchdol.slots.length, 5, "three placements, at least five bandits");
    assert.equal(suchdol.slots[0].spot.soul, "soul-ksuc_poacher_1", "the level's own soul");
    assert.ok(sut.camps.camps.every((camp) => camp.slots.length >= 5));
    assert.ok(!sut.camps.camps.some((camp) => camp.slots.some((slot) => /farmer|cook|klor_man/.test(slot.spot.soul))), "no villager became a bandit");
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
    assert.deepEqual(Array.from(sut.camps.camps, (camp) => camp.name), ["Minas", "Vrchlicko (moinho)", "Kopec Vysoká", "Rabštejnsko", "Mezholezsko"]);
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
    const melee = sut.created[2];
    assert.equal(melee.options.health, 140, "lowered 2026-10-30");
    assert.equal(melee.options.maxHealth, 140);
    assert.equal(melee.options.name, "Bandido");
    assert.equal(melee.options.lootable, true);
    assert.equal(melee.options.nametag, false);
    assert.equal(melee.options.interactable, false);

    // Plain clothes and weapons, coins and a bite, and now and then one of the guilds' goods (2026-10-18); a veteran's battered kit and the
    // second bow are taken off the body when he falls (2026-10-21).
    const allowed = new Set([...GEAR, "money", "bread", "apple", "carrot", ...sut.api.CHEST_LOOT.flatMap((entry) => entry.items), ...VETERAN_KIT]);
    // The chiefs' good armour and weapon are tried apart (2026-11-01).
    for (const npc of sut.created.filter((one) => one.options.name !== "Chefe dos bandidos")) {
        const raw = sut.stocked.get(npc.id);
        assert.ok(raw.every((row) => /^(cls|obj):/.test(row.item)), "sent as class GUIDs");
        const items = plain(raw);
        assert.ok(items.every((row) => allowed.has(row.item)), `only plain things: ${JSON.stringify(items.map((row) => row.item))}`);
        const money = items.find((row) => row.item === "money");
        assert.ok(money.amount >= 20 && money.amount <= 80, "2 to 8 coins as the game shows them (lowered 2026-10-25)");
        assert.ok(items.some((row) => /^(Tunic|Gambeson)/.test(row.item) && row.equipped === 1), "dressed");
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
        assert.ok(items.some((row) => /^(Tunic|Gambeson)/.test(row.item) && row.equipped === 1), "still dressed");
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

test("every kit a bandit is given fits the game's dressing: no tunic with a gambeson, a padded coif under a helmet, the base pieces first (2026-11-02)", () => {
    const order = (names) => names.map((name) => RULES.slotOf(name)).filter((slot) => slot !== null);
    for (const armourAll of [false, true]) {
        for (let seed = 0; seed < 12; seed += 1) {
            let state = seed * 7919 + 17;
            const sut = load();
            sut.camps.random = () => ((state = (state * 1103515245 + 12345) % 2147483648) / 2147483648);
            sut.camps.settings.armourAll = armourAll;
            sut.camps.discover(placements());
            sut.camps.spawnAll();
            for (const npc of sut.created) {
                const worn = plain(sut.stocked.get(npc.id)).filter((row) => (row.equipped ?? 0) > 0).map((row) => row.item);
                const problems = Array.from(RULES.kitProblems(worn));
                assert.equal(problems.length, 0, `${npc.options.name}: ${worn.join(", ")}: ${problems.join("; ")}`);
                const slots = order(worn);
                for (const [base, over] of [["head_coif_padded", "head_helmet"], ["body_cloth_padded", "body_chainmail"], ["body_cloth_padded", "body_plate"], ["body_cloth_padded", "sleeves"]]) {
                    if (slots.includes(over)) {
                        assert.ok(slots.indexOf(base) < slots.indexOf(over), `${base} before ${over}: ${worn.join(", ")}`);
                    }
                }
                if (armourAll || ["Bandido veterano", "Chefe dos bandidos"].includes(npc.options.name)) {
                    assert.ok(worn.some((name) => /^Gambeson/.test(name)), `${npc.options.name} in a gambeson`);
                }
            }
        }
    }
});

test("a piece the game does not know takes the piece that stands on it with it: no helmet without its coif (2026-11-02)", () => {
    const missing = ["CoifMail02_m01_B3", "CoifMail02_m03_B3"];
    const sut = load({ gearMissing: missing, unknown: missing });
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const chief = sut.npcs.get(sut.camps.camps[0].slots[0].npcId);
    const worn = plain(sut.stocked.get(chief.id)).filter((row) => (row.equipped ?? 0) > 0).map((row) => row.item);
    assert.ok(!worn.includes("BascinetOpen08_m01_B3"), "the bascinet is left off");
    assert.ok(worn.includes("Brigandine02_m04_E2") && worn.some((name) => /^GambesonLong/.test(name)), "the rest of his armour is on");
    assert.equal(RULES.kitProblems(worn).length, 0);
    assert.ok(Array.from(sut.camps.report()).some((line) => line.startsWith("o jogo não vestiu:") && line.includes("BascinetOpen08_m01_B3")));
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

test("a player who comes close is attacked: the nearest blade fights hand to hand (one at a time since 2026-11-02), the archer shoots, the rest close round him; a man out of earshot stays out (2026-10-30)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const men = Array.from(kopec.slots, (slot) => sut.npcs.get(slot.npcId));
    // Slot 1 stands 45 m off: out of sight of the player, and out of earshot of the others.
    men[1].position = { x: 1066 + 45, y: 2442, z: 100 };
    const player = sut.addPlayer(1, 1066, 2442 - 20);

    sut.camps.tick();
    assert.equal(men[0].attacks.at(-1).target, 1, "the nearest fights");
    assert.equal(men[4].attacks.length, 0, "and the next waits his turn");
    assert.equal(men[5].attacks.at(-1).opts.weapon, "bow", "the archer shoots");
    assert.deepEqual(Array.from(kopec.slots, (slot) => slot.role), ["front", undefined, "ring", "ring", "ring", "bow"]);

    // The other blades go to spots five and a half metres from him (nine until 2026-11-02), one on each side of the line the front is on, and apart from each other.
    const ring = [men[2], men[3], men[4]];
    for (const man of ring) {
        assert.equal(man.attacks.length, 0, "they do not charge");
        assert.equal(man.moves.length, 1);
        assert.equal(man.moves[0].opts.speed, "jog");
        assert.ok(Math.abs(Math.hypot(man.moves[0].target.x - player.position.x, man.moves[0].target.y - player.position.y) - 5.5) < 1e-6, "five and a half metres round him");
    }
    // The ring's spots, five and a half metres round him, are never in each other.
    const offsets = Array.from(sut.api.RING_OFFSETS_DEG);
    for (let a = 0; a < offsets.length; a += 1) {
        for (let b = a + 1; b < offsets.length; b += 1) {
            assert.ok(2 * 5.5 * Math.abs(Math.sin(((offsets[a] - offsets[b]) * Math.PI) / 360)) > 2, `${offsets[a]} and ${offsets[b]}: no two in each other`);
        }
    }
    assert.ok(ring[0].moves[0].target.x < player.position.x && player.position.x < ring[1].moves[0].target.x, "one to each side");
    assert.ok(sut.api.BARKS.surround.includes(ring[0].said[0]), "the first of the ring calls for the cerco");

    sut.clock.now += 10_000;
    sut.camps.tick();
    assert.equal(men[1].attacks.length, 0, "the man 45 m off never heard");
    assert.equal(kopec.slots[1].role, undefined);
    assert.equal(kopec.slots[1].target, null);
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
    const bandit = sut.created[2];
    const hit = { damage: 10 };
    sut.handlers.get("playerHit")({}, bandit, hit);
    assert.equal(hit.damage, 14);
    const veteranHit = { damage: 10 };
    sut.handlers.get("playerHit")({}, sut.created[1], veteranHit);
    assert.equal(veteranHit.damage, 17.5, "a veteran's still heavier");
    const chiefHit = { damage: 10 };
    sut.handlers.get("playerHit")({}, sut.created[0], chiefHit);
    assert.equal(Math.round(chiefHit.damage * 100) / 100, 18.9, "and a chief's heavier again (2026-11-01)");

    const other = { damage: 10 };
    sut.handlers.get("playerHit")({}, { id: 99999 }, other);
    assert.equal(other.damage, 10);
    const fromPlayer = { damage: 10 };
    sut.handlers.get("playerHit")({}, { id: bandit.id, steamId: "x" }, fromPlayer);
    assert.equal(fromPlayer.damage, 10, "a player who happens to share an id is not a bandit");
    assert.ok(sut.logs.some((line) => /16 bandido\(s\) em 3 acampamento\(s\)/.test(line)));
});

test("hitting one bandit rouses the men near him, each after a moment of his own and the shout's travel, and not the ones past earshot (2026-10-30)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const men = Array.from(camp.slots, (slot) => sut.npcs.get(slot.npcId));
    // The struck man at the camp; slot 1 ten metres from him, slot 2 forty-five; the rest far off. The player is 50 m east: nobody sees him.
    men[0].position = { x: 1065, y: 2441, z: 100 };
    men[1].position = { x: 1075, y: 2441, z: 100 };
    men[2].position = { x: 1020, y: 2441, z: 100 };
    men.slice(3).forEach((man) => { man.position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const player = sut.addPlayer(1, 1066 + 50, 2442);

    sut.camps.hit(men[0].id, player);
    assert.equal(men[0].attacks.at(-1).target, 1, "the struck man fights at once");
    sut.camps.tick();
    assert.equal(men[1].attacks.length + men[1].moves.length, 0, "the man next to him has not answered yet");
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(men[1].attacks.length + men[1].moves.length, 0, "a reaction of his own and the shout's travel take longer than a second");

    sut.clock.now += 2_600;
    sut.camps.tick();
    assert.ok(men[1].attacks.length + men[1].moves.length > 0 && ["front", "ring"].includes(camp.slots[1].role), "and then he joins the fight: at the player, or round him to wait his turn");
    sut.clock.now += 20_000;
    sut.camps.tick();
    assert.equal(men[2].attacks.length, 0, "forty-five metres from the nearest who fights, he never heard");
    assert.equal(camp.slots[2].target, null);
    assert.equal(camp.slots[2].role, undefined);
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
        assert.ok(held.every((rows) => rows.length >= 1 && !rows.some((row) => row.item === "bsmt_ironBad")));
    }
    assert.ok(Array.from(sut.camps.report()).includes("os baús não aceitaram: bsmt_ironBad"));
});

test("camp chests are filled again after three hours, and only while nobody is around", () => {
    const chest = chestStash("c1", "stash[Chest/chest3_x]", 1070, 2445);
    const sut = load({ stashes: [chest] });
    sut.camps.discover(placements());
    sut.camps.stockChests(true);
    assert.equal(chest.filled.length, 1);

    sut.clock.now = 179 * 60_000;
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1);

    sut.clock.now = 181 * 60_000;
    sut.addPlayer(1, 1070, 2445 + 30);
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1, "not with a player at the camp");
    sut.players.length = 0;
    chest.isOpen = true;
    sut.camps.stockChests();
    assert.equal(chest.filled.length, 1, "not while somebody has it open");
    chest.isOpen = false;
    sut.clock.now = 365 * 60_000;
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

test("a bandit that is struck is ordered to fight at once, not at the next look, and not again within a moment (2026-10-21: they ran when hit)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    ids.slice(1).forEach((id) => { sut.npcs.get(id).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    const bandit = sut.npcs.get(ids[0]);
    assert.equal(bandit.attacks.length, 0, "before any look of the camp");

    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.attacks.length, 1, "ordered the moment the blow landed");
    assert.equal(bandit.attacks[0].target, player.id);
    assert.equal(camp.slots[0].target, player.id);
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.attacks.length, 1, "not twice inside 800 ms");
    sut.clock.now += 900;
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.attacks.length, 2, "and again on the next blow");
});

test("a bandit whose order to fight was replaced (the game's fright) is told to fight again at the next look after the retry time", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    ids.slice(1).forEach((id) => { sut.npcs.get(id).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    sut.addPlayer(1, 1066, 2442 - 20);
    const bandit = sut.npcs.get(ids[0]);
    sut.camps.tick();
    assert.equal(bandit.attacks.length, 1);
    sut.camps.tick();
    assert.equal(bandit.attacks.length, 1, "while he is told to fight and runs, he is left to it");

    // Struck, he flees: what he is doing is no longer what he was told.
    bandit.intent = "flee";
    sut.camps.tick();
    assert.equal(bandit.attacks.length, 1, "not before the retry time");
    sut.clock.now += 4_500;
    sut.camps.tick();
    assert.equal(bandit.attacks.length, 2, "told again");
});

test("a bandit brought back by the administrator's restock is nobody's game's yet, whatever the man before him had", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const slot = sut.camps.camps[0].slots[0];
    slot.pinned = true;
    sut.npcs.get(slot.npcId).alive = false;
    sut.camps.died(slot.npcId);
    sut.camps.restockNow();
    assert.equal(slot.state, "alive");
    assert.equal(slot.pinned, false);
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

// ---------------------------------------------------------------------------------------------
// The gangs on the roads (2026-10-24).

const OWN_SOULS = new Set(["soul-kkop_bandit_1", "soul-kkop_bandit_2", "soul-kkop_bandit_3", "soul-kkop_bandit_4", "soul-kkop_bandit_5", "soul-kkop_bandit_6", "soul-krab_man_28", "soul-krab_man_29", "soul-zakopanyZitrek_bandit_1"]);
const centresOf = (sut) => Array.from(sut.camps.camps, (camp) => `${camp.name}@${camp.center.x},${camp.center.y}`);

test("road gangs keep clear of people, of every camp and of one another, and are no more than ten", () => {
    const sut = load();
    sut.camps.discover(placements());
    const people = [{ x: 2000, y: 2000, z: 100 }, { x: 3500, y: 500, z: 100 }];
    sut.camps.addWild(grid(), people, mesh());
    const before = sut.camps.camps.length;
    const camps = Array.from(sut.camps.camps, (camp) => camp.center);
    const added = sut.camps.addRoads(grid(), people, mesh());
    const roads = sut.camps.camps.slice(before);
    assert.equal(added, roads.length);
    assert.ok(added >= 5 && added <= 10, `a fair number of gangs: ${added}`);
    for (const camp of roads) {
        assert.ok(people.every((person) => flatDistance(person, camp.center) >= 140), "away from the people");
        assert.ok(camps.every((other) => flatDistance(other, camp.center) >= 330), "away from every camp, the hideouts too");
        assert.ok(roads.every((other) => other === camp || flatDistance(other.center, camp.center) >= 550), "away from one another");
    }
    assert.deepEqual(Array.from(roads, (camp) => camp.name), Array.from(roads, (_camp, index) => `Estrada ${index + 1}`));
});

test("a road gang is three or four bandits of the level's own souls, an archer and a veteran among them, standing about its place", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addRoads(grid(), [], mesh());
    const roads = sut.camps.camps.slice(3);
    assert.ok(roads.length > 0);
    for (const camp of roads) {
        assert.ok(camp.slots.length === 3 || camp.slots.length === 4, `${camp.name}: ${camp.slots.length}`);
        assert.equal(camp.slots.filter((slot) => slot.archer).length, sut.api.archersFor(camp.slots.length));
        assert.equal(camp.slots.filter((slot) => slot.veteran === true).length, sut.api.veteransFor(camp.slots.length));
        assert.ok(camp.slots.every((slot) => OWN_SOULS.has(slot.spot.soul)), "the level's own souls");
        assert.ok(camp.slots.every((slot) => flatDistance(slot.spot.position, camp.center) <= 5 + 0.01), "standing about the place");
    }
});

test("the roads are the same on every start, whatever order the places come in, and leave the hideouts where they were", () => {
    const one = load();
    one.camps.discover(placements());
    one.camps.addWild(grid(), [], mesh());
    const hideouts = centresOf(one);
    one.camps.addRoads(grid(), [], mesh());
    const other = load();
    other.camps.discover(placements());
    other.camps.addWild(grid().reverse(), [], mesh());
    other.camps.addRoads(grid().reverse(), [], mesh());
    assert.deepEqual(centresOf(one), centresOf(other));
    assert.deepEqual(centresOf(one).slice(0, hideouts.length), hideouts, "the roads come after, and move nothing");
    assert.ok(centresOf(one).length > hideouts.length);
});

test("a road place that cannot be walked to is passed over, and no place at all means no gangs", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addRoads(grid(), [], mesh((at) => at.x < 1000));
    const roads = sut.camps.camps.slice(3);
    assert.ok(roads.length > 0 && roads.every((camp) => camp.center.x >= 1000), "none on ground the mesh does not have");
    const crowded = load();
    crowded.camps.discover(placements());
    assert.equal(crowded.camps.addRoads(grid(), grid().map((marker) => marker.position), mesh()), 0, "people everywhere");
    assert.equal(crowded.camps.addRoads([], [], mesh()), 0, "no places");
    assert.equal(crowded.camps.camps.length, 3);
});

test("a dead man of a road gang is replaced two to four hours after his death, each at a time of his own; a camp's after thirty minutes (2026-10-25)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addRoads(grid(), [], mesh());
    sut.camps.spawnAll();
    const road = sut.camps.camps.find((camp) => camp.name.startsWith("Estrada"));
    const camp = sut.camps.camps[0];
    assert.ok(road, "a gang on the road");
    sut.clock.now = 1_000;
    for (const member of [...road.slots, camp.slots[0]]) {
        const body = sut.npcs.get(member.npcId);
        body.alive = false;
        sut.camps.died(body.id);
    }
    sut.camps.tick();
    const HOUR = 3_600_000;
    const waits = road.slots.map((slot) => slot.respawnWait);
    assert.ok(waits.every((wait) => wait >= 2 * HOUR && wait <= 4 * HOUR), `between two and four hours: ${waits.map((wait) => Math.round(wait / 60_000))} min`);
    assert.ok(new Set(waits).size > 1, "each man at a time of his own");
    assert.equal(camp.slots[0].respawnWait, 30 * 60_000, "a camp's man keeps the thirty minutes");
    const lines = sut.camps.inspect(road.center, 50);
    assert.ok(lines.some((line) => /morto, volta em [234] h \d\d min|morto, volta em 1 h \d\d min/.test(line)), `the administrator sees the wait: ${lines.join(" | ")}`);

    sut.clock.now = 1_000 + 31 * 60_000;
    sut.camps.tick();
    assert.equal(camp.slots[0].state, "alive", "the camp's man is back after half an hour");
    assert.ok(road.slots.every((slot) => slot.state === "dead"), "and the road's are not");

    sut.clock.now = 1_000 + 119 * 60_000;
    sut.camps.tick();
    assert.ok(road.slots.every((slot) => slot.state === "dead"), "not before two hours");

    sut.clock.now = 1_000 + 241 * 60_000;
    sut.camps.tick();
    assert.ok(road.slots.every((slot) => slot.state === "alive"), "all back after four");
    assert.ok(road.slots.every((slot) => slot.respawnWait === undefined), "and the next death chooses a time again");
});

test("a road gang's place that could not be filled is tried again as a camp's is, not after the hours", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addRoads(grid(), [], mesh());
    const road = sut.camps.camps.find((camp) => camp.name.startsWith("Estrada"));
    const slot = road.slots[0];
    const make = sut.context.Npc.create;
    sut.context.Npc.create = () => { throw new Error("no room"); };
    sut.clock.now = 5_000;
    assert.equal(sut.camps.spawn(road, slot), false);
    sut.context.Npc.create = make;
    assert.equal(slot.state, "dead");
    assert.equal(slot.respawnWait, 30 * 60_000);
    sut.clock.now = 5_000 + 31 * 60_000;
    sut.camps.tick();
    assert.equal(slot.state, "alive", "back after thirty minutes");
});

/** The places of `data/road-posts.json`, as the tool writes them. */
const roadFile = (posts) => ({ "data/road-posts.json": JSON.stringify({ posts }) });

test("installing also puts the gangs of data/road-posts.json on the roads, once the mesh is ready, after the hideouts", () => {
    const nav = { ready: false, closestPoint: (at) => ({ x: at.x, y: at.y, z: at.z }), randomPoint: (centre, radius) => ({ x: centre.x + radius / 2, y: centre.y, z: centre.z }) };
    const animalPoints = grid().map((marker) => ({ ...marker, count: 3, actorClass: "Boar", soul: "s" }));
    // The places half a grid step off the wild markers, with a row that lacks its numbers and one with an id that is no text: both passed over.
    const posts = grid().map((marker) => ({ id: `road-${marker.guid}`, x: marker.position.x + 250, y: marker.position.y + 250, z: 100 }));
    const sut = load({ placementList: placements(), animalPoints, navigation: nav, files: roadFile([...posts, { id: "no-numbers" }, { id: 5, x: 1, y: 2, z: 3 }]) });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    nav.ready = true;
    sut.timeouts[1].fn();
    const camps = sut.api.banditCamps.camps;
    const roads = camps.filter((camp) => camp.name.startsWith("Estrada"));
    const hideouts = camps.filter((camp) => camp.name.startsWith("Esconderijo"));
    assert.ok(roads.length >= 3 && roads.length <= 10, `gangs on the roads: ${roads.length}`);
    assert.ok(hideouts.length > 1, "the hideouts in the wild are still there");
    assert.ok(camps.indexOf(roads[0]) > camps.indexOf(hideouts[hideouts.length - 1]), "the roads come after the hideouts");
    assert.ok(roads.every((camp) => posts.some((post) => post.x === camp.center.x && post.y === camp.center.y)), "each on a place of the file");
    assert.ok(sut.logs.some((line) => new RegExp(`e ${roads.length} posto\\(s\\) nas estradas`).test(line)), "the log says how many");
    assert.ok(!sut.logs.some((line) => /road-posts\.json/.test(line)), "and nothing is missing");
    assert.ok(roads.every((camp) => camp.slots.every((slot) => slot.state === "alive")), "and their bandits stand in the world");
});

test("without data/road-posts.json the roads stay empty and the log says so; the hideouts do not suffer", () => {
    const nav = { ready: true, closestPoint: (at) => ({ x: at.x, y: at.y, z: at.z }), randomPoint: (centre, radius) => ({ x: centre.x + radius / 2, y: centre.y, z: centre.z }) };
    const animalPoints = grid().map((marker) => ({ ...marker, count: 3, actorClass: "Boar", soul: "s" }));
    const sut = load({ placementList: placements(), animalPoints, navigation: nav });
    sut.api.installBandits();
    sut.timeouts[0].fn();
    const camps = sut.api.banditCamps.camps;
    assert.equal(camps.filter((camp) => camp.name.startsWith("Estrada")).length, 0);
    assert.ok(camps.filter((camp) => camp.name.startsWith("Esconderijo")).length > 1);
    assert.ok(sut.logs.some((line) => /road-posts\.json não foi encontrado/.test(line)));
    assert.ok(sut.logs.some((line) => /e 0 posto\(s\) nas estradas/.test(line)));
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

test("three levels of aggression change how far they see, how hard they hit, how long a camp is roused, how many fight hand to hand and how far a shout carries; the middle one is the default (lowered 2026-10-30)", () => {
    const sut = load();
    const { AGGRESSION, banditSettings, setAggression, aggressionLevel } = sut.api;
    const now = () => [banditSettings.aggroRadius, banditSettings.damageMultiplier, banditSettings.alarmMs, banditSettings.frontMax, banditSettings.earshotM];
    assert.equal(aggressionLevel(), "media");
    // One fights hand to hand at a time at every level since 2026-11-02 (it was 1, 2, 3): the others close round and take turns.
    assert.deepEqual(now(), [24, 1.4, 45_000, 1, 30], "the default is the middle one");

    setAggression("alta");
    assert.deepEqual(now(), [36, 1.8, 90_000, 1, 50]);
    setAggression("baixa");
    assert.deepEqual(now(), [14, 1.0, 25_000, 1, 15]);
    setAggression("media");
    assert.deepEqual(now(), [24, 1.4, 45_000, 1, 30]);
    setAggression("baixa");
    assert.ok(AGGRESSION.baixa.aggroRadius < AGGRESSION.media.aggroRadius && AGGRESSION.media.aggroRadius < AGGRESSION.alta.aggroRadius);
    assert.ok(AGGRESSION.baixa.front === 1 && AGGRESSION.media.front === 1 && AGGRESSION.alta.front === 1);
    assert.deepEqual(JSON.parse(sut.files.get("playerdata/bandits.json")), { aggression: "baixa" });
});

test("the level kept is read at the start, and a file that says nonsense leaves the middle one", () => {
    const low = load({ files: { "playerdata/bandits.json": JSON.stringify({ aggression: "baixa" }) } });
    low.api.installBandits();
    assert.equal(low.api.aggressionLevel(), "baixa");
    assert.equal(low.api.banditSettings.aggroRadius, 14);
    assert.equal(low.api.banditSettings.frontMax, 1, "and how many fight hand to hand with it");

    const odd = load({ files: { "playerdata/bandits.json": JSON.stringify({ aggression: "furiosa" }) } });
    odd.api.installBandits();
    assert.equal(odd.api.aggressionLevel(), "media");
});

test("a bandit who sees somebody shouts once, the camp roused shouts its own call, and a blow makes him curse; none shouts again within nine seconds", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const ids = Array.from(sut.camps.camps[0].slots, (slot) => slot.npcId);
    // The second man of the camp (the first is its chief, who gives orders instead).
    ids.filter((_id, index) => index !== 1).forEach((id) => { sut.npcs.get(id).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    const first = sut.npcs.get(ids[1]);

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
    assert.equal(first.said.length, 2, "nine seconds between shouts (twenty before 2026-11-01)");
    assert.equal(sut.api.BARK_EVERY_MS, 9_000);
});

test("a bandit who is roused by his camp's alarm answers with the alarm call; the first of the ring calls for the cerco", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    camp.alarm = { targetId: player.id, until: sut.clock.now + 60_000 };
    sut.camps.tick();
    const front = sut.npcs.get(ids[0]);
    assert.ok(front.said?.length >= 1);
    assert.ok(sut.api.BARKS.chief.includes(front.said[0]), `the chief gives his orders: ${front.said[0]}`);
    const said = ids.slice(1).map((id) => sut.npcs.get(id).said?.[0]).filter((line) => line !== undefined);
    assert.ok(said.some((line) => sut.api.BARKS.surround.includes(line)), `the first of the ring calls for the cerco: ${JSON.stringify(said)}`);
});

test("a bandit that no game runs is pinned to the nearest player's, and let go when nobody is about", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const ids = Array.from(kopec.slots, (slot) => slot.npcId);
    const first = sut.npcs.get(ids[0]);
    first.simulator = null;
    const other = sut.npcs.get(ids[1]);
    other.simulator = { id: 9, nickname: "p9", position: { x: 1066, y: 2442, z: 100 } };
    const player = sut.addPlayer(1, 1066, 2442 - 90);

    sut.camps.tick();
    assert.deepEqual(JSON.parse(JSON.stringify(first.pins)), [1], "nobody ran him: the player's game is made to");
    assert.equal(other.pins, undefined, "a bandit somebody runs is left alone");
    first.simulator = { id: 1, nickname: "p1", position: { x: 1066, y: 2442 - 90, z: 100 } };
    sut.camps.tick();
    assert.deepEqual(JSON.parse(JSON.stringify(first.pins)), [1], "once the player's game runs him, nothing more is asked");

    player.position = { x: 5000, y: 5000, z: 100 };
    sut.camps.tick();
    assert.deepEqual(JSON.parse(JSON.stringify(first.pins)), [1, null], "alone again: let go");
});

test("a blow is judged by the game that runs the man struck: a runner far from him gives him to whoever strikes, a near one keeps him (2026-10-25)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const [one, two, three] = kopec.slots.slice(0, 3).map((slot) => sut.npcs.get(slot.npcId));
    const attacker = sut.addPlayer(1, 1066, 2442 - 3, { nickname: "Luance" });
    const pinsOf = (npc) => JSON.parse(JSON.stringify(npc.pins ?? []));

    // Run by a player sixty metres from him, struck by one at three metres: the striker's game runs him.
    one.simulator = { id: 9, nickname: "Ludmilla", position: { x: 1066, y: 2442 - 60, z: 100 } };
    sut.camps.hit(one.id, attacker);
    assert.deepEqual(pinsOf(one), [1]);
    assert.ok(sut.logs.some((line) => /preso ao jogo de quem bate \(o jogo de Ludmilla, a \d+ m dele, o rodava\)/.test(line)), "the log says whose game ran him and how far");

    // A runner near him keeps him, and so does the striker's own game.
    two.simulator = { id: 9, nickname: "Ludmilla", position: { x: 1066, y: 2442 - 15, z: 100 } };
    sut.clock.now += 5_000;
    sut.camps.hit(two.id, attacker);
    assert.deepEqual(pinsOf(two), [], "a runner fifteen metres off judges well enough");
    three.simulator = { id: 1, nickname: "Luance", position: { x: 1066, y: 2442 - 3, z: 100 } };
    sut.camps.hit(three.id, attacker);
    assert.deepEqual(pinsOf(three), [], "already the striker's");

    // A blow from far off (a bow) moves nobody's game.
    const far = sut.addPlayer(2, 1066, 2442 - 60, { nickname: "Arqueiro" });
    two.simulator = { id: 9, nickname: "Ludmilla", position: { x: 1066 + 80, y: 2442, z: 100 } };
    sut.clock.now += 5_000;
    sut.camps.hit(two.id, far);
    assert.deepEqual(pinsOf(two), [], "the striker is not near him");
});

test("a bandit whose runner is far past reach, with a player much nearer, is given to that player; a runner within reach is left to the game's own election (2026-10-25)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const [one, two] = kopec.slots.slice(0, 2).map((slot) => sut.npcs.get(slot.npcId));
    sut.addPlayer(1, 1066, 2442 - 30, { nickname: "Luance" });
    const pinsOf = (npc) => JSON.parse(JSON.stringify(npc.pins ?? []));

    one.simulator = { id: 9, nickname: "Longe", position: { x: 1066, y: 2442 - 120, z: 100 } };
    two.simulator = { id: 9, nickname: "Perto", position: { x: 1066, y: 2442 - 40, z: 100 } };
    sut.camps.tick();
    assert.deepEqual(pinsOf(one), [1], "run from 120 m with somebody at 30 m: given to him");
    assert.ok(sut.logs.some((line) => /era rodado por Longe, a \d+ m: preso ao jogo de Luance, a \d+ m/.test(line)));
    assert.deepEqual(pinsOf(two), [], "run from 40 m: within reach, left alone");
});

test("a bandit nobody is fighting strolls about his spot now and then", () => {
    const sut = load({ navigation: { ready: true, closestPoint: (point) => point, randomPoint: (centre) => ({ x: centre.x + 2, y: centre.y + 1, z: centre.z }) } });
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const bandit = sut.npcs.get(kopec.slots[0].npcId);
    bandit.simulator = { id: 9, nickname: "p9", position: { x: 1066, y: 2442, z: 100 } };
    sut.addPlayer(1, 1066, 2442 - 150);

    sut.camps.tick();
    sut.clock.now += 60_000;
    sut.camps.tick();
    assert.ok(bandit.moves.length >= 1, "he walked somewhere");
    assert.equal(bandit.moves.at(-1).opts.speed, "walk");
});

test("a player in the global world, which is where every real player stands, is seen by the camp and fought (a test against world 0 alone left them all out)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const first = sut.npcs.get(kopec.slots[0].npcId);
    const player = sut.addPlayer(1, 1066, 2442 - 20, { virtualWorld: 4294967295 });

    sut.camps.tick();
    assert.equal(first.attacks.at(-1)?.target, player.id, "he goes for the player");

    const elsewhere = load();
    elsewhere.camps.discover(placements());
    elsewhere.camps.spawnAll();
    const bandit = elsewhere.npcs.get(elsewhere.camps.camps[0].slots[0].npcId);
    elsewhere.addPlayer(1, 1066, 2442 - 20, { virtualWorld: 7 });
    elsewhere.camps.tick();
    assert.equal(bandit.attacks.length, 0, "a player in some other numbered world is not his to see");
});

test("a bandit ordered to fight who does not stir is sent running at the player, and is ordered to fight again when he stands", () => {
    const sut = load({ navigation: { ready: true, closestPoint: (point) => point, randomPoint: (centre) => ({ x: centre.x + 2, y: centre.y + 1, z: centre.z }) } });
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const bandit = sut.npcs.get(kopec.slots[0].npcId);
    bandit.simulator = { id: 9, nickname: "p9", position: { x: 1066, y: 2442, z: 100 } };
    // His turn outlasts the test (the turns are another test's).
    sut.camps.settings.turnMs = [60_000, 60_000];
    // Nine metres off: near enough for the blade (twenty would be his bow's).
    sut.addPlayer(1, 1066, 2442 - 9, { virtualWorld: 4294967295 });

    sut.camps.tick();
    assert.equal(bandit.attacks.length, 1);
    assert.equal(bandit.moves.length, 0, "not at once: the game's own pursuit gets its chance");

    sut.clock.now += 1_000;
    sut.camps.tick();
    sut.clock.now += 3_500;
    sut.camps.tick();
    const run = bandit.moves.at(-1);
    assert.ok(run, "he stood still: sent at the player");
    assert.equal(run.opts.speed, "jog", "at a jog since 2026-11-02 ('os bandidos correm muito rápido')");
    assert.equal(run.opts.pathfinding, "server");

    // He gets there and stands: the order to fight is given again.
    bandit.status = "reached";
    bandit.position = { x: 1066, y: 2442 - 8, z: 100 };
    sut.clock.now += 5_000;
    sut.camps.tick();
    assert.ok(bandit.attacks.length >= 2, "ordered to fight again");
});

test("/bandidos estado lists what stands about the player: who runs each bandit, what he was told, whom he is after", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const bandit = sut.npcs.get(kopec.slots[0].npcId);
    bandit.simulator = null;
    bandit.intent = "hold";
    const lines = Array.from(sut.camps.inspect({ x: 1066, y: 2442 - 30, z: 100 }));
    assert.match(lines[0], /^1\. /);
    assert.ok(lines.some((line) => /PARADO \(ninguém o roda\)/.test(line) && /idle\/hold/.test(line)), lines.join(" | "));
});

test("one in three of a camp is a veteran: worn armour, more health, three draughts; the others carry a bow beside the blade and two draughts (2026-10-21, 2026-11-02)", () => {
    const sut = load();
    assert.deepEqual([2, 3, 5, 6, 8, 9].map(sut.api.veteransFor), [0, 1, 1, 2, 2, 3]);
    sut.camps.discover(placements());
    const kopec = sut.camps.camps[0];
    assert.deepEqual(Array.from(kopec.slots, (slot) => slot.veteran === true), [true, true, false, false, false, false], "two of six, never the archer");
    sut.camps.spawnAll();
    // The first veteran is the camp's chief (2026-11-01); the second is a veteran.
    assert.equal(sut.npcs.get(kopec.slots[0].npcId).options.name, "Chefe dos bandidos");
    const veteran = sut.npcs.get(kopec.slots[1].npcId);
    assert.equal(veteran.options.name, "Bandido veterano");
    assert.equal(veteran.options.health, 200);
    const kit = plain(sut.stocked.get(veteran.id)).filter((row) => VETERAN_KIT.includes(row.item) && RULES.slotOf(row.item) !== null);
    assert.ok(kit.length >= 6, "helmet, mail coif, gambeson, rondels, boots, gloves");
    assert.ok(kit.every((row) => row.metadata.condition >= 0.45 && row.metadata.condition <= 0.65 && row.equipped === 1), "worn, as the game's own bandits' (0.35 to 0.84)");
    assert.equal(kopec.slots[1].potions, 3);
    const plainMan = sut.npcs.get(kopec.slots[2].npcId);
    const rows = plain(sut.stocked.get(plainMan.id));
    assert.ok(rows.some((row) => row.item === "bow_b" && row.equipped === 1) && rows.some((row) => row.item === "arrow_crude"), "a bow beside the blade");
    assert.ok(rows.some((row) => ["axeWork01", "maceClub", "shortswordCleaver"].includes(row.item)));
    assert.equal(kopec.slots[2].potions, 2);
    assert.equal(kopec.slots[2].hasBow, true);
});

test("a bandit takes up his bow when his man runs off, and his blade again when he comes back; a refused bow is not tried for a while", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const slot = kopec.slots[2];
    kopec.slots.forEach((other) => { if (other !== slot) sut.npcs.get(other.npcId).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const bandit = sut.npcs.get(slot.npcId);
    bandit.simulator = { id: 9, nickname: "p9", position: { x: 1066, y: 2442, z: 100 } };
    const at = (metres) => ({ x: bandit.position.x, y: bandit.position.y - metres, z: 100 });
    const player = sut.addPlayer(1, at(9).x, at(9).y, { virtualWorld: 4294967295 });
    sut.camps.tick();
    assert.equal(bandit.attacks.at(-1).opts, undefined, "nine metres: the blade");
    player.position = at(16);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.deepEqual({ ...bandit.attacks.at(-1).opts }, { weapon: "bow" }, "sixteen metres: the bow");
    assert.equal(slot.mode, "bow");
    player.position = at(8);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(slot.mode, "bow", "eight metres: still the bow (the gap keeps him from changing at every step)");
    player.position = at(3);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(bandit.attacks.at(-1).opts, undefined, "three metres: the blade again");
    assert.equal(slot.mode, "melee");
    assert.ok(sut.logs.some((line) => /tomou o arco: o alvo se afastou/.test(line)));

    // The game turns the bow down: he fights with the blade and does not ask again for half a minute.
    bandit.attack = function (target, opts) { this.attacks.push({ target: target.id, opts }); this.status = "running"; this.intent = "attack"; return opts?.weapon !== "bow"; };
    player.position = at(16);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(slot.mode, "melee");
    const asked = bandit.attacks.length;
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(bandit.attacks.filter((attack, index) => index >= asked && attack.opts?.weapon === "bow").length, 0, "not again at once");
});

test("a bandit badly hurt drinks a draught while he has one, no oftener than every fifteen seconds", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    // A veteran: the first man is the chief, with three.
    const slot = kopec.slots[1];
    const veteran = sut.npcs.get(slot.npcId);
    veteran.maxHealth = 200;
    veteran.health = 150;
    assert.equal(sut.camps.drink(slot, veteran), false, "not hurt enough");
    veteran.health = 60;
    assert.equal(sut.camps.drink(slot, veteran), true);
    assert.ok(Math.abs(veteran.health - (60 + 200 * 0.35)) < 1e-9);
    assert.equal(slot.potions, 2);
    assert.ok(sut.api.BARKS.potion.includes(veteran.said.at(-1)), veteran.said.at(-1));
    veteran.health = 50;
    assert.equal(sut.camps.drink(slot, veteran), false, "not again at once");
    sut.clock.now += 15_000;
    assert.equal(sut.camps.drink(slot, veteran), true);
    sut.clock.now += 15_000;
    veteran.health = 20;
    assert.equal(sut.camps.drink(slot, veteran), true, "the third (2026-11-02)");
    sut.clock.now += 15_000;
    veteran.health = 20;
    assert.equal(sut.camps.drink(slot, veteran), false, "none left");
});

test("a fallen bandit keeps his clothes and purse, and a veteran his armour and blade for the loot (2026-11-02); only the second bow is taken off the body", () => {
    const sut = load();
    sut.api.installBandits();
    sut.timeouts[0].fn();
    const camp = sut.api.banditCamps.camps[0];
    const veteranSlot = camp.slots.find((slot) => slot.veteran === true && slot.chief !== true && slot.npcId !== null);
    const veteran = sut.npcs.get(veteranSlot.npcId);
    const before = plain(sut.stocked.get(veteran.id)).map((row) => row.item);
    veteran.alive = false;
    sut.handlers.get("npcDeath")(veteran);
    const after = plain(sut.stocked.get(veteran.id)).map((row) => row.item);
    assert.ok(before.some((item) => VETERAN_KIT.includes(item)) && before.includes("bow_b"));
    const armour = before.filter((item) => VETERAN_KIT.includes(item));
    assert.ok(armour.length >= 6 && armour.every((item) => after.includes(item)), "the armour and the blade stay, to be looted");
    assert.ok(!after.includes("bow_b") && !after.includes("arrow_crude"), "the second bow goes");
    assert.ok(after.includes("money") && after.some((item) => /^Hose/.test(item)), "his own things stay");
});

test("a bandit left with next to nothing is held and finished a moment later, for whoever struck him last (2026-10-27: the archer who lay on the ground alive at 3 of 180)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const ids = Array.from(camp.slots, (slot) => slot.npcId);
    ids.slice(1).forEach((id) => { sut.npcs.get(id).position = { x: 1066 + 900, y: 2442, z: 100 }; });
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    const bandit = sut.npcs.get(ids[0]);
    bandit.kill = function kill(by) { (this.killed ??= []).push(by); this.alive = false; };
    bandit.maxHealth = 180;

    bandit.health = 25;
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.attacks.length, 1, "at 25 of 180 he still fights");
    assert.equal(bandit.holds, 0);

    bandit.health = 30;
    sut.clock.now += 900;
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.holds, 0, "at 30 of 180 (17%) he still fights");
    assert.equal(bandit.attacks.length, 2);

    bandit.health = 20;
    sut.clock.now += 900;
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.holds, 1, "at 20 of 180 (11%) he is held where he is");
    assert.equal(bandit.killed, undefined);
    camp.slots[0].finishAt = undefined;
    camp.slots[0].finishBy = undefined;
    bandit.holds = 0;
    camp.slots[0].potions = 0;

    bandit.health = 3;
    sut.clock.now += 900;
    sut.camps.hit(bandit.id, player);
    assert.equal(bandit.holds, 1, "at 3 he is held where he is");
    assert.equal(bandit.attacks.length, 2, "and is not ordered to fight again");
    assert.equal(bandit.killed, undefined);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(bandit.killed, undefined, "not yet: a moment, for the fall to be seen");
    sut.clock.now += 600;
    sut.camps.tick();
    assert.deepEqual(Array.from(bandit.killed), [player.id], "killed, for the player who struck him");
    sut.camps.tick();
    assert.equal(camp.slots[0].state, "dead");
});

test("a bandit that was left with next to nothing by something else is finished by the round as well, and a healthy one is not touched", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const bandit = sut.npcs.get(camp.slots[0].npcId);
    const other = sut.npcs.get(camp.slots[1].npcId);
    bandit.kill = function kill(by) { (this.killed ??= []).push(by); this.alive = false; };
    other.kill = function kill() { this.killed = [1]; this.alive = false; };
    bandit.maxHealth = 180;
    other.maxHealth = 180;
    bandit.health = 14;
    other.health = 25;
    camp.slots[0].potions = 0;
    camp.slots[1].potions = 0;
    sut.addPlayer(1, 1066, 2442 - 20);
    sut.camps.tick();
    assert.equal(bandit.holds, 1, "14 of 180 is under twelve in a hundred: held");
    sut.clock.now += 2_000;
    sut.camps.tick();
    assert.equal(bandit.alive, false);
    assert.equal(other.alive, true, "25 of 180 (the lowest seen fighting on his feet) is not");
    assert.equal(other.killed, undefined);
});

test("a man hurt this badly who still has a draught drinks it and stands up instead; and a mark left on a slot never kills the next man there (2026-10-27)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const slot = camp.slots[0];
    const bandit = sut.npcs.get(slot.npcId);
    bandit.kill = function kill() { this.killed = true; this.alive = false; };
    bandit.maxHealth = 140;
    bandit.health = 6;
    assert.ok((slot.potions ?? 0) > 0, "he has a draught");
    assert.equal(sut.camps.finishOff(slot, bandit, sut.clock.now), false, "he drinks: nothing is finished");
    assert.ok(bandit.health > 40, "and is up again");
    assert.equal(bandit.holds, 0);
    assert.equal(slot.finishAt, undefined);

    // The draught gone, a man at 6 is held; if the player then kills him, the mark goes with the body and the next man in that place is left alone.
    slot.potions = 0;
    bandit.health = 6;
    assert.equal(sut.camps.finishOff(slot, bandit, sut.clock.now), true);
    assert.ok(slot.finishAt !== undefined);
    bandit.alive = false;
    sut.camps.died(bandit.id);
    assert.equal(slot.finishAt, undefined, "cleared at his death");
    assert.equal(slot.finishBy, undefined);

    slot.finishAt = sut.clock.now - 10_000;
    slot.finishBy = 77;
    const camp2 = sut.camps.camps[0];
    sut.camps.spawn(camp2, slot);
    assert.equal(slot.finishAt, undefined, "and cleared at a new body");
    const next = sut.npcs.get(slot.npcId);
    next.kill = function kill() { this.killed = true; this.alive = false; };
    sut.camps.tick();
    assert.equal(next.alive, true, "the new man is not killed by a mark of the old one");
});

/** A camp of Kopec with the player 20 m south of it: slots 0 and 4 are the nearest blades, 1, 3 and 2 follow, 5 is the archer (see the distances in the test above). */
function cercoScene() {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const men = Array.from(camp.slots, (slot) => sut.npcs.get(slot.npcId));
    const player = sut.addPlayer(1, 1066, 2442 - 20);
    return { sut, camp, men, player };
}

test("the ring stands at its spots looking at the player, goes to new spots when he has moved, and is not sent again within two seconds (2026-10-30)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.tick();
    const walker = men[1];
    assert.equal(camp.slots[1].role, "ring");
    assert.equal(walker.moves.length, 1);
    const goal = walker.moves[0].target;

    // Walking: left alone while the spot is where it was.
    sut.clock.now += 1_000;
    sut.camps.tick();
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(walker.moves.length, 1, "he is on his way: not sent again");

    // The player takes a few steps: the spot moves under three metres, he goes on to the old one.
    player.position = { x: 1066 + 1, y: 2442 - 21, z: 100 };
    sut.clock.now += 2_100;
    sut.camps.tick();
    assert.equal(walker.moves.length, 1);

    // The player is 15 m farther south: the spot is somewhere else, and he is sent to it after the pause.
    player.position = { x: 1066, y: 2442 - 35, z: 100 };
    sut.clock.now += 2_100;
    sut.camps.tick();
    assert.equal(walker.moves.length, 2);
    assert.ok(Math.hypot(walker.moves[1].target.x - goal.x, walker.moves[1].target.y - goal.y) > 10);

    // He gets there: held where he is, looking at the player; held once, looking again every two seconds.
    walker.position = { x: walker.moves[1].target.x, y: walker.moves[1].target.y, z: 100 };
    walker.status = "reached";
    const holds = walker.holds;
    sut.clock.now += 100;
    sut.camps.tick();
    assert.equal(walker.holds, holds + 1);
    assert.deepEqual(walker.looks, [player.id]);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(walker.holds, holds + 1, "held once");
    assert.equal(walker.looks.length, 1);
    sut.clock.now += 1_100;
    sut.camps.tick();
    assert.equal(walker.looks.length, 2);
    assert.equal(walker.attacks.length, 0, "and he never charged");
});

test("a man is run by the game of a player fighting him close when the game that runs him is farther off; the target's game otherwise (2026-11-02: 'alguns bandidos continuam imortais')", () => {
    const { sut, camp, men, player } = cercoScene();
    const other = sut.addPlayer(2, men[0].position.x + 1, men[0].position.y);
    // Slot 0 is run by the target's game, which stands far from him; the other player is beside him, fighting.
    men[0].simulator = player;
    player.position = { x: men[0].position.x + 15, y: men[0].position.y, z: 100 };
    sut.camps.tick();
    assert.equal(men[0].pins?.at(-1), 2, "given to the one beside him");
    assert.ok(sut.logs.some((line) => /preso ao jogo de quem luta colado nele/.test(line)));
    // Run by a game as near as the fighter: left as it is.
    const pins = (men[1].pins ?? []).length;
    men[1].simulator = player;
    player.position = { x: men[1].position.x + 2, y: men[1].position.y, z: 100 };
    other.position = { x: men[1].position.x + 1, y: men[1].position.y, z: 100 };
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal((men[1].pins ?? []).length, pins);
    assert.ok(camp.slots.length > 0);
});

test("a man of the ring goes round the player to his spot, never through him: by the spot halfway round when the straight way passes close (2026-11-02)", () => {
    const sut = load();
    const centre = { x: 0, y: 0, z: 0 };
    // From the far side (west of the player) to a spot east of him: the straight way runs through him.
    const way = sut.api.ringWay({ x: -9, y: 0.5, z: 0 }, { x: 9, y: 0, z: 0 }, centre, 9, 5);
    assert.ok(Math.abs(Math.hypot(way.x, way.y) - 9) < 1e-9, "a spot on the ring");
    assert.ok(Math.abs(way.x) < 1 && Math.abs(way.y) > 8, `halfway round: ${JSON.stringify(way)}`);
    // A way that keeps clear goes straight to the spot.
    assert.deepEqual(JSON.parse(JSON.stringify(sut.api.ringWay({ x: 9, y: 9, z: 0 }, { x: 9, y: -1, z: 0 }, centre, 9, 5))), { x: 9, y: -1, z: 0 });
    assert.ok(sut.api.passesWithin({ x: -9, y: 0, z: 0 }, { x: 9, y: 0, z: 0 }, centre) < 1e-9);
});

test("a man badly hurt gives his place in the front to one of the ring; one the player comes close to defends himself; one struck from afar fights back (2026-10-30)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.tick();
    assert.deepEqual([0, 4].map((index) => camp.slots[index].role), ["front", "ring"], "one at a time (2026-11-02)");

    // Slot 0 is down to 20 of 140 with no draught left: he falls back, and slot 1 (the next nearest) steps up and is told to fight at once.
    men[0].maxHealth = 140;
    men[0].health = 20;
    camp.slots[0].potions = 0;
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[0].role, "ring");
    // The nearest of the others steps up (one at a time since 2026-11-02).
    const stepped = camp.slots.findIndex((slot, index) => index !== 0 && slot.role === "front");
    assert.ok(stepped > 0);
    assert.equal(men[stepped].attacks.at(-1).target, 1, "told to fight the moment he steps up");
    assert.ok(men[0].moves.length >= 1, "and the hurt man is sent to the ring");

    // A man of the ring with the player two metres from him fights whatever the line says (2.5 m since 2026-11-02; 4.5 m before, and the whole ring ran into the player).
    men[3].position = { x: player.position.x + 2, y: player.position.y, z: 100 };
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[3].role, "front");
    assert.equal(men[3].attacks.at(-1).target, 1);

    // Struck from afar, a man of the ring fights back and stays in the line for a few seconds.
    const waiting = camp.slots.findIndex((slot, index) => index !== 3 && slot.role === "ring" && !slot.archer && index !== 0);
    assert.ok(waiting > 0);
    sut.camps.hit(men[waiting].id, player);
    assert.equal(men[waiting].attacks.at(-1).target, 1);
    assert.equal(camp.slots[waiting].role, "front");
    sut.clock.now += 1_000;
    const moves = men[waiting].moves.length;
    sut.camps.tick();
    assert.equal(camp.slots[waiting].role, "front");
    assert.equal(men[waiting].moves.length, moves, "he is not sent back to the ring");
});

test("a player with company draws more of the camp into the line: one more for each friend within twelve metres, up to two (2026-10-30)", () => {
    const { sut, camp } = cercoScene();
    // A friend five metres behind the first player: the men all go for the nearer one, and his company counts.
    sut.addPlayer(2, 1066, 2442 - 25);
    sut.camps.tick();
    const roles = Array.from(camp.slots, (slot) => slot.role);
    assert.equal(roles.filter((role) => role === "front").length, 2, "one plus one for the friend (one at a time since 2026-11-02)");
    assert.equal(roles.filter((role) => role === "ring").length, 3);

    const crowd = cercoScene();
    for (const [id, dy] of [[2, 25], [3, 30], [4, 32]]) crowd.sut.addPlayer(id, 1066, 2442 - dy);
    crowd.sut.camps.tick();
    assert.equal(crowd.camp.slots.filter((slot) => slot.role === "front").length, 3, "one plus at most two, whatever the crowd");
    assert.equal(crowd.camp.slots.filter((slot) => slot.role === "ring").length, 2);
});

test("at every level one fights hand to hand at a time (three at the high level until 2026-11-02) (2026-10-30)", () => {
    for (const [level, fronts] of [["baixa", 1], ["alta", 1]]) {
        const { sut, camp, player } = cercoScene();
        sut.api.setAggression(level);
        player.position = { x: 1066, y: 2442 - 11, z: 100 }; // near enough for the low level's eyes too
        sut.camps.tick();
        assert.equal(camp.slots.filter((slot) => slot.role === "front").length, fronts, level);
        assert.equal(camp.slots.filter((slot) => slot.role === "bow").length, 1, "the archer shoots all the same");
    }
});

test("the men take turns at the player: after his turn the one at him falls back to the ring and another steps up, and the player coming close does not bring him back at once (2026-11-02)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.settings.turnMs = [6_000, 6_000];
    sut.camps.tick();
    const first = camp.slots.findIndex((slot) => slot.role === "front");
    assert.ok(first >= 0);
    for (let s = 0; s < 7; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    const now = camp.slots.findIndex((slot) => slot.role === "front");
    assert.notEqual(now, first, "another one's turn");
    assert.equal(camp.slots[first].role, "ring", "he fell back to the ring");
    assert.equal(camp.slots.filter((slot) => slot.role === "front").length, 1, "one at a time");
    // The player at him: he does not turn on him again for a moment.
    men[first].position = { x: player.position.x + 1.5, y: player.position.y, z: 100 };
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[first].role, "ring");
});

test("the turns are long ones since 2026-11-04 ('alternando muito'): fifteen to twenty-five seconds at the player", () => {
    const { sut } = cercoScene();
    assert.deepEqual(Array.from(sut.camps.settings.turnMs), [15_000, 25_000]);
});

/** Brings a man of the ring to where he was last sent until he stands there (a way round the player has a spot halfway first). */
function arriveInRing(sut, man) {
    for (let leg = 0; leg < 4; leg += 1) {
        const holds = man.holds;
        const goal = man.moves.at(-1).target;
        man.position = { x: goal.x, y: goal.y, z: 100 };
        man.status = "reached";
        sut.clock.now += 1_000;
        sut.camps.tick();
        if (man.holds > holds) return goal;
    }
    assert.fail("he never stood at his spot");
}

test("a man who steps in to defend himself holds his ground six seconds after the player stepped off, then goes back to the ring (2026-11-04: 'o que deixa de luta')", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.settings.turnMs = [600_000, 600_000];
    sut.camps.tick();
    const front = camp.slots.findIndex((slot) => slot.role === "front");
    const waiting = camp.slots.findIndex((slot) => slot.role === "ring");
    // The player fights the man of the line at a metre and a half, and comes within two metres of one of the ring: that one fights.
    men[front].position = { x: player.position.x - 1.5, y: player.position.y, z: 100 };
    men[waiting].position = { x: player.position.x + 2, y: player.position.y, z: 100 };
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[waiting].role, "front");
    // A step farther (3.5 m): before 2026-11-04 he walked back to the ring at once; now he stays for six seconds.
    men[waiting].position = { x: player.position.x + 3.5, y: player.position.y, z: 100 };
    const moves = men[waiting].moves.length;
    for (let s = 1; s <= 5; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
        assert.equal(camp.slots[waiting].role, "front", `${s} s after`);
        assert.equal(camp.slots[front].role, "front", "the man of the line keeps his place");
    }
    // Standing still three metres off, he may be sent at the player (the chase), never off to a spot of the ring.
    for (const move of men[waiting].moves.slice(moves)) {
        assert.ok(Math.hypot(move.target.x - player.position.x, move.target.y - player.position.y) < 1, "a run at the player, not a walk to the ring");
    }
    sut.clock.now += 2_000;
    sut.camps.tick();
    assert.equal(camp.slots[waiting].role, "ring", "and then he goes back");
});

test("a man struck after his turn ran out turns on the one who struck him and fights; the blows of his turn do not keep him (2026-11-04)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.settings.turnMs = [6_000, 6_000];
    sut.camps.tick();
    const first = camp.slots.findIndex((slot) => slot.role === "front");
    // Struck during his turn: that does not keep him at the player when the turn is over.
    sut.clock.now += 1_000;
    sut.camps.hit(men[first].id, player);
    for (let s = 0; s < 7; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    assert.equal(camp.slots[first].role, "ring", "his turn ran out: he fell back");
    // Struck now, after it: he fights back at once, and is not sent back to the ring at the next look.
    const attacks = men[first].attacks.length;
    sut.camps.hit(men[first].id, player);
    assert.equal(men[first].attacks.length, attacks + 1);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[first].role, "front");
});

test("a man of the ring is no statue: after a while of his own he walks a small step round and nearer, turns to the player again, and never charges (2026-11-04)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.settings.turnMs = [600_000, 600_000];
    sut.camps.tick();
    const index = camp.slots.findIndex((slot) => slot.role === "ring");
    const man = men[index];
    const spot = arriveInRing(sut, man);
    const holds = man.holds;
    const moves = man.moves.length;
    sut.clock.now += 3_000;
    sut.camps.tick();
    assert.equal(man.moves.length, moves, "three seconds after he got there he still stands");
    for (let s = 0; s < 3; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    assert.equal(man.moves.length, moves + 1, "six seconds after, he has taken a step");
    const step = man.moves.at(-1);
    assert.equal(step.opts.speed, "walk");
    const moved = Math.hypot(step.target.x - spot.x, step.target.y - spot.y);
    assert.ok(moved > 0.6 && moved < 2, `a small step: ${moved.toFixed(2)} m`);
    assert.ok(Math.abs(Math.hypot(step.target.x - player.position.x, step.target.y - player.position.y) - 4.5) < 0.01, "a metre nearer the player");
    // There: held and turned to the player.
    const looks = man.looks.length;
    man.position = { x: step.target.x, y: step.target.y, z: 100 };
    man.status = "reached";
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(man.holds, holds + 1);
    assert.equal(man.looks.length, looks + 1);
    assert.equal(man.attacks.length, 0, "and he never charged");
    assert.equal(camp.slots[index].role, "ring");
});

test("a small step the game will not take is given up, and never counts against his spot in the ring (2026-11-04)", () => {
    const { sut, camp, men } = cercoScene();
    sut.camps.settings.turnMs = [600_000, 600_000];
    sut.camps.tick();
    const index = camp.slots.findIndex((slot) => slot.role === "ring");
    const man = men[index];
    arriveInRing(sut, man);
    for (let s = 0; s < 6; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    man.status = "failed";
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(camp.slots[index].ringFails ?? 0, 0);
    assert.equal(camp.slots[index].role, "ring");
});

test("two shooters standing in each other: the later of the camp's line steps aside across the line to the player and shoots again from there (2026-11-04)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.settings.turnMs = [600_000, 600_000];
    const archer = camp.slots.findIndex((slot) => slot.archer);
    // The man of the line carries a bow too, and the player is twenty metres off: he shoots.
    sut.camps.tick();
    const front = camp.slots.findIndex((slot) => slot.role === "front");
    camp.slots[front].hasBow = true;
    camp.slots[front].mode = "bow";
    men[archer].position = { x: men[front].position.x + 0.5, y: men[front].position.y, z: 100 };
    for (let s = 0; s < 3; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    assert.equal(men[front].moves.length, 0, "the first of the line stays where he is");
    assert.equal(men[archer].moves.length, 1, "the archer, later in the line, steps aside");
    const aside = men[archer].moves[0].target;
    const apart = Math.hypot(aside.x - men[front].position.x, aside.y - men[front].position.y);
    assert.ok(apart >= 2.2, `clear of him: ${apart.toFixed(2)} m`);
    // Across the line to the player, not towards him.
    const before = Math.hypot(men[archer].position.x - player.position.x, men[archer].position.y - player.position.y);
    const after = Math.hypot(aside.x - player.position.x, aside.y - player.position.y);
    assert.ok(after >= before - 0.5, `not nearer the player: ${before.toFixed(1)} -> ${after.toFixed(1)}`);
    assert.ok(sut.logs.some((line) => /atirador afastado/.test(line)));
    // While he walks there the bow is not ordered again; once there, it is.
    const attacks = men[archer].attacks.length;
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(men[archer].attacks.length, attacks, "left to walk");
    men[archer].position = { x: aside.x, y: aside.y, z: 100 };
    men[archer].status = "reached";
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.equal(men[archer].attacks.length, attacks + 1);
    assert.equal(men[archer].attacks.at(-1).opts.weapon, "bow");
    assert.equal(men[archer].moves.length, 1, "and not sent aside again");
});

test("the side step: away from the man he stands in, else the other side, else back from the target; nowhere when all are taken (2026-11-04)", () => {
    const sut = load();
    const target = { x: 0, y: 0, z: 0 };
    const from = { x: 0, y: 20, z: 0 };
    const crowd = { x: 0.5, y: 20, z: 0 };
    const plainSpot = (spot) => (spot === null ? null : { x: Math.round(spot.x * 100) / 100, y: Math.round(spot.y * 100) / 100 });
    assert.deepEqual(plainSpot(sut.api.asideSpot(from, crowd, target, 3.5, 2.2, [crowd])), { x: -3.5, y: 20 }, "west, away from the man east of him");
    assert.deepEqual(plainSpot(sut.api.asideSpot(from, crowd, target, 3.5, 2.2, [crowd, { x: -3.5, y: 20, z: 0 }])), { x: 3.5, y: 20 }, "that side taken: the other");
    assert.deepEqual(plainSpot(sut.api.asideSpot(from, crowd, target, 3.5, 2.2, [crowd, { x: -3.5, y: 20, z: 0 }, { x: 3.5, y: 20, z: 0 }])), { x: 0, y: 23.5 }, "both taken: back");
    assert.equal(sut.api.asideSpot(from, crowd, target, 3.5, 2.2, [crowd, { x: -3.5, y: 20, z: 0 }, { x: 3.5, y: 20, z: 0 }, { x: 0, y: 23.5, z: 0 }]), null);
});

test("a fallen man's purse is shared at once by the players who fought him near the body; with none of them near it stays on the corpse (2026-11-02)", () => {
    globalThis.__given = [];
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const camp = sut.camps.camps[0];
    const man = sut.npcs.get(camp.slots[2].npcId);
    const purse = plain(sut.stocked.get(man.id)).filter((row) => row.item === "money").reduce((sum, row) => sum + row.amount, 0);
    assert.ok(purse > 0);
    const hans = sut.addPlayer(1, man.position.x + 2, man.position.y);
    const jan = sut.addPlayer(2, man.position.x - 2, man.position.y);
    sut.camps.hit(man.id, hans);
    sut.camps.hit(man.id, jan);
    man.alive = false;
    sut.camps.died(man.id);
    const given = globalThis.__given.filter(([id]) => id === 1 || id === 2);
    assert.equal(given.reduce((sum, [, units]) => sum + units, 0), purse, "all of it, between the two");
    assert.ok(Math.abs(given[0][1] - given[1][1]) <= 1, "in equal parts");
    assert.ok(!plain(sut.stocked.get(man.id)).some((row) => row.item === "money"), "none left on the corpse");
    assert.ok(sut.logs.some((line) => /a bolsa de .* foi para p1, p2/.test(line)));

    // The killing blow's player, named by the death, has his share though no blow of his was seen.
    globalThis.__given = [];
    const third = sut.npcs.get(camp.slots[4].npcId);
    const third_purse = plain(sut.stocked.get(third.id)).filter((row) => row.item === "money").reduce((sum, row) => sum + row.amount, 0);
    third.alive = false;
    sut.camps.died(third.id, hans);
    assert.deepEqual(globalThis.__given, [[1, third_purse]]);

    // Nobody who fought him near: the purse stays for the loot.
    globalThis.__given = [];
    const other = sut.npcs.get(camp.slots[3].npcId);
    const far = sut.addPlayer(3, other.position.x + 200, other.position.y);
    sut.camps.hit(other.id, far);
    other.alive = false;
    sut.camps.died(other.id);
    assert.deepEqual(globalThis.__given, []);
    assert.ok(plain(sut.stocked.get(other.id)).some((row) => row.item === "money"));
});

test("the men spread over the players near: one struck close by by another player turns to him, and of many on one player one goes for another with fewer on him (2026-11-02)", () => {
    const { sut, camp, men, player } = cercoScene();
    // The men about the player, as they are in a fight.
    men.forEach((man, index) => {
        man.position = { x: player.position.x + Math.cos(index) * 5, y: player.position.y + Math.sin(index) * 5, z: 100 };
    });
    sut.camps.tick();
    const onFirst = camp.slots.filter((slot) => slot.target === player.id && !slot.archer).length;
    assert.ok(onFirst >= 3, "all of them on the first");
    // A second player comes up beside the fight: one of the men goes for him.
    const second = sut.addPlayer(2, player.position.x + 4, player.position.y);
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.ok(camp.slots.some((slot) => slot.target === second.id), "one went for the second");
    // He strikes another of them from close by: that one turns to him too.
    const struck = camp.slots.find((slot) => slot.target === player.id && !slot.archer && slot.npcId !== null);
    const body = men[camp.slots.indexOf(struck)];
    body.position = { x: second.position.x + 2, y: second.position.y, z: 100 };
    sut.clock.now += 5_100;
    sut.camps.hit(body.id, second);
    sut.clock.now += 100;
    sut.camps.tick();
    assert.equal(struck.target, second.id, "he turned to the one who struck him");
});

test("a spot in the ring the game will not take a man to turns him into one of the front line after two refusals (2026-10-30)", () => {
    const { sut, camp, men } = cercoScene();
    men[1].moveTo = function (target, opts) { this.moves.push({ target, opts }); return false; };
    sut.camps.tick();
    assert.equal(camp.slots[1].role, "ring");
    assert.equal(camp.slots[1].ringFails, 1);
    sut.clock.now += 2_100;
    sut.camps.tick();
    assert.equal(camp.slots[1].ringFails, 2);
    assert.equal(men[1].attacks.length, 0);
    sut.clock.now += 2_100;
    sut.camps.tick();
    assert.equal(camp.slots[1].role, "front");
    assert.equal(men[1].attacks.at(-1).target, 1, "he fights instead of standing about");

    // A spot he failed to reach by the game's own word counts too.
    const second = cercoScene();
    second.sut.camps.tick();
    const walker = second.men[3];
    assert.equal(second.camp.slots[3].role, "ring");
    walker.status = "failed";
    second.sut.clock.now += 2_100;
    second.sut.camps.tick();
    assert.equal(second.camp.slots[3].ringFails, 1);
});

test("the ring breaks up when the player is lost: the men let go and walk home, and a new fight starts from the beginning (2026-10-30)", () => {
    const { sut, camp, men, player } = cercoScene();
    sut.camps.tick();
    assert.equal(camp.slots[2].role, "ring");
    player.position = { x: 1066, y: 2442 - 120, z: 100 };
    sut.clock.now += 5_000;
    sut.camps.tick();
    for (const slot of camp.slots) {
        assert.equal(slot.target, null);
        assert.equal(slot.role, undefined);
        assert.equal(slot.ringGoal, undefined);
    }
    assert.ok(men[2].holds >= 1);
});

test("/bandidos estado marks the men of the ring (2026-10-30)", () => {
    const { sut } = cercoScene();
    sut.camps.tick();
    const lines = Array.from(sut.camps.inspect({ x: 1066, y: 2442 - 20, z: 100 }));
    assert.equal(lines.filter((line) => /, cercando/.test(line)).length, 4, lines.join(" | "));
});

// ---------------------------------------------------------------------------------------------
// 2026-11-01: the chief, the runner of a fight, the voices, the tactics and the horses.

test("every camp and hideout has a chief, a master of his weapon in good armour, all of it loot since 2026-11-02; a gang of the roads has none (2026-11-01)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.addRoads(grid(), [], mesh());
    for (const camp of sut.camps.camps) {
        const chiefs = camp.slots.filter((slot) => slot.chief === true);
        if (camp.name.startsWith("Estrada")) {
            assert.equal(chiefs.length, 0, `${camp.name}: none on the roads`);
        } else {
            assert.equal(chiefs.length, 1, `${camp.name}: one chief`);
            assert.equal(camp.slots.indexOf(chiefs[0]), 0, "the first man");
            assert.equal(chiefs[0].archer, false);
        }
    }
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const chief = sut.npcs.get(kopec.slots[0].npcId);
    assert.equal(chief.options.name, "Chefe dos bandidos");
    assert.equal(chief.options.health, 320);
    assert.ok(sut.api.CHIEF_SOULS.includes(chief.options.soul), "one of the game's best bandits' souls");
    assert.equal(kopec.slots[0].potions, 4);
    const rows = plain(sut.stocked.get(chief.id));
    const weapon = rows.find((row) => sut.api.CHIEF_WEAPONS.includes(row.item));
    assert.ok(weapon !== undefined && weapon.equipped === 1, "the weapon he is a master of");
    assert.equal(sut.camps.chiefOf(kopec).weapon, weapon.item, "the same for the camp every start");
    for (const piece of ["BascinetOpen08_m01_B3", /^CoifMail/, "Brigandine02_m04_E2", "Gauntlets04_m01_C2", /^GambesonLong/, /^MailLong/]) {
        const row = rows.find((one) => (typeof piece === "string" ? one.item === piece : piece.test(one.item)));
        assert.ok(row !== undefined && row.equipped === 1 && row.metadata.condition >= 0.75, `${piece}: sound and worn`);
    }
    assert.ok(!rows.some((row) => /^Tunic/.test(row.item)), "no tunic under the gambeson");
    const money = rows.find((row) => row.item === "money");
    assert.ok(money.amount >= 400 && money.amount <= 900, "a heavier purse: 40 to 90 coins as the game shows them");
    assert.ok(!rows.some((row) => row.item === "bow_b"), "no bow");

    // When he falls, his armour and the weapon he was a master of stay on him, for the loot (2026-11-02: "é para manter no corpo para poder saquear").
    sut.camps.died(chief.id);
    const after = plain(sut.stocked.get(chief.id)).map((row) => row.item);
    assert.ok(after.some((item) => sut.api.CHIEF_WEAPONS.includes(item)) && after.includes("Brigandine02_m04_E2") && after.includes("BascinetOpen08_m01_B3"), JSON.stringify(after));
    assert.ok(after.includes("money") && after.some((item) => /^Hose/.test(item)));
});

test("a man after a player is run by that player's game when his own runner is far from the fight; a runner close by keeps him (2026-11-01: \"alguns NPCs ficam imortais\")", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const men = Array.from(kopec.slots, (slot) => sut.npcs.get(slot.npcId));
    const player = sut.addPlayer(1, 1066, 2442 - 5, { nickname: "Vaelgor" });
    // Aspen's game runs the nearest man from 47 m: Vaelgor fights him at 5 m.
    men[0].simulator = { id: 7, nickname: "Aspen", position: { x: 1066, y: 2442 + 42, z: 100 } };
    men[4].simulator = { id: 7, nickname: "Aspen", position: { x: 1066 + 4, y: 2442, z: 100 } };
    sut.camps.tick();
    assert.equal(JSON.parse(JSON.stringify(men[0].pins ?? [])).at(-1), 1, "given to the one he fights");
    assert.ok(sut.logs.some((line) => /preso ao jogo do alvo \(o jogo de Aspen, a 4\d m dele, o rodava\)/.test(line)), sut.logs.join(" | "));
    assert.ok(!(men[4].pins ?? []).includes(1), "a runner a few metres off judges well enough");
});

test("a fight is loud: the shouts are played on the games of the players near the man, and the men of the line taunt now and then (2026-11-01)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const heard = [];
    const player = sut.addPlayer(1, 1066, 2442 - 3, { emit: (event, payload) => heard.push([event, JSON.parse(payload)]) });
    const deaf = sut.addPlayer(2, 1066 + 300, 2442, { emit: () => assert.fail("too far to hear") });
    sut.camps.tick();
    assert.ok(heard.length >= 1, "the first lines are heard");
    assert.equal(heard[0][0], "kcdc-gamemode:bandit.shout");
    assert.ok(Object.values(sut.api.SHOUTS).flat().includes(heard[0][1].t), heard[0][1].t);
    assert.ok(Number.isFinite(heard[0][1].x) && Number.isFinite(heard[0][1].z));
    // The man of the line in reach of him taunts within the next quarter of a minute.
    const front = sut.npcs.get(kopec.slots[0].npcId);
    front.position = { x: 1066, y: 2442 - 2, z: 100 };
    // The taunts are this test's, not the turns: his turn outlasts it.
    sut.camps.settings.turnMs = [600_000, 600_000];
    const before = (front.said ?? []).length;
    for (let s = 0; s < 40; s += 1) {
        sut.clock.now += 1_000;
        sut.camps.tick();
    }
    const lines = (front.said ?? []).slice(before);
    assert.ok(lines.some((line) => sut.api.BARKS.taunt.includes(line) || sut.api.BARKS.chief.includes(line)), JSON.stringify(lines));
    assert.equal(deaf.id, 2);
});

test("when the chief falls, his men who are badly hurt run and the rest are enraged: their blows weigh more for a minute (2026-11-01)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const player = sut.addPlayer(1, 1066, 2442 - 10);
    for (const slot of kopec.slots) slot.target = player.id;
    const hurt = sut.npcs.get(kopec.slots[2].npcId);
    hurt.maxHealth = 140;
    hurt.health = 30;
    const angry = sut.npcs.get(kopec.slots[3].npcId);
    angry.maxHealth = 140;
    angry.health = 140;
    const plainHand = sut.camps.handOf(angry.id);
    sut.camps.died(kopec.slots[0].npcId);
    assert.equal(hurt.flees?.length, 1, "the hurt one runs");
    assert.ok(sut.api.BARKS.chiefFell.includes(hurt.said.at(-1)));
    assert.ok(sut.api.BARKS.rage.includes(angry.said.at(-1)));
    assert.ok(Math.abs(sut.camps.handOf(angry.id) - plainHand * 1.25) < 1e-9, "a heavier hand");
    sut.clock.now += 61_000;
    assert.equal(sut.camps.handOf(angry.id), plainHand, "for a minute");
    assert.ok(sut.logs.some((line) => /o chefe caiu; 1 fugiram, \d+ enfurecidos/.test(line)));
});

test("an archer whose man comes up to him runs back a few steps; a man of the line badly hurt with no draught may fall back once and comes again (2026-11-01)", () => {
    const sut = load();
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    const archerSlot = kopec.slots.find((slot) => slot.archer);
    const archer = sut.npcs.get(archerSlot.npcId);
    const player = sut.addPlayer(1, archer.position.x, archer.position.y - 3);
    sut.camps.tick();
    sut.clock.now += 1_000;
    sut.camps.tick();
    assert.ok((archer.flees ?? []).length >= 1, "the archer ran back from him");
    assert.ok(sut.logs.some((line) => /o arqueiro recuou/.test(line)));

    const sut2 = load();
    sut2.camps.discover(placements());
    sut2.camps.spawnAll();
    const camp2 = sut2.camps.camps[0];
    const p2 = sut2.addPlayer(1, 1066, 2442 - 2);
    sut2.camps.tick();
    const frontSlot = camp2.slots.find((slot) => slot.role === "front" && slot.chief !== true) ?? camp2.slots.find((slot) => slot.chief !== true && !slot.archer && slot.npcId !== null);
    // Alone at the player: nobody else of the ring to take his place (a man badly hurt with men behind him gives it up since 2026-11-02, the turns).
    for (const other of camp2.slots) {
        if (other !== frontSlot) other.state = "dead";
    }
    const man = sut2.npcs.get(frontSlot.npcId);
    man.maxHealth = 140;
    man.health = 30;
    frontSlot.potions = 0;
    sut2.randoms.list = Array(20).fill(0);
    sut2.clock.now += 1_000;
    sut2.camps.tick();
    assert.equal(man.flees?.length, 1, "he fell back");
    assert.ok(sut2.api.BARKS.retreat.includes(man.said.at(-1)), man.said.at(-1));
    sut2.clock.now += 7_000;
    sut2.camps.tick();
    assert.equal(frontSlot.retreatUntil, undefined, "and came again");
    sut2.clock.now += 1_000;
    sut2.camps.tick();
    assert.equal(man.flees.length, 1, "once in his life");
    assert.equal(p2.id, 1);
});

test("a rider's horse: a bandit's blow on him wounds it, and a man of the line next to him may rear it and throw him off (2026-11-01)", () => {
    const sut = load();
    sut.api.installBandits();
    sut.timeouts[0].fn();
    const camp = sut.api.banditCamps.camps[0];
    // The man beside the rider keeps his turn through the test (the turns are another test's: here nobody walks up in his place).
    sut.api.banditCamps.settings.turnMs = [600_000, 600_000];
    const horse = { id: 50, health: 100, reared: 0, rearAndThrowDown() { this.reared += 1; return true; } };
    const bandit = sut.npcs.get(camp.slots[2].npcId);
    // He rides up to the camp's second man, two metres from him.
    const rider = sut.addPlayer(1, bandit.position.x, bandit.position.y - 2, { mounted: true, horse });
    const hit = { damage: 10 };
    sut.handlers.get("playerHit")(rider, bandit, hit);
    assert.equal(hit.damage, 14);
    assert.equal(horse.health, 93, "half the blow off the horse");
    const walker = sut.addPlayer(2, 1066, 2442 - 2);
    sut.handlers.get("playerHit")(walker, bandit, { damage: 10 });
    assert.equal(horse.health, 93, "a man on foot has no horse to wound");

    // The front line: a third of the looks rear the horse, no oftener than every twenty seconds for the same rider.
    for (let s = 0; s < 30; s += 1) {
        sut.clock.now += 1_000;
        sut.api.banditCamps.tick();
    }
    assert.ok(horse.reared >= 1 && horse.reared <= 2, `reared ${horse.reared} time(s) in thirty seconds`);
    assert.ok(sut.logs.some((line) => /assustou o cavalo: o cavaleiro foi ao chão/.test(line)));
});

test("a riderless horse of a player away from it is taken by a man of the camp and led home; the theft ends when its owner comes near (2026-11-01)", () => {
    const horse = {
        id: 77, ownerId: 1, rider: null, health: 100, position: { x: 1066 + 15, y: 2442, z: 100 }, moves: [], holds: 0,
        moveTo(goal, opts) { this.moves.push({ goal: { x: goal.x, y: goal.y, z: goal.z }, opts }); return true; },
        hold() { this.holds += 1; },
    };
    const sut = load({ horses: [horse] });
    sut.camps.discover(placements());
    sut.camps.spawnAll();
    const kopec = sut.camps.camps[0];
    // The owner is fighting nobody, 40 m off his horse, inside the camp's leash.
    const owner = sut.addPlayer(1, 1066 + 15, 2442 + 40);
    kopec.slots.forEach((slot) => { const npc = sut.npcs.get(slot.npcId); npc.position = { x: 1066 + 15 + 8, y: 2442, z: 100 }; });
    sut.context.banditSettings = sut.api.banditSettings;
    sut.api.banditSettings.aggroRadius = 5;
    try {
        sut.camps.tick();
        const theft = kopec.theft;
        assert.ok(theft !== null && theft !== undefined, "a man goes for the horse");
        const thiefSlot = kopec.slots.find((slot) => slot.npcId === theft.npcId);
        assert.equal(thiefSlot.stealing, true);
        assert.equal(thiefSlot.chief, undefined, "not the chief");
        const thief = sut.npcs.get(theft.npcId);
        thief.position = { x: horse.position.x + 1, y: horse.position.y, z: 100 };
        sut.clock.now += 1_000;
        sut.camps.tick();
        assert.equal(kopec.theft.stage, "lead");
        assert.equal(horse.moves.length, 1, "the horse is led to the camp");
        assert.ok(sut.chats.some(([id, line]) => id === 1 && /levando o seu cavalo/.test(line)), "its owner is told");
        assert.ok(sut.api.BARKS.horseSteal.includes(thief.said.at(-1)));
        // The owner comes up to his horse: the theft ends, and the horse stops.
        owner.position = { x: horse.position.x + 2, y: horse.position.y, z: 100 };
        sut.clock.now += 1_000;
        sut.camps.tick();
        assert.equal(kopec.theft, null);
        assert.equal(thiefSlot.stealing, undefined);
        assert.ok(horse.holds >= 1);
        assert.ok(sut.logs.some((line) => /roubo do cavalo 77 acabou: p1 alcançou o cavalo/.test(line)), sut.logs.join(" | "));
    } finally {
        sut.api.banditSettings.aggroRadius = 24;
    }
});
