const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));
const HOUR = 3_600_000;

const GEAR = {
    weapons: { basic: ["axeWork01"], common: ["axeBattle01"], good: ["longswordCommon"], excellent: ["warhammerRaven"] },
    armor: { basic: ["CoifCap01_m01_C"], common: ["SkullCap01_m01_D1"], good: ["ArmPlate02_m01_C3"], excellent: ["BascinetVisor03_m01_A4"] },
    clothes: { basic: ["Cap03_m01_E"], common: ["Cap01_m01_C"], good: ["Cap18_m01_A"], excellent: ["Coat01_m04_A"] },
};

/** A number generator that walks a fixed list, then goes on from a simple sequence. */
function sequence(list) {
    let at = 0;
    let fallback = 0.123;
    return () => {
        if (at < list.length) return list[at++];
        fallback = (fallback * 9301 + 0.4971) % 1;
        return fallback;
    };
}

function load() {
    const books = [
        { id: "kcdc:book:cheap", price: 900 },
        { id: "kcdc:book:dear", price: 4500 },
    ];
    const disk = { files: new Map() };
    const store = { ensureDir() {}, read: (file) => (disk.files.has(file) ? { status: "ok", value: JSON.parse(disk.files.get(file)) } : { status: "missing" }), write: (file, body) => disk.files.set(file, JSON.stringify(body)) };
    const logs = [];
    const world = { stashes: [], players: [] };
    const sandbox = {
        exports: {},
        require: (id) => {
            if (id === "./books.js") return { BOOKS: books, bookGuid: (id2) => `guid:${id2}` };
            if (id === "./store.js") return store;
            throw new Error(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Stash: { all: () => world.stashes, find: (guid) => world.stashes.find((stash) => stash.levelGuid === guid) ?? null },
        Player: { all: () => world.players },
        Events: { on() {} },
        setTimeout: () => 1,
        setInterval: () => 1,
        clearTimeout() {},
        clearInterval() {},
    };
    vm.runInNewContext(dist("treasure.js"), sandbox);
    return { api: sandbox.exports, world, logs, disk };
}

function chest(guid, over = {}) {
    let rows = [];
    const stash = {
        levelGuid: guid,
        name: `Stash[Chest/chest1_${guid}]`,
        isVirtual: false,
        isOpen: false,
        startsLocked: false,
        position: { x: 3000, y: 100, z: 50 },
        added: [],
        refuse: new Set(over.refuse ?? []),
        setInventory({ items }) { rows = items.map((row) => ({ ...row })); return { ok: true, code: "" }; },
        getInventory: () => ({ items: rows.map((row) => ({ ...row })) }),
        addItem(request) {
            if (stash.refuse.has(request.item)) return { ok: false, code: "unknownItemClass" };
            if (request.metadata?.quality > 1 && stash.refuse.has("quality")) return { ok: false, code: "invalidQuality" };
            stash.added.push(request);
            rows.push({ item: request.item, amount: request.amount, metadata: request.metadata ?? {} });
            return { ok: true, code: "" };
        },
        loot() { rows = []; },
        ...over.fields,
    };
    return stash;
}

/** A GUID of sixteen hex digits whose share (see shareOf) is below the given bound, by trying. */
function guidWithShare(api, below, start = 1) {
    for (let n = start; n < 100_000; n += 1) {
        const guid = n.toString(16).padStart(16, "0");
        if (api.shareOf(guid) < below) return guid;
    }
    throw new Error("none");
}

const surroundings = (over = {}) => ({ settlements: () => [{ x: 0, y: 0 }], claimed: () => false, playersNear: () => false, ...over });

test("which chests hold something is a number from the chest's own GUID, the same at every start, spread evenly", () => {
    const { api } = load();
    assert.equal(api.shareOf("00a1b2c3d4e5f607"), api.shareOf("00a1b2c3d4e5f607"));
    let under = 0;
    const total = 4000;
    for (let n = 0; n < total; n += 1) {
        const share = api.shareOf(Math.imul(n + 1, 2654435761).toString(16).padStart(16, "0"));
        assert.ok(share >= 0 && share < 1);
        if (share < 0.4) under += 1;
    }
    assert.ok(under > total * 0.35 && under < total * 0.45, `about 40%: ${under}/${total}`);
});

test("a chest's tier comes from how far it is from people, and a lock lifts it by one (not past the third)", () => {
    const { api } = load();
    assert.equal(api.tierOf(10, false), 1);
    assert.equal(api.tierOf(149.9, false), 1);
    assert.equal(api.tierOf(150, false), 2);
    assert.equal(api.tierOf(499, false), 2);
    assert.equal(api.tierOf(500, false), 3);
    assert.equal(api.tierOf(10, true), 2);
    assert.equal(api.tierOf(300, true), 3);
    assert.equal(api.tierOf(900, true), 3);
    assert.equal(api.tierOf(Number.POSITIVE_INFINITY, false), 3);
});

test("only containers that are nobody's store are treasure: not beehives, graves, donation boxes, quest chests or vegetable stores", () => {
    const { api } = load();
    for (const name of ["Stash[Chest/chest1_abc]", "stash[Stash/stash_pile_wall_a1_x]", "Stash12[Stash/barrel_with_arrows29_x]", "sack_pile3", "crate_small2"]) {
        assert.equal(api.isTreasureName(name), true, name);
    }
    for (const name of ["Stash[bee_hive_2]", "donationBox_1", "stash_vegetables_a3", "shootingRange_stash", "spizovaciOddil_mainStash", "tomb_a", "nemcuvPoklad_stashInTheWall", "kutnohorskyTurnaj_stashForRewardLongsword", "stash[quest_chest]", "Stash[Chest/grave_chest]", "table_dice_chest"]) {
        assert.equal(api.isTreasureName(name), false, name);
    }
});

test("a chest of the first tier holds plain things; the steel and the dear books come only from the third", () => {
    const { api } = load();
    const table = api.entries(GEAR);
    const seen = { 1: new Set(), 2: new Set(), 3: new Set() };
    for (let n = 0; n < 4000; n += 1) {
        for (const tier of [1, 2, 3]) {
            const rows = api.rollChest(tier, table, sequence([(n * 0.6180339887) % 1, (n * 0.7548776662) % 1, (n * 0.5698402909) % 1]));
            const items = plain(rows).map((row) => row.item);
            assert.equal(new Set(items).size, items.length, "no kind twice in a chest");
            const [min, max] = { 1: [1, 2], 2: [1, 3], 3: [2, 4] }[tier];
            assert.ok(rows.length >= min && rows.length <= max, `tier ${tier} held ${rows.length}`);
            items.forEach((item) => seen[tier].add(item));
        }
    }
    for (const dear of ["bsmt_steelGood", "bsmt_steelNormal", "bsmt_copper", "guid:kcdc:book:dear"]) {
        assert.ok(!seen[1].has(dear) && !seen[2].has(dear), `${dear} is not for the first two tiers`);
        assert.ok(seen[3].has(dear), `${dear} is found in the third`);
    }
    for (const middle of ["bsmt_ironGood", "bsmt_steelBad", "potion_stamina", "guid:kcdc:book:cheap", "arrow_hunting"]) {
        assert.ok(!seen[1].has(middle), `${middle} is not for the first tier`);
        assert.ok(seen[2].has(middle), `${middle} is found in the second`);
    }
    for (const plainThing of ["bread", "bandage_classic", "herb_mint", "bsmt_ironBad", "arrow_crude", "money"]) {
        assert.ok(seen[1].has(plainThing), `${plainThing} is found everywhere`);
    }
    // Gear is poor and rare (2026-10-20: "não podem ter armadura e espada muito boas, têm que ser mais raros, senão tira o sentido das profissões").
    for (const tier of [1, 2, 3]) {
        for (const good of ["longswordCommon", "warhammerRaven", "ArmPlate02_m01_C3", "BascinetVisor03_m01_A4"]) {
            assert.ok(!seen[tier].has(good), `${good}: no good or excellent weapon or armour in a chest of the tier ${tier}`);
        }
    }
    assert.ok(seen[1].has("Cap03_m01_E") && !seen[1].has("axeWork01") && !seen[1].has("CoifCap01_m01_C"), "near people only a plain cap: no weapon and no armour");
    assert.ok(seen[2].has("axeWork01") && seen[2].has("CoifCap01_m01_C") && !seen[2].has("axeBattle01") && !seen[2].has("SkullCap01_m01_D1"), "plain weapons and armour from the second tier");
    assert.ok(seen[3].has("axeBattle01") && seen[3].has("SkullCap01_m01_D1"), "common ones only from the third");
    assert.ok(seen[3].has("Cap18_m01_A") && !seen[3].has("Coat01_m04_A") && !seen[2].has("Cap18_m01_A"), "a good cap far away, and no excellent clothes anywhere");
});

test("gear is rare in a chest: weapons and armour a third as often as they were, clothes two thirds", () => {
    const { api } = load();
    const table = api.entries(GEAR);
    const weight = (id) => table.find((entry) => entry.id === id).weight;
    assert.deepEqual([weight("weapons"), weight("armor"), weight("clothes")], [2, 2, 4]);
    const total = (tier) => table.filter((entry) => entry.minTier <= tier).reduce((sum, entry) => sum + entry.weight, 0);
    assert.ok(weight("weapons") / total(3) < 0.02, "about one roll in seventy gives a weapon, even far away");
    let weapons = 0;
    let armour = 0;
    let chests = 0;
    for (let n = 0; n < 6000; n += 1) {
        const rows = plain(api.rollChest(3, table, sequence([(n * 0.6180339887) % 1, (n * 0.7548776662) % 1, (n * 0.5698402909) % 1, (n * 0.3247179572) % 1])));
        chests += 1;
        if (rows.some((row) => ["axeWork01", "axeBattle01"].includes(row.item))) weapons += 1;
        if (rows.some((row) => ["CoifCap01_m01_C", "SkullCap01_m01_D1"].includes(row.item))) armour += 1;
    }
    assert.ok(weapons / chests < 0.08 && armour / chests < 0.08, `a chest far away holds a weapon ${weapons}/${chests} and armour ${armour}/${chests} of the time: rare`);
});

test("the quality of a piece found: weapons and armour never past common, and common only far away; clothes good at most; and no horse tack", () => {
    const { api } = load();
    for (const draw of [0, 0.3, 0.64, 0.65, 0.9, 0.999]) {
        assert.equal(api.gearQuality("weapons", 1, draw), "basic");
        assert.equal(api.gearQuality("weapons", 2, draw), "basic");
        assert.equal(api.gearQuality("armor", 2, draw), "basic");
        assert.ok(["basic", "common"].includes(api.gearQuality("weapons", 3, draw)), `weapons ${draw}`);
        assert.ok(["basic", "common"].includes(api.gearQuality("armor", 3, draw)), `armour ${draw}`);
        assert.ok(["basic", "common", "good"].includes(api.gearQuality("clothes", 3, draw)));
        assert.equal(api.gearQuality("clothes", 1, draw), "basic");
    }
    assert.equal(api.gearQuality("weapons", 3, 0.64), "basic");
    assert.equal(api.gearQuality("weapons", 3, 0.65), "common", "a third of the third tier's pieces");
    assert.equal(api.gearQuality("clothes", 3, 0.84), "common");
    assert.equal(api.gearQuality("clothes", 3, 0.85), "good", "one in seven");

    const tack = { armor: { basic: ["CaparisonBrunswig_m01", "CoifCap01_m01_C", "HorseSaddle01"], common: ["Bridle01"] }, weapons: {}, clothes: {} };
    const entries = api.entries(tack);
    const armour = entries.find((entry) => entry.id === "armor");
    const found = new Set();
    for (let n = 0; n < 200; n += 1) plain(armour.roll(3, sequence([n / 200, (n * 0.37) % 1]))).forEach((row) => found.add(row.item));
    assert.deepEqual([...found].sort(), ["CoifCap01_m01_C"], "the caparison, the saddle and the bridle are never found");
    assert.deepEqual(plain(api.withoutTack(tack).armor), { basic: ["CoifCap01_m01_C"], common: [] }, "and the data file's own are taken out when it is read");
});

test("every chest has food or survival goods, minerals, recipes and gear to be found across the tiers", () => {
    const { api } = load();
    const table = api.entries(GEAR);
    const kinds = new Set(table.map((entry) => entry.id));
    for (const wanted of ["comida", "ataduras", "ervas", "sucata", "ferro", "aço comum", "aço bom", "receitas", "receitas raras", "poções", "flechas", "moedas", "weapons", "armor", "clothes"]) {
        assert.ok(kinds.has(wanted), wanted);
    }
});

test("coin grows with the tier, in the money item's units (the game shows a tenth)", () => {
    const { api } = load();
    const money = api.entries(GEAR).find((entry) => entry.id === "moedas");
    const range = (tier) => {
        let low = Infinity;
        let high = 0;
        for (let n = 0; n <= 200; n += 1) {
            const amount = money.roll(tier, () => Math.min(n / 200, 0.999999))[0].amount;
            low = Math.min(low, amount);
            high = Math.max(high, amount);
        }
        return [low, high];
    };
    assert.deepEqual(range(1), [50, 300]);
    assert.deepEqual(range(2), [100, 1200]);
    assert.deepEqual(range(3), [150, 2700]);
});

test("a gear roll carries a worn quality, one or two for a weapon, and says nothing when the table has none", () => {
    const { api } = load();
    const weapons = api.entries(GEAR).find((entry) => entry.id === "weapons");
    assert.equal(weapons.minTier, 2, "no weapons near people");
    assert.equal(api.entries(GEAR).find((entry) => entry.id === "armor").minTier, 2);
    assert.equal(api.entries(GEAR).find((entry) => entry.id === "clothes").minTier, 1);
    assert.deepEqual(plain(weapons.roll(2, () => 0)), [{ item: "axeWork01", amount: 1, metadata: { quality: 1 } }]);
    assert.ok(weapons.roll(3, () => 0.99)[0].metadata.quality <= 2, "never better than two");
    assert.ok(weapons.roll(3, () => 0.99)[0].item === "axeBattle01", "the common one, from the third tier");
    const clothes = api.entries(GEAR).find((entry) => entry.id === "clothes");
    assert.ok(clothes.roll(3, () => 0.99)[0].metadata.quality <= 3);
    const none = api.entries({}).find((entry) => entry.id === "weapons");
    assert.deepEqual(plain(none.roll(2, () => 0.5)), []);
});

test("the chests that take part: the level's own, nobody's, of a loot name, and only the share that holds something", () => {
    const sut = load();
    const lucky = guidWithShare(sut.api, 0.2, 1);
    const unlucky = (() => { for (let n = 1; n < 100_000; n += 1) { const guid = (n * 7919).toString(16).padStart(16, "0"); if (sut.api.shareOf(guid) >= 0.2) return guid; } })();
    const claimed = guidWithShare(sut.api, 0.2, 5000);
    sut.world.stashes = [
        chest(lucky),
        chest(unlucky),
        chest(claimed),
        chest(guidWithShare(sut.api, 0.2, 9000), { fields: { name: "stash_vegetables_a1" } }),
        chest(guidWithShare(sut.api, 0.2, 12000), { fields: { isVirtual: true } }),
        chest(guidWithShare(sut.api, 0.2, 15000), { fields: { levelGuid: "" } }),
    ];
    const treasure = new sut.api.Treasure(GEAR, surroundings({ claimed: (guid) => guid === claimed }), undefined, () => 1_000_000, sequence([0.5, 0.2, 0.7]));
    assert.equal(treasure.run(), 1);
    assert.ok(sut.world.stashes[0].added.length >= 1, "the chest that holds something got it");
    assert.equal(sut.world.stashes[1].added.length, 0, "not every chest has anything");
    assert.equal(sut.world.stashes[2].added.length, 0, "a property's or a camp's chest is left to its keeper");
    assert.deepEqual(sut.world.stashes.slice(3).map((stash) => stash.added.length), [0, 0, 0]);
    assert.equal(treasure.status().chests, 1);
});

test("a chest is filled once; what is left in it is not touched, and a looted one is filled again after three hours with nobody near", () => {
    const sut = load();
    const guid = guidWithShare(sut.api, 0.2, 1);
    const stash = chest(guid);
    sut.world.stashes = [stash];
    const clock = { now: 1_000_000 };
    let near = false;
    const treasure = new sut.api.Treasure(GEAR, surroundings({ playersNear: () => near }), undefined, () => clock.now, sequence([0.5, 0.2]));
    assert.equal(treasure.run(), 1);
    const first = plain(stash.getInventory().items);
    assert.ok(first.length >= 1);

    clock.now += 3 * HOUR;
    assert.equal(treasure.run(), 0, "not looted: left as it is");
    assert.deepEqual(plain(stash.getInventory().items), first);

    stash.loot();
    clock.now += 10 * 60_000;
    assert.equal(treasure.run(), 0, "found empty: the hour starts");
    clock.now += 179 * 60_000;
    assert.equal(treasure.run(), 0, "not yet");
    clock.now += 2 * 60_000;
    near = true;
    assert.equal(treasure.run(), 0, "somebody is near: not in front of them");
    near = false;
    stash.isOpen = true;
    assert.equal(treasure.run(), 0, "a chest somebody has open is left alone");
    stash.isOpen = false;
    assert.equal(treasure.run(), 1, "three hours on, nobody near: filled again");
    assert.ok(stash.getInventory().items.length >= 1);
});

test("a name the game does not know is left out and said once; a quality it will not make is tried again without", () => {
    const sut = load();
    const guid = guidWithShare(sut.api, 0.2, 1);
    const stash = chest(guid, { refuse: ["bread", "quality"] });
    sut.world.stashes = [stash];
    const treasure = new sut.api.Treasure(GEAR, surroundings({ settlements: () => [{ x: 3000, y: 100 }] }), undefined, () => 1, sequence([0.01, 0.01, 0.01, 0.02, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]));
    treasure.run(true);
    treasure.run(true);
    assert.ok(!stash.added.some((row) => row.item === "bread"), "bread was refused");
    assert.ok(treasure.status().refused.includes("bread"));
});

test("switched off, nothing is filled; the share can be changed, and both are kept", () => {
    const sut = load();
    const guid = guidWithShare(sut.api, 0.2, 1);
    sut.world.stashes = [chest(guid)];
    const treasure = new sut.api.Treasure(GEAR, surroundings(), undefined, () => 1, sequence([0.5, 0.2]));
    treasure.setEnabled(false);
    assert.equal(treasure.run(), 0);
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/treasure.json")), { enabled: false, share: 0.2 });
    assert.equal(treasure.run(true), 1, "an administrator's fill goes ahead whatever");

    treasure.setShare(0);
    assert.equal(treasure.status().chests, 0);
    assert.equal(treasure.run(true), 0, "no chest holds anything at zero");
    treasure.setShare(7);
    assert.equal(treasure.share, 1, "clamped");
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/treasure.json")).share, 1);

    const again = new sut.api.Treasure(GEAR, surroundings());
    again.load();
    assert.equal(again.enabled, false);
    assert.equal(again.share, 1);
});

test("the chest farther from every settlement is of a higher tier, and the status counts them", () => {
    const sut = load();
    const near = chest(guidWithShare(sut.api, 0.2, 1), { fields: { position: { x: 50, y: 0, z: 0 } } });
    const mid = chest(guidWithShare(sut.api, 0.2, 3000), { fields: { position: { x: 300, y: 0, z: 0 } } });
    const far = chest(guidWithShare(sut.api, 0.2, 6000), { fields: { position: { x: 2000, y: 0, z: 0 } } });
    const locked = chest(guidWithShare(sut.api, 0.2, 9000), { fields: { position: { x: 60, y: 0, z: 0 }, startsLocked: true } });
    sut.world.stashes = [near, mid, far, locked];
    const treasure = new sut.api.Treasure(GEAR, surroundings(), undefined, () => 1, sequence([0.5]));
    treasure.run(true);
    assert.deepEqual(plain(treasure.status().byTier), { 1: 1, 2: 2, 3: 1 });
});

test("soap and perfume are in the chests of the world (2026-10-27): soap and the plain perfumes from the first tier, the better perfumes from the second and the third", () => {
    const { api } = load();
    const table = api.entries(GEAR);
    const entry = (id) => table.find((one) => one.id === id);
    assert.deepEqual(plain(entry("sabão").roll(1, () => 0)), [{ item: "soap", amount: 1 }]);
    assert.deepEqual(plain(entry("sabão").roll(1, () => 0.99)), [{ item: "soap_kcd", amount: 3 }], "a knight's soap too, up to three cakes");
    assert.equal(entry("sabão").minTier, 1);
    assert.deepEqual(plain(entry("perfume").roll(1, () => 0)), [{ item: "perfume_longWeak", amount: 1 }]);
    assert.deepEqual(plain(entry("perfume").roll(1, () => 0.99)), [{ item: "perfume_shortStrong", amount: 1 }]);
    assert.equal(entry("perfume").minTier, 1);
    assert.deepEqual(plain(entry("perfume bom").roll(2, () => 0)), [{ item: "perfume_longWeak_medium", amount: 1 }]);
    assert.equal(entry("perfume bom").minTier, 2);
    assert.deepEqual(plain(entry("perfume raro").roll(3, () => 0.99)), [{ item: "perfume_shortStrong_high", amount: 1 }]);
    assert.equal(entry("perfume raro").minTier, 3);
    // And they come out of the dice: a chest of the first tier is rolled over and over until soap and perfume have both turned up.
    const seen = new Set();
    let at = 0.0137;
    const random = () => (at = (at * 9301 + 0.4971) % 1);
    for (let n = 0; n < 3000; n += 1) {
        for (const row of api.rollChest(1, table, random)) {
            seen.add(row.item);
        }
    }
    assert.ok(seen.has("soap") && seen.has("soap_kcd") && seen.has("perfume_longWeak") && seen.has("perfume_shortStrong"), "the first tier's");
    assert.ok(!seen.has("perfume_longWeak_high") && !seen.has("perfume_longWeak_medium"), "and not the better perfumes");
});

// The food sacks (2026-10-27, the user: "nos sacos de comida vamos colocar um pouco de comida como frutas, mas pouco"): a little food by what the sack is, and nothing else.

const APPLE = "2264f217-590e-4c0f-a4c6-f50c6532b9f6";
const PEAR = "2eeb7bf7-f0ac-4c46-9468-97c2f76cb254";
const PLUM = "2ac0499c-a18f-425f-ab8c-bc81eaa0142a";
const ONION = "4a6fa310-067a-404d-9813-bd1761d1c70d";
const sack = (guid, kind) => chest(guid, { fields: { name: `Stash3[Stash/sack_${kind}9_${guid}]` } });

test("a food sack is known by the name the level gives it, and is no chest of the loot tables any more", () => {
    const { api } = load();
    assert.equal(api.sackKindOf("Stash3[Stash/sack_apples9_2e9f7b0e-39db-4638-91dc-147b4bc60980]"), "apples");
    assert.equal(api.sackKindOf("Stash1[Stash/sack_onions8_fa3b5f7e]"), "onions");
    assert.equal(api.sackKindOf("Stash4[Stash/sack_generic8_55d4d74e]"), "generic");
    assert.equal(api.sackKindOf("Stash1[interiorDecoration/shelves/shelf_rustic_b_v1:Stash/sack_onions1[interiorDecoration/shelves/shelf_rustic_b_v1]_x]"), "onions", "on a house's shelf too");
    assert.equal(api.sackKindOf("Stash[Chest/chest1_abc]"), null);
    assert.equal(api.sackKindOf("sack_pile3"), null, "a pile of sacks is no food sack");
    assert.equal(api.isTreasureName("Stash3[Stash/sack_apples9_x]"), false, "a sack of apples that held a sword was no RP");
    assert.equal(api.isTreasureName("Stash4[Stash/sack_generic8_x]"), false);
    assert.equal(api.isTreasureName("sack_pile3"), true, "other sacks stay as they were");
});

test("a sack of apples holds one to three apples and, one time in four, a pear or a plum too; never anything else", () => {
    const { api } = load();
    const seen = new Set();
    for (let n = 0; n < 3000; n += 1) {
        const rows = api.rollSack("apples", sequence([n / 3000, (n * 7 % 3000) / 3000, (n * 13 % 3000) / 3000, (n * 31 % 3000) / 3000, (n * 17 % 3000) / 3000]));
        assert.ok(rows.length >= 1 && rows.length <= 2);
        assert.equal(rows[0].item, APPLE);
        assert.ok(rows[0].amount >= 1 && rows[0].amount <= 3);
        if (rows[1] !== undefined) {
            assert.ok([PEAR, PLUM].includes(rows[1].item));
            assert.ok(rows[1].amount >= 1 && rows[1].amount <= 2);
        }
        for (const row of rows) seen.add(row.item);
    }
    assert.deepEqual([...seen].sort(), [APPLE, PEAR, PLUM].sort());
    // The draws that decide: a first row of three apples, and no second row when the draw is above a quarter.
    assert.deepEqual(plain(api.rollSack("apples", sequence([0.99, 0.9]))), [{ item: APPLE, amount: 3 }]);
    assert.deepEqual(plain(api.rollSack("apples", sequence([0, 0.1, 0.9, 0.5]))), [{ item: APPLE, amount: 1 }, { item: PLUM, amount: 2 }]);
});

test("a sack of onions holds onions, and now and then an apple; a plain sack one thing, one or two of it, mostly fruit", () => {
    const { api } = load();
    for (let n = 0; n < 2000; n += 1) {
        const rows = api.rollSack("onions", sequence([(n % 100) / 100, (n * 3 % 100) / 100, (n * 7 % 100) / 100, (n * 11 % 100) / 100]));
        assert.equal(rows[0].item, ONION);
        assert.ok(rows[0].amount >= 1 && rows[0].amount <= 3);
        assert.ok(rows.length <= 2 && (rows[1] === undefined || rows[1].item === APPLE));
    }
    const kinds = {};
    for (let n = 0; n < 4000; n += 1) {
        const rows = api.rollSack("generic", sequence([(n % 1000) / 1000, (n * 7 % 1000) / 1000]));
        assert.equal(rows.length, 1);
        assert.ok(rows[0].amount >= 1 && rows[0].amount <= 2);
        kinds[rows[0].item] = (kinds[rows[0].item] ?? 0) + 1;
    }
    const fruit = (kinds[APPLE] ?? 0) + (kinds[PEAR] ?? 0) + (kinds[PLUM] ?? 0);
    assert.ok(fruit > 4000 * 0.6, `mostly fruit: ${fruit} of 4000`);
    assert.deepEqual(Object.keys(kinds).filter((item) => ![APPLE, PEAR, PLUM, "walnuts", "b7ee311c-736b-4f7c-987b-8431ce3b5600"].includes(item)), [], "and nothing but food");
});

test("half of the food sacks hold something, filled with food by their kind, apart from the chests; a claimed one is left; one emptied is filled again after three hours", () => {
    const sut = load();
    const found = [];
    for (let n = 1; found.length < 4 && n < 100_000; n += 1) {
        const guid = (n * 104729).toString(16).padStart(16, "0");
        if (sut.api.shareOf(guid) < 0.5) found.push(guid);
    }
    const skipped = (() => { for (let n = 1; n < 100_000; n += 1) { const guid = (n * 15485863).toString(16).padStart(16, "0"); if (sut.api.shareOf(guid) >= 0.5) return guid; } })();
    const [apples, onions, generic, claimed] = found;
    sut.world.stashes = [sack(apples, "apples"), sack(onions, "onions"), sack(generic, "generic"), sack(claimed, "apples"), sack(skipped, "apples"), chest(guidWithShare(sut.api, 0.2, 40_000))];
    let now = 1_000_000;
    const treasure = new sut.api.Treasure(GEAR, surroundings({ claimed: (guid) => guid === claimed }), undefined, () => now, sequence([0.1, 0.5, 0.3, 0.2, 0.4]));
    assert.equal(treasure.run(), 4, "three sacks and the chest");
    assert.equal(treasure.status().sacks, 3);
    assert.equal(treasure.status().chests, 1, "the chests are counted apart");
    assert.ok(sut.world.stashes[0].added.every((row) => [APPLE, PEAR, PLUM].includes(row.item)) && sut.world.stashes[0].added.length >= 1);
    assert.ok(sut.world.stashes[1].added.every((row) => [ONION, APPLE].includes(row.item)) && sut.world.stashes[1].added.length >= 1);
    assert.equal(sut.world.stashes[2].added.length, 1);
    assert.equal(sut.world.stashes[3].added.length, 0, "a property's sack is its keeper's");
    assert.equal(sut.world.stashes[4].added.length, 0, "and half of them hold nothing");
    assert.ok(sut.world.stashes[0].added.every((row) => row.metadata === undefined), "food has no quality to give");

    // Picked clean, a sack waits three hours and is filled again with nobody near.
    sut.world.stashes[0].loot();
    now += 3_600_000;
    assert.equal(treasure.run(), 0, "an hour is not enough");
    now += 3 * 3_600_000;
    assert.equal(treasure.run(), 1);
    assert.ok(sut.world.stashes[0].added.length >= 2, "filled again");
});
