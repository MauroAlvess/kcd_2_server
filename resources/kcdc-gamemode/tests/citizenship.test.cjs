"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const LORD = "76561198000000001";
const HANS = "76561198000000002";
const KAT = "76561198000000003";
const ADMIN = "76561198000000009";

function load({ saved = null, lords = { Suchdol: { steamId: LORD, name: "Radovan I Zelený" }, "Malešov": { steamId: KAT, name: "Kateřina" } }, online = [] } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/citizenship.json", saved);
    const writes = [];
    const handlers = new Map();
    const notices = [];
    const socials = [];
    const payloads = [];
    let resolver = null;
    const names = { [LORD]: "Radovan I Zelený", [HANS]: "Hans Kovář", [KAT]: "Kateřina Zelená" };
    const requires = {
        "./auth.js": { isAdmin: (player) => player.steamId === ADMIN },
        "./barbers.js": { BARBERS: [{ id: "barbeiro-suchdol" }, { id: "barbeiro-malesov" }, { id: "barbeiro-wysoka" }] },
        "./vendors.js": { VENDORS: [{ village: "Suchdol", trade: "ferreiro" }, { village: "Suchdol", trade: "alfaiate" }, { village: "Suchdol", trade: "banhista" }, { village: "Malešov", trade: "taberneiro" }, { village: "Malešov, na mata", trade: "mascate" }, { village: "Bylansko", trade: "mascate" }] },
        "./family.js": { getSurname: (steamId) => (steamId === LORD ? "Zelený" : null) },
        "./guild-members.js": { nameOfMember: (steamId) => names[steamId] ?? "um jogador" },
        "./properties.js": { regionLordOf: (region) => lords[region] ?? null },
        "./respawn.js": { CHURCHES: [{ id: "suchdol", place: "Suchdol", x: 1, y: 2, z: 3 }, { id: "raborsch", place: "Raborsch", x: 10, y: 20, z: 30 }], setHomeResolver: (fn) => { resolver = fn; }, wakePoint: (church) => ({ x: church.x, y: church.y, z: church.z + 0.3 }) },
        "./status.js": { addPayload: (fn) => payloads.push(fn), notice: (player, text) => notices.push([player.steamId, text]), sendSocial: (player) => socials.push(player.steamId) },
        "./store.js": {
            ensureDir() {},
            read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
            write: (file, body) => { writes.push(plain(body)); files.set(file, JSON.stringify(body)); },
        },
    };
    const sandbox = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Date,
        Events: { onClient: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => online },
        Navigation: { ready: true, closestPoint: (at) => ({ x: at.x + 1, y: at.y + 1, z: at.z }) },
    };
    vm.runInNewContext(dist("citizenship.js"), sandbox);
    sandbox.exports.installCitizenship();
    return { api: sandbox.exports, files, writes, handlers, notices, socials, payloads, resolver: () => resolver };
}

const body = (id, steamId, nickname = `j${id}`) => ({ id, steamId, nickname, emitted: [], emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); } });

test("there are three towns, with the crests the panel draws", () => {
    const { api } = load();
    assert.deepEqual(plain(api.TOWNS.map((town) => [town.id, town.region, town.crest])), [["suchdol", "Suchdol", "town-suchdol.webp"], ["raborsch", "Raborsch", "town-raborsch.webp"], ["malesov", "Malešov", "town-maleshov.webp"]]);
});

test("a player chooses one town, once: the choice is kept by Steam id and read again at the next start", () => {
    const first = load();
    const hans = body(1, HANS);
    const chosen = first.api.choose(hans, "suchdol", 5000);
    assert.equal(chosen.ok, true);
    assert.match(chosen.message, /cidadão de Suchdol: quando morrer, é lá que você acorda/);
    assert.equal(first.api.townOf(HANS).id, "suchdol");
    assert.deepEqual(first.writes.at(-1), { v: 1, citizens: { [HANS]: { town: "suchdol", since: 5000 } } });

    const again = first.api.choose(hans, "raborsch");
    assert.equal(again.ok, false);
    assert.match(again.message, /Você já é cidadão de Suchdol: só o senhor das terras pode depor/);
    assert.match(first.api.choose(hans, "suchdol").message, /já é cidadão de Suchdol\./);
    assert.equal(first.api.townOf(HANS).id, "suchdol", "unchanged");

    const second = load({ saved: first.files.get("playerdata/citizenship.json") });
    assert.equal(second.api.townOf(HANS).id, "suchdol");
    assert.equal(second.api.citizensOf(second.api.TOWNS[0]).length, 1);
});

test("a town that is not one, a player with no Steam id, and a record of a town that is gone are all refused or dropped", () => {
    const { api } = load({ saved: JSON.stringify({ citizens: { [HANS]: { town: "atlantis", since: 1 }, [KAT]: { town: "raborsch", since: 2 } } }) });
    assert.equal(api.townOf(HANS), null, "a record of a town the catalog lacks is dropped");
    assert.equal(api.townOf(KAT).id, "raborsch");
    assert.match(api.choose(body(1, LORD), "atlantis").message, /não existe/);
    assert.match(api.choose(body(2, ""), "suchdol").message, /identificação Steam/);
    assert.equal(api.townOf(""), null);
});

test("only the lord of a town's lands, or an administrator, may see its citizens and depose one; the citizen may choose again afterwards", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const kat = body(3, KAT);
    const admin = body(4, ADMIN);
    const sut = load({ online: [hans, lord, kat, admin] });
    sut.api.choose(hans, "suchdol", 100);
    sut.api.choose(lord, "suchdol", 50);

    const page = sut.api.citizenPage(lord, "suchdol", 0);
    assert.equal(page.total, 2);
    assert.deepEqual(plain(page.citizens.map((one) => [one.name, one.you])), [["Radovan I Zelený", true], ["Hans Kovář", false]], "the oldest first");
    assert.ok(page.citizens.every((one) => /^c[0-9a-z]+$/.test(one.key)), "a key, never a Steam id");
    assert.equal(sut.api.citizenPage(hans, "suchdol", 0), null, "a citizen sees no list");
    assert.equal(sut.api.citizenPage(kat, "suchdol", 0), null, "nor does the lord of another town");
    assert.notEqual(sut.api.citizenPage(admin, "suchdol", 0), null);

    const key = page.citizens[1].key;
    assert.match(sut.api.depose(kat, "suchdol", key).message, /Só o senhor das terras de Suchdol/);
    assert.match(sut.api.depose(hans, "suchdol", key).message, /Só o senhor/);
    assert.equal(sut.api.townOf(HANS).id, "suchdol");

    const done = sut.api.depose(lord, "suchdol", key);
    assert.equal(done.ok, true);
    assert.match(done.message, /A cidadania de Hans Kovář em Suchdol foi deposta/);
    assert.equal(sut.api.townOf(HANS), null);
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /cidadania de Suchdol foi deposta/.test(text)));
    assert.ok(sut.socials.includes(HANS), "his page is brought up to date");
    assert.match(sut.api.depose(lord, "suchdol", key).message, /não é mais cidadã/);
    assert.equal(sut.api.choose(hans, "malesov").ok, true, "free to choose again");
});

test("a page of citizens is eight at a time, and a page past the end is the last", () => {
    const lord = body(1, LORD);
    const sut = load({ online: [lord] });
    for (let n = 0; n < 19; n += 1) sut.api.setCitizenship(`7656119800010${String(n).padStart(4, "0")}`, "suchdol", n);
    const first = sut.api.citizenPage(lord, "suchdol", 0);
    assert.deepEqual([first.total, first.pages, first.citizens.length, first.first], [19, 3, 8, 0]);
    const last = sut.api.citizenPage(lord, "suchdol", 99);
    assert.deepEqual([last.page, last.citizens.length, last.first], [2, 3, 16]);
    assert.equal(sut.api.citizenPage(lord, "suchdol", -2).page, 0);
});

test("the payload tells each town's crest, lord, the lord's family name and citizens, which town is yours, and the towns you are lord of", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const admin = body(3, ADMIN);
    const sut = load({ online: [hans, lord, admin] });
    sut.api.choose(hans, "raborsch", 1);
    const of = (player) => plain(sut.payloads[0](player).citizenship);

    const mine = of(hans);
    assert.equal(mine.mine, "raborsch");
    assert.deepEqual(mine.lordOf, []);
    const suchdol = mine.towns.find((town) => town.id === "suchdol");
    assert.deepEqual(suchdol, { id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp", lord: "Radovan I Zelený", family: "Zelený", citizens: 0, npcs: 4 });
    const raborsch = mine.towns.find((town) => town.id === "raborsch");
    assert.deepEqual([raborsch.lord, raborsch.family, raborsch.citizens], [null, null, 1], "no lord yet: the lands are not ceded");

    assert.deepEqual(of(lord).lordOf, ["suchdol"]);
    assert.equal(of(lord).mine, null);
    assert.deepEqual(of(admin).lordOf, ["suchdol", "raborsch", "malesov"]);
});

test("the page's three events: choose, ask for the citizens, depose, each answered", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const sut = load({ online: [hans, lord] });
    sut.handlers.get("kcdc-gamemode:status.citizenChoose")(hans, JSON.stringify({ town: "suchdol" }));
    assert.equal(sut.api.townOf(HANS).id, "suchdol");
    assert.ok(sut.socials.includes(HANS));

    sut.handlers.get("kcdc-gamemode:status.citizens")(lord, { town: "suchdol", page: 0 });
    const answer = lord.emitted.at(-1);
    assert.equal(answer.event, "kcdc-gamemode:status.citizens");
    assert.equal(answer.payload.total, 1);
    sut.handlers.get("kcdc-gamemode:status.citizens")(hans, { town: "suchdol", page: 0 });
    assert.equal(hans.emitted.length, 0, "a citizen is told nothing");

    sut.handlers.get("kcdc-gamemode:status.citizenDepose")(lord, { town: "suchdol", key: answer.payload.citizens[0].key, page: 0 });
    assert.equal(sut.api.townOf(HANS), null);
    assert.equal(lord.emitted.at(-1).payload.total, 0, "the list is sent again without him");
    for (const bad of [null, "{", { town: 5 }, { key: [] }]) sut.handlers.get("kcdc-gamemode:status.citizenDepose")(lord, bad);
});

test("who dies wakes in their town: its church, or its square; somebody with no town gets nothing from this", () => {
    const sut = load();
    sut.api.setCitizenship(HANS, "suchdol");
    sut.api.setCitizenship(KAT, "malesov");
    const resolve = sut.resolver();
    assert.deepEqual(plain(resolve(HANS)), { place: "Suchdol", point: { x: 1, y: 2, z: 3.3 }, text: "Suchdol, a sua cidade" });
    const square = plain(resolve(KAT));
    assert.equal(square.place, "Malešov");
    assert.deepEqual([square.point.x, square.point.y], [561.5, 259.3], "the nearest walkable floor to the square");
    assert.equal(resolve(LORD), null);
});

test("an administrator's hand: set, clear, and a bad town or no Steam id changes nothing", () => {
    const { api, writes } = load();
    assert.equal(api.setCitizenship(HANS, "raborsch"), true);
    assert.equal(api.townOf(HANS).id, "raborsch");
    assert.equal(api.setCitizenship(HANS, "atlantis"), false);
    assert.equal(api.setCitizenship("", "raborsch"), false);
    assert.equal(api.setCitizenship(HANS, null), true);
    assert.equal(api.setCitizenship(HANS, null), false, "nothing to clear");
    assert.equal(api.townOf(HANS), null);
    assert.ok(writes.length >= 2);
});

test("a file that cannot be read is left alone", () => {
    const files = new Map([["playerdata/citizenship.json", "x"]]);
    const writes = [];
    const requires = {
        "./auth.js": { isAdmin: () => false }, "./barbers.js": { BARBERS: [] }, "./vendors.js": { VENDORS: [] }, "./family.js": { getSurname: () => null }, "./guild-members.js": { nameOfMember: () => "x" }, "./properties.js": { regionLordOf: () => null },
        "./respawn.js": { CHURCHES: [], setHomeResolver() {}, wakePoint: () => ({}) }, "./status.js": { addPayload() {}, notice() {}, sendSocial() {} },
        "./store.js": { ensureDir() {}, read: () => ({ status: "corrupt", reason: "bad" }), write: (file, text) => writes.push(file) },
    };
    const sandbox = { exports: {}, require: (id) => requires[id], console: { log() {} }, Events: { onClient() {} }, Player: { all: () => [] }, Navigation: { ready: false } };
    vm.runInNewContext(dist("citizenship.js"), sandbox);
    sandbox.exports.installCitizenship();
    sandbox.exports.choose({ steamId: HANS, nickname: "Hans" }, "suchdol");
    assert.deepEqual(writes, [], "nothing is written over a file that could not be read");
    assert.ok(files.has("playerdata/citizenship.json"));
});

test("the NPCs that live in a town are its vendors and its barber, the roadside pedlars not counted", () => {
    const { api } = load();
    const [suchdol, raborsch, malesov] = api.TOWNS;
    assert.equal(api.npcsOf(suchdol), 4, "a smith, a seamstress, a bath maid and the barber");
    assert.equal(api.npcsOf(malesov), 2, "a tavern keeper and the barber; the pedlar 'Malešov, na mata' belongs to its camp");
    assert.equal(api.npcsOf(raborsch), 0);
});
