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
            const [min, max] = { 1: [1, 3], 2: [2, 4], 3: [3, 5] }[tier];
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
    assert.ok(seen[1].has("axeWork01") && !seen[1].has("axeBattle01"), "plain weapons near people");
    assert.ok(seen[3].has("longswordCommon") && seen[3].has("warhammerRaven"), "good and now and then excellent ones far away");
    assert.ok(!seen[2].has("warhammerRaven") && !seen[1].has("longswordCommon"), "and none of them near");
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
    assert.deepEqual(range(1), [100, 600]);
    assert.deepEqual(range(2), [200, 2400]);
    assert.deepEqual(range(3), [300, 5400]);
});

test("a gear roll carries a quality up to the tier's best and says nothing when the table has none", () => {
    const { api } = load();
    const weapons = api.entries(GEAR).find((entry) => entry.id === "weapons");
    assert.deepEqual(plain(weapons.roll(1, () => 0)), [{ item: "axeWork01", amount: 1, metadata: { quality: 1 } }]);
    assert.ok(weapons.roll(3, () => 0.99)[0].metadata.quality <= 4);
    const none = api.entries({}).find((entry) => entry.id === "weapons");
    assert.deepEqual(plain(none.roll(2, () => 0.5)), []);
});

test("the chests that take part: the level's own, nobody's, of a loot name, and only the share that holds something", () => {
    const sut = load();
    const lucky = guidWithShare(sut.api, 0.4, 1);
    const unlucky = (() => { for (let n = 1; n < 100_000; n += 1) { const guid = (n * 7919).toString(16).padStart(16, "0"); if (sut.api.shareOf(guid) >= 0.4) return guid; } })();
    const claimed = guidWithShare(sut.api, 0.4, 5000);
    sut.world.stashes = [
        chest(lucky),
        chest(unlucky),
        chest(claimed),
        chest(guidWithShare(sut.api, 0.4, 9000), { fields: { name: "stash_vegetables_a1" } }),
        chest(guidWithShare(sut.api, 0.4, 12000), { fields: { isVirtual: true } }),
        chest(guidWithShare(sut.api, 0.4, 15000), { fields: { levelGuid: "" } }),
    ];
    const treasure = new sut.api.Treasure(GEAR, surroundings({ claimed: (guid) => guid === claimed }), undefined, () => 1_000_000, sequence([0.5, 0.2, 0.7]));
    assert.equal(treasure.run(), 1);
    assert.ok(sut.world.stashes[0].added.length >= 1, "the chest that holds something got it");
    assert.equal(sut.world.stashes[1].added.length, 0, "not every chest has anything");
    assert.equal(sut.world.stashes[2].added.length, 0, "a property's or a camp's chest is left to its keeper");
    assert.deepEqual(sut.world.stashes.slice(3).map((stash) => stash.added.length), [0, 0, 0]);
    assert.equal(treasure.status().chests, 1);
});

test("a chest is filled once; what is left in it is not touched, and a looted one is filled again after an hour with nobody near", () => {
    const sut = load();
    const guid = guidWithShare(sut.api, 0.4, 1);
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
    clock.now += 59 * 60_000;
    assert.equal(treasure.run(), 0, "not yet");
    clock.now += 2 * 60_000;
    near = true;
    assert.equal(treasure.run(), 0, "somebody is near: not in front of them");
    near = false;
    stash.isOpen = true;
    assert.equal(treasure.run(), 0, "a chest somebody has open is left alone");
    stash.isOpen = false;
    assert.equal(treasure.run(), 1, "an hour on, nobody near: filled again");
    assert.ok(stash.getInventory().items.length >= 1);
});

test("a name the game does not know is left out and said once; a quality it will not make is tried again without", () => {
    const sut = load();
    const guid = guidWithShare(sut.api, 0.4, 1);
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
    const guid = guidWithShare(sut.api, 0.4, 1);
    sut.world.stashes = [chest(guid)];
    const treasure = new sut.api.Treasure(GEAR, surroundings(), undefined, () => 1, sequence([0.5, 0.2]));
    treasure.setEnabled(false);
    assert.equal(treasure.run(), 0);
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/treasure.json")), { enabled: false, share: 0.4 });
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
    const near = chest(guidWithShare(sut.api, 0.4, 1), { fields: { position: { x: 50, y: 0, z: 0 } } });
    const mid = chest(guidWithShare(sut.api, 0.4, 3000), { fields: { position: { x: 300, y: 0, z: 0 } } });
    const far = chest(guidWithShare(sut.api, 0.4, 6000), { fields: { position: { x: 2000, y: 0, z: 0 } } });
    const locked = chest(guidWithShare(sut.api, 0.4, 9000), { fields: { position: { x: 60, y: 0, z: 0 }, startsLocked: true } });
    sut.world.stashes = [near, mid, far, locked];
    const treasure = new sut.api.Treasure(GEAR, surroundings(), undefined, () => 1, sequence([0.5]));
    treasure.run(true);
    assert.deepEqual(plain(treasure.status().byTier), { 1: 1, 2: 2, 3: 1 });
});
