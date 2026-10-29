const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const MAURO = "76561198000000001";
const HANS = "76561198000000002";
const KATERINA = "76561198000000003";

/** The real titles module over a fake disk, a fake character book and the real catalog. */
function load({ saved = null, characters = {}, thieves = {} } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/titles.json", JSON.stringify(saved));
    const logs = [];
    const nobility = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/nobility.js"), "utf8"), nobility);
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./nobility.js") return nobility.exports;
            if (id === "./characters.js") return { getCharacter: (steamId) => characters[steamId] ?? null };
            if (id === "./thieves.js") return { onThiefChange() {}, thiefMark: (steamId) => thieves[steamId] ?? null };
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
                    write: (file, body) => files.set(file, JSON.stringify(body)),
                };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/titles.js"), "utf8"), context);
    return { api: context.exports, files, logs, disk: () => JSON.parse(files.get("playerdata/titles.json")) };
}

const by = (steamId, name) => ({ steamId, name });
const plain = (value) => JSON.parse(JSON.stringify(value));

function fakePlayer(steamId, gender = "male") {
    const calls = [];
    return {
        steamId,
        appearance: { gender },
        calls,
        setNametagVisible: (visible) => calls.push(["visible", visible]),
        setNametagText: (text) => calls.push(["text", text]),
        setNametagColor: (colour) => calls.push(["colour", colour]),
        setNametagHealthVisible: (visible) => calls.push(["health", visible]),
    };
}

test("a title is kept by Steam id with who named it, in a versioned file", () => {
    const { api, disk } = load();
    const granted = api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    assert.deepEqual(plain(granted), { replaced: null, displaced: null });
    assert.deepEqual(Array.from(api.titlesOf(HANS)), ["cavaleiro"]);
    assert.equal(disk().version, 2);
    assert.equal(disk().holders[HANS].name, "Hans");
    assert.equal(disk().holders[HANS].grants[0].by, MAURO);
    assert.equal(disk().holders[HANS].grants[0].byName, "Mauro");
    assert.ok(disk().holders[HANS].grants[0].at > 0);
    assert.deepEqual(Array.from(api.titlesOf("")), [], "no Steam id, no titles");
    assert.deepEqual(plain(api.addTitle("", "Ninguém", "cavaleiro", by(MAURO, "Mauro"))), { replaced: null, displaced: null });
});

test("a rank of the blood takes the place of the old one, an office is added beside it, and the highest reads first", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "escudeiro", by(MAURO, "Mauro"));
    api.addTitle(HANS, "Hans", "burgrave", by(MAURO, "Mauro"));
    assert.deepEqual(Array.from(api.titlesOf(HANS)), ["escudeiro", "burgrave"]);

    const granted = api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    assert.equal(granted.replaced, "escudeiro");
    assert.deepEqual(Array.from(api.titlesOf(HANS)), ["cavaleiro", "burgrave"]);
    assert.deepEqual(plain(api.titleLines(HANS, false).map((line) => line.label)), ["Cavaleiro", "Burgrave"]);
    assert.deepEqual(plain(api.titleLines(HANS, true).map((line) => line.label)), ["Cavaleira", "Burgrave"], "in the form of a woman's body");
});

test("a title only one may hold passes from its holder to the next, and the old holder is named", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "rei", by("admin", "a Coroa"));
    const granted = api.addTitle(KATERINA, "Katerina", "rei", by("admin", "a Coroa"));
    assert.equal(granted.displaced, HANS);
    assert.deepEqual(Array.from(api.titlesOf(HANS)), []);
    assert.deepEqual(Array.from(api.titlesOf(KATERINA)), ["rei"]);
    assert.equal(api.holderOfTitle("rei"), KATERINA);
    assert.equal(api.holderOfTitle("lorde"), null);
});

test("taking a title away forgets the holder when none is left, and the shown one with it", () => {
    const { api, disk } = load();
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    api.addTitle(HANS, "Hans", "burgrave", by(MAURO, "Mauro"));
    assert.equal(api.setShown(HANS, "burgrave"), true);
    assert.equal(api.shownOf(HANS), "burgrave");

    assert.equal(api.removeTitle(HANS, "burgrave"), true);
    assert.equal(api.shownOf(HANS), null, "what is not held is not worn");
    assert.equal(api.removeTitle(HANS, "burgrave"), false);
    assert.equal(api.removeTitle(HANS, "cavaleiro"), true);
    assert.equal(disk().holders[HANS], undefined);
});

test("only a title that is held can be worn; none puts it away", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    assert.equal(api.setShown(HANS, "rei"), false);
    assert.equal(api.setShown(KATERINA, "cavaleiro"), false);
    assert.equal(api.shownOf(HANS), null, "nothing is worn until it is chosen");
    assert.equal(api.setShown(HANS, "cavaleiro"), true);
    assert.equal(api.setShown(HANS, null), true);
    assert.equal(api.shownOf(HANS), null);
    assert.equal(api.setShown(KATERINA, null), true, "nothing to put away is not an error");
});

test("a rank that replaces the worn one is no longer worn", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "escudeiro", by(MAURO, "Mauro"));
    api.setShown(HANS, "escudeiro");
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    assert.equal(api.shownOf(HANS), null);
});

test("removeWhere takes the titles of the blood and keeps the offices, for a noble who stops being one", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "lorde", by("admin", "a Coroa"));
    api.addTitle(HANS, "Hans", "burgrave", by("admin", "a Coroa"));
    api.addTitle(HANS, "Hans", "bispo", by("admin", "a Coroa"));
    const taken = api.removeWhere(HANS, (title) => title.kind !== "office");
    assert.deepEqual(Array.from(taken), ["lorde", "bispo"]);
    assert.deepEqual(Array.from(api.titlesOf(HANS)), ["burgrave"]);
    assert.deepEqual(Array.from(api.removeWhere(KATERINA, () => true)), []);
});

test("the name is kept current for the hierarchy to list a holder who is away", () => {
    const { api } = load();
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    api.noteName(HANS, "Hans Capon");
    api.noteName(KATERINA, "Katerina");
    const listed = Array.from(api.holders());
    assert.equal(listed.length, 1);
    assert.equal(listed[0].name, "Hans Capon");
    assert.equal(listed[0].steamId, HANS);
});

test("the first version of the file, a free text for each Steam id, is read into the catalog and what has no place is kept aside", () => {
    const { api, files, logs } = load({ saved: { [HANS]: "Cavaleiro", [KATERINA]: "Senhor de Suchdol", [MAURO]: "Barão", "76561198000000009": "capitão da guarda", "76561198000000008": "Senhora" } });
    assert.deepEqual(Array.from(api.titlesOf(HANS)), ["cavaleiro"]);
    assert.deepEqual(Array.from(api.titlesOf("76561198000000009")), ["capitao-guarda"], "accents and case are not told apart");
    assert.deepEqual(Array.from(api.titlesOf("76561198000000008")), ["lorde"], "'Senhora' was a lady");
    assert.deepEqual(Array.from(api.titlesOf(KATERINA)), []);
    assert.deepEqual(Array.from(api.titlesOf(MAURO)), []);
    assert.ok(logs.some((line) => /2 título\(s\) antigo\(s\) de texto livre/.test(line) && /Senhor de Suchdol/.test(line) && /Barão/.test(line)));
    const kept = JSON.parse(files.get("playerdata/titles.legacy.json"));
    assert.equal(kept[KATERINA], "Senhor de Suchdol", "the old file is copied before anything overwrites it");
});

test("a file that is damaged is left alone, and an empty or new one starts with nobody", () => {
    const corrupt = { exports: {} };
    const files = new Map();
    const logs = [];
    const nobility = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/nobility.js"), "utf8"), nobility);
    const context = {
        exports: {},
        require: (id) => (id === "./nobility.js" ? nobility.exports : id === "./characters.js" ? { getCharacter: () => null } : id === "./thieves.js" ? { onThiefChange() {}, thiefMark: () => null } : { ensureDir() {}, read: () => ({ status: "corrupt", reason: "x" }), write: (file, body) => files.set(file, body) }),
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/titles.js"), "utf8"), context);
    assert.deepEqual(Array.from(context.exports.titlesOf(HANS)), []);
    assert.ok(logs.some((line) => /ilegível e foi deixado como está/.test(line)));
    assert.equal(corrupt.exports.x, undefined);

    const { api } = load();
    assert.deepEqual(Array.from(api.holders()), []);
});

test("over the head: only the title the player chose, in gold, in the form of their body; a commoner's nametag is off", () => {
    const { api } = load({ characters: { [KATERINA]: { appearance: { gender: "female" } } } });
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    api.addTitle(KATERINA, "Katerina", "cavaleiro", by(MAURO, "Mauro"));

    const hans = fakePlayer(HANS);
    api.applyNametag(hans);
    assert.deepEqual(plain(hans.calls), [["visible", false], ["text", ""], ["colour", 0xffffffff]], "a title that is held but not chosen is not worn");

    api.setShown(HANS, "cavaleiro");
    api.setShown(KATERINA, "cavaleiro");
    const worn = fakePlayer(HANS);
    api.applyNametag(worn);
    assert.deepEqual(plain(worn.calls), [["text", "Cavaleiro"], ["colour", 0xffd5a156], ["health", false], ["visible", true]]);
    const she = fakePlayer(KATERINA, "male");
    api.applyNametag(she);
    assert.deepEqual(plain(she.calls)[0], ["text", "Cavaleira"], "the saved look says woman whatever the game reports");

    const plainOne = fakePlayer("76561198000000077");
    api.applyNametag(plainOne);
    assert.deepEqual(plain(plainOne.calls)[0], ["visible", false]);

    const back = fakePlayer(HANS);
    api.restoreNametag(back);
    assert.deepEqual(plain(back.calls), [["text", ""], ["colour", 0xffffffff], ["visible", true]]);

    const gone = { steamId: HANS, appearance: { gender: "male" }, setNametagVisible() { throw new Error("gone"); }, setNametagText() { throw new Error("gone"); }, setNametagColor() {}, setNametagHealthVisible() {} };
    assert.doesNotThrow(() => api.applyNametag(gone), "a player gone between the event and here");
});

test("a marked thief wears Ladrão over the head, in red, over any title, and Ladra for a woman", () => {
    const mark = { name: "Hans", until: 2e12, reason: "roubou", at: 1 };
    const { api } = load({ characters: { [KATERINA]: { appearance: { gender: "female" } } }, thieves: { [HANS]: mark, [KATERINA]: mark } });
    api.addTitle(HANS, "Hans", "cavaleiro", by(MAURO, "Mauro"));
    api.setShown(HANS, "cavaleiro");
    const hans = fakePlayer(HANS);
    api.applyNametag(hans);
    assert.deepEqual(plain(hans.calls), [["text", "Ladrão"], ["colour", 0xffd23c32], ["health", false], ["visible", true]]);
    const she = fakePlayer(KATERINA, "male");
    api.applyNametag(she);
    assert.deepEqual(plain(she.calls)[0], ["text", "Ladra"]);
});
