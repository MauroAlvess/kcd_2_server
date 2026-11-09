"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const ERIK = "76561198000000001";
const ILSE = "76561198000000002";
const HANS = "76561198000000003";
const ADMIN = "76561198000000009";

// Wars between lands (2026-10-31, src/server/wars.ts): the lord of a town's lands marks the towns his is at war with, everybody online is told, and a lord who lost hands the lands to the winner.
const TOWNS = [
    { id: "suchdol", region: "Suchdol", name: "Suchdol", seat: null },
    { id: "wysoka", region: "Wysoka", name: "Wysoka", seat: "suchdol" },
    { id: "raborsch", region: "Raborsch", name: "Raborsch", seat: null },
    { id: "bohunowitz", region: "Bohunowitz", name: "Bohunowitz", seat: "raborsch" },
    { id: "malesov", region: "Malešov", name: "Malešov", seat: null },
];

function load({ saved = null, corrupt = false, lords = { Suchdol: { steamId: ERIK, name: "Erik" }, Wysoka: { steamId: ERIK, name: "Erik" }, Raborsch: { steamId: ILSE, name: "Ilse" } }, citizens = { [HANS]: "suchdol" } } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/wars.json", JSON.stringify(saved));
    const writes = [];
    const chats = [];
    const notifies = [];
    const notices = [];
    const socials = [];
    const payloads = [];
    const handlers = new Map();
    const ready = [];
    const timers = [];
    const releases = [];
    const ceded = [];
    const regionCeded = [];
    const names = { [ERIK]: "Erik", [ILSE]: "Ilse", [HANS]: "Hans", [ADMIN]: "Admin" };
    const body = (id, steamId) => ({
        id, steamId, nickname: names[steamId], ready: true,
        emit(event, payload) { notifies.push({ to: steamId, event, payload: JSON.parse(payload) }); },
    });
    const online = [body(1, ERIK), body(2, ILSE), body(3, HANS), body(9, ADMIN)];
    const byRegion = (region) => lords[region] ?? null;
    const lordRegions = (town) => (town.seat === null ? [town.region] : [town.region, TOWNS.find((one) => one.id === town.seat).region]);
    const requires = {
        "./auth.js": { isAdmin: (player) => player.steamId === ADMIN },
        "./citizenship.js": {
            TOWNS,
            townById: (id) => (typeof id === "string" ? (TOWNS.find((town) => town.id === id) ?? null) : null),
            townOf: (steamId) => (citizens[steamId] === undefined ? null : TOWNS.find((town) => town.id === citizens[steamId])),
            lordOfTown: (town) => { for (const region of lordRegions(town)) if (byRegion(region) !== null) return byRegion(region); return null; },
            mayDepose: (player, town) => player.steamId === ADMIN || lordRegions(town).some((region) => byRegion(region)?.steamId === player.steamId),
        },
        "./guild-members.js": { nameOfMember: (steamId) => names[steamId] ?? "um jogador" },
        "./language.js": { languageOf: () => "pt", translate: (text) => text },
        "./properties.js": {
            regionCeded,
            regionLordOf: byRegion,
            releaseRegion: (query) => { const lord = lords[query]; releases.push(query); delete lords[query]; return { ok: true, message: "", lord, released: 3, kept: 0 }; },
            cedeRegionTo: (region, lord, by) => {
                lords[region] = { steamId: lord.steamId, name: lord.name };
                ceded.push({ region, lord: { steamId: lord.steamId, name: lord.name }, by });
                for (const fn of regionCeded) fn(region);
                return { given: 4, chests: 2, npc: 0, kept: 1 };
            },
        },
        "./status.js": { addLazyPayload: (set, fn) => { assert.equal(set, "citizenship", "the wars ride with the towns"); payloads.push(fn); }, notice: (player, text) => notices.push([player.steamId, text]), sendSocial: (player) => socials.push(player.steamId) },
        "./store.js": {
            ensureDir() {},
            read: (file) => (corrupt ? { status: "corrupt", reason: "broken" } : files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
            write: (file, value) => { writes.push(plain(value)); files.set(file, JSON.stringify(value)); },
        },
    };
    const sandbox = {
        exports: {},
        require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {} },
        Date,
        setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        Chat: { sendToPlayer: (player, text) => chats.push([player.steamId, text]) },
        Player: { all: () => online },
        Events: { onClient: (name, fn) => handlers.set(name, fn), on: (name, fn) => { if (name === "playerReady") ready.push(fn); } },
    };
    vm.runInNewContext(dist("wars.js"), sandbox);
    sandbox.exports.installWars();
    const who = (steamId) => online.find((player) => player.steamId === steamId);
    // An administrator ceding a region from the panel: the lord is written and the handlers of `regionCeded` hear of it.
    const cede = (region, lord) => { lords[region] = { steamId: lord.steamId, name: lord.name }; for (const fn of regionCeded) fn(region); };
    return { api: sandbox.exports, files, writes, chats, notifies, notices, socials, payloads, handlers, ready, timers, releases, ceded, lords, who, cede };
}

const toldAll = (chats, text) => chats.filter(([, line]) => line === text).length;

test("a lord marks the towns his is at war with: both towns are at war, everybody online is told in the chat and on the notification line, and the file keeps it", () => {
    const w = load();
    const done = w.api.setWars(w.who(ERIK), "suchdol", "raborsch,malesov", 5000);
    assert.equal(done.ok, true);
    assert.equal(done.message, "Suchdol está em guerra com Raborsch e Malešov.");
    assert.deepEqual(plain(w.api.opponentsOf("suchdol")), ["raborsch", "malesov"]);
    assert.deepEqual(plain(w.api.opponentsOf("raborsch")), ["suchdol"], "a war has two ends: the town it was declared against is at war too");
    assert.equal(w.api.isAtWar("malesov"), true);
    assert.equal(w.api.isAtWar("wysoka"), false, "his own land is not at war because he is");
    assert.equal(toldAll(w.chats, "[Guerra] Suchdol declarou guerra a Raborsch e Malešov."), 4, "all four players online were told in the chat");
    assert.equal(w.notifies.filter((entry) => entry.event === "kcdc-gamemode:notify" && entry.payload.text === "[Guerra] Suchdol declarou guerra a Raborsch e Malešov.").length, 4, "and on the game's notification line");
    assert.deepEqual(w.writes.at(-1), { v: 1, wars: [{ a: "suchdol", b: "raborsch", since: 5000, by: "Erik" }, { a: "suchdol", b: "malesov", since: 5000, by: "Erik" }] });
});

test("the list is the whole truth: a town left out ends its war, an empty list is peace, and nothing changed is said so", () => {
    const w = load();
    w.api.setWars(w.who(ERIK), "suchdol", "raborsch,malesov", 5000);
    w.chats.length = 0;
    const stop = w.api.setWars(w.who(ERIK), "suchdol", "raborsch", 6000);
    assert.equal(stop.ok, true);
    assert.deepEqual(plain(w.api.opponentsOf("suchdol")), ["raborsch"]);
    assert.equal(w.api.isAtWar("malesov"), false);
    assert.equal(toldAll(w.chats, "[Guerra] A guerra entre Suchdol e Malešov terminou."), 4);
    assert.equal(w.writes.at(-1).wars.length, 1, "the war that ended is off the file");

    const same = w.api.setWars(w.who(ERIK), "suchdol", "raborsch");
    assert.equal(same.ok, false);
    assert.match(same.message, /Suchdol já está em guerra com Raborsch: nada mudou\./);

    // The war may begin and end in one form.
    w.chats.length = 0;
    const swap = w.api.setWars(w.who(ERIK), "suchdol", ["malesov"], 7000);
    assert.equal(swap.ok, true);
    assert.deepEqual(plain(w.api.opponentsOf("suchdol")), ["malesov"]);
    assert.equal(w.chats.length, 8, "one announcement for the war begun and one for the war ended, to four players each");

    const peace = w.api.setWars(w.who(ERIK), "suchdol", "");
    assert.equal(peace.ok, true);
    assert.equal(peace.message, "Suchdol está em paz: nenhuma guerra marcada.");
    assert.equal(w.api.allWars().length, 0);
    assert.equal(w.api.setWars(w.who(ERIK), "suchdol", "").ok, false, "at peace already");
});

test("who marks a war: only the lord of the town's lands or an administrator, never against a town that does not exist or against his own lands; either lord may end it", () => {
    const w = load();
    assert.match(w.api.setWars(w.who(HANS), "suchdol", "raborsch").message, /Só o senhor das terras de Suchdol marca a guerra\./);
    assert.match(w.api.setWars(w.who(ERIK), "narnia", "raborsch").message, /Essa cidade não existe\./);
    assert.match(w.api.setWars(w.who(ERIK), "suchdol", "raborsch,narnia").message, /Essa cidade não existe\./);
    assert.match(w.api.setWars(w.who(ERIK), "suchdol", "suchdol").message, /Essa cidade não existe\./, "a town is not at war with itself");
    assert.match(w.api.setWars(w.who(ERIK), "suchdol", "wysoka").message, /Você não faz guerra às suas próprias terras: Wysoka\./);
    assert.match(w.api.setWars(w.who(ILSE), "raborsch", "bohunowitz").message, /Você não faz guerra às suas próprias terras: Bohunowitz\./, "a land that follows his seat is his own");
    assert.equal(w.api.allWars().length, 0, "nothing was begun");
    assert.equal(w.writes.length, 0);

    // The lord of a seat marks the war of its land (as he closes its citizenship); an administrator marks any town, even one nobody rules.
    assert.equal(w.api.setWars(w.who(ERIK), "wysoka", "raborsch").ok, true);
    assert.equal(w.api.setWars(w.who(ADMIN), "malesov", "suchdol").ok, true);
    assert.deepEqual(plain(w.api.opponentsOf("suchdol")), ["malesov"]);

    // The lord of the town it is declared against ends it as well: it is a matter of word between them.
    assert.equal(w.api.setWars(w.who(ILSE), "raborsch", "").ok, true);
    assert.equal(w.api.isAtWar("wysoka"), false);
});

test("the page is told every war, and a lord what each of his towns may do: the towns it may mark (not his own lands) and the lords it may hand its lands to", () => {
    const w = load();
    const payload = (steamId) => plain(w.payloads[0](w.who(steamId)).wars);
    assert.deepEqual(payload(ERIK).links, []);
    assert.deepEqual(Object.keys(payload(ERIK).command), ["suchdol", "wysoka"], "the towns he rules");
    assert.deepEqual(payload(ERIK).command.suchdol, { targets: ["raborsch", "bohunowitz", "malesov"], surrender: [] });
    assert.deepEqual(Object.keys(payload(ILSE).command), ["raborsch", "bohunowitz"], "a land that follows his seat's lord is his");
    assert.deepEqual(payload(HANS).command, {}, "a citizen has nothing to command");
    assert.deepEqual(Object.keys(payload(ADMIN).command), ["suchdol", "wysoka", "raborsch", "bohunowitz", "malesov"], "an administrator commands every town");

    w.api.setWars(w.who(ERIK), "suchdol", "raborsch,malesov", 5000);
    assert.deepEqual(payload(HANS).links, [{ a: "suchdol", b: "raborsch", since: 5000 }, { a: "suchdol", b: "malesov", since: 5000 }], "everybody sees who is at war; never who declared it");
    assert.deepEqual(payload(ERIK).command.suchdol.surrender, [{ town: "raborsch", lord: "Ilse" }], "Malešov has no lord to receive the lands");
    assert.deepEqual(payload(ILSE).command.raborsch.surrender, [{ town: "suchdol", lord: "Erik" }]);
    assert.deepEqual(payload(ERIK).command.wysoka.surrender, [], "Wysoka is at no war");
});

test("a lord who lost hands the lands to the lord of the town he is at war with: the title is lifted off him and given to the winner, the war between the two ends, and everybody is told", () => {
    const w = load();
    w.api.setWars(w.who(ERIK), "suchdol", "raborsch,malesov", 5000);
    w.chats.length = 0;
    const done = w.api.surrender(w.who(ERIK), "suchdol", "raborsch");
    assert.equal(done.ok, true);
    assert.match(done.message, /Você entregou Suchdol ao senhor de Raborsch/);
    assert.deepEqual(plain(w.releases), ["Suchdol"], "what was his in the region goes back to nobody first");
    assert.deepEqual(plain(w.ceded), [{ region: "Suchdol", lord: { steamId: ILSE, name: "Ilse" }, by: "guerra (Raborsch)" }]);
    assert.equal(w.lords.Suchdol.steamId, ILSE);
    assert.equal(w.api.linkOf("suchdol", "raborsch"), null, "the war between the two is over");
    assert.equal(w.api.isAtWar("suchdol"), false, "what the old lord declared from the town is off the books: the new lord begins his own");
    assert.equal(w.api.isAtWar("malesov"), false);
    assert.equal(toldAll(w.chats, "[Guerra] O senhor de Suchdol perdeu a guerra e entregou as suas terras ao senhor de Raborsch: Suchdol agora é governada de lá."), 4);
    assert.deepEqual(w.notices.find(([to]) => to === ILSE), [ILSE, "Suchdol foi entregue a você pelo senhor de lá: 4 propriedades (e 2 baús) passaram para você."], "the winner is told, in the panel");
    assert.ok(w.socials.includes(ILSE), "and his page is refreshed");
    // Wysoka was ceded to him on its own: it stays his.
    assert.equal(w.lords.Wysoka.steamId, ERIK);
});

test("the lands are handed only to the lord of a town at war with them, by their own lord, and only if there is a lord to receive them; a land that follows its seat has no title to lift", () => {
    const w = load();
    const erik = w.who(ERIK);
    assert.match(w.api.surrender(erik, "suchdol", "raborsch").message, /Suchdol não está em guerra com Raborsch: só se entregam terras a quem se está em guerra\./);
    assert.match(w.api.surrender(w.who(HANS), "suchdol", "raborsch").message, /Só o senhor das terras de Suchdol entrega as terras\./);
    assert.match(w.api.surrender(erik, "suchdol", "narnia").message, /Essa cidade não existe\./);
    assert.match(w.api.surrender(erik, "suchdol", "suchdol").message, /Essa cidade não existe\./);
    w.api.setWars(erik, "suchdol", "malesov");
    assert.match(w.api.surrender(erik, "suchdol", "malesov").message, /Malešov não tem senhor para receber as terras\./);
    assert.equal(w.ceded.length, 0);

    // The lord of Raborsch rules Bohunowitz through his seat: handed to the lord of Suchdol, no title of its own is lifted and the region is given.
    w.api.setWars(w.who(ILSE), "bohunowitz", "suchdol");
    const land = w.api.surrender(w.who(ILSE), "bohunowitz", "suchdol");
    assert.equal(land.ok, true);
    assert.deepEqual(plain(w.releases), [], "Bohunowitz had no lord of its own");
    assert.deepEqual(plain(w.ceded), [{ region: "Bohunowitz", lord: { steamId: ERIK, name: "Erik" }, by: "guerra (Suchdol)" }]);
    assert.equal(w.api.isAtWar("bohunowitz"), false);

    // An administrator hands them for the lord, when there is a war to end.
    const admin = load();
    admin.api.setWars(admin.who(ADMIN), "suchdol", "raborsch");
    assert.equal(admin.api.surrender(admin.who(ADMIN), "suchdol", "raborsch").ok, true);
    assert.equal(admin.lords.Suchdol.steamId, ILSE);
});

test("the lord of a seat does not give away a land that was ceded to somebody else: it is that one's to hand over", () => {
    const w = load({ lords: { Suchdol: { steamId: ERIK, name: "Erik" }, Wysoka: { steamId: HANS, name: "Hans" }, Raborsch: { steamId: ILSE, name: "Ilse" } } });
    assert.equal(w.api.setWars(w.who(ERIK), "wysoka", "raborsch").ok, true, "he may mark it, as he closes its citizenship");
    const refused = w.api.surrender(w.who(ERIK), "wysoka", "raborsch");
    assert.equal(refused.ok, false);
    assert.match(refused.message, /Só o senhor de Wysoka entrega as suas terras\./);
    assert.equal(w.ceded.length, 0);
    assert.deepEqual(w.payloads[0](w.who(ERIK)).wars.command.wysoka.surrender.length, 0, "and the page does not offer it to him");
    assert.equal(w.api.surrender(w.who(HANS), "wysoka", "raborsch").ok, true, "its own lord hands it");
});

test("two towns that come to have one and the same lord are not at war any more, whoever ceded the region (an administrator's cession, a surrender)", () => {
    const w = load();
    w.api.setWars(w.who(ERIK), "suchdol", "raborsch");
    assert.equal(w.api.isAtWar("raborsch"), true);
    w.cede("Suchdol", { steamId: ILSE, name: "Ilse" });
    assert.equal(w.api.isAtWar("raborsch"), false, "Suchdol and Raborsch have one lord now");
    assert.equal(w.api.allWars().length, 0);
    assert.equal(w.writes.at(-1).wars.length, 0);
});

test("a citizen of a town at war is reminded at the entry, once the welcome is over; one at peace, or with no citizenship, is told nothing", () => {
    const w = load();
    assert.equal(w.ready.length, 1);
    w.api.setWars(w.who(ERIK), "suchdol", "raborsch,malesov", 5000);
    w.chats.length = 0;
    w.ready[0](w.who(HANS));
    w.ready[0](w.who(ILSE));
    assert.equal(w.timers.length, 2);
    assert.ok(w.timers.every((timer) => timer.ms >= 20000), "after the welcome and the creator");
    for (const timer of w.timers) timer.fn();
    assert.deepEqual(plain(w.chats), [[HANS, "[Guerra] Sua cidade, Suchdol, está em guerra com Raborsch e Malešov."]], "Ilse has no citizenship in this realm of two");
    // At peace: nothing.
    w.api.setWars(w.who(ERIK), "suchdol", "");
    w.chats.length = 0;
    w.timers.length = 0;
    w.ready[0](w.who(HANS));
    w.timers[0].fn();
    assert.deepEqual(plain(w.chats), []);
    // Not ready any more: nothing either.
    w.api.setWars(w.who(ERIK), "suchdol", "raborsch");
    w.chats.length = 0;
    w.timers.length = 0;
    const gone = { ...w.who(HANS), ready: false };
    w.ready[0](gone);
    w.timers[0].fn();
    assert.deepEqual(plain(w.chats), []);
});

test("the wars are read again at the next start: a war between towns the realm has is kept, one against a town it does not have, with itself or twice is dropped; a corrupt file is left alone", () => {
    const saved = { v: 1, wars: [{ a: "suchdol", b: "raborsch", since: 7, by: "Erik" }, { a: "raborsch", b: "suchdol", since: 9, by: "Ilse" }, { a: "suchdol", b: "narnia", since: 1, by: "x" }, { a: "malesov", b: "malesov", since: 1, by: "x" }, { a: "malesov", b: "wysoka" }, "junk"] };
    const w = load({ saved });
    assert.deepEqual(plain(w.api.allWars()), [{ a: "suchdol", b: "raborsch", since: 7, by: "Erik" }, { a: "malesov", b: "wysoka", since: 0, by: "" }]);

    const broken = load({ corrupt: true });
    assert.equal(broken.api.setWars(broken.who(ERIK), "suchdol", "raborsch").ok, true, "the war works in memory");
    assert.equal(broken.writes.length, 0, "but a file that cannot be read is not written over");
});

test("the client may ask for a war to be marked or for the lands to be handed over, and the answer is the panel's notice and a fresh page", () => {
    const w = load();
    w.handlers.get("kcdc-gamemode:status.warSet")(w.who(ERIK), JSON.stringify({ town: "suchdol", against: "raborsch" }));
    assert.deepEqual(plain(w.api.opponentsOf("suchdol")), ["raborsch"]);
    assert.deepEqual(w.notices.at(-1), [ERIK, "Suchdol está em guerra com Raborsch."]);
    w.handlers.get("kcdc-gamemode:status.warSurrender")(w.who(ERIK), JSON.stringify({ town: "suchdol", to: "raborsch" }));
    assert.equal(w.lords.Suchdol.steamId, ILSE);
    assert.ok(w.socials.filter((steamId) => steamId === ERIK).length >= 2);
    // A payload that is not an object, or is too long, is nothing.
    w.handlers.get("kcdc-gamemode:status.warSet")(w.who(ERIK), "not json");
    assert.match(w.notices.at(-1)[1], /Essa cidade não existe\./);
});
