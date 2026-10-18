const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function fakeDisk(seed = {}) {
    const files = new Map(Object.entries(seed));
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) throw new Error("ENOENT");
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function loadModule(name, sandbox) {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8"), sandbox);
    return sandbox.exports;
}

const BUYS = {
    ferreiro: ["bsmt_ironBad", "daggerCommon", "huntingSwordBasic", "unknownBlade"],
    alquimista: ["herb_marigold", "potion_marigold"],
    taberneiro: ["beer", "bread", "pigMeat"],
    cacador: ["arrow_normal", "bow_b", "deerMeat"],
    alfaiate: ["TunicShort01_m01_D"],
};

class FakeVector3 {
    constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
}

/** unknownItems are names the fake game does not know; the rest are worth 100 each. */
function load({ unknownItems = ["unknownBlade"], navigationReady = false, seed = {}, houses = [], hour = 12, buys = BUYS, gestures = [], now = 1_760_000_000_000, doorsByGuid = {} } = {}) {
    const disk = fakeDisk(seed);
    const store = loadModule("store", { exports: {}, require: () => disk.fs });
    const books = loadModule("books", { exports: {}, console: { log() {} }, Items: { register: (id) => `guid:${id}` }, Events: { on() {} } });
    books.registerBooks();

    const handlers = new Map();
    const timers = [];
    const intervals = [];
    const npcs = new Map();
    const vendors = new Map();
    const fires = [];
    const opened = [];
    const logs = [];
    const world = { hour };
    const players = [];
    const reservations = [];
    const released = [];
    // The catalog is the test's copy: a vendor's claim on a house must not reach the next test's houses.
    const catalog = houses.map((entry) => ({ ...entry }));
    const clock = { now };
    let nextNpc = 100;
    let nextVendor = 1;

    // The shared body and spot helpers are the real ones, over the same fakes.
    let townsfolk;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./books.js") return books;
            if (id === "./store.js") return store;
            if (id === "./townsfolk.js") return townsfolk;
            if (id === "./properties.js") {
                return {
                    listProperties: () => catalog,
                    reserveForNpc: (houseId, npcName, homeName) => {
                        reservations.push({ houseId, npcName, homeName });
                        const found = catalog.find((candidate) => candidate.id === houseId);
                        if (found) {
                            found.npc = npcName;
                            // As the real catalog does: a census name ("Casa 01") becomes the vendor's.
                            if (/^(Casa|Taverna) \d+$/.test(found.name)) found.name = homeName;
                        }
                        return true;
                    },
                    releaseNpcHomes: (keep) => {
                        released.push([...keep].sort());
                        return 0;
                    },
                };
            }
            if (id === "node:fs") {
                return { readFileSync: (file) => { if (buys !== null && /vendor-buys\.json$/.test(file)) return JSON.stringify(buys); throw new Error("ENOENT"); } };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        Math,
        Vector3: FakeVector3,
        setTimeout: (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length; },
        clearTimeout(handle) { if (timers[handle - 1]) timers[handle - 1].done = true; },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        Navigation: {
            get ready() { return navigationReady; },
            closestPoint: (point) => new FakeVector3(point.x, point.y, point.z + 0.5),
            randomPoint: (center, radius) => new FakeVector3(center.x + radius / 2, center.y, center.z),
        },
        World: world,
        Door: { find: (guid) => doorsByGuid[guid] ?? null },
        Player: { all: () => players },
        Animations: { list: (term) => gestures.filter((row) => row.fragment.toLowerCase().includes(term.toLowerCase())) },
        Inventory: {
            getItemPrice: (item) => (unknownItems.includes(item) ? null : { pristine: 100, current: 100 }),
        },
        Npc: {
            create: (options) => {
                const npc = {
                    id: nextNpc++, options, looks: [], walks: [], teleports: [], anims: [], said: [], talking: [], removed: false, healthBar: true,
                    position: { ...options.position },
                    lookAt(target) { this.looks.push(target.id ?? "point"); return true; },
                    setNametagHealthVisible(visible) { this.healthBar = visible; },
                    moveTo(target, how) { this.walks.push({ x: target.x, y: target.y, pathfinding: how?.pathfinding }); return true; },
                    teleport(target) { this.teleports.push({ x: target.x, y: target.y }); this.position = { ...target }; return true; },
                    playAnimation(fragment, how) { this.anims.push({ fragment, tags: how?.tags ?? "", loop: how?.loop === true }); return true; },
                    stopAnimation() { this.anims.push({ fragment: "(stop)", tags: "", loop: false }); return true; },
                    say(text) { this.said.push(text); return true; },
                    hold() { this.holds = (this.holds ?? 0) + 1; return true; },
                    setTalking(on) { this.talking.push(on); return true; },
                    remove() { this.removed = true; npcs.delete(this.id); },
                };
                npcs.set(npc.id, npc);
                return npc;
            },
            getById: (id) => npcs.get(id) ?? null,
        },
        Vfx: {
            list: () => ["WH_Particels.fires.candle", "WH_Particels.fires.exterior_fireplace", "WH_Particels.fires.fire_firewood"],
            spawn: (effect, position) => {
                const fire = { effect, position: { x: position.x, y: position.y, z: position.z }, destroyed: false, destroy() { this.destroyed = true; } };
                fires.push(fire);
                return fire;
            },
        },
        Vendor: {
            create: (options) => {
                const id = nextVendor++;
                vendors.set(id, { id, options, stock: [], buyPrices: [], purse: options.purse ?? null, destroyed: false });
                return id;
            },
            setStock: (id, rows) => { vendors.get(id).stock = JSON.parse(JSON.stringify(rows)); return true; },
            setBuyPrices: (id, rows) => { vendors.get(id).buyPrices = JSON.parse(JSON.stringify(rows)); return true; },
            setPurse: (id, purse) => { vendors.get(id).purse = purse; return true; },
            getPurse: (id) => vendors.get(id)?.purse ?? null,
            destroy: (id) => { vendors.get(id).destroyed = true; return true; },
            open: (vendor, player, npc) => { opened.push({ vendor, player, npc }); return 1; },
        },
    };
    townsfolk = (() => {
        const realm = { ...context, exports: {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/townsfolk.js"), "utf8"), realm);
        return realm.exports;
    })();
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/vendors.js"), "utf8"), context);
    context.exports.installVendors();

    const emit = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    return {
        api: context.exports,
        world, players, clock, disk, npcs, vendors, fires, opened, logs, handlers, timers, intervals, emit, reservations, released,
        spawn: () => timers[0].fn(),
        byName: (name) => [...npcs.values()].find((npc) => npc.options.name === name),
        shop: (name) => [...vendors.values()].filter((vendor) => !vendor.destroyed).find((vendor) => vendor.options.name === name),
        line: (id) => Array.from(context.exports.describeVendors()).find((entry) => entry.startsWith(`  ${id} --`)),
    };
}

const live = (sut) => [...sut.npcs.values()];
const player = (id, x, y, z = 146) => ({ id, ready: true, virtualWorld: 0, position: { x, y, z } });

const SUCHDOL = ["Mestre Ferreiro", "Boticário", "Taberneiro", "Mestre Caçador", "Costureira"];
const villagers = (sut) => live(sut).filter((npc) => SUCHDOL.includes(npc.options.name));
const ATTENDANT_NAMES = ["Dona dos Banhos", "Banhista", "Administradora dos Banhos"];
const pedlars = (sut) => live(sut).filter((npc) => !SUCHDOL.includes(npc.options.name) && !ATTENDANT_NAMES.includes(npc.options.name));
const attendants = (sut) => live(sut).filter((npc) => ATTENDANT_NAMES.includes(npc.options.name));

test("five trade NPCs appear in Suchdol a little after the server starts, at the shops the level places, and a pedlar at each roadside camp, by a fire", () => {
    const sut = load();
    assert.equal(sut.npcs.size, 0, "nothing at install time: the level is not up yet");
    assert.ok(sut.timers[0].ms >= 5000);
    sut.spawn();
    assert.deepEqual(villagers(sut).map((npc) => npc.options.name), SUCHDOL);
    assert.ok(live(sut).every((npc) => npc.options.interactable && npc.options.invulnerable && npc.options.nametag === false && npc.healthBar === false && npc.options.lootable === false));
    assert.deepEqual({ x: sut.byName("Taberneiro").position.x, y: sut.byName("Taberneiro").position.y }, { x: 604.01, y: 3277.69 }, "at the tavern's own shop");
    assert.deepEqual({ x: sut.byName("Mestre Ferreiro").position.x, y: sut.byName("Mestre Ferreiro").position.y }, { x: 662.34, y: 3258.94 }, "at the village smithy");
    assert.ok(sut.logs.some((line) => /vendors: Suchdol: 5 vendedores/.test(line)));

    assert.equal(pedlars(sut).length, 13, "one at each of the level's roadside camps");
    assert.deepEqual([...new Set(pedlars(sut).map((npc) => npc.options.name))].sort(), ["Bufarinheira", "Mascate"]);
    assert.equal(sut.fires.length, 13, "each camp's fire lit");
    assert.ok(sut.fires.every((fire) => fire.effect === "WH_Particels.fires.exterior_fireplace"), "the outdoor fireplace of the game's catalog, since campfire_a is not in it");
    const first = pedlars(sut)[0];
    assert.ok(sut.fires.some((fire) => Math.hypot(fire.position.x - first.position.x, fire.position.y - first.position.y) < 3), "a couple of steps from the fire");
    assert.ok(sut.logs.some((line) => /13 mascate\(s\) nas fogueiras de beira de estrada, 13 fogueira\(s\) acesa\(s\)/.test(line)));
    assert.deepEqual(Array.from(sut.api.vendorIds()).slice(0, 6), ["ferreiro", "alquimista", "taberneiro", "cacador", "alfaiate", "mascate-1"]);
});

test("eight bath attendants stand where the level has its baths, with no house and no fire, and sell soap, perfume and bandages", () => {
    const sut = load();
    sut.spawn();
    assert.equal(attendants(sut).length, 8);
    assert.deepEqual(Array.from(new Set(attendants(sut).map((npc) => npc.options.name))).sort(), ["Administradora dos Banhos", "Banhista", "Dona dos Banhos"]);
    assert.equal(sut.byName("Dona dos Banhos").options.name, "Dona dos Banhos");
    const at = (id) => {
        const line = sut.line(id);
        return /lugar em (\d+) (\d+) (\d+)/.exec(line).slice(1).map(Number);
    };
    assert.deepEqual([at("banho-1"), at("banho-4"), at("banho-6"), at("banho-8")], [[741, 3348, 142], [3208, 2168, 95], [3083, 465, 36], [564, 256, 110]], "Suchdol, Grunta, Kuttenberg and Malešov");
    assert.equal(sut.fires.length, 13, "a bath has no camp fire: only the pedlars' are lit");
    assert.ok(!/sem casa|mora em/.test(sut.line("banho-1")) && /nos banhos/.test(sut.line("banho-1")));
    assert.ok(sut.logs.some((line) => /vendors: 8 banhista\(s\) nos banhos: Suchdol, Zikmundovo, Grunta, Kuttenberg, Malešov/.test(line)));

    const shop = sut.shop("Banhos (Suchdol)");
    assert.deepEqual(shop.stock.map((row) => row.item), ["soap", "soap_kcd", "perfume_longWeak", "perfume_longWeak_medium", "perfume_longWeak_high", "perfume_shortStrong", "perfume_shortStrong_medium", "perfume_shortStrong_high", "bandage_classic", "guid:kcdc:book:alquimia-perfumaria"]);
    assert.ok(shop.stock.filter((row) => !row.item.startsWith("guid:kcdc:book:")).every((row) => row.price === 120), "the game's price plus a fifth, like everybody's; the book at its own");
    assert.ok(shop.buyPrices.some((row) => row.item === "soap") && shop.buyPrices.length === 9, "and buys what the baths sell, at a third of its worth");
});

test("a bath attendant keeps to the baths by day and by night, never farther than a pedlar from the fire", () => {
    const sut = load({ hour: 23, navigationReady: true });
    sut.spawn();
    const maid = attendants(sut)[0];
    assert.ok(maid, "no house to sleep in");
    sut.api.liveDay(sut.clock.now + 60_000);
    const spot = maid.walks.at(-1);
    assert.ok(spot, "walks about at night too");
    assert.ok(Math.hypot(spot.x - maid.options.position.x, spot.y - maid.options.position.y) <= sut.api.vendorLife.campRoamM + 0.01);
});

test("each wears the outfit of its trade, and a clothier may keep the dress of her soul", () => {
    const sut = load();
    sut.spawn();
    assert.equal(sut.byName("Mestre Ferreiro").options.outfit, "12468c7d-7ab1-4afc-b102-b0e74c144e8c");
    assert.equal(sut.byName("Boticário").options.outfit, "6d7407c7-7504-4432-9695-01567ffed4a6");
    assert.equal(sut.byName("Costureira").options.soul, "townswoman");
    assert.match(sut.byName("Costureira").options.outfit, /^[0-9a-f-]{36}$/, "dressed from the villagers' women, not left to the soul");
    assert.equal(sut.byName("Bufarinheira").options.soul, "townswoman");
});

test("each sells its trade's goods at the game's price plus a margin, and the smiths their books at the book's price", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.ok(smith.stock.some((row) => row.item === "bsmt_ironBad" && row.price === 120));
    assert.ok(smith.stock.some((row) => row.item.startsWith("guid:kcdc:book:ferreiro-")));
    assert.deepEqual(sut.shop("Taberneiro (Suchdol)").stock.map((row) => row.item), ["beef", "pigMeat", "lambMeat", "chicken", "guid:kcdc:book:alquimia-tonicos", "guid:kcdc:book:alquimia-medicina"], "meat, and the books of drinks and remedies");
});

test("a pedlar sells a few odd things of each kind, a different few at every camp, always with plain dice", () => {
    const sut = load();
    sut.spawn();
    const shops = [...sut.vendors.values()].filter((vendor) => vendor.options.name.startsWith("Mascate ("));
    assert.equal(shops.length, 13);
    const first = shops[0].stock.map((row) => row.item);
    assert.equal(first.length, 11, "plain dice, three dice, two badges, three things to wear and two odd things");
    assert.equal(first[0], "dieNormal");
    assert.ok(first.includes("Spectacles01_m01") || shops.some((shop) => shop.stock.some((row) => row.item === "Spectacles01_m01")), "spectacles at some camp");
    assert.ok(shops.some((shop) => shop.stock.some((row) => row.item === "EyepatchZizka_m01")), "an eye patch at some camp");
    assert.ok(shops.every((shop) => shop.stock.every((row) => row.price === 120)), "the game's price plus a fifth, like everybody's");
    assert.notDeepEqual(shops[1].stock.map((row) => row.item), first, "the next camp has other things");
    assert.ok(shops[0].buyPrices.some((row) => row.item === "loot_rosary" && row.price === 35), "and buys trinkets at a third of their worth");
    assert.deepEqual(Array.from(sut.api.waresOf(0)).map((line) => line.item), first);
});

test("each buys only its own trade's goods, at a third of what the game says they are worth", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.equal(smith.options.buys, true);
    assert.deepEqual(smith.buyPrices, [{ item: "bsmt_ironBad", price: 35 }, { item: "daggerCommon", price: 35 }, { item: "huntingSwordBasic", price: 35 }], "an item the game does not know is left out");
    assert.deepEqual(sut.shop("Caçador (Suchdol)").buyPrices.map((row) => row.item), ["arrow_normal", "bow_b", "deerMeat"]);
    assert.deepEqual(sut.shop("Alfaiate (Suchdol)").buyPrices.map((row) => row.item), ["TunicShort01_m01_D"]);
    assert.equal(sut.api.BUY_SHARE, 0.35);

    const none = load({ buys: null });
    none.spawn();
    assert.deepEqual(none.shop("Ferreiro (Suchdol)").buyPrices, []);
    assert.ok(none.logs.some((line) => /vendor-buys\.json não foi encontrado/.test(line)));
    assert.ok([...none.vendors.values()].some((vendor) => vendor.options.name.startsWith("Mascate (") && vendor.buyPrices.length > 0), "a pedlar's trinkets do not need the file");
});

test("at most 128 kinds of goods per vendor, which is all the game takes", () => {
    const many = Array.from({ length: 200 }, (_, index) => `herb_${index}`);
    const sut = load({ buys: { ...BUYS, alquimista: many } });
    sut.spawn();
    assert.equal(sut.shop("Boticário (Suchdol)").buyPrices.length, 128);
});

test("a purse of five hundred coins as the game shows them: what is spent is kept across a restart, and it is full again a day after", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.equal(smith.purse, 5_000, "500 on screen");
    smith.purse = 4_100;
    sut.emit("vendorTrade", smith.id, { id: 7 }, [], [], 9000);
    sut.timers.filter((timer) => timer.ms === 3000 && !timer.done).forEach((timer) => timer.fn());
    const saved = JSON.parse(sut.disk.files.get("playerdata/vendor-purses.json"));
    assert.equal(saved.ferreiro.purse, 4_100);

    const again = load({ seed: { "playerdata/vendor-purses.json": JSON.stringify(saved) }, now: sut.clock.now + 60_000 });
    again.spawn();
    assert.equal(again.shop("Ferreiro (Suchdol)").purse, 4_100, "a restart does not fill it early");
    // Every purse was filled at the first start, and all of them were kept.
    assert.equal(Object.keys(saved).length, 26);
    assert.equal(again.api.refillPurses(saved.ferreiro.refilledAt + 23 * 3600_000), 0);
    assert.equal(again.api.refillPurses(saved.ferreiro.refilledAt + 24 * 3600_000), 26, "a day after they were filled");
    assert.equal(again.api.refillPurses(saved.ferreiro.refilledAt + 25 * 3600_000), 0, "and not again until the next day");
    assert.equal(again.shop("Ferreiro (Suchdol)").purse, 5_000);

    const later = load({ seed: { "playerdata/vendor-purses.json": JSON.stringify(saved) }, now: sut.clock.now + 25 * 3600_000 });
    later.spawn();
    assert.equal(later.shop("Ferreiro (Suchdol)").purse, 5_000, "a restart a day later finds it full");

    // A purse saved while it was bigger comes down to the new size, but one below it is kept as it was.
    const bigger = load({ seed: { "playerdata/vendor-purses.json": JSON.stringify({ ferreiro: { purse: 41_000, refilledAt: sut.clock.now }, alquimista: { purse: 1_230, refilledAt: sut.clock.now } }) }, now: sut.clock.now + 60_000 });
    bigger.spawn();
    assert.equal(bigger.shop("Ferreiro (Suchdol)").purse, 5_000, "41.000 saved, 500 allowed");
    assert.equal(bigger.shop("Boticário (Suchdol)").purse, 1_230);
});

test("talking to a trade NPC opens its shop with that NPC behind the counter; other NPCs are left alone", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    sut.emit("npcInteract", smith, { id: 7 });
    assert.deepEqual(sut.opened, [{ vendor: sut.shop("Ferreiro (Suchdol)").id, player: 7, npc: smith.id }]);
    assert.deepEqual(smith.looks.slice(-1), [7]);
    sut.emit("npcInteract", { id: 9999, lookAt() { throw new Error("not ours"); } }, { id: 7 });
    assert.equal(sut.opened.length, 1);
});

test("the shelves are filled again on a timer", () => {
    const sut = load();
    sut.spawn();
    sut.shop("Taberneiro (Suchdol)").stock = [];
    sut.intervals.find((interval) => interval.ms === 15 * 60_000).fn();
    assert.equal(sut.shop("Taberneiro (Suchdol)").stock.length, 6);
});

test("an administrator moves a vendor's place, and it is remembered", () => {
    const sut = load();
    sut.spawn();
    assert.ok(Array.from(sut.api.vendorIds()).includes("cacador"));
    assert.equal(sut.api.isVendorId("alfaiate"), true);
    assert.equal(sut.api.isVendorId("mascate-13"), true);
    assert.equal(sut.api.isVendorId("padeiro"), false);
    sut.api.moveVendor("cacador", { x: 580, y: 3270, z: 147 }, 90);
    assert.deepEqual(JSON.parse(sut.disk.files.get("playerdata/vendors.json"))["cacador"], { x: 580, y: 3270, z: 147, yaw: 90 });
    assert.match(sut.line("cacador"), /Mestre Caçador \(Suchdol\), lugar em 580 3270 147 \(escolhido\)/);
    assert.match(sut.line("ferreiro"), /bolsa 500 moedas -- andando pela vila/);
    assert.match(sut.line("mascate-1"), /Mascate \(Bohounovice, à beira d'água\).* -- junto da fogueira/);
});

test("stopping the resource takes the NPCs, shops and fires away and keeps what is in the purses", () => {
    const sut = load();
    sut.spawn();
    sut.shop("Boticário (Suchdol)").purse = 12_340;
    sut.emit("resourceStop", "another-resource");
    assert.equal(sut.npcs.size, 26);
    sut.emit("resourceStop", "kcdc-gamemode");
    assert.equal(sut.npcs.size, 0);
    assert.ok([...sut.vendors.values()].every((vendor) => vendor.destroyed));
    assert.ok(sut.fires.every((fire) => fire.destroyed));
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/vendor-purses.json"))["alquimista"].purse, 12_340);
});

test("one somehow brought down is back at their place a moment later", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    sut.emit("npcDeath", smith, null);
    const revive = sut.timers.find((timer) => timer.ms === 10_000);
    assert.ok(revive);
    revive.fn();
    const again = sut.byName("Mestre Ferreiro");
    assert.notEqual(again.id, smith.id);
    assert.equal(again.removed, false);
});

// ---------------------------------------------------------------------------------------------
// A vendor's day.

const house = (id, name, region, x, y, over = {}) => ({ id, name, region, kind: "house", parentId: "", ownerSteamId: "", x, y, z: 146, ...over });
const HOUSES = [
    house("casa-01", "Casa 01", "Suchdol", 660, 3270),
    house("casa-02", "Casa 02", "Suchdol", 615, 3290),
    house("casa-03", "Casa 03", "Suchdol", 600, 3280, { ownerSteamId: "76561198000000001" }),
    house("casa-04", "Casa 04", "Suchdol", 590, 3282),
    house("casa-05", "Casa 05", "Suchdol", 575, 3280),
    house("casa-06", "Casa 06", "Suchdol", 580, 3285),
    house("taverna-01", "Taverna 01", "Suchdol", 605, 3270),
    house("celeiro-01", "Celeiro 01", "Suchdol", 662, 3259),
    house("wysoka-casa-01", "Casa 01", "Wysoka", 395, 2447),
];

test("the hours of a day: about by day, home at night; the tavern opens later", () => {
    const { api } = load();
    assert.deepEqual([5, 6, 12, 21.9, 22, 23, 0].map((hour) => api.phaseAt(api.DAY_HOURS, hour)), ["night", "day", "day", "day", "night", "night", "night"]);
    assert.deepEqual([8, 9, 19.5, 21.9, 22, 1].map((hour) => api.phaseAt(api.TAVERN_HOURS, hour)), ["night", "day", "day", "day", "night", "night"]);
});

test("each vendor gets an empty house of their own village near their place; the tavern keeper the tavern; nobody a player's house or a barn; a pedlar none", () => {
    const sut = load({ houses: HOUSES });
    sut.spawn();
    const home = (id) => /mora em ([^,]+?),/.exec(sut.line(id))?.[1];
    assert.equal(home("taberneiro"), "Taverna de Suchdol", "the tavern, named for its keeper");
    assert.equal(home("ferreiro"), "Casa do Ferreiro", "Casa 01, the nearest though a barn is nearer, named for him");
    assert.notEqual(home("alquimista"), "Casa 03", "Casa 03 has an owner");
    assert.equal(new Set(["ferreiro", "alquimista", "taberneiro", "cacador", "alfaiate"].map(home)).size, 5, "five houses, one each");
    assert.ok(sut.logs.some((line) => /vendors: Suchdol: 5 vendedores; casas: ferreiro Casa do Ferreiro/.test(line)));
    assert.equal(home("mascate-1"), undefined, "a pedlar keeps to the fire");
    assert.ok(!/sem casa/.test(sut.line("mascate-1")));
    assert.ok(!/sem casa|mora em/.test(sut.line("banho-1")), "and a bath attendant to the baths");
});

test("a vendor's house is theirs in the catalog: named for them, and kept for them at the next start", () => {
    const sut = load({ houses: HOUSES });
    sut.spawn();
    const claim = (npcName) => sut.reservations.find((entry) => entry.npcName === npcName);
    assert.deepEqual({ ...claim("Mestre Ferreiro") }, { houseId: "casa-01", npcName: "Mestre Ferreiro", homeName: "Casa do Ferreiro" });
    assert.deepEqual({ ...claim("Taberneiro") }, { houseId: "taverna-01", npcName: "Taberneiro", homeName: "Taverna de Suchdol" });
    assert.equal(claim("Boticário").homeName, "Casa do Boticário");
    assert.equal(claim("Mascate"), undefined);
    assert.deepEqual(sut.released.at(-1), ["casa-01", "casa-02", "casa-04", "casa-05", "taverna-01"].sort(), "any other house kept for a vendor is given back");

    // Next start: the smith's house is the one already kept for him, even with a nearer one free.
    const kept = HOUSES.map((entry) => ({ ...entry, ...(entry.id === "casa-02" ? { npc: "Mestre Ferreiro" } : {}) }));
    const again = load({ houses: kept });
    again.spawn();
    assert.equal(again.reservations.find((entry) => entry.npcName === "Mestre Ferreiro").houseId, "casa-02");
});

test("by day a vendor walks about near their place, stays a while at each spot and walks on, never with a stall animation", () => {
    const sut = load({ hour: 10, navigationReady: true });
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    const t0 = sut.clock.now;
    sut.api.liveDay(t0 + 1_000);
    assert.deepEqual(smith.walks, [], "a while where they stand first");
    sut.api.liveDay(t0 + 60_000);
    assert.equal(smith.walks.length, 1, "then a walk");
    const spot = smith.walks[0];
    assert.equal(spot.pathfinding, "server");
    const far = Math.hypot(spot.x - 662.34, spot.y - 3258.94);
    assert.ok(far > 1 && far <= sut.api.vendorLife.roamM, `near their place: ${far} m`);
    sut.api.liveDay(t0 + 70_000);
    assert.equal(smith.walks.length, 1, "no other walk while one is going on");
    sut.clock.now = t0 + 70_000;
    sut.emit("npcIntentDone", smith, "reached");
    sut.api.liveDay(t0 + 72_000);
    assert.equal(smith.walks.length, 1, "there a while");
    sut.api.liveDay(t0 + 130_000);
    assert.equal(smith.walks.length, 2, "and on to another spot");
    sut.clock.now = t0 + 131_000;
    sut.emit("npcIntentDone", smith, "blocked");
    sut.api.liveDay(t0 + 190_000);
    assert.equal(smith.walks.length, 3, "a blocked walk is just another stop");
    assert.ok(live(sut).every((npc) => npc.anims.every((anim) => !/^Seller|WaitingStand|CountingMoney/.test(anim.fragment))), "no seller stance: they leaned on a counter that is not there");
    assert.match(sut.line("ferreiro"), /andando pela vila/);
});

test("a customer who comes near has the vendor stop, look at them and greet them with a word of the trade, not again for a while", () => {
    const sut = load({ hour: 9, navigationReady: true });
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    const t0 = sut.clock.now;
    sut.api.liveDay(t0 + 60_000);
    assert.equal(smith.walks.length, 1);
    sut.players.push(player(7, 664, 3260));
    sut.api.liveDay(t0 + 62_000);
    assert.equal(smith.holds, 1, "stops walking for the customer");
    assert.equal(smith.looks.at(-1), 7);
    assert.equal(smith.anims.at(-1).fragment, "GreetingsUpperBody");
    assert.match(smith.said.at(-1), /^Bom dia! (Ferro e aço|Precisa de uma lâmina|Ferraduras)/);
    for (let step = 1; step <= 10; step += 1) sut.api.liveDay(t0 + 62_000 + step * 30_000);
    assert.equal(smith.said.length, 1, "greeted once");
    assert.equal(smith.walks.length, 1, "and does not walk off while the customer is there");
    sut.players.length = 0;
    sut.api.liveDay(t0 + 500_000);
    sut.api.liveDay(t0 + 600_000);
    assert.equal(smith.walks.length, 2, "about again once they go");
});

test("a pedlar keeps to the fire, by day and by night", () => {
    const sut = load({ hour: 23, navigationReady: true });
    sut.spawn();
    const pedlar = pedlars(sut)[0];
    assert.ok(pedlar, "a pedlar has no house to sleep in");
    const t0 = sut.clock.now;
    sut.api.liveDay(t0 + 60_000);
    const spot = pedlar.walks.at(-1);
    assert.ok(spot, "walks about at night too");
    assert.ok(Math.hypot(spot.x - pedlar.options.position.x, spot.y - pedlar.options.position.y) <= sut.api.vendorLife.campRoamM + 0.01, "never far from the fire");
});

test("at night a vendor walks home on a route the server plans and goes in; out of the door in the morning", () => {
    const sut = load({ houses: HOUSES, hour: 18, navigationReady: true });
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    sut.world.hour = 22.5;
    sut.api.liveDay(sut.clock.now);
    assert.deepEqual(smith.walks.at(-1), { x: 660, y: 3270, pathfinding: "server" }, "to the door of Casa 01, around what is in the way");
    assert.match(sut.line("ferreiro"), /indo para casa/);
    sut.emit("npcIntentDone", smith, "reached");
    assert.equal(smith.removed, true, "in through the door");
    assert.match(sut.line("ferreiro"), /dormindo em casa/);

    sut.world.hour = 6.2;
    sut.api.liveDay(sut.clock.now + 1000);
    const morning = sut.byName("Mestre Ferreiro");
    assert.deepEqual({ x: morning.position.x, y: morning.position.y }, { x: 660, y: 3270 }, "out of the door");
    assert.match(sut.line("ferreiro"), /andando pela vila/);
});

test("a walk home that comes back blocked is tried once by the game's own steering, then the vendor goes in", () => {
    const sut = load({ houses: HOUSES, hour: 18, navigationReady: true });
    sut.spawn();
    sut.world.hour = 22.5;
    sut.api.liveDay(sut.clock.now);
    const smith = sut.byName("Mestre Ferreiro");
    sut.emit("npcIntentDone", smith, "blocked");
    assert.equal(smith.walks.at(-1).pathfinding, "game");
    sut.emit("npcIntentDone", smith, "blocked");
    assert.equal(smith.removed, true);
});

test("a vendor nobody can see finishing the walk home goes in anyway; with somebody watching, three minutes at most", () => {
    const sut = load({ houses: HOUSES, hour: 18 });
    sut.spawn();
    sut.world.hour = 22.5;
    const t0 = sut.clock.now;
    sut.api.liveDay(t0);
    const smith = sut.byName("Mestre Ferreiro");
    sut.api.liveDay(t0 + 10_000);
    assert.equal(smith.removed, false, "not before a little while");
    sut.api.liveDay(t0 + 25_000);
    assert.equal(smith.removed, true);

    const watched = load({ houses: HOUSES, hour: 18 });
    watched.spawn();
    watched.players.push(player(1, 640, 3250));
    watched.world.hour = 22.5;
    const t1 = watched.clock.now;
    watched.api.liveDay(t1);
    const theirs = watched.byName("Mestre Ferreiro");
    watched.api.liveDay(t1 + 25_000);
    assert.equal(theirs.removed, false);
    watched.api.liveDay(t1 + 180_000);
    assert.equal(theirs.removed, true);
});

test("a server that starts at night has the vendors with a house asleep, and those without one, and the pedlars, about", () => {
    const sut = load({ houses: [house("casa-01", "Casa 01", "Suchdol", 660, 3270)], hour: 23 });
    sut.spawn();
    assert.equal(sut.byName("Mestre Ferreiro"), undefined, "the smith sleeps in Casa 01");
    assert.ok(sut.byName("Costureira"), "the clothier has no house: she stays");
    assert.ok(sut.shop("Ferreiro (Suchdol)"), "his shop is still there for the morning");
    assert.equal(pedlars(sut).length, 13);
    assert.equal(attendants(sut).length, 8);
});

// ---------------------------------------------------------------------------------------------
// The other villages: a smith, an apothecary and a tavern keeper of their own.

const SUCHDOL_HOUSES = HOUSES.filter((entry) => entry.region === "Suchdol");
const WYSOKA = ["01", "02", "03", "04", "05"].map((n, index) => house(`wysoka-casa-${n}`, `Casa ${n}`, "Wysoka", 380 + index * 12, 2450 + index * 15));

test("a village with houses gets a smith, an apothecary and a tavern keeper, each outside a house of their own", () => {
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...WYSOKA] });
    sut.spawn();
    const ids = ["ferreiro-wysoka", "alquimista-wysoka", "taberneiro-wysoka"];
    for (const id of ids) assert.ok(sut.line(id), `${id} is a vendor`);
    assert.ok(sut.logs.some((line) => /3 vendedor\(es\) de vilas.*ferreiro-wysoka/.test(line)), sut.logs.join(" | "));

    const lines = ids.map((id) => sut.line(id));
    assert.ok(lines.every((line) => /Wysoka/.test(line) && /mora em /.test(line)), lines.join(" | "));
    // Three different houses.
    const homes = lines.map((line) => /mora em ([^,]+)/.exec(line)[1]);
    assert.equal(new Set(homes).size, 3);
    assert.equal(sut.reservations.filter((entry) => ids.some((id) => entry.houseId.startsWith("wysoka"))).length >= 3, true);

    assert.equal(sut.shop("Ferreiro (Wysoka)") !== undefined, true, "with a shop of its own");
    assert.equal(sut.shop("Boticário (Wysoka)") !== undefined, true);
    assert.equal(sut.shop("Taberneiro (Wysoka)") !== undefined, true);
    // Each sells what its trade sells in Suchdol.
    assert.deepEqual(sut.shop("Ferreiro (Wysoka)").stock.map((row) => row.item).slice(0, 3), sut.shop("Ferreiro (Suchdol)").stock.map((row) => row.item).slice(0, 3));
});

test("a village vendor stands a few metres outside the door of their house, facing it, and not inside the building", () => {
    const inside = { contains: (spot) => spot.x > 479 && spot.x < 486 };
    const door = { position: { x: 480, y: 2450, z: 146 }, areas: [inside] };
    const houses = WYSOKA.map((entry, index) => (index === 0 ? { ...entry, x: 480, y: 2450, doorGuid: "door-1" } : entry));
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...houses], doorsByGuid: { "door-1": door } });
    const built = sut.api.villageVendors(houses.map((entry) => ({ ...entry })), (property) => sut.api.outsideDoor(property));
    const first = built.find((def) => def.id === "ferreiro-wysoka" || def.id === "alquimista-wysoka" || def.id === "taberneiro-wysoka");
    assert.ok(first);
    // The first free house by the middle of the village is not necessarily house 1; check the one made from it directly.
    const spot = sut.api.outsideDoor(houses[0]);
    assert.ok(spot.x >= 486 || spot.x <= 479, `outside the building: ${spot.x}`);
    assert.ok(Math.hypot(spot.x - 480, spot.y - 2450) <= 5 + 0.01, "within five metres of the door");
});

test("a village with fewer than three houses, or none of the census's, has no vendors of its own", () => {
    const sut = load({ houses: [...SUCHDOL_HOUSES, house("a-casa-01", "Casa 01", "Aldeia", 1, 1), house("a-casa-02", "Casa 02", "Aldeia", 2, 2), house("a-celeiro-01", "Celeiro 01", "Aldeia", 3, 3)] });
    sut.spawn();
    assert.equal(sut.line("ferreiro-aldeia"), undefined);
    assert.ok(sut.logs.some((line) => /0 vendedor\(es\) de vilas/.test(line)));
});

test("a village whose houses all belong to somebody still has its vendors, outside a house, with no home to go to", () => {
    const owned = WYSOKA.map((entry) => ({ ...entry, ownerSteamId: "76561198000000001" }));
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...owned] });
    sut.spawn();
    for (const id of ["ferreiro-wysoka", "alquimista-wysoka", "taberneiro-wysoka"]) {
        const line = sut.line(id);
        assert.ok(line, id);
        assert.doesNotMatch(line, /mora em/, "no house of theirs");
    }
    assert.ok(sut.reservations.every((entry) => !entry.houseId.startsWith("wysoka")), "nobody's house was taken from them");
});

test("the tavern keeper of Malešov keeps the house by the level's own innkeeper when it is free", () => {
    const malesov = ["01", "02", "03", "04", "05", "06"].map((n, index) => house(`malesov-casa-${n}`, `Casa ${n}`, "Malešov", 560 + index * 8, 250 + index * 10));
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...malesov] });
    sut.spawn();
    assert.match(sut.line("taberneiro-malesov"), /mora em Taverna de Malešov/, sut.line("taberneiro-malesov"));
    assert.ok(sut.reservations.some((entry) => entry.houseId === "malesov-casa-06" && entry.homeName === "Taverna de Malešov"));
});

test("village vendors are made again at the next look, in place of the old ones, and Suchdol's five are never doubled", () => {
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...WYSOKA] });
    sut.spawn();
    const before = [...sut.api.vendorIds()].length;
    assert.equal(sut.api.addVillageVendors(), 3);
    assert.equal([...sut.api.vendorIds()].length, before, "the same number: the old three were taken out first");
    assert.equal([...sut.api.vendorIds()].filter((id) => id === "ferreiro").length, 1);
});

test("each trade's vendor offers the recipes of its own trade: the smith's, the apothecary's, the tavern's, the hunter's and the baths'", () => {
    const sut = load();
    sut.spawn();
    const books = (name) => sut.shop(name).stock.map((row) => row.item).filter((item) => item.startsWith("guid:kcdc:book:")).map((item) => item.replace("guid:kcdc:book:", ""));
    assert.deepEqual(books("Ferreiro (Suchdol)").filter((id) => id.startsWith("ferreiro-")), ["ferreiro-machados", "ferreiro-ferraduras", "ferreiro-cacadores", "ferreiro-curtas", "ferreiro-sabres", "ferreiro-longas", "ferreiro-nobres", "ferreiro-raras"], "every smithing book the server has but the two the guild kits hand out");
    assert.deepEqual(books("Boticário (Suchdol)"), ["alquimia-tonicos", "alquimia-vigor", "alquimia-cacador", "alquimia-medicina", "alquimia-perfumaria", "alquimia-venenos", "alquimia-astucia", "alquimia-polvora"]);
    assert.deepEqual(books("Taberneiro (Suchdol)"), ["alquimia-tonicos", "alquimia-medicina"]);
    assert.deepEqual(books("Caçador (Suchdol)"), ["alquimia-cacador", "alquimia-vigor"]);
    assert.deepEqual(books("Banhos (Suchdol)"), ["alquimia-perfumaria"]);
    assert.deepEqual(books("Alfaiate (Suchdol)"), [], "the game has no tailor's recipes to teach");
    assert.deepEqual(books("Mascate (Bohounovice, à beira d'água)"), []);
});
