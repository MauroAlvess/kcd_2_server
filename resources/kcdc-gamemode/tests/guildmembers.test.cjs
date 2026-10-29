const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

function pure(file) {
    const sandbox = { exports: {}, require: () => ({}) };
    vm.runInNewContext(dist(file), sandbox);
    return sandbox.exports;
}

/**
 * `people` maps a Steam id to what the modules the roster reads would say of them: { guild, titles, standing, name,
 * female, surname }. `known` lists "viewer>target" pairs of introductions; `admins` the Steam ids of administrators.
 */
function load(people, { known = [], admins = [] } = {}) {
    const handlers = new Map();
    const nobility = pure("nobility.js");
    const characterName = pure("character-name.js");
    const modules = {
        "./acquaintances.js": { knowsSteam: (viewer, target) => viewer !== "" && (viewer === target || known.includes(`${viewer}>${target}`)) },
        "./auth.js": { isAdmin: (player) => admins.includes(player.steamId) },
        "./character-name.js": characterName,
        "./characters.js": {
            getCharacter: (steamId) => (people[steamId] ? { nickname: `conta-${steamId.slice(-2)}`, name: people[steamId].name, epithet: people[steamId].epithet, appearance: { gender: people[steamId].female ? "female" : "male" } } : null),
        },
        "./family.js": { getSurname: (steamId) => people[steamId]?.surname ?? null },
        "./nobility.js": nobility,
        "./status.js": {
            GUILDS: [{ id: "venatores" }, { id: "tabernarii" }],
            getGuildId: (steamId) => people[steamId]?.guild ?? null,
            getSocialStatus: (steamId) => people[steamId]?.standing ?? "plebeius",
            listGuildMembers: (guildId) => Object.keys(people).filter((steamId) => people[steamId].guild === guildId),
        },
        "./titles.js": { titlesOf: (steamId) => people[steamId]?.titles ?? [] },
    };
    const sandbox = {
        exports: {},
        require: (id) => {
            assert.ok(modules[id], `unexpected require ${id}`);
            return modules[id];
        },
        Events: { onClient: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(dist("guild-members.js"), sandbox);
    return { api: sandbox.exports, handlers };
}

const viewerOf = (steamId, sent = []) => ({ steamId, sent, emit: (event, payload) => sent.push({ event, payload: JSON.parse(payload) }) });

// Real ids of the catalog (nobility.ts): a lord of the great nobility, a knight, a burgomaster of a town.
const LORD = "lorde";
const KNIGHT = "cavaleiro";

function sample() {
    const people = {};
    people["1"] = { guild: "venatores", name: "Jan", titles: [], standing: "plebeius" };
    people["2"] = { guild: "venatores", name: "Hans", titles: [], standing: "nobilis" };
    people["3"] = { guild: "venatores", name: "Katerina", female: true, titles: [], standing: "plebeius", surname: "Capon" };
    people["4"] = { guild: "tabernarii", name: "Otto", titles: [], standing: "plebeius" };
    return people;
}

test("a name from the catalog of titles is known to the order the hierarchy reads in", () => {
    const { TITLES } = pure("nobility.js");
    for (const id of [LORD, KNIGHT]) {
        assert.ok(TITLES.some((title) => title.id === id), `${id} is a title of the catalog`);
    }
});

test("the members come in the hierarchy's order: the highest title, then nobles, then commoners, each by name", () => {
    const people = sample();
    people["1"].titles = [KNIGHT];
    people["2"].titles = [LORD];
    const { api } = load(people);
    const viewer = viewerOf("2");
    const roster = api.rosterOf(viewer, "venatores", 0);
    assert.deepEqual(Array.from(roster.members, (member) => member.name), ["Hans", "Jan", "Katerina Capon"], "a lord, a knight, then a commoner");
    assert.equal(roster.total, 3);
    assert.equal(roster.pages, 1);
    assert.equal(roster.members[0].titles, "Lorde");
    assert.equal(roster.members[2].titles, "");

    // With no titles at all: the noble first, then the commoners by name.
    const bare = sample();
    const again = load(bare).api.rosterOf(viewerOf("2"), "venatores", 0);
    assert.deepEqual(Array.from(again.members, (member) => [member.name, member.standing]), [["Hans", "nobilis"], ["Jan", "plebeius"], ["Katerina Capon", "plebeius"]]);
});

test("the lines say a woman's title as a woman's, and who the viewer is", () => {
    const people = sample();
    people["3"].titles = [KNIGHT];
    const { api } = load(people);
    const roster = api.rosterOf(viewerOf("3"), "venatores", 0);
    const katerina = roster.members.find((member) => member.name.startsWith("Katerina"));
    assert.equal(katerina.you, true);
    assert.equal(roster.members.filter((member) => member.you).length, 1);
    assert.equal(katerina.titles, "Cavaleira");
});

test("a name is seen by the same guild, by whoever was introduced, and by an administrator; to anybody else it is a stranger", () => {
    const people = sample();
    const { api } = load(people, { known: ["4>2"], admins: ["9"] });
    people["9"] = { guild: null, name: "Admin", titles: [], standing: "plebeius" };

    const brother = api.rosterOf(viewerOf("1"), "venatores", 0);
    assert.deepEqual(Array.from(brother.members, (member) => member.name).sort(), ["Hans", "Jan", "Katerina Capon"], "the guild's own");

    const outsider = api.rosterOf(viewerOf("4"), "venatores", 0);
    const names = Array.from(outsider.members, (member) => member.name);
    assert.ok(names.includes("Hans"), "introduced to Hans");
    assert.ok(names.includes("Desconhecido"), "Jan is a stranger to him");
    assert.ok(names.includes("Desconhecida"), "and Katerina, a stranger in her own gender");
    assert.ok(!names.some((name) => /Jan|Katerina/.test(name)));

    const admin = api.rosterOf(viewerOf("9"), "venatores", 0);
    assert.deepEqual(Array.from(admin.members, (member) => member.name).sort(), ["Hans", "Jan", "Katerina Capon"]);

    const anonymous = api.rosterOf(viewerOf(""), "venatores", 0);
    assert.ok(Array.from(anonymous.members, (member) => member.name).every((name) => /^Desconhecid/.test(name)));
});

test("a guild is read a page at a time, and a page out of range is the nearest one", () => {
    const people = {};
    for (let n = 1; n <= 23; n += 1) {
        people[String(1000 + n)] = { guild: "venatores", name: `Membro${String(n).padStart(2, "0")}`, titles: [], standing: "plebeius" };
    }
    const { api } = load(people, { admins: ["9"] });
    const viewer = viewerOf("9");
    const first = api.rosterOf(viewer, "venatores", 0);
    assert.equal(first.members.length, api.PAGE_SIZE);
    assert.equal(first.total, 23);
    assert.equal(first.pages, 3);
    assert.equal(first.members[0].name, "Membro01");
    assert.equal(api.rosterOf(viewer, "venatores", 2).members.length, 3);
    assert.equal(api.rosterOf(viewer, "venatores", 99).page, 2);
    assert.equal(api.rosterOf(viewer, "venatores", -4).page, 0);
    assert.equal(api.rosterOf(viewer, "venatores", 1.5).page, 0);
});

test("an empty guild has one empty page, and a guild that is not in the catalog has none", () => {
    const { api } = load({});
    const roster = api.rosterOf(viewerOf("1"), "tabernarii", 0);
    assert.deepEqual({ total: roster.total, pages: roster.pages, page: roster.page, members: roster.members.length }, { total: 0, pages: 1, page: 0, members: 0 });
    assert.equal(api.rosterOf(viewerOf("1"), "no-such-guild", 0), null);
});

test("the page asks by event and is answered with its own page; nonsense is not answered", () => {
    const { api, handlers } = load(sample(), { admins: ["1"] });
    api.installGuildMembers();
    const handler = handlers.get(`${RESOURCE}:status.guildMembers`);
    const sent = [];
    const viewer = viewerOf("1", sent);

    handler(viewer, JSON.stringify({ guildId: "venatores", page: 0 }));
    assert.equal(sent.length, 1);
    assert.equal(sent[0].event, `${RESOURCE}:status.guildMembers`);
    assert.equal(sent[0].payload.guildId, "venatores");
    assert.equal(sent[0].payload.members.length, 3);

    handler(viewer, { guildId: "tabernarii" });
    assert.equal(sent.length, 2, "an object is read as it is");

    handler(viewer, "not json");
    handler(viewer, JSON.stringify({ guildId: "no-such-guild" }));
    handler(viewer, JSON.stringify({ guildId: 7 }));
    handler(viewer, null);
    assert.equal(sent.length, 2);

    const text = JSON.stringify(sent[0].payload);
    assert.ok(!/steam|"1"|conta-/i.test(text), "no Steam id and no account name goes to the page");
});

test("only an administrator is answered (2026-10-26: the Ver membros button is theirs alone), even a member of the guild asked about", () => {
    const { api, handlers } = load(sample(), { admins: ["9"] });
    api.installGuildMembers();
    const handler = handlers.get(`${RESOURCE}:status.guildMembers`);
    const member = [];
    const outsider = [];
    const admin = [];
    handler(viewerOf("1", member), JSON.stringify({ guildId: "venatores", page: 0 }));
    handler(viewerOf("4", outsider), JSON.stringify({ guildId: "venatores", page: 0 }));
    assert.deepEqual([member.length, outsider.length], [0, 0], "a brother of the guild and a stranger are told nothing");
    handler(viewerOf("9", admin), JSON.stringify({ guildId: "venatores", page: 0 }));
    assert.equal(admin.length, 1);
    assert.equal(admin[0].payload.members.length, 3);
});
