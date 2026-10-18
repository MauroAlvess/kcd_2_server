const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ rejectSouls = [], navigationReady = true } = {}) {
    const world = { npcs: new Map(), nextId: 700, logs: [], created: [] };
    const files = new Map();
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
        write: (file, body) => files.set(file, JSON.stringify(body)),
    };
    const townsfolk = { placeOf: (spot) => ({ x: spot.x, y: spot.y, z: spot.z }) };
    const sandbox = {
        exports: {},
        require: (id) => (id === "./store.js" ? store : id === "./townsfolk.js" ? townsfolk : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => world.logs.push(line) },
        Vector3: class { constructor(x, y, z) { Object.assign(this, { x, y, z }); } },
        Navigation: { get ready() { return navigationReady; }, randomPoint: (centre, radius) => ({ x: centre.x + radius / 2, y: centre.y, z: centre.z }) },
        Npc: {
            create: (options) => {
                if (rejectSouls.includes(options.soul)) throw new Error("no such soul");
                const npc = { id: world.nextId++, options, status: "idle", walks: [], removed: false, setNametagHealthVisible() {}, moveTo(point, how) { this.walks.push({ point, how }); return true; }, remove() { this.removed = true; world.npcs.delete(this.id); } };
                world.npcs.set(npc.id, npc);
                world.created.push(options);
                return npc;
            },
            getById: (id) => world.npcs.get(id) ?? null,
        },
        Events: { on() {} },
        setTimeout: () => 1,
        setInterval: () => 1,
        clearTimeout() {},
        clearInterval() {},
    };
    vm.runInNewContext(dist("village-pets.js"), sandbox);
    return { api: sandbox.exports, world, files };
}

const house = (id, region, x, y) => ({ id, name: `Casa ${id.slice(-2)}`, region, kind: "house", parentId: "", x, y, z: 100 });
const houses = (region, count, x0, y0) => Array.from({ length: count }, (_, n) => house(`${region.toLowerCase()}-casa-${String(n + 1).padStart(2, "0")}`, region, x0 + n * 15, y0 + n * 9));
const standAt = (property) => ({ x: property.x + 2.5, y: property.y, z: property.z });
const LEVEL = {
    dogs: [
        { name: "ksuc_dog_1", x: 533, y: 3244, z: 147 },
        { name: "ksuc_dog_4", x: 563, y: 3289, z: 146 },
        { name: "kmal_dog_1", x: 552, y: 293, z: 109 },
        { name: "kzik_dog1", x: 1698, y: 2837, z: 175 },
    ],
    cats: [{ name: "CatHolder17", x: 576, y: 261, z: 110 }],
};

test("a village is a region with at least three houses of the census, by name", () => {
    const { api } = load();
    const catalog = [...houses("Wysoka", 5, 380, 2450), ...houses("Aldeia", 2, 10, 10), { ...house("wysoka-bau-01", "Wysoka", 1, 1), kind: "chest" }, { ...house("wysoka-dentro-01", "Wysoka", 1, 1), parentId: "wysoka-casa-01" }];
    assert.deepEqual(plain(api.villagesOf(catalog)).map((village) => [village.name, village.houses.length]), [["Wysoka", 5]]);
});

test("a village has dogs in proportion to its houses, two to six", () => {
    const { api } = load();
    assert.deepEqual([3, 4, 5, 6, 10, 40, 400].map((count) => api.dogsFor(count)), [2, 2, 3, 3, 5, 6, 6]);
});

test("the level's own dogs are kept where the level puts them, with their own souls; the rest stand beside houses with the village's pool", () => {
    const { api } = load();
    const catalog = [...houses("Suchdol", 12, 500, 3200), ...houses("Wysoka", 5, 380, 2450)];
    const plans = plain(api.planPets(catalog, LEVEL, standAt, null));
    const suchdol = plans.filter((plan) => plan.village === "Suchdol");
    assert.equal(suchdol.length, 6);
    assert.deepEqual(suchdol.slice(0, 2).map((plan) => [plan.soul, plan.home.x, plan.home.y]), [["ksuc_dog_1", 533, 3244], ["ksuc_dog_4", 563, 3289]]);
    assert.deepEqual(suchdol.slice(2).map((plan) => plan.soul), ["ksuc_dog_2", "ksuc_dog_3", "ksuc_dog_5", "ksuc_dog_6"], "the rest of the pool, no soul twice");
    assert.equal(new Set(suchdol.map((plan) => plan.soul)).size, 6);

    const wysoka = plans.filter((plan) => plan.village === "Wysoka");
    assert.deepEqual(wysoka.map((plan) => plan.soul), ["kvys_dog_1", "kvys_dog_2", "kvys_dog_3"], "Wysoka's own pool, which the level places nowhere near");
    assert.ok(wysoka.every((plan) => plan.home.x > 380 && plan.home.y > 2440 && plan.home.y < 2560), "beside its houses");
    assert.ok(plans.every((plan) => plan.kind === "dog"), "no cats without a cat soul");
    assert.ok(!plans.some((plan) => plan.soul === "kzik_dog1"), "Zikmundovo's dogs are not a mapped village's");
});

test("a village with no pool of its own gets the generic dog, and ids are unique", () => {
    const { api } = load();
    const plans = plain(api.planPets(houses("Aldeia", 8, 10, 10), { dogs: [], cats: [] }, standAt, null));
    assert.equal(plans.length, 4);
    assert.ok(plans.every((plan) => plan.soul === "animal_dog"));
    assert.equal(new Set(plans.map((plan) => plan.id)).size, 4);
});

test("a cat is planned only when the game has a cat, one for every three dogs at least, at the level's cat spot when there is one", () => {
    const { api } = load();
    const catalog = houses("Malešov", 6, 560, 250);
    const withCat = plain(api.planPets(catalog, LEVEL, standAt, "cat-soul-guid"));
    const cats = withCat.filter((plan) => plan.kind === "cat");
    assert.equal(cats.length, 1);
    assert.deepEqual([cats[0].soul, cats[0].home.x, cats[0].home.y], ["cat-soul-guid", 576, 261]);
    const none = plain(api.planPets(catalog, LEVEL, standAt, null));
    assert.equal(none.filter((plan) => plan.kind === "cat").length, 0);
    assert.equal(api.findCatSoul([{ name: "Wolf", soul: "a", actorClass: "Wolf" }, { name: "Hare", soul: "b", actorClass: "Hare" }]), null);
    assert.equal(api.findCatSoul([{ name: "Domestic cat", soul: "c", actorClass: "Cat" }]), "c");
    assert.equal(api.findCatSoul([]), null);
});

test("every pet is made harmless and nameless, and a soul the game refuses is made the generic dog", () => {
    const sut = load({ rejectSouls: ["kvys_dog_2"] });
    const pets = new sut.api.VillagePets(() => 1000, () => 0.5);
    const catalog = houses("Wysoka", 5, 380, 2450);
    const plans = sut.api.planPets(catalog, { dogs: [], cats: [] }, standAt, null);
    assert.equal(pets.spawnAll(plans), 3);
    assert.ok(sut.world.created.every((options) => options.invulnerable === true && options.lootable === false && options.interactable === false && options.nametag === false && options.name === ""));
    assert.deepEqual(sut.world.created.map((options) => options.soul), ["kvys_dog_1", "animal_dog", "kvys_dog_3"]);
    assert.ok(sut.world.logs.some((line) => /kvys_dog_2.*no such soul/.test(line)));
    assert.equal(pets.count("dog"), 3);
    assert.equal(pets.count("cat"), 0);
});

test("by day a pet wanders within eighteen metres of home, a while at each place; at night it keeps within four and moves seldom", () => {
    const sut = load();
    const clock = { now: 1_000_000 };
    const pets = new sut.api.VillagePets(() => clock.now, () => 0);
    const plans = sut.api.planPets(houses("Wysoka", 4, 380, 2450), { dogs: [], cats: [] }, standAt, null);
    pets.spawnAll(plans);
    const [first] = [...sut.world.npcs.values()];
    const homeX = plans[0].home.x;
    clock.now += 60_000;
    pets.tick(12);
    assert.equal(first.walks.length, 1);
    assert.equal(first.walks[0].how.pathfinding, "server");
    assert.equal(first.walks[0].point.x, homeX + 9, "a point of eighteen metres' reach: the fake takes half of it");

    pets.tick(12);
    assert.equal(first.walks.length, 1, "it stands a while at the spot first");
    clock.now += 12_001;
    first.status = "running";
    pets.tick(12);
    assert.equal(first.walks.length, 1, "still walking");
    first.status = "idle";
    pets.tick(23);
    assert.equal(first.walks.length, 2);
    assert.equal(first.walks[1].point.x, homeX + 2, "at night, four metres' reach: the fake takes half of it");
    clock.now += 40_000;
    assert.equal(first.walks.length, 2, "and the pause at night is longer");
});

test("with no navigation mesh nothing walks, and one that falls is made again after a moment; stopping takes them all away", () => {
    const sut = load({ navigationReady: false });
    const clock = { now: 1_000_000 };
    const pets = new sut.api.VillagePets(() => clock.now, () => 0);
    pets.spawnAll(sut.api.planPets(houses("Wysoka", 4, 380, 2450), { dogs: [], cats: [] }, standAt, null));
    clock.now += 90_000;
    pets.tick(12);
    assert.ok([...sut.world.npcs.values()].every((npc) => npc.walks.length === 0));

    const [first] = [...sut.world.npcs.values()];
    const later = [];
    assert.equal(pets.died(first.id, (fn) => later.push(fn)), true);
    assert.equal(pets.count(), 1, "gone until it is made again");
    later[0]();
    assert.equal(first.removed, true);
    assert.equal(pets.count(), 2);
    assert.equal(pets.died(999, () => undefined), false, "somebody else's NPC is not its business");

    pets.stop();
    assert.equal(sut.world.npcs.size, 0);
    assert.equal(pets.count(), 0);
});

test("an administrator can switch them off for good, and it is kept", () => {
    const sut = load();
    assert.equal(sut.api.petsEnabled(), true);
    sut.api.setPetsEnabled(false);
    assert.equal(sut.api.petsEnabled(), false);
    assert.deepEqual(JSON.parse(sut.files.get("playerdata/village-pets.json")), { enabled: false });
});
