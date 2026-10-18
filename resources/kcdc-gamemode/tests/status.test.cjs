const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** Every player a test has made since the last load(), for Player.all / Player.getById. */
const online = [];
let nextId = 1;

/** roles maps steamId -> "player" | "admin"; anyone not listed is a player, matching auth.ts's own default. */
function load(roles = {}, catalog = [], characters = {}, seed = {}) {
    online.length = 0;
    const grants = [];
    const edits = [];
    const labels = {};
    /** What the world says of a door or chest's lock right now; unknown when left out. */
    const worldLocks = {};
    const kitCalls = [];
    const kit = { handed: [], colours: [] };
    const benefits = [];
    const supporterSummaries = {};
    /** The language each Steam id chose; Portuguese for the rest. */
    const languages = {};
    /** The ids of the titles each Steam id holds, and the one each chose to wear. */
    const titles = {};
    const shown = {};
    /** The doors and chests whose lock in the world is the level's own, not this server's. */
    const levelLocks = new Set();
    const handlers = new Map();
    const chat = [];
    const files = new Map(Object.entries(seed));
    const fakeFs = {
        readFileSync(file) {
            if (!files.has(file)) throw new Error("ENOENT");
            return files.get(file);
        },
        writeFileSync(file, data) { files.set(file, data); },
        mkdirSync() {},
    };
    // The real compiled family module, sharing this test's fake disk, so an event can be followed
    // from the handler to the file and back into the payload.
    let family = null;
    const familyModule = () => {
        if (!family) {
            const sandbox = { exports: {}, require: (id) => { assert.equal(id, "node:fs"); return fakeFs; } };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/family.js"), "utf8"), sandbox);
            family = sandbox.exports;
        }
        return family;
    };
    // The real name rules: pure, so there is nothing to fake.
    let characterNames = null;
    const characterNameModule = () => {
        if (!characterNames) {
            const sandbox = { exports: {} };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-name.js"), "utf8"), sandbox);
            characterNames = sandbox.exports;
        }
        return characterNames;
    };
    // The real compiled catalog and rules: pure, so there is nothing to fake.
    let nobility = null;
    const nobilityModule = () => {
        if (!nobility) {
            const sandbox = { exports: {} };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/nobility.js"), "utf8"), sandbox);
            nobility = sandbox.exports;
        }
        return nobility;
    };
    // The real roster rules (reading a request, searching, cutting a page): pure.
    let rosterRules = null;
    const rosterModule = () => {
        if (!rosterRules) {
            const sandbox = { exports: {} };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/roster.js"), "utf8"), sandbox);
            rosterRules = sandbox.exports;
        }
        return rosterRules;
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "node:fs") {
                return fakeFs;
            }
            if (id === "./roster.js") {
                return rosterModule();
            }
            if (id === "./language.js") {
                return { languageOf: (player) => languages[player.steamId] ?? "pt", translate: (text, lang) => (lang === "en" ? `[en] ${text}` : text) };
            }
            if (id === "./acquaintances.js") {
                return { nameOf: (player) => player.nickname, adminLabel: (player) => player.nickname };
            }
            if (id === "./character-name.js") {
                return characterNameModule();
            }
            if (id === "./family.js") {
                return familyModule();
            }
            if (id === "./titles.js") {
                return {
                    titlesOf: (steamId) => titles[steamId] ?? [],
                    titleLines: (steamId) => (titles[steamId] ?? []).map((titleId) => ({ id: titleId, label: titleId === "cavaleiro" ? "Cavaleiro" : titleId, kind: "blood", branch: "lesser" })),
                    shownOf: (steamId) => shown[steamId] ?? null,
                };
            }
            if (id === "./nobility.js") {
                return nobilityModule();
            }
            if (id === "./characters.js") {
                return { getCharacter: (steamId) => characters[steamId] ?? null };
            }
            if (id === "./auth.js") {
                return {
                    roleOf: (player) => roles[player.steamId] ?? "player",
                    isAdmin: (player) => roles[player.steamId] === "admin",
                };
            }
            if (id === "./properties.js") {
                const find = (propertyId) => catalog.find((property) => property.id === propertyId) ?? null;
                const done = (kind, extra) => { edits.push({ kind, ...extra }); return { ok: true, message: `${kind} ok` }; };
                return {
                    NAME_MIN: 2, NAME_MAX: 60, DESCRIPTION_MAX: 240, REGION_MIN: 2, REGION_MAX: 40, OWNER_KEY_LIMIT: 8,
                    listProperties: () => catalog,
                    propertiesOwnedBy: (steamId) => catalog.filter((property) => property.ownerSteamId === steamId),
                    getProperty: find,
                    ownerOf: (property) => (property.ownerSteamId ? { steamId: property.ownerSteamId, name: property.ownerName || "dono" } : null),
                    isOwner: (player, property) => player.steamId !== "" && property.ownerSteamId === player.steamId,
                    shortName: (property) => property.name,
                    labelFor: (guid) => labels[guid] ?? "",
                    npcOf: (property) => property.npc ?? null,
                    domainOf: (steamId) => catalog.filter((property) => property.domainOf === steamId),
                    doorLines: (property) => (property.doors ?? []).map((guid, index) => ({ name: index === 0 ? "Entrada" : `Porta ${index + 1}`, locked: property.doorShut ? property.doorShut[index] === "1" : property.locked })),
                    lockState: (property) => (property.partShut ? "part" : property.locked ? "all" : "none"),
                    lockedByUs: (guid) => (guid in worldLocks ? worldLocks[guid] === true && !levelLocks.has(guid) : null),
                    previewRegion: (region) => ({ given: catalog.filter((property) => property.region === region && !property.ownerSteamId && !property.npc && !property.parentId).length, chests: 0, npc: 0, kept: 0 }),
                    regionNamed: (query) => (catalog.some((property) => property.region === query) ? query : null),
                    cedeRegion: (giver, query, target) => { edits.push({ kind: "cede", region: query, to: target.steamId }); return { ok: true, message: `${query} agora é de ${target.nickname}`, given: 1, chests: 0, npc: 0, kept: 0 }; },
                    setDoorLocked: (propertyId, index, locked) => done("door", { id: propertyId, index, locked }),
                    propertyOfGuid: (guid) => catalog.find((property) => (property.doors ?? []).includes(guid) || property.stashGuid === guid) ?? null,
                    lockedInWorld: (guid) => (guid in worldLocks ? worldLocks[guid] : null),
                    setLocked: (propertyId, locked) => done("lock", { id: propertyId, locked }),
                    issueKey: (giver, propertyId, target, admin) => { grants.push({ steamId: giver.steamId, propertyId, admin, ...(target !== giver ? { to: target.steamId } : {}) }); return { ok: true, message: "chave dada" }; },
                    assignOwner: (giver, propertyId, target) => done("owner", { id: propertyId, to: target.steamId }),
                    clearOwner: (propertyId) => done("disown", { id: propertyId }),
                    renameProperty: (propertyId, name) => done("name", { id: propertyId, name }),
                    describeProperty: (propertyId, text) => done("description", { id: propertyId, text }),
                    setRegion: (propertyId, region) => done("region", { id: propertyId, region }),
                };
            }
            if (id === "./kits.js") {
                return {
                    grantGuildKit: (player, guildId) => { kitCalls.push({ steamId: player.steamId, guildId }); return kit.handed; },
                    grantFactionColours: (player, factionId) => { kitCalls.push({ steamId: player.steamId, factionId }); return kit.colours; },
                };
            }
            if (id === "./supporters.js") {
                return {
                    supporters: {
                        summary: (steamId) => supporterSummaries[steamId] ?? null,
                        grant: (admin, target) => {
                            benefits.push({ by: admin.steamId, to: target.steamId });
                            supporterSummaries[target.steamId] = { since: "14/10/2026", last: "14/10/2026", times: 1 };
                            return { ok: true, message: `Benefícios entregues a ${target.nickname}` };
                        },
                    },
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log() {} },
        Events: { onClient: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => chat.push(text) },
        Player: { all: () => online, getById: (id) => online.find((entry) => entry.id === id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/status.js"), "utf8"), context);
    context.exports.installStatus();
    return { api: context.exports, languages, handlers, chat, files, grants, edits, labels, worldLocks, levelLocks, kitCalls, kit, benefits, supporterSummaries, titles, shown, family: familyModule };
}

function makePlayer(steamId, nickname = `jogador-${steamId.slice(-2) || "x"}`) {
    const sent = [];
    const player = { id: nextId++, nickname, ready: true, alive: true, steamId, sent, health: 72.4, maxHealth: 100, hunger: 64.6, maxHunger: 100, appearance: { gender: "male" }, emit: (event, payload) => sent.push({ event, payload: JSON.parse(payload) }) };
    online.push(player);
    return player;
}

const POLL = "kcdc-gamemode:status.poll";
/** What the roster event answers `player` when they ask `query`: the last answer. */
function rosterOf(handlers, player, query = {}) {
    handlers.get("kcdc-gamemode:status.roster")(player, query);
    return player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.roster").at(-1).payload;
}
const SELECT = "kcdc-gamemode:status.selectGuild";
const SOCIAL = "kcdc-gamemode:status.social";

test("a new player is a Plebeius with no guild, and sees the five guilds", () => {
    const { handlers } = load();
    const player = makePlayer("76561198000000001");
    handlers.get(POLL)(player);

    assert.equal(player.sent.length, 1);
    assert.equal(player.sent[0].event, SOCIAL);
    const payload = player.sent[0].payload;
    assert.deepEqual(payload.socialStatus, { label: "Plebeius", gloss: "plebeu" });
    assert.equal(payload.guildId, null);
    assert.equal(payload.guilds.length, 5);
    assert.deepEqual(Array.from(payload.guilds, (guild) => guild.profession), ["Ferreiro", "Caçador", "Taberneiro", "Alquimista", "Artesão"]);
    for (const guild of payload.guilds) {
        for (const key of ["id", "nameLatin", "profession", "crest", "description"]) {
            assert.equal(typeof guild[key], "string", `${guild.id} has a ${key}`);
        }
        assert.match(guild.crest, /\.webp$/);
    }
});

test("selecting a guild saves it by Steam id and answers with the new state, once", () => {
    const { handlers, chat, files } = load();
    const player = makePlayer("76561198000000002");
    handlers.get(SELECT)(player, { guildId: "venatores" });

    assert.equal(player.sent.at(-1).payload.guildId, "venatores");
    assert.match(chat.at(-1), /Venatores/);
    const saved = JSON.parse(files.get("playerdata/social.json"));
    assert.equal(saved["76561198000000002"].guildId, "venatores");

    handlers.get(SELECT)(player, { guildId: "alchemistae" });
    assert.equal(JSON.parse(files.get("playerdata/social.json"))["76561198000000002"].guildId, "venatores");
    const notice = player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.notice").at(-1);
    assert.match(notice.payload.text, /Você já escolheu a guilda Venatores: a escolha é definitiva/);

    handlers.get(SELECT)(player, { guildId: "venatores" });
    const same = player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.notice").at(-1);
    assert.match(same.payload.text, /Você já faz parte de Venatores/);
});

test("an administrator's remedy: a guild taken away lets the player choose again, and the members of a guild are listed", () => {
    const { api, handlers, files } = load();
    const first = makePlayer("76561198000000011");
    const second = makePlayer("76561198000000012");
    handlers.get(SELECT)(first, { guildId: "tabernarii" });
    handlers.get(SELECT)(second, { guildId: "tabernarii" });
    assert.deepEqual(Array.from(api.listGuildMembers("tabernarii")).sort(), ["76561198000000011", "76561198000000012"]);
    assert.deepEqual(Array.from(api.listGuildMembers("venatores")), []);

    assert.equal(api.clearGuildId("76561198000000011"), true);
    assert.equal(api.clearGuildId("76561198000000011"), false, "nothing left to take");
    assert.equal(api.clearGuildId("76561198000000099"), false, "nor from a player with no record");
    assert.equal(api.getGuildId("76561198000000011"), null);
    assert.deepEqual(Array.from(api.listGuildMembers("tabernarii")), ["76561198000000012"]);

    handlers.get(SELECT)(first, { guildId: "alchemistae" });
    assert.equal(api.getGuildId("76561198000000011"), "alchemistae", "free to choose again");
    assert.equal(JSON.parse(files.get("playerdata/social.json"))["76561198000000012"].guildId, "tabernarii", "the other is untouched");
});

test("the tailors' guild is gone: it cannot be chosen, and a saved choice of it reads as no guild", () => {
    const { handlers, files, chat } = load();
    const player = makePlayer("76561198000000091");
    handlers.get(SELECT)(player, { guildId: "sartores" });
    assert.equal(player.sent.length, 0, "refused");
    assert.match(chat.at(-1), /não pode ser selecionada/);

    files.set("playerdata/social.json", JSON.stringify({ "76561198000000092": { socialStatus: "plebeius", guildId: "sartores", factionId: null, showcase: "guild", updatedAt: 1 } }));
    const older = makePlayer("76561198000000092");
    handlers.get(POLL)(older);
    assert.equal(older.sent[0].payload.guildId, null);
});

test("joining a guild brings its kit once, announced on the panel, and a second guild cannot be joined", () => {
    const { handlers, kitCalls, kit } = load();
    const player = makePlayer("76561198000000093");

    kit.handed = ["10 sucata de metal", "aço"];
    handlers.get(SELECT)(player, { guildId: "fabri-ferrarii" });
    assert.deepEqual(kitCalls, [{ steamId: "76561198000000093", guildId: "fabri-ferrarii" }]);
    const notice = player.sent.find((entry) => entry.event === "kcdc-gamemode:status.notice");
    assert.match(notice.payload.text, /Kit da guilda entregue: 10 sucata de metal, aço/);

    kit.handed = [];
    handlers.get(SELECT)(player, { guildId: "venatores" });
    assert.equal(kitCalls.length, 1, "a refused choice brings no kit");
    assert.equal(player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.social").at(-1).payload.guildId, "fabri-ferrarii");
});

test("a guild that is not in the catalog, or a missing Steam id, is refused and nothing is saved", () => {
    const { handlers, chat, files } = load();
    const player = makePlayer("76561198000000003");

    handlers.get(SELECT)(player, { guildId: "no-such-guild" });
    handlers.get(SELECT)(player, "venatores");
    handlers.get(SELECT)(player, null);
    assert.equal(player.sent.length, 0);
    assert.equal(chat.length, 3);

    const anonymous = makePlayer("");
    handlers.get(SELECT)(anonymous, { guildId: "venatores" });
    assert.equal(anonymous.sent.length, 0);
    assert.equal(files.size, 0);
});

test("a status set by a script shows with its Latin label and Portuguese gloss", () => {
    const { api, handlers } = load();
    const player = makePlayer("76561198000000004");
    api.setSocialStatus(player.steamId, "nobilis");
    handlers.get(POLL)(player);

    assert.deepEqual(player.sent[0].payload.socialStatus, { label: "Nobilis", gloss: "nobre" });
    assert.equal(api.getSocialStatus(player.steamId), "nobilis");
    assert.equal(api.getSocialStatus("76561198000000005"), "plebeius");
});

const SELECT_FACTION = "kcdc-gamemode:status.selectFaction";
const SELECT_SHOWCASE = "kcdc-gamemode:status.selectShowcase";

test("the panel's payload carries the player's role, straight from auth.ts, for the page to gate on", () => {
    const { handlers } = load({ "76561198000000018": "admin" });

    const admin = makePlayer("76561198000000018");
    handlers.get(POLL)(admin);
    assert.equal(admin.sent[0].payload.role, "admin");

    const player = makePlayer("76561198000000019");
    handlers.get(POLL)(player);
    assert.equal(player.sent[0].payload.role, "player");
});


test("the panel is told the name the player gave the character, and nothing for one made before the names", () => {
    const characters = {};
    const { handlers } = load({}, [], characters);
    const named = makePlayer("76561198000000030", "Mauro");
    characters["76561198000000030"] = { appearance: { gender: "male" }, nickname: "Mauro", name: "Henry", epithet: "ii" };
    handlers.get(POLL)(named);
    assert.equal(named.sent[0].payload.characterName, "Henry II", "the first name and the alcunha; the surname is a row of its own");

    const old = makePlayer("76561198000000031", "Ivan");
    characters["76561198000000031"] = { appearance: { gender: "male" }, nickname: "Ivan" };
    handlers.get(POLL)(old);
    assert.equal(old.sent[0].payload.characterName, "");

    const nobody = makePlayer("76561198000000032", "Novo");
    handlers.get(POLL)(nobody);
    assert.equal(nobody.sent[0].payload.characterName, "", "no saved character at all");
});

test("a new player has no faction, sees both houses, and the character page starts on the guild", () => {
    const { handlers } = load();
    const player = makePlayer("76561198000000011");
    handlers.get(POLL)(player);

    const payload = player.sent[0].payload;
    assert.equal(payload.factionId, null);
    assert.equal(payload.showcase, "guild");
    assert.deepEqual(payload.factions.map((faction) => faction.id), ["leao-dourado", "corvo"]);
    for (const faction of payload.factions) {
        for (const key of ["id", "name", "motto", "crest"]) {
            assert.equal(typeof faction[key], "string", `${faction.id} has a ${key}`);
        }
        assert.match(faction.crest, /\.webp$/);
    }
    assert.equal(payload.factions[0].name, "Casa do Leão Dourado");
    assert.equal(payload.factions[0].motto, "Pela honra, a lei e o sangue, manteremos a ordem.");
    assert.equal(payload.factions[1].name, "Casa do Corvo");
    assert.equal(payload.factions[1].motto, "Nas sombras da guerra, a astúcia conquista o que a força não pode.");
});

test("swearing to a house saves it by Steam id and answers with the new state; the oath is for good, only an administrator undoes it", () => {
    const { handlers, chat, files } = load();
    const player = makePlayer("76561198000000012");

    handlers.get(SELECT_FACTION)(player, { factionId: "corvo" });
    assert.equal(player.sent.at(-1).payload.factionId, "corvo");
    assert.match(chat.at(-1), /Casa do Corvo/);
    assert.equal(JSON.parse(files.get("playerdata/social.json"))["76561198000000012"].factionId, "corvo");

    handlers.get(SELECT_FACTION)(player, { factionId: "leao-dourado" });
    assert.equal(JSON.parse(files.get("playerdata/social.json"))["76561198000000012"].factionId, "corvo", "a second oath changes nothing");
    const toast = player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.notice").at(-1);
    assert.match(toast.payload.text, /Você já jurou lealdade à Casa do Corvo: o juramento é definitivo/);
    handlers.get(SELECT_FACTION)(player, { factionId: "corvo" });
    assert.match(player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.notice").at(-1).payload.text, /Você já jurou lealdade à Casa do Corvo\./);
});

test("an administrator's remedy: a sworn faction taken away lets the player swear again", () => {
    const { handlers, api } = load();
    const player = makePlayer("76561198000000013");
    handlers.get(SELECT_FACTION)(player, { factionId: "corvo" });
    assert.equal(api.clearFactionId("76561198000000013"), true);
    assert.equal(api.clearFactionId("76561198000000013"), false, "nothing left to clear");
    assert.equal(api.clearFactionId(""), false);
    handlers.get(SELECT_FACTION)(player, { factionId: "leao-dourado" });
    assert.equal(player.sent.at(-1).payload.factionId, "leao-dourado");
});

test("the character page may show the citizenship too, as a third choice", () => {
    const { handlers, api } = load();
    const player = makePlayer("76561198000000014");
    handlers.get(SELECT_SHOWCASE)(player, { showcase: "citizenship" });
    assert.equal(api.getShowcase("76561198000000014"), "citizenship");
    handlers.get(SELECT_SHOWCASE)(player, { showcase: "outra" });
    assert.equal(api.getShowcase("76561198000000014"), "citizenship", "a bad value is ignored");
});

test("swearing to a house hands its colours, and the player is told in the chat and on the page", () => {
    const { handlers, chat, kitCalls, kit } = load();
    const player = makePlayer("76561198000000019");
    kit.colours = ["o manto azul (casaco bordado)", "a gola acolchoada azul"];

    handlers.get(SELECT_FACTION)(player, { factionId: "corvo" });
    assert.deepEqual(kitCalls.map((call) => ({ ...call })), [{ steamId: "76561198000000019", factionId: "corvo" }]);
    assert.match(chat.at(-1), /cores da facção.*manto azul.*gola acolchoada azul.*inventário/);
    const notice = player.sent.find((entry) => entry.event === "kcdc-gamemode:status.notice");
    assert.match(notice.payload.text, /manto azul/);
    assert.equal(player.sent.at(-1).event, SOCIAL, "the page is redrawn after the notice");
});

test("a house whose colours were handed before says nothing more about them, and a refused oath hands nothing", () => {
    const { handlers, chat, kitCalls } = load();
    const player = makePlayer("76561198000000020");

    handlers.get(SELECT_FACTION)(player, { factionId: "leao-dourado" });
    assert.ok(!chat.some((line) => /cores da facção/.test(line)));
    assert.ok(!player.sent.some((entry) => entry.event === "kcdc-gamemode:status.notice"));

    kitCalls.length = 0;
    handlers.get(SELECT_FACTION)(player, { factionId: "no-such-house" });
    assert.deepEqual(kitCalls, []);
});

test("choosing a faction leaves the guild and the social status alone", () => {
    const { api, handlers } = load();
    const player = makePlayer("76561198000000013");
    api.setSocialStatus(player.steamId, "nobilis");
    handlers.get(SELECT)(player, { guildId: "tabernarii" });
    handlers.get(SELECT_FACTION)(player, { factionId: "corvo" });

    const payload = player.sent.at(-1).payload;
    assert.equal(payload.guildId, "tabernarii");
    assert.equal(payload.factionId, "corvo");
    assert.deepEqual(payload.socialStatus, { label: "Nobilis", gloss: "nobre" });
});

test("a faction that is not in the catalog, or a missing Steam id, is refused and nothing is saved", () => {
    const { handlers, chat, files } = load();
    const player = makePlayer("76561198000000014");

    handlers.get(SELECT_FACTION)(player, { factionId: "no-such-house" });
    handlers.get(SELECT_FACTION)(player, "corvo");
    handlers.get(SELECT_FACTION)(player, null);
    assert.equal(player.sent.length, 0);
    assert.equal(chat.length, 3);

    const anonymous = makePlayer("");
    handlers.get(SELECT_FACTION)(anonymous, { factionId: "corvo" });
    assert.equal(anonymous.sent.length, 0);
    assert.equal(files.size, 0);
});

test("the character page remembers whether it shows the guild or the faction", () => {
    const { handlers, files } = load();
    const player = makePlayer("76561198000000015");

    handlers.get(SELECT_SHOWCASE)(player, { showcase: "faction" });
    assert.equal(player.sent.at(-1).payload.showcase, "faction");
    assert.equal(JSON.parse(files.get("playerdata/social.json"))["76561198000000015"].showcase, "faction");

    handlers.get(SELECT_SHOWCASE)(player, { showcase: "guild" });
    assert.equal(player.sent.at(-1).payload.showcase, "guild");
});

test("a showcase that is neither guild nor faction is ignored without a word", () => {
    const { handlers, chat, files } = load();
    const player = makePlayer("76561198000000016");

    handlers.get(SELECT_SHOWCASE)(player, { showcase: "both" });
    handlers.get(SELECT_SHOWCASE)(player, "faction");
    handlers.get(SELECT_SHOWCASE)(player, null);
    handlers.get(SELECT_SHOWCASE)(makePlayer(""), { showcase: "faction" });
    assert.equal(player.sent.length, 0);
    assert.equal(chat.length, 0);
    assert.equal(files.size, 0);
});

test("a record saved before factions existed still loads, with the new fields at their defaults", () => {
    const { handlers, files } = load();
    files.set("playerdata/social.json", JSON.stringify({
        "76561198000000017": { socialStatus: "nobilis", guildId: "venatores", updatedAt: 1 },
    }));
    const player = makePlayer("76561198000000017");
    handlers.get(POLL)(player);

    const payload = player.sent[0].payload;
    assert.deepEqual(payload.socialStatus, { label: "Nobilis", gloss: "nobre" });
    assert.equal(payload.guildId, "venatores");
    assert.equal(payload.factionId, null);
    assert.equal(payload.showcase, "guild");
});

const GRANT_KEY = "kcdc-gamemode:status.grantKey";

test("the property catalog is sent to an admin and never to a player", () => {
    const catalog = [{ id: "casa", name: "Casa", region: "Kuttenberg", doors: [] }];
    const { handlers } = load({ "76561198000000020": "admin" }, catalog);

    const admin = makePlayer("76561198000000020");
    handlers.get(POLL)(admin);
    assert.equal(admin.sent[0].payload.properties.length, 1);
    assert.equal(admin.sent[0].payload.properties[0].id, "casa");

    const player = makePlayer("76561198000000021");
    handlers.get(POLL)(player);
    assert.deepEqual(player.sent[0].payload.properties, []);
});

test("a player is sent the properties they own, and only those, with the owner's name and a flag for theirs", () => {
    const catalog = [
        { id: "casa-03", name: "Casa 03", region: "Suchdol", kind: "house", doors: ["d1", "d2", "d3"], doorGuid: "d1", keys: 2, locked: true, parentId: "", ownerSteamId: "76561198000000140", ownerName: "Hans", description: "Perto do moinho" },
        { id: "casa-03-bau-1", name: "Baú 1", region: "Suchdol", kind: "chest", doors: [], keys: 0, locked: false, parentId: "casa-03", ownerSteamId: "76561198000000140", ownerName: "Hans" },
        { id: "casa-04", name: "Casa 04", region: "Suchdol", kind: "house", doors: [], keys: 0, locked: false, parentId: "", ownerSteamId: "", ownerName: "" },
    ];
    const { handlers } = load({ "76561198000000141": "admin" }, catalog);

    const hans = makePlayer("76561198000000140", "Hans");
    handlers.get(POLL)(hans);
    const own = hans.sent[0].payload.properties;
    assert.deepEqual(Array.from(own, (entry) => entry.id), ["casa-03", "casa-03-bau-1"]);
    assert.equal(own[0].mine, true);
    assert.equal(own[0].owner, "Hans");
    assert.equal(own[0].description, "Perto do moinho");
    assert.equal(own[1].parentId, "casa-03");
    assert.ok(!("description" in own[1]), "an empty description is not sent");
    assert.equal(hans.sent[0].payload.propertyLimits.keyLimit, 8);

    const admin = makePlayer("76561198000000141");
    handlers.get(POLL)(admin);
    const all = admin.sent[0].payload.properties;
    assert.equal(all.length, 3);
    assert.deepEqual(Array.from(all, (entry) => entry.mine ?? false), [false, false, false], "the administrator sees all of them, none as theirs");
    assert.deepEqual(Object.keys(all[2]).sort(), ["id", "kind", "locked", "name", "region"], "a property with nothing to say about it is sent without the empty fields");
});

test("a request for a key reaches the property module with the sender's role, which decides who may", () => {
    const { handlers, grants, chat } = load({ "76561198000000022": "admin" });

    handlers.get(GRANT_KEY)(makePlayer("76561198000000023"), { propertyId: "casa" });
    assert.deepEqual(grants, [{ steamId: "76561198000000023", propertyId: "casa", admin: false }], "a player's request goes in as a player's");

    const admin = makePlayer("76561198000000022");
    handlers.get(GRANT_KEY)(admin, { propertyId: "casa" });
    assert.deepEqual(grants.at(-1), { steamId: "76561198000000022", propertyId: "casa", admin: true });
    assert.equal(chat.at(-1), "chave dada");

    const before = grants.length;
    handlers.get(GRANT_KEY)(admin, { propertyId: 7 });
    handlers.get(GRANT_KEY)(admin, null);
    assert.equal(grants.length, before, "a request that is not a string id never gets that far");
});

test("a request that arrives as the JSON text of an object is read the same", () => {
    const { handlers, grants } = load();
    handlers.get(GRANT_KEY)(makePlayer("76561198000000150"), JSON.stringify({ propertyId: "casa" }));
    assert.equal(grants.length, 1);
    handlers.get(GRANT_KEY)(makePlayer("76561198000000151"), "not json {");
    assert.equal(grants.length, 1);
});

test("an administrator's list carries everything about each player, a player's picker only a name and a number, and the social payload carries no list at all", () => {
    const { handlers } = load({ "76561198000000094": "admin" });
    const admin = makePlayer("76561198000000094", "Mauro");
    const other = makePlayer("76561198000000095", "Hans");

    handlers.get(POLL)(admin);
    assert.equal(admin.sent[0].payload.players, undefined, "a list of 500 is not sent with every refresh of the panel");

    const list = rosterOf(handlers, admin).players;
    assert.deepEqual(Array.from(list, (entry) => [entry.nickname, entry.role, entry.self]), [["Hans", "player", false], ["Mauro", "admin", true]], "by name");
    assert.equal(list[0].steamId, "76561198000000095");

    const theirs = rosterOf(handlers, other, { tag: "pick" });
    assert.deepEqual(theirs.players, [{ id: admin.id, nickname: "Mauro" }], "a name and a number, never oneself, no role and no Steam id");
    assert.equal(theirs.tag, "pick");
    const asked = rosterOf(handlers, other);
    assert.equal(asked.tag, "pick", "a player has no list page: a request for it is answered as for a picker");
    assert.deepEqual(Array.from(asked.players, (entry) => Object.keys(entry).sort().join()), ["id,nickname"]);
    assert.equal(rosterOf(handlers, admin).players.length, 2);
});

test("the administrator's list carries what the Jogadores page shows of the one picked", () => {
    const { handlers, files, supporterSummaries } = load({ "76561198000000301": "admin" }, [], { "76561198000000302": { appearance: { gender: "female" } } });
    files.set("playerdata/social.json", JSON.stringify({ "76561198000000302": { socialStatus: "nobilis", guildId: "venatores", factionId: "corvo", showcase: "guild", updatedAt: 1 } }));
    supporterSummaries["76561198000000302"] = { since: "01/10/2026", last: "14/10/2026", times: 2 };
    const admin = makePlayer("76561198000000301", "Mauro");
    const kat = makePlayer("76561198000000302", "Katerina");
    const entry = rosterOf(handlers, admin).players.find((each) => each.id === kat.id);
    assert.equal(entry.guildId, "venatores");
    assert.equal(entry.guild, "Caçador");
    assert.equal(entry.factionId, "corvo");
    assert.deepEqual(entry.status, { label: "Nobilis", gloss: "nobre" });
    assert.equal(entry.body, "female", "the saved look, not the body the client reports");
    assert.equal(typeof entry.marital.label, "string");
    assert.deepEqual(entry.health, [72, 100]);
    assert.deepEqual(entry.hunger, [65, 100]);
    assert.deepEqual(entry.supporter, { since: "01/10/2026", last: "14/10/2026", times: 2 });
    assert.equal(rosterOf(handlers, admin).players.find((each) => each.id === admin.id).supporter, null);

    handlers.get(POLL)(kat);
    assert.deepEqual(kat.sent[0].payload.supporter, { since: "01/10/2026", last: "14/10/2026", times: 2 }, "and a supporter sees their own, to be thanked");
});

test("a gauge whose capacity the game has not reported yet is on the scale of 100, and a reading that is no number is no reading", () => {
    const { api } = load();
    assert.deepEqual(Array.from(api.gauge(40.4, 0)), [40, 100]);
    assert.deepEqual(Array.from(api.gauge(64.6, 100)), [65, 100]);
    assert.deepEqual(Array.from(api.gauge(Number.NaN, 100)), [0, 0]);
    assert.deepEqual(Array.from(api.gauge(-3, 100)), [0, 100]);
    assert.deepEqual(Array.from(api.gauge(50, Number.NaN)), [50, 100]);
});

test("the Jogadores list still shows hunger when the game has not told the capacity of it: the bar is not left blank", () => {
    const { handlers } = load({ "76561198000000301": "admin" });
    const admin = makePlayer("76561198000000301", "Mauro");
    const kat = makePlayer("76561198000000302", "Katerina");
    kat.maxHunger = 0;
    kat.hunger = 33.2;
    const entry = rosterOf(handlers, admin).players.find((each) => each.id === kat.id);
    assert.deepEqual(Array.from(entry.hunger), [33, 100]);
});

test("only an administrator hands over the supporter benefits; both lists are brought up to date", () => {
    const GRANT = "kcdc-gamemode:status.supporterGrant";
    const { handlers, benefits, chat } = load({ "76561198000000311": "admin" });
    const admin = makePlayer("76561198000000311", "Mauro");
    const hans = makePlayer("76561198000000312", "Hans");

    handlers.get(GRANT)(hans, { targetId: hans.id });
    assert.deepEqual(benefits, [], "a player cannot give them to himself");

    handlers.get(GRANT)(admin, { targetId: hans.id });
    assert.deepEqual(benefits, [{ by: "76561198000000311", to: "76561198000000312" }]);
    assert.match(chat.at(-1), /Benefícios entregues a Hans/);
    const roster = admin.sent.filter((entry) => entry.event === "kcdc-gamemode:status.roster").at(-1);
    assert.deepEqual(roster.payload.players.find((entry) => entry.id === hans.id).supporter, { since: "14/10/2026", last: "14/10/2026", times: 1 });
    assert.deepEqual(hans.sent.filter((entry) => entry.event === SOCIAL).at(-1).payload.supporter.times, 1, "his own page knows at once");

    handlers.get(GRANT)(admin, { targetId: 99999 });
    assert.match(chat.at(-1), /não está mais no servidor/);
    for (const bad of [{}, { targetId: "2" }, { targetId: 1.5 }, null]) handlers.get(GRANT)(admin, bad);
    assert.equal(benefits.length, 1);
});

test("an admin can hand a key to another player, who is told; a player who left or a bad target is handled", () => {
    const { handlers, grants, chat } = load({ "76561198000000096": "admin" });
    const admin = makePlayer("76561198000000096", "Mauro");
    const tenant = makePlayer("76561198000000097", "Hans");

    handlers.get(GRANT_KEY)(admin, { propertyId: "casa-01", targetId: tenant.id });
    assert.deepEqual(grants.at(-1), { steamId: "76561198000000096", propertyId: "casa-01", admin: true, to: "76561198000000097" });
    assert.match(chat.at(-1), /Mauro entregou a você uma chave/);

    handlers.get(GRANT_KEY)(admin, { propertyId: "casa-01", targetId: admin.id });
    assert.deepEqual(grants.at(-1), { steamId: "76561198000000096", propertyId: "casa-01", admin: true }, "naming themselves is the same as naming nobody");

    const before = grants.length;
    handlers.get(GRANT_KEY)(admin, { propertyId: "casa-01", targetId: 99999 });
    assert.equal(grants.length, before, "a target who is not there gets nothing");
});

const FAMILY_ADD = "kcdc-gamemode:status.familyAdd";
const FAMILY_REMOVE = "kcdc-gamemode:status.familyRemove";
const FAMILY_SURNAME = "kcdc-gamemode:status.familySurname";
const NOTICE = "kcdc-gamemode:status.notice";

const ofKind = (player, event) => player.sent.filter((entry) => entry.event === event);

const FAMILY_ANSWER = "kcdc-gamemode:status.familyAnswer";
/** The player answers the newest request waiting in their Família section. */
const answer = (handlers, player, accept = 1) => handlers.get(FAMILY_ANSWER)(player, { key: ofKind(player, SOCIAL).at(-1).payload.familyInvites.at(-1).key, accept });

test("a new player's panel carries an empty tree, the catalogs to draw it with, and a single status", () => {
    const { handlers } = load();
    const player = makePlayer("76561198000000030");
    handlers.get(POLL)(player);

    const payload = player.sent[0].payload;
    assert.deepEqual(payload.family, []);
    assert.equal(payload.familyRows.length, 7);
    assert.ok(payload.familyRelations.some((relation) => relation.id === "primo" && relation.degree === true));
    assert.equal(payload.familyLimits.maxPersons, 80);
    assert.equal(payload.surname, null);
    assert.deepEqual(payload.maritalStatus, { label: "Caelebs", gloss: "solteiro" });
});

test("adding a relative is saved and answered with the tree; a spouse makes the character married", () => {
    const { handlers, files } = load();
    const player = makePlayer("76561198000000031");

    handlers.get(FAMILY_ADD)(player, { relation: "avo", name: "Wenzel Capon" });
    handlers.get(FAMILY_ADD)(player, { relation: "esposa", name: "Elisabeth" });
    handlers.get(FAMILY_ADD)(player, { relation: "prima", degree: 2, name: "Anezka" });

    const payload = ofKind(player, SOCIAL).at(-1).payload;
    assert.deepEqual(payload.family.map((p) => `${p.row}:${p.label}:${p.name}`), [
        "avos:Avô:Wenzel Capon",
        "geracao:Esposa:Elisabeth",
        "geracao:Prima de 2º grau:Anezka",
    ]);
    assert.deepEqual(payload.maritalStatus, { label: "Coniugatus", gloss: "casado" });
    assert.equal(JSON.parse(files.get("playerdata/family.json"))["76561198000000031"].persons.length, 3);
});

test("a refused relative is explained on the panel itself, since the chat is behind it, and no tree is sent", () => {
    const { handlers, chat } = load();
    const player = makePlayer("76561198000000032");

    handlers.get(FAMILY_ADD)(player, { relation: "pai", name: "X" });

    assert.equal(ofKind(player, SOCIAL).length, 0);
    const notices = ofKind(player, NOTICE);
    assert.equal(notices.length, 1);
    assert.match(notices[0].payload.text, /2 e 40/);
    assert.equal(chat.at(-1), notices[0].payload.text, "the chat keeps the same line");
});

test("malformed family events never save anything", () => {
    const { handlers, files } = load();
    const player = makePlayer("76561198000000033");

    for (const bad of [null, undefined, "pai", 7, [], { relation: 7, name: "Hans" }, { relation: "pai" }, { name: "Hans" }]) {
        handlers.get(FAMILY_ADD)(player, bad);
    }
    handlers.get(FAMILY_REMOVE)(player, null);
    handlers.get(FAMILY_REMOVE)(player, { id: 7 });

    assert.equal(ofKind(player, SOCIAL).length, 0, "nothing worth redrawing happened");
    assert.equal(files.size, 0);
});

test("removing a relative sends the new tree, and an id that is not theirs sends nothing", () => {
    const { handlers } = load();
    const player = makePlayer("76561198000000034");
    handlers.get(FAMILY_ADD)(player, { relation: "irmao", name: "Petr" });
    const id = ofKind(player, SOCIAL).at(-1).payload.family[0].id;

    const before = ofKind(player, SOCIAL).length;
    handlers.get(FAMILY_REMOVE)(player, { id: "p99" });
    assert.equal(ofKind(player, SOCIAL).length, before);

    handlers.get(FAMILY_REMOVE)(player, { id });
    assert.deepEqual(ofKind(player, SOCIAL).at(-1).payload.family, []);
});

test("the surname is saved, shown to the page, changed, and cleared; a bad one is explained", () => {
    const { handlers } = load();
    const player = makePlayer("76561198000000035");

    handlers.get(FAMILY_SURNAME)(player, { surname: "Capon" });
    assert.equal(ofKind(player, SOCIAL).at(-1).payload.surname, "Capon");

    handlers.get(FAMILY_SURNAME)(player, { surname: "de Skalitz" });
    assert.equal(ofKind(player, SOCIAL).at(-1).payload.surname, "de Skalitz");

    handlers.get(FAMILY_SURNAME)(player, { surname: "" });
    assert.equal(ofKind(player, SOCIAL).at(-1).payload.surname, null);

    handlers.get(FAMILY_SURNAME)(player, { surname: "C" });
    assert.match(ofKind(player, NOTICE).at(-1).payload.text, /sobrenome/);

    const before = player.sent.length;
    handlers.get(FAMILY_SURNAME)(player, "Capon");
    assert.equal(player.sent.length, before + 1, "a surname that is not in an object is refused out loud");
});

test("the marital status is worded for the saved character's gender", () => {
    const { handlers } = load({}, [], { "76561198000000036": { appearance: { gender: "female" } } });
    const player = makePlayer("76561198000000036");

    handlers.get(POLL)(player);
    assert.deepEqual(ofKind(player, SOCIAL).at(-1).payload.maritalStatus, { label: "Caelebs", gloss: "solteira" });

    handlers.get(FAMILY_ADD)(player, { relation: "esposo", name: "Jan" });
    assert.deepEqual(ofKind(player, SOCIAL).at(-1).payload.maritalStatus, { label: "Coniugata", gloss: "casada" });
});

test("a key the admin asked for is confirmed on the panel as well as in the chat", () => {
    const { handlers, chat } = load({ "76561198000000037": "admin" });
    const admin = makePlayer("76561198000000037");

    handlers.get(GRANT_KEY)(admin, { propertyId: "casa" });
    assert.deepEqual(ofKind(admin, NOTICE).map((entry) => entry.payload.text), ["chave dada"]);
    assert.equal(chat.at(-1), "chave dada");
});

const PROP_SAVE = "kcdc-gamemode:status.propSave";
const PROP_OWNER = "kcdc-gamemode:status.propOwner";
const PROP_DISOWN = "kcdc-gamemode:status.propDisown";
const PEEK = "kcdc-gamemode:props.peek";
const LABEL = "kcdc-gamemode:props.label";

const HOUSE = { id: "casa-03", name: "Casa 03", region: "Suchdol", kind: "house", doors: [], keys: 0, locked: false, parentId: "", ownerSteamId: "76561198000000160", ownerName: "Hans", description: "" };

test("the owner may rename and describe what is theirs; anybody else is told it is not theirs to change", () => {
    const { handlers, edits } = load({}, [{ ...HOUSE }]);
    const hans = makePlayer("76561198000000160", "Hans");
    handlers.get(PROP_SAVE)(hans, { id: "casa-03", name: "Casa do Ferreiro", description: "Perto do moinho" });
    assert.deepEqual(edits, [{ kind: "name", id: "casa-03", name: "Casa do Ferreiro" }, { kind: "description", id: "casa-03", text: "Perto do moinho" }]);
    assert.deepEqual(ofKind(hans, NOTICE).map((entry) => entry.payload.text), ["Propriedade atualizada."]);
    assert.ok(ofKind(hans, SOCIAL).length >= 1, "and is answered with the new state");

    edits.length = 0;
    const stranger = makePlayer("76561198000000161", "Katerina");
    handlers.get(PROP_SAVE)(stranger, { id: "casa-03", name: "Minha agora", description: "" });
    assert.deepEqual(edits, []);
    assert.deepEqual(ofKind(stranger, NOTICE).map((entry) => entry.payload.text), ["Só o dono pode mudar isso."]);
});

test("a field that did not change is not sent to the property module, and the region is the administrator's alone", () => {
    const { handlers, edits } = load({ "76561198000000162": "admin" }, [{ ...HOUSE, description: "Velha" }]);
    const hans = makePlayer("76561198000000160", "Hans");
    handlers.get(PROP_SAVE)(hans, { id: "casa-03", name: "Casa 03", description: "Velha", region: "Rabštejn" });
    assert.deepEqual(edits, [], "same name, same description, and an owner has no say over the region");

    const admin = makePlayer("76561198000000162", "Mauro");
    handlers.get(PROP_SAVE)(admin, { id: "casa-03", name: "Casa 03", description: "Velha", region: "Rabštejn" });
    assert.deepEqual(edits, [{ kind: "region", id: "casa-03", region: "Rabštejn" }]);
});

test("a failure of the property module is what the player is told", () => {
    const { handlers } = load({}, [{ ...HOUSE }]);
    const hans = makePlayer("76561198000000160", "Hans");
    handlers.get(PROP_SAVE)(hans, { id: "nao-existe", name: "x", description: "" });
    assert.deepEqual(ofKind(hans, NOTICE).map((entry) => entry.payload.text), ["Propriedade não encontrada."]);
});

test("only an administrator gives a property to a player or takes the owner off, and the new owner is told", () => {
    const { handlers, edits, chat } = load({ "76561198000000163": "admin" }, [{ ...HOUSE }]);
    const hans = makePlayer("76561198000000160", "Hans");
    handlers.get(PROP_OWNER)(hans, { id: "casa-03", targetId: hans.id });
    handlers.get(PROP_DISOWN)(hans, { id: "casa-03" });
    assert.deepEqual(edits, [], "a player's request is dropped");

    const admin = makePlayer("76561198000000163", "Mauro");
    const buyer = makePlayer("76561198000000164", "Katerina");
    handlers.get(PROP_OWNER)(admin, { id: "casa-03", targetId: buyer.id });
    assert.deepEqual(edits, [{ kind: "owner", id: "casa-03", to: "76561198000000164" }]);
    assert.match(chat.at(-1), /Mauro entregou a você uma propriedade/);

    handlers.get(PROP_OWNER)(admin, { id: "casa-03" });
    assert.deepEqual(edits.at(-1), { kind: "owner", id: "casa-03", to: "76561198000000163" }, "without a target it is the administrator's own");
    handlers.get(PROP_OWNER)(admin, { id: "casa-03", targetId: 99999 });
    assert.equal(edits.length, 2, "a player who is gone gets nothing");

    handlers.get(PROP_DISOWN)(admin, { id: "casa-03" });
    assert.deepEqual(edits.at(-1), { kind: "disown", id: "casa-03" });
});

test("what a door or chest is called is answered to anybody who asks, and only for a real GUID", () => {
    const { handlers, labels } = load();
    labels["a1b2c3d4e5f60718"] = "Casa 03 - Hans";
    const player = makePlayer("76561198000000165");

    handlers.get(PEEK)(player, { guid: "a1b2c3d4e5f60718" });
    assert.deepEqual(ofKind(player, LABEL).map((entry) => entry.payload), [{ guid: "a1b2c3d4e5f60718", label: "Casa 03 - Hans", use: false, door: false }]);

    handlers.get(PEEK)(player, { guid: "0000000000000001" });
    assert.deepEqual(ofKind(player, LABEL).at(-1).payload, { guid: "0000000000000001", label: "", use: false, door: false }, "an object that is no property answers with nothing");

    const before = ofKind(player, LABEL).length;
    for (const bad of [{ guid: 7 }, { guid: "../etc/passwd" }, { guid: "" }, {}, null, "x".repeat(5000)]) {
        handlers.get(PEEK)(player, bad);
    }
    assert.equal(ofKind(player, LABEL).length, before, "anything else is ignored");
});

test("adding a player as a relative asks them in their own Família section; their yes puts the one who adds in their tree, tells both, draws both panels", () => {
    const { handlers, chat } = load();
    const hans = makePlayer("76561198000000401", "Hans");
    const kat = makePlayer("76561198000000402", "Katerina");
    handlers.get(FAMILY_ADD)(hans, { relation: "esposa", name: "Katerina", linkId: kat.id });

    assert.match(ofKind(hans, NOTICE).at(-1).payload.text, /^O pedido foi para Katerina: o vínculo vale quando for aceito, na seção Família\./);
    assert.ok(chat.some((line) => /^Hans quer registrar você na família como Esposa\. Aceite ou recuse na seção Família do painel \(F2\)\./.test(line)), "she is told in the chat");
    const asked = ofKind(kat, SOCIAL).at(-1).payload;
    assert.deepEqual(asked.familyInvites.map((ask) => [ask.name, ask.label]), [["Hans", "Esposa"]]);
    assert.deepEqual(asked.family, [], "nothing in her tree before she answers");
    assert.deepEqual(ofKind(hans, SOCIAL).at(-1).payload.family.map((person) => [person.label, person.player, person.asked]), [["Esposa", false, true]]);

    answer(handlers, kat);
    const hers = ofKind(kat, SOCIAL).at(-1).payload;
    assert.deepEqual(hers.family.map((person) => [person.name, person.label, person.player]), [["Hans", "Esposo", true]]);
    assert.deepEqual(hers.familyInvites, []);
    assert.equal(hers.maritalStatus.gloss, "casado", "married by her own tree (the body in this test is a man's)");
    assert.match(ofKind(kat, NOTICE).at(-1).payload.text, /^Você aceitou: Hans está na sua árvore como Esposo\./);
    assert.ok(chat.some((line) => /^Katerina aceitou ser Esposa na sua árvore de família\./.test(line)), "he is told in the chat");
    assert.deepEqual(ofKind(hans, SOCIAL).at(-1).payload.family.map((person) => [person.label, person.player, person.asked]), [["Esposa", true, false]]);

    // and only one way round: the other player cannot be put in the first one's tree again
    handlers.get(FAMILY_ADD)(kat, { relation: "esposo", name: "Hans", linkId: hans.id });
    assert.match(ofKind(kat, NOTICE).at(-1).payload.text, /já está na sua árvore/);
});

test("a no is said to both and leaves the relative a name; a request answered is gone", () => {
    const { handlers, chat } = load();
    const hans = makePlayer("76561198000000405", "Hans");
    const jan = makePlayer("76561198000000406", "Jan");
    handlers.get(FAMILY_ADD)(hans, { relation: "filho", name: "Jan", linkId: jan.id });
    const key = ofKind(jan, SOCIAL).at(-1).payload.familyInvites[0].key;
    handlers.get(FAMILY_ANSWER)(jan, { key, accept: 0 });
    assert.match(ofKind(jan, NOTICE).at(-1).payload.text, /^Você recusou o pedido de Hans\./);
    assert.ok(chat.some((line) => /^Jan recusou ser Filho na sua árvore; o parente fica só com o nome\./.test(line)));
    assert.deepEqual(ofKind(hans, SOCIAL).at(-1).payload.family.map((person) => [person.name, person.player, person.asked]), [["Jan", false, false]]);
    assert.deepEqual(ofKind(jan, SOCIAL).at(-1).payload.family, []);
    handlers.get(FAMILY_ANSWER)(jan, { key, accept: 1 });
    assert.match(ofKind(jan, NOTICE).at(-1).payload.text, /pedido não existe mais/);
});

test("a changed relation, a changed player and a removal travel to the other tree, with a word to the player it happened to", () => {
    const { handlers, chat } = load();
    const hans = makePlayer("76561198000000411", "Hans");
    const kat = makePlayer("76561198000000412", "Katerina");
    const jan = makePlayer("76561198000000413", "Jan");
    handlers.get(FAMILY_ADD)(hans, { relation: "filha", name: "Dorota", linkId: kat.id });
    answer(handlers, kat);
    const entry = ofKind(hans, SOCIAL).at(-1).payload.family[0];
    assert.equal(ofKind(kat, SOCIAL).at(-1).payload.family[0].label, "Pai");

    handlers.get(FAMILY_EDIT)(hans, { id: entry.id, relation: "filho_adotivo" });
    assert.equal(ofKind(kat, SOCIAL).at(-1).payload.family[0].label, "Pai");
    assert.match(ofKind(hans, NOTICE).at(-1).payload.text, /^Na árvore de Katerina, você agora é Pai\./);
    assert.ok(chat.some((line) => /^Hans mudou o parentesco entre vocês: na sua árvore, Hans agora aparece como Pai\./.test(line)));

    handlers.get(FAMILY_EDIT)(hans, { id: entry.id, linkId: jan.id });
    assert.deepEqual(ofKind(kat, SOCIAL).at(-1).payload.family, [], "the old player's tree lost it");
    assert.ok(chat.some((line) => /^Hans tirou você da árvore de família, e saiu da sua também\./.test(line)));
    answer(handlers, jan);
    assert.equal(ofKind(jan, SOCIAL).at(-1).payload.family[0].label, "Pai", "and the new one's has it, once they say yes");

    handlers.get(FAMILY_REMOVE)(hans, { id: entry.id });
    assert.deepEqual(ofKind(jan, SOCIAL).at(-1).payload.family, []);
    assert.match(ofKind(hans, NOTICE).at(-1).payload.text, /^Jan não tem mais você na árvore\./);
    assert.deepEqual(ofKind(hans, SOCIAL).at(-1).payload.family, []);
});

test("a full tree on the other side is said to the one who added, and a link made before the mirror gets it at start", () => {
    const { handlers } = load();
    const hans = makePlayer("76561198000000421", "Hans");
    const kat = makePlayer("76561198000000422", "Katerina");
    for (let i = 0; i < 80; i += 1) {
        handlers.get(FAMILY_ADD)(kat, { relation: "primo", name: `Primo ${i}` });
    }
    handlers.get(FAMILY_ADD)(hans, { relation: "irmao", name: "Katerina", linkId: kat.id });
    answer(handlers, kat);
    assert.match(ofKind(kat, NOTICE).at(-1).payload.text, /^Você aceitou o vínculo com Hans, mas sua árvore está cheia: Hans não entrou nela\./);
    assert.equal(ofKind(hans, SOCIAL).at(-1).payload.family.length, 1, "his own tree took her all the same");

    const owner = "76561198000000431";
    const daughter = "76561198000000432";
    const seeded = load({}, [], { [owner]: { appearance: { gender: "male" }, nickname: "Hans", name: "Hans", epithet: "" } }, {
        "playerdata/family.json": JSON.stringify({ [owner]: { persons: [{ id: "p1", relation: "filha", degree: null, name: "Dorota", createdAt: 1, steamId: daughter }], updatedAt: 1 } }),
    });
    const saved = JSON.parse(seeded.files.get("playerdata/family.json"));
    assert.equal(saved[daughter].persons[0].relation, "pai", "the daughter's tree has her father now");
    assert.equal(saved[daughter].persons[0].name, "Hans");
    assert.equal(saved[daughter].persons[0].steamId, owner);
    assert.equal(saved[owner].persons[0].mirrored, true);
});

const PROP_LOCK = "kcdc-gamemode:status.propLock";

test("a door or chest of a property says it is one, so an E pressed there is told to the server; the lock is not the client's business", () => {
    const { handlers, labels, worldLocks } = load({}, [{ ...HOUSE, doors: ["a1b2c3d4e5f60718"], locked: true }]);
    labels["a1b2c3d4e5f60718"] = "Casa 03 - Hans";
    const player = makePlayer("76561198000000165");

    worldLocks["a1b2c3d4e5f60718"] = false;
    handlers.get(PEEK)(player, { guid: "a1b2c3d4e5f60718" });
    assert.deepEqual(ofKind(player, LABEL).at(-1).payload, { guid: "a1b2c3d4e5f60718", label: "Casa 03 - Hans", use: true, door: true });

    worldLocks["a1b2c3d4e5f60718"] = true;
    handlers.get(PEEK)(player, { guid: "a1b2c3d4e5f60718" });
    assert.equal(ofKind(player, LABEL).at(-1).payload.use, true, "locked or not, the same answer: the menu is the server's");
});

test("the label says whether it is a door: only a door of a property is held locked for a look, a chest is not", () => {
    const { handlers, labels } = load({}, [{ ...HOUSE, doors: ["a1b2c3d4e5f60718"], stashGuid: "c1c2c3c4c5c60718" }]);
    labels["a1b2c3d4e5f60718"] = "Casa 03";
    labels["c1c2c3c4c5c60718"] = "Casa 03 · Baú";
    labels["0f0f0f0f0f0f0f0f"] = "";
    const player = makePlayer("76561198000000166");
    for (const guid of ["a1b2c3d4e5f60718", "c1c2c3c4c5c60718", "0f0f0f0f0f0f0f0f"]) {
        handlers.get(PEEK)(player, { guid });
    }
    const answers = ofKind(player, LABEL).map((entry) => ({ guid: entry.payload.guid, use: entry.payload.use, door: entry.payload.door }));
    assert.deepEqual(answers.slice(-3), [
        { guid: "a1b2c3d4e5f60718", use: true, door: true },
        { guid: "c1c2c3c4c5c60718", use: true, door: false },
        { guid: "0f0f0f0f0f0f0f0f", use: false, door: false },
    ]);
});

test("the owner and an administrator lock and unlock from the panel; anybody else is told it is not theirs", () => {
    const { handlers, edits } = load({ "76561198000000163": "admin" }, [{ ...HOUSE }]);
    const hans = makePlayer("76561198000000160", "Hans");
    handlers.get(PROP_LOCK)(hans, { id: "casa-03", locked: 1 });
    assert.deepEqual(edits, [{ kind: "lock", id: "casa-03", locked: true }]);
    assert.deepEqual(ofKind(hans, NOTICE).map((entry) => entry.payload.text), ["lock ok"]);
    assert.ok(ofKind(hans, SOCIAL).length >= 1, "and the panel is drawn again");

    const admin = makePlayer("76561198000000163", "Mauro");
    handlers.get(PROP_LOCK)(admin, { id: "casa-03", locked: 0 });
    assert.deepEqual(edits.at(-1), { kind: "lock", id: "casa-03", locked: false });

    edits.length = 0;
    const stranger = makePlayer("76561198000000161", "Katerina");
    handlers.get(PROP_LOCK)(stranger, { id: "casa-03", locked: 0 });
    assert.deepEqual(edits, []);
    assert.deepEqual(ofKind(stranger, NOTICE).map((entry) => entry.payload.text), ["Só o dono pode trancar ou destrancar."]);

    handlers.get(PROP_LOCK)(hans, { id: "casa-03", locked: "sim" });
    handlers.get(PROP_LOCK)(hans, { id: "casa-03", locked: 2 });
    assert.deepEqual(edits, [], "only 0 and 1 mean anything");
    handlers.get(PROP_LOCK)(hans, { id: "nao-existe", locked: 1 });
    assert.equal(ofKind(hans, NOTICE).at(-1).payload.text, "Propriedade não encontrada.");
});

const REGION_CEDE = "kcdc-gamemode:status.regionCede";
const REGION_HOUSES = [
    { ...HOUSE, id: "casa-01", name: "Casa 01", ownerSteamId: "", ownerName: "" },
    { ...HOUSE, id: "casa-02", name: "Casa 02", ownerSteamId: "", ownerName: "" },
];

test("an administrator takes a whole region for themselves by naming nobody, and gives it to somebody by naming them", () => {
    const { handlers, edits, chat } = load({ "76561198000000401": "admin" }, REGION_HOUSES.map((house) => ({ ...house })));
    const admin = makePlayer("76561198000000401", "Mauro");
    const buyer = makePlayer("76561198000000402", "Katerina");

    handlers.get(REGION_CEDE)(admin, { region: "Suchdol", confirm: 1 });
    assert.deepEqual(edits, [{ kind: "cede", region: "Suchdol", to: "76561198000000401" }], "no target: the region is the administrator's own");
    assert.deepEqual(ofKind(admin, NOTICE).map((entry) => entry.payload.text), ["Suchdol agora é de Mauro"]);
    assert.ok(!chat.some((line) => /cedeu a você/.test(line)), "nobody is told it was given to them: it was them");
    assert.ok(ofKind(admin, SOCIAL).length >= 1, "and the panel is drawn again, with the properties in it");

    handlers.get(REGION_CEDE)(admin, { region: "Suchdol", targetId: buyer.id, confirm: 1 });
    assert.deepEqual(edits.at(-1), { kind: "cede", region: "Suchdol", to: "76561198000000402" });
    assert.match(chat.at(-1), /Mauro cedeu a você a região de Suchdol/);
    assert.ok(ofKind(buyer, SOCIAL).length >= 1, "the new lord sees what is theirs");
});

test("a region asked for without the confirmation is only counted, and one that is not in the catalog is refused", () => {
    const { handlers, edits } = load({ "76561198000000403": "admin" }, REGION_HOUSES.map((house) => ({ ...house })));
    const admin = makePlayer("76561198000000403", "Mauro");

    handlers.get(REGION_CEDE)(admin, { region: "Suchdol" });
    assert.deepEqual(edits, [], "nothing changes before the confirmation");
    assert.match(ofKind(admin, NOTICE).at(-1).payload.text, /Suchdol para Mauro: 2 propriedade\(s\)/);

    handlers.get(REGION_CEDE)(admin, { region: "Praga", confirm: 1 });
    handlers.get(REGION_CEDE)(admin, { confirm: 1 });
    assert.deepEqual(edits, []);
    assert.equal(ofKind(admin, NOTICE).at(-1).payload.text, "Escolha uma região para ceder.");
});

test("a player cannot take or cede a region, whoever they name", () => {
    const { handlers, edits } = load({}, REGION_HOUSES.map((house) => ({ ...house })));
    const player = makePlayer("76561198000000404", "Hans");
    const other = makePlayer("76561198000000405", "Katerina");
    handlers.get(REGION_CEDE)(player, { region: "Suchdol", confirm: 1 });
    handlers.get(REGION_CEDE)(player, { region: "Suchdol", targetId: other.id, confirm: 1 });
    assert.deepEqual(edits, []);
    assert.deepEqual(ofKind(player, NOTICE), [], "and no word: the request is just dropped");
});

const SET_SOCIAL = "kcdc-gamemode:status.setSocial";
const FAMILY_EDIT = "kcdc-gamemode:status.familyEdit";
const ROSTER = "kcdc-gamemode:status.roster";

test("a player's payload carries the titles they hold and the one they wear, and the roster a line of them for an administrator", () => {
    const { handlers, titles, shown } = load({ "76561198000000301": "admin" });
    const admin = makePlayer("76561198000000301", "Mauro");
    const hans = makePlayer("76561198000000302", "Hans");
    titles["76561198000000302"] = ["cavaleiro", "burgrave"];
    shown["76561198000000302"] = "cavaleiro";

    handlers.get(POLL)(hans);
    const own = ofKind(hans, SOCIAL).at(-1).payload;
    assert.deepEqual(own.titles.map((line) => line.id), ["cavaleiro", "burgrave"]);
    assert.equal(own.shownTitle, "cavaleiro");
    assert.equal(own.title, undefined, "no free-text title any more");
    assert.equal(own.titleSuggestions, undefined);

    const row = rosterOf(handlers, admin).players.find((entry) => entry.id === hans.id);
    assert.equal(row.titles, "Cavaleiro · Burgrave", "the highest first, in the body's own form");
    assert.deepEqual(row.titleIds, ["cavaleiro", "burgrave"], "the ids too, for the form that gives and takes titles");
    for (const bar of ["health", "stamina", "hunger", "energy"]) {
        assert.ok(Array.isArray(row[bar]) && row[bar].length === 2, `${bar} for the players page`);
    }
    assert.equal(row.steamId, "76561198000000302");
});

test("whom a noble may name is the nominations module's own list, searched and paged like any other, and nobody's by default", () => {
    const { handlers, api } = load({ "76561198000000303": "admin" });
    const admin = makePlayer("76561198000000303", "Mauro");
    const hans = makePlayer("76561198000000304", "Hans");
    assert.deepEqual(rosterOf(handlers, hans, { tag: "nom" }).players, [], "nothing until a module says whom");

    api.setNominees((player) => (player.id === hans.id ? [{ id: admin.id, name: "Mauro" }, { id: 77, name: "Ivan Zeman" }] : []));
    assert.deepEqual(rosterOf(handlers, hans, { tag: "nom" }).players, [{ id: 77, nickname: "Ivan Zeman" }, { id: admin.id, nickname: "Mauro" }]);
    assert.deepEqual(rosterOf(handlers, hans, { tag: "nom", q: "zem" }).players, [{ id: 77, nickname: "Ivan Zeman" }]);
    assert.deepEqual(rosterOf(handlers, admin, { tag: "nom" }).players, [], "a contributor that has nothing for somebody gives nothing");
});

test("raising a player to the nobility takes along the spouse and the legitimate line linked in the tree, when asked", () => {
    const { handlers, api } = load({ "76561198000000311": "admin" });
    const admin = makePlayer("76561198000000311", "Mauro");
    const hans = makePlayer("76561198000000312", "Hans");
    const dorota = makePlayer("76561198000000313", "Dorota");
    const jan = makePlayer("76561198000000314", "Jan");
    const adopted = makePlayer("76561198000000315", "Vojtech");
    const brother = makePlayer("76561198000000316", "Hynek");
    for (const [relation, relative] of [["esposa", dorota], ["filho", jan], ["filho_adotivo", adopted], ["irmao", brother]]) {
        handlers.get(FAMILY_ADD)(hans, { relation, name: relative.nickname, linkId: relative.id });
        answer(handlers, relative);
    }

    handlers.get(SET_SOCIAL)(admin, { targetId: hans.id, status: "nobilis", family: 1 });
    const status = (player) => api.getSocialStatus(player.steamId);
    assert.deepEqual([hans, dorota, jan, adopted, brother].map(status), ["nobilis", "nobilis", "nobilis", "plebeius", "plebeius"]);
    assert.match(ofKind(admin, NOTICE).at(-1).payload.text, /Nobilis \(nobre\) agora: Hans, Dorota, Jan\./);
    assert.equal(ofKind(dorota, SOCIAL).at(-1).payload.socialStatus.label, "Nobilis", "the spouse's page says so at once");

    handlers.get(SET_SOCIAL)(admin, { targetId: hans.id, status: "plebeius", family: 0 });
    assert.deepEqual([hans, dorota].map(status), ["plebeius", "nobilis"], "only him when the family is left out");
    handlers.get(SET_SOCIAL)(hans, { targetId: hans.id, status: "nobilis", family: 1 });
    assert.equal(status(hans), "plebeius", "a player cannot raise themselves");
    handlers.get(SET_SOCIAL)(admin, { targetId: hans.id, status: "rei", family: 1 });
    assert.equal(status(hans), "plebeius", "only plebeius and nobilis");
});

test("the players page lists who would change along, and a relative may be linked, edited and unlinked from the tree", () => {
    const { handlers } = load({ "76561198000000321": "admin" });
    const admin = makePlayer("76561198000000321", "Mauro");
    const hans = makePlayer("76561198000000322", "Hans");
    const kat = makePlayer("76561198000000323", "Katerina");
    handlers.get(FAMILY_ADD)(hans, { relation: "esposa", name: "Dorota", linkId: kat.id });
    answer(handlers, kat);

    const entry = rosterOf(handlers, admin).players.find((row) => row.id === hans.id);
    assert.deepEqual(entry.heirs, ["Dorota (Katerina)"]);
    assert.equal(entry.statusId, "plebeius");
    assert.equal(ofKind(kat, SOCIAL).at(-1).payload.maritalStatus.gloss, "casado", "named as a spouse: married (her character is a man here)");

    const tree = ofKind(hans, SOCIAL).at(-1).payload.family;
    assert.equal(tree[0].player, true);
    handlers.get(FAMILY_EDIT)(hans, { id: tree[0].id, deceased: 1 });
    assert.equal(ofKind(hans, SOCIAL).at(-1).payload.family[0].deceased, true);
    assert.equal(ofKind(hans, SOCIAL).at(-1).payload.maritalStatus.gloss, "viúvo");
    handlers.get(FAMILY_EDIT)(hans, { id: tree[0].id, linkId: -1 });
    assert.equal(ofKind(hans, SOCIAL).at(-1).payload.family[0].player, false);
    handlers.get(FAMILY_EDIT)(hans, { id: tree[0].id, linkId: hans.id });
    assert.match(ofKind(hans, NOTICE).at(-1).payload.text, /seu próprio parente/);
    handlers.get(FAMILY_ADD)(hans, { relation: "filho", name: "Ninguém", linkId: 99999 });
    assert.match(ofKind(hans, NOTICE).at(-1).payload.text, /não está mais no servidor/);
});

// ---------------------------------------------------------------------------------------------
// The lists of players, a page at a time.

test("the administrator's list is cut into pages of twelve, by name, and says how many there are", () => {
    const { handlers } = load({ "76561198000000401": "admin" });
    const admin = makePlayer("76561198000000401", "Mauro");
    for (let n = 1; n <= 29; n += 1) makePlayer(`765611980000005${String(n).padStart(2, "0")}`, `Jogador ${String(n).padStart(2, "0")}`);

    const first = rosterOf(handlers, admin);
    assert.deepEqual([first.page, first.pages, first.total, first.players.length], [0, 3, 30, 12]);
    assert.equal(first.players[0].nickname, "Jogador 01");
    const last = rosterOf(handlers, admin, { page: 2 });
    assert.deepEqual([last.page, last.players.length], [2, 6]);
    assert.equal(last.players.at(-1).nickname, "Mauro", "M comes after J");
    assert.equal(rosterOf(handlers, admin, { page: 99 }).page, 2, "a page past the end is the last one");
    assert.equal(rosterOf(handlers, admin, { page: -3 }).page, 0);
    assert.equal(rosterOf(handlers, admin, { page: "x" }).page, 0);
});

test("a search finds a player by part of the name, without caring for accents or case, and by the number", () => {
    const { handlers } = load({ "76561198000000402": "admin" });
    const admin = makePlayer("76561198000000402", "Mauro");
    const jose = makePlayer("76561198000000403", "José Alves");
    makePlayer("76561198000000404", "Katerina");
    makePlayer("76561198000000405", "Jose Maria");

    assert.deepEqual(Array.from(rosterOf(handlers, admin, { q: "jose" }).players, (entry) => entry.nickname), ["José Alves", "Jose Maria"]);
    assert.deepEqual(Array.from(rosterOf(handlers, admin, { q: "  MARIA " }).players, (entry) => entry.nickname), ["Jose Maria"]);
    assert.deepEqual(Array.from(rosterOf(handlers, admin, { q: "jose alves" }).players, (entry) => entry.nickname), ["José Alves"], "every word must be in the name");
    assert.deepEqual(Array.from(rosterOf(handlers, admin, { q: String(jose.id) }).players, (entry) => entry.nickname), ["José Alves"]);
    assert.deepEqual(Array.from(rosterOf(handlers, admin, { q: `#${jose.id}` }).players, (entry) => entry.id), [jose.id]);
    const none = rosterOf(handlers, admin, { q: "zzz" });
    assert.deepEqual([none.total, none.pages, none.page, none.players.length], [0, 1, 0, 0]);
    assert.equal(rosterOf(handlers, admin, { q: "a".repeat(200) }).q.length, 40, "the text is cut");
});

test("the list can be filtered to administrators, supporters, nobles, and those without a guild", () => {
    const { handlers, files, supporterSummaries } = load({ "76561198000000411": "admin" });
    files.set("playerdata/social.json", JSON.stringify({ "76561198000000412": { socialStatus: "nobilis", guildId: "venatores", factionId: null, showcase: "guild", updatedAt: 1 } }));
    supporterSummaries["76561198000000413"] = { since: "01/10/2026", last: "14/10/2026", times: 1 };
    const admin = makePlayer("76561198000000411", "Mauro");
    const noble = makePlayer("76561198000000412", "Radovan");
    const patron = makePlayer("76561198000000413", "Katerina");
    const names = (filter) => Array.from(rosterOf(handlers, admin, { filter }).players, (entry) => entry.nickname);

    assert.deepEqual(names("all"), ["Katerina", "Mauro", "Radovan"]);
    assert.deepEqual(names("admin"), ["Mauro"]);
    assert.deepEqual(names("patron"), ["Katerina"]);
    assert.deepEqual(names("noble"), ["Radovan"]);
    assert.deepEqual(names("noguild"), ["Katerina", "Mauro"]);
    assert.deepEqual(names("nonsense"), ["Katerina", "Mauro", "Radovan"], "a filter that does not exist is all");
    assert.equal(rosterOf(handlers, admin, { filter: "noble", q: "kat" }).total, 0, "a filter and a search together");
    assert.ok(noble && patron);
});

test("a picker is answered with eight at a time, never the one who asks, nobody who is still joining, and the list is the same however many ask", () => {
    const { handlers } = load();
    const me = makePlayer("76561198000000421", "Eu");
    for (let n = 1; n <= 11; n += 1) makePlayer(`765611980000004${30 + n}`, `Vizinho ${String(n).padStart(2, "0")}`);
    const joining = makePlayer("76561198000000450", "Entrando");
    joining.ready = false;

    const page = rosterOf(handlers, me, { tag: "pick" });
    assert.deepEqual([page.total, page.pages, page.players.length], [11, 2, 8]);
    assert.ok(!page.players.some((entry) => entry.id === me.id || entry.id === joining.id));
    assert.equal(rosterOf(handlers, me, { tag: "pick", page: 1 }).players.length, 3, "page 2 of 11 is three");
    assert.deepEqual(Array.from(rosterOf(handlers, me, { tag: "pick", q: "vizinho 10" }).players, (entry) => entry.nickname), ["Vizinho 10"]);
});

test("what an administrator last asked of the list is what an action refreshes", () => {
    const GRANT = "kcdc-gamemode:status.supporterGrant";
    const { handlers } = load({ "76561198000000461": "admin" });
    const admin = makePlayer("76561198000000461", "Mauro");
    const hans = makePlayer("76561198000000462", "Hans");
    makePlayer("76561198000000463", "Dorota");
    rosterOf(handlers, admin, { q: "han", filter: "all" });
    handlers.get(GRANT)(admin, { targetId: hans.id });
    const refreshed = admin.sent.filter((entry) => entry.event === "kcdc-gamemode:status.roster").at(-1).payload;
    assert.equal(refreshed.q, "han");
    assert.deepEqual(Array.from(refreshed.players, (entry) => entry.nickname), ["Hans"]);
});

test("a toast of the panel, and the chat line with it, are said in the language the player chose", () => {
    const { handlers, chat, languages } = load();
    const english = makePlayer("76561198000000471", "Hans");
    const portuguese = makePlayer("76561198000000472", "Kath");
    languages["76561198000000471"] = "en";
    handlers.get(SELECT)(english, { guildId: "inventada" });
    handlers.get(SELECT)(portuguese, { guildId: "inventada" });
    const toast = (player) => player.sent.filter((entry) => entry.event === "kcdc-gamemode:status.notice").at(-1);
    assert.equal(toast(english), undefined, "this refusal is only a chat line");
    handlers.get("kcdc-gamemode:status.propLock")(english, { id: "nao-existe", locked: 1 });
    assert.equal(toast(english).payload.text, "[en] Propriedade não encontrada.");
    assert.equal(chat.at(-1), "[en] Propriedade não encontrada.");
    handlers.get("kcdc-gamemode:status.propLock")(portuguese, { id: "nao-existe", locked: 1 });
    assert.equal(toast(portuguese).payload.text, "Propriedade não encontrada.");
});
