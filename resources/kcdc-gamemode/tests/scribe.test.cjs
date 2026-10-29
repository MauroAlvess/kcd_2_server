// The Escrivão section (src/server/scribe.ts): who hands out the guilds, to whom, and how, over the real nobility catalog and a fake game (2026-10-29).
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const ADMIN = "76561198000000001";
const SCRIBE = "76561198000000002";
const MASTER = "76561198000000003";
const SOLDIER = "76561198000000004";
const LORD = "76561198000000005";
const HANS = "76561198000000006";
const KAT = "76561198000000007";
const DOROTA = "76561198000000008";
const RAB = "76561198000000009";
const NONE = "76561198000000010";

const GUILD_IDS = ["fabri-ferrarii", "venatores", "tabernarii", "alchemistae", "artifices", "collectores", "agricolae", "domitores"];
const TOWNS = [
    { id: "suchdol", name: "Suchdol", seat: null },
    { id: "wysoka", name: "Wysoka", seat: "suchdol" },
    { id: "opatowitz", name: "Opatowitz", seat: "suchdol" },
    { id: "raborsch", name: "Raborsch", seat: null },
    { id: "horschan", name: "Horschan", seat: "raborsch" },
];

function fakeDisk() {
    const files = new Map();
    return {
        files,
        fs: {
            readFileSync(file) { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function load({ saved = null, disk = fakeDisk() } = {}) {
    if (saved !== null) disk.files.set("playerdata/guild-grants.json", typeof saved === "string" ? saved : JSON.stringify(saved));
    const store = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(dist("store.js"), store);
    const nobility = { exports: {} };
    vm.runInNewContext(dist("nobility.js"), nobility);

    const admins = [ADMIN];
    const titles = { [SCRIBE]: ["escrivao"], [MASTER]: ["mestre-oficio"], [SOLDIER]: ["soldado"], [LORD]: [] };
    // Who is a citizen of what, and who has which guild.
    const citizens = { [SCRIBE]: "wysoka", [MASTER]: "suchdol", [SOLDIER]: "suchdol", [HANS]: "suchdol", [KAT]: "wysoka", [DOROTA]: "opatowitz", [RAB]: "raborsch", [LORD]: "raborsch" };
    const guilds = {};
    const names = { [SCRIBE]: "Escriba", [MASTER]: "Mestre", [SOLDIER]: "Soldado", [LORD]: "Lord", [HANS]: "Hans", [KAT]: "Kateřina", [DOROTA]: "Dorota", [RAB]: "Rabsch", [NONE]: "Ninguém" };
    const lords = { raborsch: LORD, horschan: LORD };
    const players = [];
    const handlers = new Map();
    const payloads = [];
    const notices = [];
    const socials = [];
    const kits = [];
    const logs = [];

    const townById = (id) => TOWNS.find((town) => town.id === id) ?? null;
    const status = {
        GUILDS: GUILD_IDS.map((id) => ({ id, nameLatin: id.toUpperCase(), profession: `Ofício ${id}`, crest: `${id}.webp`, description: "" })),
        getGuildId: (steamId) => guilds[steamId] ?? null,
        setGuildId: (steamId, guildId) => { if (!GUILD_IDS.includes(guildId)) return false; guilds[steamId] = guildId; return true; },
        clearGuildId: (steamId) => { if (guilds[steamId] === undefined) return false; delete guilds[steamId]; return true; },
        listGuildMembers: (guildId) => Object.entries(guilds).filter(([, id]) => id === guildId).map(([steamId]) => steamId),
        addPayload: (fn) => payloads.push(fn),
        notice: (player, text) => notices.push([player.steamId, text]),
        sendSocial: (player) => socials.push(player.steamId),
    };
    const sandbox = {
        exports: {},
        require: (id) => {
            switch (id) {
                case "./auth.js": return { isAdmin: (player) => admins.includes(player.steamId) };
                case "./citizenship.js": return {
                    TOWNS,
                    citizensOf: (town) => Object.entries(citizens).filter(([, id]) => id === town.id).map(([steamId]) => steamId),
                    keyOf: (steamId) => `k${steamId.slice(-2)}`,
                    landsOf: (town) => TOWNS.filter((other) => other.seat === town.id),
                    seatOf: (town) => (town.seat === null ? null : townById(town.seat)),
                    lordOfTown: (town) => (lords[town.id] === undefined ? null : { steamId: lords[town.id], name: names[lords[town.id]] }),
                    townOf: (steamId) => (citizens[steamId] === undefined ? null : townById(citizens[steamId])),
                };
                case "./guild-members.js": return { nameOfMember: (steamId) => names[steamId] ?? "um jogador" };
                case "./kits.js": return { grantGuildKit: (player, guildId) => { kits.push([player.steamId, guildId]); return ["machado"]; }, guildKitHint: () => "Dica do kit." };
                case "./nobility.js": return nobility.exports;
                case "./status.js": return status;
                case "./store.js": return store.exports;
                case "./titles.js": return { titlesOf: (steamId) => titles[steamId] ?? [] };
                default: return assert.fail(`unexpected require ${id}`);
            }
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date,
        Events: { onClient: (name, fn) => handlers.set(name, fn), on: () => undefined },
        Player: { all: () => players },
    };
    vm.runInNewContext(dist("scribe.js"), sandbox);
    const spawn = (steamId, nickname = names[steamId] ?? "x") => {
        const player = { id: players.length + 1, steamId, nickname, ready: true, emitted: [], emit(event, payload) { this.emitted.push({ event, payload: JSON.parse(payload) }); } };
        players.push(player);
        return player;
    };
    return { api: sandbox.exports, disk, titles, citizens, guilds, lords, admins, spawn, handlers, payloads, notices, socials, kits, logs };
}

test("the section is for a clerk, the masters of a trade, the town's officers, a lord of lands and the staff; a soldier and a commoner have none", () => {
    const sut = load();
    assert.equal(sut.api.mayGrant(sut.spawn(SCRIBE)), true);
    assert.equal(sut.api.mayGrant(sut.spawn(MASTER)), true);
    assert.equal(sut.api.mayGrant(sut.spawn(LORD)), true, "a lord of lands, with no title");
    assert.equal(sut.api.mayGrant(sut.spawn(ADMIN)), true);
    assert.equal(sut.api.mayGrant(sut.spawn(SOLDIER)), false);
    assert.equal(sut.api.mayGrant(sut.spawn(HANS)), false);
    assert.equal(sut.api.mayGrant(sut.spawn("")), false);
    sut.titles[HANS] = ["burgomestre"];
    assert.equal(sut.api.mayGrant(sut.spawn(HANS, "H")), true, "an officer of the town");
});

test("whose guild they hand out: their own house (the town, its seat and its lands), the lands a lord rules, everybody for the staff; nobody for a clerk with no citizenship", () => {
    const sut = load();
    const ids = (player) => plain(sut.api.scopeOf(player).map((town) => town.id));
    assert.deepEqual(ids(sut.spawn(SCRIBE)), ["suchdol", "wysoka", "opatowitz"], "a citizen of Wysoka sees all of Suchdol's house");
    assert.deepEqual(ids(sut.spawn(MASTER)), ["suchdol", "wysoka", "opatowitz"]);
    assert.deepEqual(ids(sut.spawn(LORD)), ["raborsch", "horschan"], "the lands he rules, and his own house");
    assert.deepEqual(ids(sut.spawn(ADMIN)), ["suchdol", "wysoka", "opatowitz", "raborsch", "horschan"]);
    delete sut.citizens[SCRIBE];
    assert.deepEqual(ids(sut.spawn(SCRIBE, "S2")), []);
});

test("which guilds: any of the eight for a clerk, a lord and the staff; for a master only the one they belong to, and none while they have none", () => {
    const sut = load();
    assert.equal(sut.api.guildsOf(sut.spawn(SCRIBE)).length, 8);
    assert.equal(sut.api.guildsOf(sut.spawn(ADMIN)).length, 8);
    assert.equal(sut.api.guildsOf(sut.spawn(LORD)).length, 8);
    const master = sut.spawn(MASTER);
    assert.deepEqual(plain(sut.api.guildsOf(master)), [], "a master with no guild hands none");
    sut.guilds[MASTER] = "venatores";
    assert.deepEqual(plain(sut.api.guildsOf(master)), ["venatores"]);
    sut.titles[MASTER] = ["mestre-oficio", "escrivao"];
    assert.equal(sut.api.guildsOf(master).length, 8, "a master who is also a clerk hands any");
    assert.deepEqual(plain(sut.api.guildsOf(sut.spawn(SOLDIER))), []);
});

test("the list: the citizens of the scope by name, their town and guild, filtered by guild and by land and by a name typed, ten to a page, with how many are where", () => {
    const sut = load();
    for (let n = 0; n < 12; n += 1) {
        sut.citizens[`7656119800000010${String(n).padStart(2, "0")}`] = n % 2 === 0 ? "suchdol" : "opatowitz";
    }
    sut.guilds[HANS] = "venatores";
    sut.guilds[KAT] = "venatores";
    sut.guilds[DOROTA] = "tabernarii";
    const scribe = sut.spawn(SCRIBE);
    const all = sut.api.pageFor(scribe, {});
    assert.equal(all.total, 6 + 12, "the clerk, the master, the soldier, Hans, Kateřina and Dorota, and twelve more: all of Suchdol's house, none of Raborsch's");
    assert.equal(all.pages, 2);
    assert.equal(all.entries.length, 10);
    assert.deepEqual(plain(all.towns.map((town) => town.id)), ["suchdol", "wysoka", "opatowitz"]);
    assert.ok(!JSON.stringify(all).includes("76561198"), "no Steam id goes to the page");
    const hans = all.entries.find((entry) => entry.name === "Hans");
    assert.deepEqual(plain({ ...hans, key: "k" }), { key: "k", name: "Hans", town: "suchdol", townName: "Suchdol", guild: "venatores", by: "", you: false });

    assert.deepEqual(plain(sut.api.pageFor(scribe, { guild: "venatores" }).entries.map((entry) => entry.name)).sort(), ["Hans", "Kateřina"]);
    assert.equal(sut.api.pageFor(scribe, { guild: "none" }).total, all.total - 3);
    assert.deepEqual(plain(sut.api.pageFor(scribe, { town: "opatowitz", guild: "tabernarii" }).entries.map((entry) => entry.name)), ["Dorota"]);
    assert.deepEqual(plain(sut.api.pageFor(scribe, { search: "KATERINA" }).entries.map((entry) => entry.name)), ["Kateřina"], "no case, no accents");
    assert.equal(sut.api.pageFor(scribe, { town: "raborsch" }).town, "", "a land outside the scope is not a filter");
    assert.equal(sut.api.pageFor(scribe, { guild: "nao-existe" }).guild, "");
    assert.equal(sut.api.pageFor(scribe, { page: 1 }).entries.length, 8);
    assert.equal(sut.api.pageFor(scribe, { page: 99 }).page, 1);
    assert.equal(sut.api.pageFor(scribe, {}).counts.venatores, 2);
    assert.equal(all.towns.find((town) => town.id === "suchdol").guilded, 1, "how many of Suchdol's have a guild");
    assert.equal(sut.api.pageFor(sut.spawn(SOLDIER), {}), null, "no power, no page");
});

test("handing a guild: the citizen is set in it, told, given the kit, and the hand is written down; the guild they had is replaced", () => {
    const sut = load();
    const scribe = sut.spawn(SCRIBE, "Escriba");
    const hans = sut.spawn(HANS, "Hans");
    const done = sut.api.grant(scribe, "k06", "venatores");
    assert.equal(done.ok, true);
    assert.match(done.message, /Hans agora é Ofício venatores \(VENATORES\)/);
    assert.equal(sut.guilds[HANS], "venatores");
    assert.deepEqual(plain(sut.kits), [[HANS, "venatores"]]);
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /Escriba cedeu a você a guilda VENATORES/.test(text)));
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /Kit da guilda entregue: machado/.test(text)));
    assert.ok(sut.socials.includes(HANS));
    const saved = JSON.parse(sut.disk.files.get("playerdata/guild-grants.json"));
    assert.equal(saved.grants[HANS].by, SCRIBE);
    assert.equal(sut.api.grantOf(HANS).byName, "Escriba");

    assert.match(sut.api.grant(scribe, "k06", "venatores").message, /já faz parte/);
    assert.equal(sut.api.grant(scribe, "k06", "tabernarii").ok, true, "replaced");
    assert.equal(sut.guilds[HANS], "tabernarii");
    assert.equal(hans.emitted.length, 0);

    sut.guilds[HANS] = "agricolae";
    assert.equal(sut.api.grantOf(HANS), null, "a guild changed by another hand is no longer the scribe's");
});

test("handing a guild is refused to a citizen of other lands, to oneself, for a guild a master has not, and by somebody with no power; and a citizen who is away gets the kit at the next entry", () => {
    const sut = load();
    const scribe = sut.spawn(SCRIBE);
    assert.match(sut.api.grant(scribe, "k09", "venatores").message, /não é cidadã de nenhuma das terras que você atende/, "Raborsch's is not his house");
    assert.match(sut.api.grant(scribe, "zzz", "venatores").message, /não é cidadã/);
    assert.match(sut.api.grant(scribe, 5, "venatores").message, /não é cidadã/);
    assert.match(sut.api.grant(scribe, "k02", "venatores").message, /Ninguém cede uma guilda a si mesmo/);
    assert.match(sut.api.grant(scribe, "k06", "inventada").message, /Essa guilda não existe/);
    assert.match(sut.api.grant(sut.spawn(SOLDIER), "k06", "venatores").message, /Só um escrivão/);

    const master = sut.spawn(MASTER);
    sut.guilds[MASTER] = "fabri-ferrarii";
    assert.match(sut.api.grant(master, "k06", "venatores").message, /um mestre cede só a sua/);
    assert.equal(sut.api.grant(master, "k06", "fabri-ferrarii").ok, true, "his own");

    const admin = sut.spawn(ADMIN);
    assert.equal(sut.api.grant(admin, "k09", "domitores").ok, true, "the staff hands to anybody in any land");
    assert.equal(sut.guilds[HANS], "fabri-ferrarii");
    assert.ok(sut.kits.every(([steamId]) => steamId !== HANS), "Hans is not in the game: the kit waits for his next entry (index.ts offers the kit of the guild he belongs to)");
    // A master does not take another trade's member out of it.
    sut.guilds[KAT] = "tabernarii";
    assert.match(sut.api.grant(master, "k07", "fabri-ferrarii").message, /que o seu cargo não retira/);
});

test("taking a guild off: a clerk takes any, a master only theirs, and a citizen with none is told so", () => {
    const sut = load();
    const scribe = sut.spawn(SCRIBE);
    const hans = sut.spawn(HANS, "Hans");
    sut.guilds[HANS] = "venatores";
    sut.guilds[KAT] = "fabri-ferrarii";
    sut.api.grant(scribe, "k06", "venatores");

    const master = sut.spawn(MASTER);
    sut.guilds[MASTER] = "fabri-ferrarii";
    assert.match(sut.api.retire(master, "k06").message, /retira só a sua/, "not another trade's");
    assert.equal(sut.api.retire(master, "k07").ok, true, "his own trade's member");
    assert.equal(sut.guilds[KAT], undefined);

    const done = sut.api.retire(scribe, "k06");
    assert.equal(done.ok, true);
    assert.match(done.message, /Hans deixou de ser Ofício venatores/);
    assert.equal(sut.guilds[HANS], undefined);
    assert.equal(sut.api.grantOf(HANS), null);
    assert.ok(sut.notices.some(([to, text]) => to === HANS && /retirou de você a guilda VENATORES/.test(text)));
    assert.ok(hans.ready);
    assert.match(sut.api.retire(scribe, "k06").message, /não tem guilda/);
    assert.match(sut.api.retire(sut.spawn(SOLDIER), "k06").message, /Só um escrivão/);
    assert.match(sut.api.retire(scribe, "k09").message, /não é cidadã/);
});

test("the panel is told whether the section is theirs, which guilds they hand out and the lands they look at", () => {
    const sut = load();
    sut.api.installScribe();
    const payload = (player) => plain(sut.payloads[0](player));
    assert.deepEqual(payload(sut.spawn(HANS)), { scribe: { visible: false } });
    const scribe = payload(sut.spawn(SCRIBE));
    assert.equal(scribe.scribe.visible, true);
    assert.equal(scribe.scribe.guilds.length, 8);
    assert.equal(scribe.scribe.own, false);
    assert.deepEqual(scribe.scribe.towns.map((town) => town.id), ["suchdol", "wysoka", "opatowitz"]);
    sut.guilds[MASTER] = "venatores";
    const master = payload(sut.spawn(MASTER));
    assert.deepEqual(master.scribe.guilds, ["venatores"]);
    assert.equal(master.scribe.own, true, "the page says a master hands only their own");
});

test("the events: the list on a request, and after a grant or a take-off the list comes back as it was filtered", () => {
    const sut = load();
    sut.api.installScribe();
    const scribe = sut.spawn(SCRIBE, "Escriba");
    sut.spawn(HANS, "Hans");
    sut.handlers.get("kcdc-gamemode:status.scribe")(scribe, JSON.stringify({ guild: "none", town: "suchdol" }));
    const first = scribe.emitted.at(-1);
    assert.equal(first.event, "kcdc-gamemode:status.scribe");
    assert.equal(first.payload.guild, "none");
    assert.equal(first.payload.town, "suchdol");
    assert.ok(first.payload.entries.some((entry) => entry.name === "Hans"));

    sut.handlers.get("kcdc-gamemode:status.scribeGrant")(scribe, JSON.stringify({ key: "k06", guild: "venatores", fguild: "none", ftown: "suchdol" }));
    assert.equal(sut.guilds[HANS], "venatores");
    const after = scribe.emitted.at(-1).payload;
    assert.equal(after.guild, "none");
    assert.ok(!after.entries.some((entry) => entry.name === "Hans"), "he has a guild now: not in the list of those with none");
    assert.ok(sut.notices.some(([to, text]) => to === SCRIBE && /Hans agora é/.test(text)));

    sut.handlers.get("kcdc-gamemode:status.scribeRevoke")(scribe, JSON.stringify({ key: "k06", fguild: "none" }));
    assert.equal(sut.guilds[HANS], undefined);
    assert.ok(scribe.emitted.at(-1).payload.entries.some((entry) => entry.name === "Hans"));

    const soldier = sut.spawn(SOLDIER);
    sut.handlers.get("kcdc-gamemode:status.scribe")(soldier, "{}");
    assert.equal(soldier.emitted.length, 0, "nothing for a player with no power");
    sut.handlers.get("kcdc-gamemode:status.scribe")(scribe, "{");
    sut.handlers.get("kcdc-gamemode:status.scribeGrant")(scribe, null);
});

test("the tradesmen are everybody with a guild, with the land they are citizens of and who handed it; the grants are read back at the start, and a file that cannot be read is left alone", () => {
    const sut = load({ saved: { v: 1, grants: { [HANS]: { guild: "venatores", by: SCRIBE, byName: "Escriba", at: 5 }, "": { guild: "x" }, [KAT]: { guild: 5 } } } });
    sut.api.installScribe();
    sut.guilds[HANS] = "venatores";
    sut.guilds[DOROTA] = "tabernarii";
    assert.deepEqual(plain(sut.api.tradesmen().map((one) => [one.steamId, one.guild, one.town, one.by])).sort(), [[HANS, "venatores", "suchdol", SCRIBE], [DOROTA, "tabernarii", "opatowitz", ""]]);

    const disk = fakeDisk();
    disk.files.set("playerdata/guild-grants.json", "x");
    const broken = load({ disk });
    broken.api.installScribe();
    assert.ok(broken.logs.some((line) => /está ilegível e foi deixado como está/.test(line)));
    const scribe = broken.spawn(SCRIBE);
    broken.spawn(HANS);
    broken.api.grant(scribe, "k06", "venatores");
    assert.equal(disk.files.get("playerdata/guild-grants.json"), "x", "nothing is written over it");
});
