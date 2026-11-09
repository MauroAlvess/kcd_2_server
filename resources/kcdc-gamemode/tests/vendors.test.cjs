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

/** The game's skill books (the real table), and those of some tracks, as the vendors stock them. */
const SKILLBOOKS = loadModule("skillbook-data", { exports: {} }).SKILLBOOKS;
const skillGuids = (...tracks) => Array.from(SKILLBOOKS.filter((book) => tracks.includes(book.track)), (book) => book.guid);
const SKILL_GUIDS = new Set(SKILLBOOKS.map((book) => book.guid));
/** The real recipes and crops: the shops sell the Agricultores' seeds (2026-10-22). */
const craftData = loadModule("craft-data", { exports: {} });

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
function load({ unknownItems = ["unknownBlade"], navigationReady = false, seed = {}, houses = [], hour = 12, buys = BUYS, gestures = [], now = 1_760_000_000_000, doorsByGuid = {}, doors = [], on = true } = {}) {
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

    // The shared body and spot helpers are the real ones, over the same fakes, and so is the keeper (src/server/npc-keeper.ts).
    let townsfolk;
    let keeper;
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./books.js") return books;
            if (id === "./craft-items.js") return { craftItemGuid: (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : null) };
            if (id === "./craft-data.js") return craftData;
            if (id === "./store.js") return store;
            if (id === "./townsfolk.js") return townsfolk;
            if (id === "./npc-keeper.js") return keeper;
            if (id === "./npc-speech.js") return SPEECH;
            if (id === "./idle-gestures.js") return { maybeGesture: () => false };
            if (id === "./skillbook-data.js") return { SKILLBOOKS };
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
            canReach: () => true,
        },
        World: world,
        Door: { find: (guid) => doorsByGuid[guid] ?? null, all: () => doors },
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
    const real = (name) => {
        const realm = { ...context, exports: {} };
        vm.runInNewContext(fs.readFileSync(path.join(__dirname, `../dist/server/${name}.js`), "utf8"), realm);
        return realm.exports;
    };
    keeper = real("npc-keeper");
    townsfolk = real("townsfolk");
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/vendors.js"), "utf8"), context);
    // The vendors are off in the game since 2026-10-29; the tests of what they do switch them on, `on: false` is the game as it is.
    context.exports.vendorSettings.enabled = on;
    context.exports.installVendors();

    const emit = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));
    return {
        api: context.exports,
        world, players, clock, disk, npcs, vendors, fires, opened, logs, handlers, timers, intervals, emit, reservations, released, catalog,
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
    assert.deepEqual([at("banho-1"), at("banho-4"), at("banho-6"), at("banho-8")], [[741, 3348, 142], [3208, 2168, 95], [3083, 465, 36], [564, 256, 110]], "Suchdol, Minas, Kuttenberg and Malešov");
    assert.equal(sut.fires.length, 13, "a bath has no camp fire: only the pedlars' are lit");
    assert.ok(!/sem casa|mora em/.test(sut.line("banho-1")) && /nos banhos/.test(sut.line("banho-1")));
    assert.ok(sut.logs.some((line) => /vendors: 8 banhista\(s\) nos banhos: Suchdol, Zikmundovo, Minas, Kuttenberg, Malešov/.test(line)));

    const shop = sut.shop("Banhos (Suchdol)");
    assert.deepEqual(shop.stock.map((row) => row.item), ["soap", "soap_kcd", "perfume_longWeak", "perfume_longWeak_medium", "perfume_longWeak_high", "perfume_shortStrong", "perfume_shortStrong_medium", "perfume_shortStrong_high", "bandage_classic"], "no recipe book any more (2026-10-18)");
    assert.ok(shop.stock.every((row) => row.price === 120), "the game's price plus a fifth, like everybody's");
    assert.ok(shop.buyPrices.some((row) => row.item === "soap") && shop.buyPrices.length === 9, "and buys what the baths sell, at a third of its worth");
});

test("a bath attendant keeps to the baths by day, never farther than a pedlar from the fire, and goes in at night (2026-10-25: nobody sleeps in the street)", () => {
    const sut = load({ hour: 12, navigationReady: true });
    sut.spawn();
    const maid = attendants(sut)[0];
    assert.ok(maid, "about by day");
    sut.api.liveDay(sut.clock.now + 60_000);
    const spot = maid.walks.at(-1);
    assert.ok(spot, "walks about");
    assert.ok(Math.hypot(spot.x - maid.options.position.x, spot.y - maid.options.position.y) <= sut.api.vendorLife.campRoamM + 0.01);

    // No door near the baths: at night she goes in where she stands, once nobody sees it.
    sut.world.hour = 23;
    const t0 = sut.clock.now + 70_000;
    sut.api.liveDay(t0);
    assert.equal(maid.removed, false, "not at once");
    sut.api.liveDay(t0 + 25_000);
    assert.equal(maid.removed, true, "in for the night");
    assert.equal(attendants(sut).length, 0, "nobody at the baths at night");
    sut.world.hour = 7;
    sut.api.liveDay(t0 + 30_000);
    assert.equal(attendants(sut).length, 8, "all out again in the morning");
});

test("a bath attendant with a door of a building near the baths goes in by it at night and comes out of it in the morning", () => {
    const baths = [741, 3348, 142];
    const door = { position: { x: baths[0] - 20, y: baths[1], z: baths[2] }, areas: [{ contains: (point) => point.x < baths[0] - 21 }] };
    const sut = load({ hour: 12, navigationReady: true, doors: [door] });
    sut.spawn();
    const maid = [...sut.npcs.values()].find((npc) => Math.hypot(npc.options.position.x - baths[0], npc.options.position.y - baths[1]) < 5);
    assert.ok(maid);
    sut.world.hour = 23;
    sut.api.liveDay(sut.clock.now + 60_000);
    const step = maid.walks.at(-1);
    assert.ok(Math.hypot(step.x - door.position.x, step.y - door.position.y) <= 3.6 && !door.areas[0].contains(step), "to the step outside the door");
    sut.emit("npcIntentDone", maid, "reached");
    assert.equal(maid.removed, true, "in by the door");
    sut.world.hour = 7;
    sut.api.liveDay(sut.clock.now + 70_000);
    const morning = [...sut.npcs.values()].find((npc) => npc.options.name === maid.options.name && Math.hypot(npc.position.x - step.x, npc.position.y - step.y) < 1);
    assert.ok(morning, "out of the same door");
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

test("each sells its trade's goods at the game's price plus a margin, and the skill books of its trade, never a recipe", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.ok(smith.stock.some((row) => row.item === "bsmt_ironBad" && row.price === 120));
    assert.ok(["bsmt_guardSpecial", "bsmt_woodExotic", "special_attire", "special_featherRooster", "guid:kcdc-craft:madeira"].every((item) => smith.stock.some((row) => row.item === item)), "the rest of what the forge's recipes take, bow wood and feathers too");
    const tavern = sut.shop("Taberneiro (Suchdol)").stock.map((row) => row.item);
    assert.deepEqual(
        tavern.filter((item) => !SKILL_GUIDS.has(item)),
        ["beef", "pigMeat", "lambMeat", "chicken", "guid:kcdc-craft:farinha", "guid:kcdc-craft:malte", "guid:kcdc-craft:lupulo", "egg", "water", "milk", "loot_salt", "honey", "special_lard", "cabbage", "garlic", "plums", "pear", "walnuts", "driedPepperSpice",
            "wine", "pigTenderloin", "beefTenderloin", "salami", "cheeseQuarter", "curdCheese", "perch", "trout", "onion", "carrot", "beet", "apple", "boletus", "lepiota", "horseradish", "crayfish", "cowKidney", "cowTongue", "pigLiver", "lambStomach", "crayfishBlue",
            "parsnip", "turnip", "leek", "roastedPeas", "herb_urticaria", "bread", "bacon", "cream", "beer",
            // The seeds of the garden vegetables (2026-10-22), and the saplings, seeds and pepper of the fruit and the spice (2026-10-24), in the order of the
            // crops (by level), our own items by the GUID the game gave them.
            // Sixteen more of the plants of 2026-11-02, in among the others by their level.
            ...["cebola", "repolho", "rabanete", "nabo", "alface", "cenoura", "morango", "espinafre", "beterraba", "fava", "alho", "amora", "aipo", "maca", "lentilha", "pastinaca", "cereja", "pera", "framboesa", "alho-poro", "mirtilo", "ameixa", "groselha", "raiz-forte", "ervilha", "marmelo", "pessego", "avela", "uva", "melancia", "noz", "mostarda", "pimenta"].map((crop) => `guid:kcdc-craft:semente-${crop}`)],
        "meat, what the kitchen's recipes take (our own flour, malt and hops by the GUID the game gave them), wine, cuts, cheese, fish, offal, roots and mushrooms, what the soups take, and the garden vegetables', fruits' and pepper's seeds",
    );
    assert.deepEqual(Array.from(tavern.filter((item) => SKILL_GUIDS.has(item))), skillGuids("drinking", "speech"), "and the books of drinking and speech");
    const apothecary = sut.shop("Boticário (Suchdol)").stock.map((row) => row.item);
    assert.ok(["wine", "special_sulfur", "special_saltpeter", "special_charcoalImproved", "herb_dried_poppy", "special_mushroomAmanita", "maliruvLek_mandrakeRoot", "maliruvLek_freshwaterPearl"].every((item) => apothecary.includes(item)));
    assert.deepEqual(
        apothecary.filter((item) => item.startsWith("guid:kcdc-craft:semente-")),
        ["urtiga", "dente-de-leao", "cardo", "endro", "confrei", "sabugueiro", "absinto", "valeriana", "hortela", "hiperico", "salvia", "eufrasia", "camomila", "tanaceto", "calendula", "beladona", "papoula", "meimendro", "paris", "gengibre"].map((crop) => `guid:kcdc-craft:semente-${crop}`),
        "and the seeds of the garden herbs, the apothecary being who buys what they give (2026-10-22; twelve more of the wild ones, 2026-10-27)",
    );
    assert.ok(smith.stock.some((row) => row.item === "player_shovel"), "the smith sells the shovel the Agricultores dig with");
    for (const shop of sut.vendors.values()) {
        assert.ok(shop.stock.length <= 128, `${shop.options.name}: ${shop.stock.length} kinds`);
    }
});

test("a pedlar sells a few odd things of each kind, a different few at every camp, always with plain dice", () => {
    const sut = load();
    sut.spawn();
    const shops = [...sut.vendors.values()].filter((vendor) => vendor.options.name.startsWith("Mascate ("));
    assert.equal(shops.length, 13);
    const first = shops[0].stock.map((row) => row.item);
    const road = new Set(Array.from(sut.api.ROAD_GOODS, (item) => (item.startsWith("kcdc-craft:") ? `guid:${item}` : item)));
    const trinkets = first.filter((item) => !SKILL_GUIDS.has(item) && !road.has(item));
    assert.equal(trinkets.length, 11, "plain dice, three dice, two badges, three things to wear and two odd things");
    assert.equal(first.filter((item) => road.has(item)).length, 8, "and eight of the guilds' goods");
    assert.ok(shops.every((shop) => shop.stock.some((row) => SKILL_GUIDS.has(row.item))), "and a book of the road's skills at every camp");
    const carried = new Set(shops.flatMap((shop) => shop.stock.map((row) => row.item)));
    assert.ok([...road].every((item) => carried.has(item)), "every one of the guilds' goods at some camp");
    assert.equal(first[0], "dieNormal");
    assert.ok(first.includes("Spectacles01_m01") || shops.some((shop) => shop.stock.some((row) => row.item === "Spectacles01_m01")), "spectacles at some camp");
    assert.ok(shops.some((shop) => shop.stock.some((row) => row.item === "EyepatchZizka_m01")), "an eye patch at some camp");
    assert.ok(shops.every((shop) => shop.stock.every((row) => row.price === 120)), "the game's price plus a fifth, like everybody's");
    assert.notDeepEqual(shops[1].stock.map((row) => row.item), first, "the next camp has other things");
    assert.ok(shops[0].buyPrices.some((row) => row.item === "loot_rosary" && row.price === 35), "and buys trinkets at a third of their worth");
    assert.deepEqual(Array.from(sut.api.waresOf(0)).map((line) => (line.item.startsWith("kcdc-craft:") ? `guid:${line.item}` : line.item)), first);
});

test("each buys only its own trade's goods, at a third of what the game says they are worth", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.equal(smith.options.buys, true);
    // The Coletores' finds and the forge's silver come first (2026-10-21), our own items by the GUID the game gave them.
    const finds = ["guid:kcdc-craft:lenha", "guid:kcdc-craft:minerio-prata", "guid:kcdc-craft:barra-prata", "loot_silverCup", "loot_silverChalice", "ring_silver_engraved", "ring_silver_gem", "brooch_silver_enamel"];
    assert.deepEqual(smith.buyPrices, [...finds.map((item) => ({ item, price: 35 })), { item: "bsmt_ironBad", price: 35 }, { item: "daggerCommon", price: 35 }, { item: "huntingSwordBasic", price: 35 }], "an item the game does not know is left out");
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

test("a vendor has 300 coins a day to buy with: what it pays out stays paid, what a player pays is taken back out, and a full purse comes back a day later", () => {
    const sut = load();
    sut.spawn();
    const smith = sut.shop("Ferreiro (Suchdol)");
    assert.equal(sut.api.PURSE, 3000);
    assert.equal(smith.purse, 3000, "300 on screen");
    // The smith bought a player's goods for 80 coins.
    smith.purse = 2200;
    sut.emit("vendorTrade", smith.id, { id: 7 }, [], [], 9000);
    assert.equal(smith.purse, 2200);
    // A player bought something: the game put the price in the purse, and it is taken back out.
    smith.purse = 3100;
    sut.emit("vendorTrade", smith.id, { id: 7 }, [], [], 9000);
    assert.equal(smith.purse, 2200, "selling to a vendor and buying back does not make it richer");
    sut.timers.filter((timer) => timer.ms === 3000 && !timer.done).forEach((timer) => timer.fn());
    const saved = JSON.parse(sut.disk.files.get("playerdata/vendor-purses.json"));
    assert.equal(saved.ferreiro.purse, 2200);
    assert.equal(saved.ferreiro.size, 3000);
    assert.equal(Object.keys(saved).length, 26);
    sut.api.refillPurses(sut.clock.now + 25 * 3600_000);
    assert.equal(smith.purse, 3000, "full again a day later");

    // Purses saved under the old size (nothing, or 500 coins) start full under the new one, at once.
    const older = load({ seed: { "playerdata/vendor-purses.json": JSON.stringify({ ferreiro: { purse: 0, refilledAt: sut.clock.now }, alquimista: { purse: 41_000, refilledAt: sut.clock.now } }) }, now: sut.clock.now + 60_000 });
    older.spawn();
    assert.equal(older.shop("Ferreiro (Suchdol)").purse, 3000);
    assert.equal(older.shop("Boticário (Suchdol)").purse, 3000);
    // One saved under this size keeps what was left in it.
    const kept = load({ seed: { "playerdata/vendor-purses.json": JSON.stringify({ ferreiro: { purse: 1_500, refilledAt: sut.clock.now, size: 3000 } }) }, now: sut.clock.now + 60_000 });
    kept.spawn();
    assert.equal(kept.shop("Ferreiro (Suchdol)").purse, 1500);
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
    assert.equal(sut.shop("Taberneiro (Suchdol)").stock.length, 82 + skillGuids("drinking", "speech").length, "six more since 2026-10-24: the fruits' and the pepper's seeds, and the grapes' (2026-10-27); sixteen of the plants of 2026-11-02");
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
    assert.match(sut.line("ferreiro"), /bolsa 300 moedas -- andando pela vila/);
    assert.match(sut.line("mascate-1"), /Mascate \(Bohounovice, à beira d'água\).* -- junto da fogueira/);
});

test("stopping the resource takes the NPCs, shops and fires away and keeps what is in the purses", () => {
    const sut = load();
    sut.spawn();
    sut.shop("Boticário (Suchdol)").purse = 2_340;
    sut.emit("resourceStop", "another-resource");
    assert.equal(sut.npcs.size, 26);
    sut.emit("resourceStop", "kcdc-gamemode");
    assert.equal(sut.npcs.size, 0);
    assert.ok([...sut.vendors.values()].every((vendor) => vendor.destroyed));
    assert.ok(sut.fires.every((fire) => fire.destroyed));
    assert.equal(JSON.parse(sut.disk.files.get("playerdata/vendor-purses.json"))["alquimista"].purse, 2_340);
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
    assert.deepEqual(smith.walks.at(-1), { x: 662.5, y: 3270, pathfinding: "server" }, "to the step outside the door of Casa 01 (never its spot, which can lie behind a locked door), around what is in the way");
    assert.match(sut.line("ferreiro"), /indo para casa/);
    sut.emit("npcIntentDone", smith, "reached");
    assert.equal(smith.removed, true, "in through the door");
    assert.match(sut.line("ferreiro"), /dormindo em casa/);

    sut.world.hour = 6.2;
    sut.api.liveDay(sut.clock.now + 1000);
    const morning = sut.byName("Mestre Ferreiro");
    assert.deepEqual({ x: morning.position.x, y: morning.position.y }, { x: 662.5, y: 3270 }, "out of the door, on its outside step");
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

test("a server that starts at night has everybody in but the pedlars by their fires, house or none (2026-10-25: nobody sleeps in the street)", () => {
    const sut = load({ houses: [house("casa-01", "Casa 01", "Suchdol", 660, 3270)], hour: 23 });
    sut.spawn();
    assert.equal(sut.byName("Mestre Ferreiro"), undefined, "the smith sleeps in Casa 01");
    assert.equal(sut.byName("Costureira"), undefined, "the clothier has no house: in all the same");
    assert.ok(sut.shop("Ferreiro (Suchdol)"), "his shop is still there for the morning");
    assert.equal(pedlars(sut).length, 13);
    assert.equal(attendants(sut).length, 0);
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

test("a village the census files after the first look gets its vendors in the same start, and the ones already out stay as they are (2026-10-20)", () => {
    const sut = load({ houses: [...SUCHDOL_HOUSES, ...WYSOKA] });
    sut.spawn();
    assert.equal(sut.line("ferreiro-miskowitz"), undefined, "not filed yet when the vendors are first made, 12 s in");
    const wysoka = sut.shop("Ferreiro (Wysoka)");
    const before = [...sut.api.vendorIds()].length;
    const timer = sut.timers.find((one) => one.ms === sut.api.NEW_VILLAGES_AFTER_MS);
    assert.ok(timer, "a look is set for after the census");
    assert.ok(timer.ms > 20_000, "after the census, which maps a new region 20 s in");

    // The census files Miskowitz and Kuttenberg, a village and a town.
    ["01", "02", "03", "04"].forEach((n, index) => sut.catalog.push(house(`miskowitz-casa-${n}`, `Casa ${n}`, "Miskowitz", 1500 + index * 10, 1950 + index * 12)));
    ["01", "02", "03", "04", "05", "06", "07"].forEach((n, index) => sut.catalog.push(house(`kuttenberg-casa-${n}`, `Casa ${n}`, "Kuttenberg", 3000 + index * 9, 700 + index * 11)));
    timer.fn();
    const ids = [...sut.api.vendorIds()];
    assert.equal(ids.length, before + 6, "a smith, an apothecary and a tavern keeper for each");
    for (const id of ["ferreiro-miskowitz", "alquimista-miskowitz", "taberneiro-miskowitz", "ferreiro-kuttenberg", "alquimista-kuttenberg", "taberneiro-kuttenberg"]) {
        assert.ok(sut.line(id), `${id} is a vendor`);
        assert.doesNotMatch(sut.line(id), /ausente/, `${id} is out in the world`);
    }
    assert.ok(sut.shop("Ferreiro (Miskowitz)") !== undefined && sut.shop("Taberneiro (Kuttenberg)") !== undefined, "each with its shop");
    assert.ok(sut.logs.some((line) => /vendors: 6 vendedor\(es\) de vilas novas, mapeadas neste início: Kuttenberg, Miskowitz|vendors: 6 vendedor\(es\) de vilas novas, mapeadas neste início: Miskowitz, Kuttenberg/.test(line)), sut.logs.slice(-4).join(" | "));
    assert.equal(sut.shop("Ferreiro (Wysoka)"), wysoka, "Wysoka's smith was not made again");
    assert.equal(wysoka.destroyed, false);
    assert.equal([...sut.api.vendorIds()].filter((id) => id === "ferreiro").length, 1, "and Suchdol's five are never doubled");

    // A second look finds nothing new, and says nothing.
    const logged = sut.logs.length;
    timer.fn();
    assert.equal(sut.api.addNewVillages(), 0);
    assert.equal(sut.logs.length, logged);

    // The timer goes with the resource.
    sut.emit("resourceStop", "kcdc-gamemode");
    assert.equal(timer.done, true);
});

test("no vendor sells a recipe any more; each trade sells the game's skill books of its own skills", () => {
    const sut = load();
    sut.spawn();
    for (const shop of sut.vendors.values()) {
        assert.ok(shop.stock.every((row) => !row.item.startsWith("guid:kcdc:book:")), `${shop.options.name} sells no recipe`);
    }
    const books = (name) => Array.from(sut.shop(name).stock.map((row) => row.item).filter((item) => SKILL_GUIDS.has(item)));
    assert.deepEqual(books("Ferreiro (Suchdol)"), skillGuids("craftsmanship", "weapon_sword", "heavy_weapons", "weapon_large", "strength"));
    assert.deepEqual(books("Boticário (Suchdol)"), skillGuids("alchemy", "scholarship", "vitality"));
    assert.deepEqual(books("Caçador (Suchdol)"), skillGuids("survival", "marksmanship", "houndmaster", "stealth"));
    assert.deepEqual(books("Alfaiate (Suchdol)"), skillGuids("agility", "horse_riding"));
    assert.deepEqual(books("Banhos (Suchdol)"), []);
    assert.ok(books("Ferreiro (Suchdol)").length > 0 && sut.shop("Ferreiro (Suchdol)").stock.filter((row) => SKILL_GUIDS.has(row.item)).every((row) => row.amount === 2));
});

test("a vendor found in the river by day is made again at their place, and the log says why (2026-10-25)", () => {
    const sut = load({ houses: HOUSES, hour: 12, navigationReady: true });
    sut.spawn();
    const smith = sut.byName("Mestre Ferreiro");
    const t0 = sut.clock.now;
    sut.api.liveDay(t0);
    smith.position = { x: smith.position.x + 5, y: smith.position.y, z: smith.position.z - 9 };
    sut.api.liveDay(t0 + 11_000);
    assert.equal(smith.removed, true, "the body in the river is taken away");
    const again = sut.byName("Mestre Ferreiro");
    assert.ok(again && again !== smith);
    assert.deepEqual([again.position.x, again.position.y], [smith.options.position.x, smith.options.position.y], "made again at the shop");
    assert.ok(sut.logs.some((line) => /^npc-keeper: vendors: Mestre Ferreiro \(Suchdol\) caiu .*: feito de novo no lugar$/.test(line)), sut.logs.filter((line) => /npc-keeper/.test(line)).join("\n"));
    assert.match(sut.line("ferreiro"), /andando pela vila/);
});

test("with the vendors switched off (2026-10-29: \"vamos remover todos npcs da cidade vendedores\") nobody is made, no shop opens, the houses kept for them are freed, and the camps' fires are still lit", () => {
    const sut = load({ on: false, houses: [{ id: "casa-01", name: "Casa do Ferreiro", kind: "house", region: "Suchdol", parentId: "", ownerSteamId: "", x: 650, y: 3260, z: 145 }] });
    assert.ok(sut.logs.some((line) => /vendors: desligados: ninguém vende/.test(line)), "the start says so");
    assert.deepEqual(sut.released.at(0), [], "every house kept for a vendor is given back: none is kept");
    sut.timers.forEach((timer) => timer.fn());
    sut.intervals.forEach((timer) => timer.fn());
    assert.equal([...sut.npcs.values()].length, 0, "no shopkeeper, no pedlar, no bath maid");
    assert.equal([...sut.vendors.values()].length, 0, "no trade window exists");
    assert.ok(sut.fires.length > 0, "the camps' fires are lit all the same: the cooking stations stand at them");
    assert.ok(Array.from(sut.api.describeVendors())[0].includes("desligados"));
    assert.equal(sut.handlers.get("npcInteract"), undefined, "nobody answers a use key on a vendor");
});
