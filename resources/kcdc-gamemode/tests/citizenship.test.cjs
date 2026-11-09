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

function load({ saved = null, lords = { Suchdol: { steamId: LORD, name: "Radovan I Zelený" }, "Malešov": { steamId: KAT, name: "Kateřina" } }, online = [], vendorsOn = true, kuttenberg = true } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/citizenship.json", saved);
    const writes = [];
    const handlers = new Map();
    const notices = [];
    const socials = [];
    const payloads = [];
    let resolver = null;
    const names = { [LORD]: "Radovan I Zelený", [HANS]: "Hans Kovář", [KAT]: "Kateřina Zelená" };
    // The one free change of guild and of citizenship (src/server/free-changes.ts): spent unless a test gives it.
    const freeLeft = new Set();
    const ceded = [];
    const regionCeded = [];
    const freeChanges = {
        freeChangeLeft: (steamId, kind) => freeLeft.has(`${steamId}:${kind}`),
        useFreeChange: (steamId, kind) => freeLeft.delete(`${steamId}:${kind}`),
        freeChangesOf: (steamId) => ({ guild: freeLeft.has(`${steamId}:guild`), citizenship: freeLeft.has(`${steamId}:citizenship`) }),
        CHANGE_PRICE_COINS: 100,
    };
    // What a change costs once the free one is spent (src/server/change-fee.ts, 2026-10-26): a purse of coins by Steam id, empty unless a test fills it.
    const purse = new Map();
    const fees = {
        chargeForChange: (player, kind) => {
            if (freeLeft.delete(`${player.steamId}:${kind}`)) return { ok: true, free: true, message: "", refund() {} };
            const have = purse.get(player.steamId) ?? 0;
            if (have < 100) return { ok: false, free: false, message: `Trocar custa 100 moedas (a sua troca gratuita já foi usada) e você tem ${have} moedas.`, refund() {} };
            purse.set(player.steamId, have - 100);
            return { ok: true, free: false, message: "", refund: () => purse.set(player.steamId, (purse.get(player.steamId) ?? 0) + 100) };
        },
    };
    const requires = {
        "./free-changes.js": freeChanges,
        "./change-fee.js": fees,
        "./auth.js": { isAdmin: (player) => player.steamId === ADMIN },
        "./barbers.js": { BARBERS: [{ id: "barbeiro-suchdol" }, { id: "barbeiro-malesov" }, { id: "barbeiro-wysoka" }] },
        "./vendors.js": { vendorSettings: { enabled: vendorsOn }, VENDORS: [{ village: "Suchdol", trade: "ferreiro" }, { village: "Suchdol", trade: "alfaiate" }, { village: "Suchdol", trade: "banhista" }, { village: "Malešov", trade: "taberneiro" }, { village: "Malešov, na mata", trade: "mascate" }, { village: "Bylansko", trade: "mascate" }, { village: "Bylany", trade: "taberneiro", home: { x: 1700, y: 1000, z: 106, yaw: 0 } }] },
        "./family.js": { getSurname: (steamId) => (steamId === LORD ? "Zelený" : null), crestOf: (steamId) => (steamId === LORD ? "https://example.com/zeleny.png" : "") },
        "./consort.js": { consortsOf: (steamId) => (steamId === LORD ? [{ label: "Lady", name: "Ludmilla Zelená", courtesy: true, text: "Lady Ludmilla Zelená", steamId: "76561198000000999" }] : []) },
        "./guild-members.js": { nameOfMember: (steamId) => names[steamId] ?? "um jogador" },
        "./properties.js": {
            regionLordOf: (region) => lords[region] ?? null,
            regionCeded,
            // Ceding a region to a lord who may be away (src/server/properties.ts): the test records each, as the catalog would take the properties.
            cedeRegionTo: (region, lord, by) => {
                lords[region] = { steamId: lord.steamId, name: lord.name };
                ceded.push({ region, lord: { steamId: lord.steamId, name: lord.name }, by });
                return { given: 2, chests: 1, npc: 0, kept: 0 };
            },
        },
        "./respawn.js": { CHURCHES: [{ id: "suchdol", place: "Suchdol", x: 1, y: 2, z: 3 }, { id: "raborsch", place: "Raborsch", x: 10, y: 20, z: 30 }, { id: "grunta", place: "Minas", x: 30, y: 31, z: 33 }, { id: "sao-tiago", place: "São Tiago, em Kuttenberg", x: 300, y: 400, z: 50 }, { id: "wysoka", place: "Wysoka", x: 440, y: 2497, z: 218.5 }, { id: "stara-kutna", place: "Stará Kutná", x: 3058, y: 1441, z: 106 }], setHomeResolver: (fn) => { resolver = fn; }, wakePoint: (church) => ({ x: church.x, y: church.y, z: church.z + 0.3 }) },
        "./level.js": { onKuttenberg: () => kuttenberg },
        "./status.js": { addPayload() {}, addLazyPayload: (set, fn) => { assert.equal(set, "citizenship"); payloads.push(fn); }, notice: (player, text) => notices.push([player.steamId, text]), sendSocial: (player) => socials.push(player.steamId) },
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
    // An administrator ceding a region from the panel: the title is written and the handlers of `regionCeded` hear of it.
    const cede = (region, lord) => { lords[region] = { steamId: lord.steamId, name: lord.name }; for (const fn of regionCeded) fn(region); };
    return { api: sandbox.exports, files, writes, handlers, notices, socials, payloads, freeLeft, purse, ceded, cede, resolver: () => resolver };
}

const body = (id, steamId, nickname = `j${id}`) => ({ id, steamId, nickname, emitted: [], emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); } });

test("there are five seats, each followed by the lands of its house (2026-10-26), with the crests the panel draws; Kuttenberg's and Pschitoky's are ones the server sends (`@`), the others are in the package", () => {
    const { api } = load();
    assert.deepEqual(
        plain(api.TOWNS.map((town) => [town.id, town.region, town.crest, town.seat])),
        [
            ["suchdol", "Suchdol", "town-suchdol.webp", null],
            ["wysoka", "Wysoka", "town-suchdol.webp", "suchdol"],
            ["opatowitz", "Opatowitz", "town-suchdol.webp", "suchdol"],
            ["raborsch", "Raborsch", "town-raborsch.webp", null],
            ["bohunowitz", "Bohunowitz", "town-raborsch.webp", "raborsch"],
            ["horschan", "Horschan", "town-raborsch.webp", "raborsch"],
            ["malesov", "Malešov", "town-maleshov.webp", null],
            ["bylany", "Bylany", "town-maleshov.webp", "malesov"],
            ["rabstein", "Rabstein", "town-maleshov.webp", "malesov"],
            ["stara-lhota", "Stará Lhota", "town-maleshov.webp", "malesov"],
            ["kuttenberg", "Kuttenberg", "@town-kuttenberg", null],
            ["stara-kutna", "Stará Kutná", "@town-kuttenberg", "kuttenberg"],
            ["danemark", "Danemark", "@town-kuttenberg", "kuttenberg"],
            ["pschitoky", "Pschitoky", "@town-pschitoky", null],
            ["miskowitz", "Miskowitz", "@town-pschitoky", "pschitoky"],
            ["minas", "Minas", "@town-pschitoky", "pschitoky"],
        ],
        "Raborsch rules Bohunowitz and Horschan, Suchdol Wysoka, Malešov Bylany, Pschitoky Miskowitz, Kuttenberg Stará Kutná",
    );
    assert.equal(api.townById("kuttenberg").church, "sao-tiago");
    assert.equal(api.townById("pschitoky").church, null, "the village has no church: its citizens wake at its square");
    assert.deepEqual(plain(api.landsOf(api.townById("raborsch")).map((town) => town.name)), ["Bohunowitz", "Horschan"]);
    assert.deepEqual(plain(api.landsOf(api.townById("wysoka"))), [], "a land rules nothing");
    assert.equal(api.seatOf(api.townById("horschan")).id, "raborsch");
    assert.equal(api.seatOf(api.townById("raborsch")), null);
    for (const land of api.TOWNS.filter((town) => town.seat !== null)) {
        const seat = api.seatOf(land);
        assert.equal(land.crest, seat.crest, `${land.id} wears its seat's crest`);
        assert.ok(api.TOWNS.indexOf(seat) < api.TOWNS.indexOf(land), "the seat comes first, so a list reads in groups");
        assert.ok(land.church !== null || land.square !== null, `${land.id} has somewhere to wake its citizens`);
    }
});

test("every crest a town has is a file of the package or a picture the server sends, and its region is one of the property catalog's (2026-10-25)", () => {
    const { api } = load();
    const served = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/ui-images.json"), "utf8"));
    const properties = fs.readFileSync(path.join(__dirname, "../src/server/properties.ts"), "utf8");
    for (const town of api.TOWNS) {
        if (town.crest.startsWith("@")) assert.ok(typeof served[town.crest.slice(1)] === "string" && served[town.crest.slice(1)].startsWith("data:image/webp;base64,"), `${town.id}: the server sends ${town.crest}`);
        else assert.ok(served[town.crest.replace(/\.webp$/, "")] !== undefined || fs.existsSync(path.join(__dirname, "../ui/img", town.crest)), `${town.id}: ${town.crest} is somewhere`);
        assert.ok(properties.includes(`name: "${town.region}"`), `${town.region} is a region of the property catalog`);
    }
});

test("a player chooses a town: the choice is kept by Steam id and read again at the next start; another one is a change, which costs", () => {
    const first = load();
    const hans = body(1, HANS);
    const chosen = first.api.choose(hans, "suchdol", 5000);
    assert.equal(chosen.ok, true);
    assert.match(chosen.message, /cidadão de Suchdol: quando morrer, é lá que você acorda/);
    assert.equal(first.api.townOf(HANS).id, "suchdol");
    assert.deepEqual(first.writes.at(-1), { v: 1, citizens: { [HANS]: { town: "suchdol", since: 5000 } }, closed: [], granted: ["Opatowitz", "Rabstein", "Stará Lhota"] });

    const again = first.api.choose(hans, "raborsch");
    assert.equal(again.ok, false);
    assert.match(again.message, /Trocar custa 100 moedas \(a sua troca gratuita já foi usada\) e você tem 0 moedas/);
    assert.match(first.api.choose(hans, "suchdol").message, /já é cidadão de Suchdol\./);
    assert.equal(first.api.townOf(HANS).id, "suchdol", "unchanged");

    const second = load({ saved: first.files.get("playerdata/citizenship.json") });
    assert.equal(second.api.townOf(HANS).id, "suchdol");
    assert.equal(second.api.citizensOf(second.api.TOWNS[0]).length, 1);
});

test("a town that is not one, a player with no Steam id, and a record of a town that is gone are all refused or dropped", () => {
    const { api } = load({ saved: JSON.stringify({ citizens: { [HANS]: { town: "atlantis", since: 1 }, [KAT]: { town: "raborsch", since: 2 }, [LORD]: { town: "horschan", since: 3 } } }) });
    assert.equal(api.townOf(HANS), null, "a record of a town the catalog lacks is dropped");
    assert.equal(api.townOf(KAT).id, "raborsch");
    assert.equal(api.townOf(LORD).id, "horschan", "a land is a town to be a citizen of");
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
    assert.match(done.message, /Hans Kovář foi expulso\(a\) de Suchdol: a cidadania acabou/);
    assert.equal(sut.api.townOf(HANS), null);
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /Você foi expulso\(a\) de Suchdol/.test(text)));
    assert.ok(sut.socials.includes(HANS), "his page is brought up to date");
    assert.match(sut.api.depose(lord, "suchdol", key).message, /não é mais cidadã/);
    assert.equal(sut.api.choose(hans, "malesov").ok, true, "free to choose again: a deposed citizen has no town to leave, so nothing is charged");
    assert.equal(sut.purse.get(HANS), undefined);
});

test("an administrator changes town without paying and without using the free change (2026-10-26)", () => {
    const sut = load();
    const admin = body(4, ADMIN);
    sut.api.choose(admin, "suchdol", 100);
    sut.freeLeft.add(`${ADMIN}:citizenship`);
    const moved = sut.api.choose(admin, "wysoka", 200);
    assert.equal(moved.ok, true);
    assert.match(moved.message, /^Administrador: você agora é cidadão de Wysoka \(era de Suchdol\)\. Administradores não pagam a troca\.$/);
    assert.equal(sut.api.townOf(ADMIN).id, "wysoka");
    assert.equal(sut.freeLeft.has(`${ADMIN}:citizenship`), true, "the free change is not spent");
    assert.equal(sut.purse.get(ADMIN), undefined, "and no coin was asked");
    assert.match(sut.api.choose(admin, "wysoka").message, /já é cidadão de Wysoka/);
    const player = body(1, HANS);
    sut.api.choose(player, "suchdol", 300);
    assert.equal(sut.api.choose(player, "wysoka").ok, false, "a player still pays");
});

test("the lord of a seat is the lord of its lands, and sees and deposes their citizens; the lord of a land ceded on its own is its lord, and the seat's still may", () => {
    const lord = body(2, LORD);
    const kat = body(3, KAT);
    const hans = body(1, HANS);
    const sut = load({ online: [hans, lord, kat], lords: { Suchdol: { steamId: LORD, name: "Radovan I Zelený" }, Bylany: { steamId: KAT, name: "Kateřina" } } });
    sut.api.choose(hans, "wysoka", 10);
    assert.equal(sut.api.townOf(HANS).id, "wysoka");
    assert.equal(sut.api.lordOfTown(sut.api.townById("wysoka")).steamId, LORD, "Wysoka has no lord of its own: Suchdol's is its lord");
    assert.equal(sut.api.lordOfTown(sut.api.townById("bylany")).steamId, KAT, "Bylany was ceded on its own");
    assert.equal(sut.api.lordOfTown(sut.api.townById("raborsch")), null);
    assert.equal(sut.api.mayDepose(lord, sut.api.townById("wysoka")), true);
    assert.equal(sut.api.mayDepose(kat, sut.api.townById("wysoka")), false, "the lord of another house's land is nobody here");
    assert.equal(sut.api.mayDepose(kat, sut.api.townById("bylany")), true);
    assert.equal(sut.api.mayDepose(lord, sut.api.townById("bylany")), false, "Suchdol's lord has nothing to do with Malešov's land");
    const page = sut.api.citizenPage(lord, "wysoka", 0);
    assert.equal(page.total, 1);
    assert.equal(sut.api.citizenPage(hans, "wysoka", 0), null);
    assert.equal(sut.api.depose(lord, "wysoka", page.citizens[0].key).ok, true);
    assert.equal(sut.api.townOf(HANS), null);
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

test("the payload tells each town's crest, lord, the lord's family name, seat and lands and citizens, which town is yours, and the towns you are lord of", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const admin = body(3, ADMIN);
    const sut = load({ online: [hans, lord, admin] });
    sut.api.choose(hans, "raborsch", 1);
    const of = (player) => plain(sut.payloads[0](player).citizenship);
    const lady = { label: "Lady", name: "Ludmilla Zelená", courtesy: true, text: "Lady Ludmilla Zelená" };

    const mine = of(hans);
    assert.equal(mine.mine, "raborsch");
    assert.deepEqual(mine.lordOf, []);
    assert.ok(!JSON.stringify(mine).includes("76561198000000999"), "the lord's spouse is told by name, never by Steam id (the tree's Consort.steamId stays on the server)");
    const suchdol = mine.towns.find((town) => town.id === "suchdol");
    assert.deepEqual(suchdol, { id: "suchdol", name: "Suchdol", crest: "town-suchdol.webp", crestUrl: "", lord: "Radovan I Zelený", family: "Zelený", consort: lady, seat: null, seatName: null, lands: ["Wysoka", "Opatowitz"], citizens: 0, closed: false, npcs: 4 });
    const wysoka = mine.towns.find((town) => town.id === "wysoka");
    assert.deepEqual(wysoka, { id: "wysoka", name: "Wysoka", crest: "town-suchdol.webp", crestUrl: "", lord: "Radovan I Zelený", family: "Zelený", consort: lady, seat: "suchdol", seatName: "Suchdol", lands: [], citizens: 0, closed: false, npcs: 1 }, "a land: its seat's crest, its seat's lord, and the seat named");
    const raborsch = mine.towns.find((town) => town.id === "raborsch");
    assert.deepEqual([raborsch.lord, raborsch.family, raborsch.citizens, raborsch.lands], [null, null, 1, ["Bohunowitz", "Horschan"]], "no lord yet: the lands are not ceded");

    assert.deepEqual(of(lord).lordOf, ["suchdol", "wysoka", "opatowitz"], "the lord of a seat has its lands too");
    assert.equal(of(lord).mine, null);
    assert.deepEqual(of(admin).lordOf, plain(sut.api.TOWNS.map((town) => town.id))); // every town, whatever its lord: an administrator opens, closes and expels anywhere
    const kuttenberg = mine.towns.find((town) => town.id === "kuttenberg");
    assert.deepEqual(kuttenberg, { id: "kuttenberg", name: "Kuttenberg", crest: "@town-kuttenberg", crestUrl: "", lord: null, family: null, consort: null, seat: null, seatName: null, lands: ["Stará Kutná", "Danemark"], citizens: 0, closed: false, npcs: 0 });
    const miskowitz = mine.towns.find((town) => town.id === "miskowitz");
    assert.deepEqual(miskowitz, { id: "miskowitz", name: "Miskowitz", crest: "@town-pschitoky", crestUrl: "", lord: null, family: null, consort: null, seat: "pschitoky", seatName: "Pschitoky", lands: [], citizens: 0, closed: false, npcs: 0 });
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
    sut.api.setCitizenship(ADMIN, "kuttenberg");
    assert.deepEqual(plain(resolve(ADMIN)), { place: "Kuttenberg", point: { x: 300, y: 400, z: 50.3 }, text: "Kuttenberg, a sua cidade" }, "a citizen of Kuttenberg wakes in São Tiago");
    sut.api.setCitizenship(HANS, "pschitoky");
    const village = plain(resolve(HANS));
    assert.equal(village.place, "Pschitoky");
    assert.deepEqual([village.point.x, village.point.y], [2308, 1822.5], "a citizen of Pschitoky wakes at the village's square, on the nearest walkable floor");
});

test("a land's citizens wake at its church, or at the village where the census has found its vendors, or else where the coach sets travellers down", () => {
    const sut = load();
    const resolve = sut.resolver();
    sut.api.setCitizenship(HANS, "wysoka");
    assert.deepEqual(plain(resolve(HANS)), { place: "Wysoka", point: { x: 440, y: 2497, z: 218.8 }, text: "Wysoka, a sua cidade" }, "Wysoka has a church of its own");
    sut.api.setCitizenship(HANS, "stara-kutna");
    assert.equal(plain(resolve(HANS)).point.x, 3058, "so has Stará Kutná");
    sut.api.setCitizenship(HANS, "bylany");
    const bylany = plain(resolve(HANS));
    assert.deepEqual([bylany.point.x, bylany.point.y], [1701, 1001], "Bylany: the tavern keeper's door, on the nearest walkable floor, and not the stop on the road");
    sut.api.setCitizenship(HANS, "bohunowitz");
    const bohunowitz = plain(resolve(HANS));
    assert.deepEqual([bohunowitz.point.x, bohunowitz.point.y], [1914.53, 3452.07], "no vendors found there: the spot the coach sets travellers down, snapped to the floor");
    assert.equal(sut.api.villageSpot(sut.api.townById("bohunowitz")), null);
    assert.deepEqual(plain(sut.api.villageSpot(sut.api.townById("bylany"))), { x: 1700, y: 1000, z: 106 });
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
        "./auth.js": { isAdmin: () => false }, "./barbers.js": { BARBERS: [] }, "./vendors.js": { vendorSettings: { enabled: true }, VENDORS: [] }, "./family.js": { getSurname: () => null, crestOf: () => "" }, "./guild-members.js": { nameOfMember: () => "x" }, "./properties.js": { regionLordOf: () => null, regionCeded: [], cedeRegionTo() { return { given: 0, chests: 0, npc: 0, kept: 0 }; } },
        "./respawn.js": { CHURCHES: [], setHomeResolver() {}, wakePoint: () => ({}) }, "./status.js": { addPayload() {}, addLazyPayload() {}, notice() {}, sendSocial() {} },
        "./level.js": { onKuttenberg: () => true },
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
    const [suchdol, raborsch, malesov] = ["suchdol", "raborsch", "malesov"].map((id) => api.townById(id));
    assert.equal(api.npcsOf(suchdol), 4, "a smith, a seamstress, a bath maid and the barber");
    assert.equal(api.npcsOf(malesov), 2, "a tavern keeper and the barber; the pedlar 'Malešov, na mata' belongs to its camp");
    assert.equal(api.npcsOf(raborsch), 0);
});

test("every player has one free change of town (2026-10-19) and every change after it costs 100 coins (2026-10-26)", () => {
    const sut = load();
    const hans = body(1, HANS);
    sut.api.choose(hans, "suchdol", 5000);
    sut.freeLeft.add(`${HANS}:citizenship`);
    const moved = sut.api.choose(hans, "raborsch", 6000);
    assert.equal(moved.ok, true);
    assert.match(moved.message, /cidadão de Raborsch \(era de Suchdol\)\. Esta era a sua troca gratuita: as próximas custam 100 moedas/);
    assert.equal(sut.api.townOf(HANS).id, "raborsch");
    assert.equal(sut.freeLeft.has(`${HANS}:citizenship`), false, "spent");

    const poor = sut.api.choose(hans, "suchdol", 7000);
    assert.equal(poor.ok, false);
    assert.match(poor.message, /Trocar custa 100 moedas .* você tem 0 moedas/);
    assert.equal(sut.api.townOf(HANS).id, "raborsch", "with no coins nothing changes");

    sut.purse.set(HANS, 250);
    const paid = sut.api.choose(hans, "horschan", 8000);
    assert.equal(paid.ok, true);
    assert.match(paid.message, /cidadão de Horschan \(era de Raborsch\) por 100 moedas\./);
    assert.equal(sut.api.townOf(HANS).id, "horschan", "a land may be chosen as a town");
    assert.equal(sut.purse.get(HANS), 150, "the price was taken");
    assert.equal(sut.api.citizensOf(sut.api.townById("horschan")).length, 1);
    assert.equal(sut.api.citizensOf(sut.api.townById("raborsch")).length, 0);

    assert.match(sut.api.choose(hans, "horschan").message, /já é cidadão de Horschan/);
    assert.equal(sut.purse.get(HANS), 150, "asking for the town one has costs nothing");
});

// ---------------------------------------------------------------------------------------------
// Closing the citizenship and expelling (2026-10-29: "um lorde no painel cidadania deve poder bloquear cidadania e assim nenhum jogador consegue virar cidadão das terras dele,
// e também deve poder expulsar cidadãos de suas terras").

test("the lord of a town's lands closes its citizenship: nobody new can become a citizen, those who are stay, and the lord and the administrators may still choose it", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const kat = body(3, KAT);
    const admin = body(4, ADMIN);
    const sut = load({ online: [hans, lord, kat, admin] });
    sut.api.choose(hans, "suchdol", 100);

    assert.equal(sut.api.setClosed(kat, "suchdol", true).ok, false, "the lord of another town may not");
    assert.match(sut.api.setClosed(kat, "suchdol", true).message, /Só o senhor das terras de Suchdol fecha ou abre a cidadania/);
    assert.equal(sut.api.setClosed(hans, "suchdol", true).ok, false, "nor a citizen");
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), false);

    const closed = sut.api.setClosed(lord, "suchdol", true);
    assert.equal(closed.ok, true);
    assert.match(closed.message, /A cidadania de Suchdol está fechada: ninguém novo pode se tornar cidadão/);
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), true);
    assert.match(sut.api.setClosed(lord, "suchdol", true).message, /já está fechada/);

    const wanting = body(5, "76561198000000005");
    const refused = sut.api.choose(wanting, "suchdol");
    assert.equal(refused.ok, false);
    assert.match(refused.message, /A cidadania de Suchdol está fechada pelo senhor das terras: ninguém novo pode se tornar cidadão por enquanto/);
    assert.equal(sut.api.townOf("76561198000000005"), null);
    assert.equal(sut.api.townOf(HANS).id, "suchdol", "a citizen stays");
    assert.equal(sut.api.choose(wanting, "raborsch").ok, true, "the other towns are not affected");

    // The lord of the lands and an administrator may still choose it; a citizen of it who is told to choose it again is a citizen already.
    assert.equal(sut.api.choose(lord, "suchdol").ok, true);
    assert.equal(sut.api.choose(admin, "suchdol").ok, true);
    assert.match(sut.api.choose(hans, "suchdol").message, /já é cidadão de Suchdol/);
    // A citizen of a closed town may leave it (here with his free change).
    sut.freeLeft.add(`${HANS}:citizenship`);
    assert.equal(sut.api.choose(hans, "raborsch").ok, true);

    assert.equal(sut.api.setClosed(lord, "suchdol", false).ok, true);
    assert.match(sut.api.setClosed(lord, "suchdol", false).message, /já está aberta/);
    assert.equal(sut.api.choose(body(6, "76561198000000006"), "suchdol").ok, true, "open again: anybody");
});

test("a closed town is kept across restarts, told to the page in each town's view, and only a town that exists is read back", () => {
    const lord = body(2, LORD);
    const sut = load({ online: [lord] });
    sut.api.setClosed(lord, "suchdol", true);
    sut.api.setClosed(lord, "wysoka", true);
    assert.deepEqual(plain(sut.writes.at(-1).closed), ["suchdol", "wysoka"]);
    assert.equal(plain(sut.payloads[0](lord).citizenship.towns.find((town) => town.id === "suchdol")).closed, true);
    assert.equal(plain(sut.payloads[0](lord).citizenship.towns.find((town) => town.id === "raborsch")).closed, false);

    const again = load({ saved: sut.files.get("playerdata/citizenship.json") });
    assert.equal(again.api.isClosed(again.api.townById("suchdol")), true);
    assert.equal(again.api.isClosed(again.api.townById("wysoka")), true);
    assert.equal(again.api.isClosed(again.api.townById("raborsch")), false);
    const odd = load({ saved: JSON.stringify({ v: 1, citizens: {}, closed: ["suchdol", "ninguem", 5, null] }) });
    assert.equal(odd.api.isClosed(odd.api.townById("suchdol")), true);
    const old = load({ saved: JSON.stringify({ v: 1, citizens: {} }) });
    assert.equal(old.api.isClosed(old.api.townById("suchdol")), false, "a file from before has none shut");
});

test("the lord of a seat closes each of its lands on its own, an administrator any town, and a town that is not one is refused", () => {
    const lord = body(2, LORD);
    const admin = body(4, ADMIN);
    const sut = load({ online: [lord, admin] });
    assert.equal(sut.api.setClosed(lord, "wysoka", true).ok, true, "a land of Suchdol, whose lord he is");
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), false, "the seat is another town");
    assert.equal(sut.api.setClosed(admin, "raborsch", true).ok, true);
    assert.equal(sut.api.setClosed(lord, "raborsch", false).ok, false);
    assert.match(sut.api.setClosed(lord, "nao-existe", true).message, /Essa cidade não existe/);
    assert.match(sut.api.setClosed(lord, 5, true).message, /Essa cidade não existe/);
});

test("the page's event closes and opens a town, answered with the notice and a new panel; a request that is not one does nothing", () => {
    const lord = body(2, LORD);
    const hans = body(1, HANS);
    const sut = load({ online: [lord, hans] });
    sut.handlers.get("kcdc-gamemode:status.citizenClose")(lord, JSON.stringify({ town: "suchdol", closed: 1 }));
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), true);
    assert.ok(sut.notices.some(([to, text]) => to === LORD && /A cidadania de Suchdol está fechada/.test(text)));
    assert.ok(sut.socials.includes(LORD));
    sut.handlers.get("kcdc-gamemode:status.citizenClose")(hans, { town: "suchdol", closed: 0 });
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), true, "a player who is no lord changes nothing");
    sut.handlers.get("kcdc-gamemode:status.citizenClose")(lord, { town: "suchdol", closed: 0 });
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), false);
    for (const bad of [null, "{", { town: 5 }, { closed: 1 }, { town: "suchdol", closed: "sim" }]) sut.handlers.get("kcdc-gamemode:status.citizenClose")(lord, bad);
    assert.equal(sut.api.isClosed(sut.api.townById("suchdol")), false, "only a 1 closes");
});

test("an expelled citizen is told, and told whether the town is closed to them now", () => {
    const hans = body(1, HANS);
    const lord = body(2, LORD);
    const sut = load({ online: [hans, lord] });
    sut.api.choose(hans, "suchdol", 100);
    const key = sut.api.citizenPage(lord, "suchdol", 0).citizens[0].key;
    sut.api.setClosed(lord, "suchdol", true);
    assert.equal(sut.api.depose(lord, "suchdol", key).ok, true);
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /Você foi expulso\(a\) de Suchdol: a sua cidadania acabou\. A cidadania de lá está fechada\./.test(text)));
    assert.equal(sut.api.choose(hans, "suchdol").ok, false, "closed: he cannot come back by choosing it");
    sut.api.setClosed(lord, "suchdol", false);
    assert.equal(sut.api.choose(hans, "suchdol").ok, true);
});

// ---------------------------------------------------------------------------------------------
// The rest of the mapped regions as lands (2026-10-29: "as regiões mapeadas vamos colocar nas terras de cada cidadania que já temos ... de forma equilibrada ... e entregar as terras novas ao
// dono da região principal, que é o lorde").

test("every region of the catalog is a town or a land now, and the five houses hold two or three lands each", () => {
    const { api } = load();
    const properties = fs.readFileSync(path.join(__dirname, "../src/server/properties.ts"), "utf8");
    const table = properties.slice(properties.indexOf("const KUTTENBERG_REGIONS"), properties.indexOf("The places of the Trosky level"));
    const mapped = [...table.matchAll(/ name: "([^"]+)",\s*minX:/g)].map((match) => match[1]);
    assert.ok(mapped.length >= 16, `the table of mapped regions was read: ${mapped.join(", ")}`);
    const covered = new Set(api.TOWNS.map((town) => town.region));
    for (const region of mapped) assert.ok(covered.has(region), `${region} is a town or a land`);
    const seats = api.TOWNS.filter((town) => town.seat === null);
    assert.equal(seats.length, 5);
    const counts = seats.map((seat) => api.landsOf(seat).length);
    assert.deepEqual(plain(counts), [2, 2, 3, 2, 2], "Suchdol, Raborsch, Malešov, Kuttenberg, Pschitoky");
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, "balanced");
    assert.deepEqual(plain(api.landsOf(api.townById("suchdol")).map((land) => land.name)), ["Wysoka", "Opatowitz"]);
    assert.deepEqual(plain(api.landsOf(api.townById("malesov")).map((land) => land.name)), ["Bylany", "Rabstein", "Stará Lhota"]);
    assert.deepEqual(plain(api.landsOf(api.townById("kuttenberg")).map((land) => land.name)), ["Stará Kutná", "Danemark"]);
    assert.deepEqual(plain(api.landsOf(api.townById("pschitoky")).map((land) => land.name)), ["Miskowitz", "Minas"]);
    assert.deepEqual(plain(api.TOWNS.filter((town) => town.follows === true).map((town) => town.id)), ["opatowitz", "rabstein", "stara-lhota", "danemark", "minas"]);
    assert.equal(api.townById("minas").church, "grunta", "Minas has its church");
});

test("a citizen of a new land wakes in it: Minas at its church, the hamlets at the house the catalog keeps for them", () => {
    const { api } = load();
    const hans = body(1, HANS);
    assert.equal(api.choose(hans, "minas", 1).ok, true);
    const home = api.homeOf(HANS);
    assert.equal(home.town.id, "minas");
    assert.deepEqual(plain(home.point), { x: 30, y: 31, z: 33.3 }, "the church, a little above its spot");
    for (const id of ["opatowitz", "rabstein", "stara-lhota", "danemark"]) {
        const sut = load();
        assert.equal(sut.api.choose(body(2, HANS), id, 1).ok, true, id);
        const where = sut.api.homeOf(HANS);
        assert.equal(where.town.id, id);
        const square = sut.api.townById(id).square;
        assert.deepEqual(plain(where.point), { x: square.x + 1, y: square.y + 1, z: square.z }, `${id}: its square, on the floor`);
    }
});

test("the lands that follow a seat's lord are ceded to him when the server starts, once, and the ones whose seat has no lord wait", () => {
    const sut = load();
    assert.deepEqual(plain(sut.ceded.map((entry) => [entry.region, entry.lord.steamId])), [["Opatowitz", LORD], ["Rabstein", KAT], ["Stará Lhota", KAT]], "Pschitoky and Kuttenberg have no lord yet: Minas and Danemark wait");
    assert.equal(sut.api.lordOfTown(sut.api.townById("opatowitz")).steamId, LORD);
    assert.equal(sut.api.lordOfTown(sut.api.townById("stara-lhota")).steamId, KAT);
    assert.equal(sut.api.lordOfTown(sut.api.townById("minas")), null);
    assert.deepEqual(plain(sut.writes.at(-1).granted), ["Opatowitz", "Rabstein", "Stará Lhota"]);
    assert.deepEqual(plain(sut.api.grantFollowingLands()), [], "asked again, nothing more to give");
    assert.equal(sut.ceded.length, 3);
});

test("a seat ceded later hands its waiting lands to its new lord, but only those, and a notice tells him when he is in the game", () => {
    const korand = { ...body(7, "76561198000000007", "Korand"), ready: true };
    const sut = load({ online: [korand] });
    assert.equal(sut.ceded.length, 3);
    sut.cede("Pschitoky", { steamId: korand.steamId, name: "Korand II" });
    assert.deepEqual(plain(sut.ceded.slice(3).map((entry) => [entry.region, entry.lord.steamId])), [["Minas", korand.steamId]], "the cession of the seat gave him Minas, and Danemark (Kuttenberg's) still waits");
    assert.equal(sut.api.lordOfTown(sut.api.townById("minas")).steamId, korand.steamId);
    assert.equal(sut.api.lordOfTown(sut.api.townById("danemark")), null);
    assert.ok(sut.notices.some(([to, text]) => to === korand.steamId && /Minas é terra de Pschitoky e agora é sua/.test(text)), JSON.stringify(sut.notices));
    sut.cede("Wysoka", { steamId: korand.steamId, name: "Korand II" });
    assert.equal(sut.ceded.length, 4, "ceding a land is no reason to hand anything");
    sut.cede("Kuttenberg", { steamId: KAT, name: "Kateřina" });
    assert.deepEqual(plain(sut.ceded.slice(4).map((entry) => entry.region)), ["Danemark"]);
    assert.deepEqual(plain(sut.writes.at(-1).granted), ["Opatowitz", "Rabstein", "Stará Lhota", "Minas", "Danemark"]);
});

test("a land that already has a lord of its own keeps him, and one that was handed once is never handed again", () => {
    const own = load({ lords: { Suchdol: { steamId: LORD, name: "Radovan I Zelený" }, Opatowitz: { steamId: HANS, name: "Hans" } } });
    assert.deepEqual(plain(own.ceded), [], "Opatowitz has its own lord");
    assert.equal(own.api.lordOfTown(own.api.townById("opatowitz")).steamId, HANS);
    assert.deepEqual(plain(own.writes.at(-1).granted), ["Opatowitz"], "and it is written down all the same");

    // The administrator took the lord off Opatowitz after it was handed: the next start does not put him back.
    const again = load({ saved: JSON.stringify({ v: 1, citizens: {}, closed: [], granted: ["Opatowitz", "Rabstein"] }), lords: { Suchdol: { steamId: LORD, name: "Radovan I Zelený" }, "Malešov": { steamId: KAT, name: "Kateřina" } } });
    assert.deepEqual(plain(again.ceded.map((entry) => entry.region)), ["Stará Lhota"]);
    assert.equal(again.api.lordOfTown(again.api.townById("opatowitz")).steamId, LORD, "no region of its own: the seat's lord is its lord, as for any land");
    const odd = load({ saved: JSON.stringify({ v: 1, citizens: {}, granted: ["Wysoka", "ninguem", 5] }), lords: {} });
    assert.deepEqual(plain(odd.ceded), []);
    assert.equal(odd.writes.length, 0, "nothing to give, nothing written");
});

test("with the vendors switched off the NPCs that live in a town are only its barber (2026-10-29)", () => {
    const off = load({ vendorsOn: false });
    assert.equal(off.api.npcsOf(off.api.townById("suchdol")), 1, "no smith, no seamstress, no bath maid: the barber");
    assert.equal(off.api.npcsOf(off.api.townById("malesov")), 1, "no tavern keeper: the barber");
    assert.equal(off.api.npcsOf(off.api.townById("raborsch")), 0);
});

test("on the Trosky level the towns are Trosky's: eight, none with a crest or a church, each waking its citizens at its own square; Kuttenberg's are not there (2026-11-09)", () => {
    const sut = load({ kuttenberg: false });
    assert.deepEqual([...sut.api.TOWNS.map((town) => town.id)], ["semine", "nebakov", "acampamento-nomade", "zhelejov", "troskowitz", "tachov", "trosky", "apolonia"]);
    assert.ok(sut.api.TOWNS.every((town) => town.crest === "" && town.church === null && town.seat === null && town.square !== null), "no crest of its own, no church, no seat, a square");
    assert.equal(sut.api.setCitizenship(HANS, "suchdol"), false, "Suchdol is not a town of this level");
    assert.equal(sut.api.setCitizenship(HANS, "semine"), true);
    const home = sut.resolver()(HANS);
    assert.equal(home.place, "Semine");
    assert.deepEqual([Math.round(home.point.x), Math.round(home.point.y)], [1498, 1582], "at Semine's square, on the floor the navigation found");
    assert.equal(sut.api.townById("trosky").name, "Castelo de Trosky");
    assert.equal(sut.api.townById("trosky").region, "Trosky", "the catalog's region of the castle");
    const kuttenberg = load();
    kuttenberg.api.setCitizenship(HANS, "suchdol");
    assert.equal(kuttenberg.resolver()(HANS).place, "Suchdol", "on Kuttenberg's level it is as it was");
});

test("a town with no crest of its own tells the crest link of its lord's family, and none when the lord or the family has none; a town with a crest of its own keeps it (2026-11-09)", () => {
    const lord = body(2, LORD);
    const none = load({ kuttenberg: false, online: [lord], lords: {} });
    assert.ok(plain(none.payloads[0](lord).citizenship.towns).every((town) => town.crest === "" && town.crestUrl === ""), "no lord: no crest");
    const sut = load({ kuttenberg: false, online: [lord], lords: { Semine: { steamId: LORD, name: "Radovan I Zelený" } } });
    const of = () => plain(sut.payloads[0](lord).citizenship.towns);
    const semine = of().find((town) => town.id === "semine");
    assert.equal(semine.crestUrl, "https://example.com/zeleny.png", "the crest of the lord's family");
    assert.equal(of().find((town) => town.id === "tachov").crestUrl, "", "another town, another lord: none");
    const kuttenberg = load({ online: [lord] });
    const suchdol = plain(kuttenberg.payloads[0](lord).citizenship.towns).find((town) => town.id === "suchdol");
    assert.deepEqual([suchdol.crest, suchdol.crestUrl], ["town-suchdol.webp", ""], "a town with a crest of its own keeps it");
});
