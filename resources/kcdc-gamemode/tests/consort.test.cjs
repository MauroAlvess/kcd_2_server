"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The spouse of a player as the realm names them at their side (src/server/consort.ts, 2026-10-25): a lord's wife is a Lady.

const LORD = "76561198000000001";
const WIFE = "76561198000000002";
const KNIGHT = "76561198000000003";
const BURGHER = "76561198000000004";

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const nobility = { exports: {} };
vm.runInNewContext(dist("nobility.js"), nobility);

function load({ spouses = {}, genders = {}, names = {}, titles = {} } = {}) {
    const requires = {
        "./characters.js": { getCharacter: (steamId) => (genders[steamId] ? { appearance: { gender: genders[steamId] } } : null) },
        "./family.js": { spousesOf: (steamId) => spouses[steamId] ?? [] },
        "./guild-members.js": { nameOfMember: (steamId) => names[steamId] ?? "um jogador" },
        "./nobility.js": nobility.exports,
        "./titles.js": { titlesOf: (steamId) => titles[steamId] ?? [] },
    };
    const sandbox = { exports: {}, require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`) };
    vm.runInNewContext(dist("consort.js"), sandbox);
    return sandbox.exports;
}

test("the wife of a lord is a Lady, called by her own character's name; the wife of a marquis, a prince and a king take the feminine of his title", () => {
    const sut = load({
        spouses: { [LORD]: [{ steamId: WIFE, name: "Elis", relation: "esposa" }] },
        genders: { [LORD]: "male", [WIFE]: "female" },
        names: { [WIFE]: "Elisabeth of England" },
        titles: { [LORD]: ["lorde"] },
    });
    assert.deepEqual(plain(sut.consortsOf(LORD)), [{ label: "Lady", name: "Elisabeth of England", courtesy: true, text: "Lady Elisabeth of England", steamId: WIFE }], "the tree's own word for her is not what she is called: her character's name is");

    for (const [title, label] of [["marques", "Marquesa"], ["principe", "Princesa"], ["rei", "Rainha"], ["cavaleiro", "Dama"], ["escudeiro", "Dama"], ["pequeno-nobre", "Dama"]]) {
        const other = load({ spouses: { [LORD]: [{ steamId: null, name: "Kath", relation: "esposa" }] }, genders: { [LORD]: "male" }, titles: { [LORD]: [title] } });
        assert.equal(other.consortsOf(LORD)[0].label, label, title);
        assert.equal(other.consortsOf(LORD)[0].text, `${label} Kath`, title);
    }
});

test("a spouse of somebody with no rank of the blood, and a husband, are only a spouse: the name, and the plain word in brackets", () => {
    const burgher = load({ spouses: { [BURGHER]: [{ steamId: null, name: "Kath", relation: "esposa" }] }, genders: { [BURGHER]: "male" }, titles: { [BURGHER]: ["burgomestre"] } });
    assert.deepEqual(plain(burgher.consortsOf(BURGHER)), [{ label: "Esposa", name: "Kath", courtesy: false, text: "Kath (esposa)", steamId: null }], "a burgomaster's wife is no lady");

    const commoner = load({ spouses: { [BURGHER]: [{ steamId: null, name: "Kath", relation: "esposa" }] } });
    assert.equal(commoner.consortsOf(BURGHER)[0].label, "Esposa", "nor a commoner's");

    const lady = load({ spouses: { [LORD]: [{ steamId: null, name: "Jan", relation: "esposo" }] }, genders: { [LORD]: "female" }, titles: { [LORD]: ["lorde"] } });
    assert.deepEqual(plain(lady.consortsOf(LORD)), [{ label: "Esposo", name: "Jan", courtesy: false, text: "Jan (esposo)", steamId: null }], "a Lady in her own right has a husband, not a lord's courtesy for him");
});

test("who a spouse is comes from the character when the spouse is a player: the gender of the body, and the name; unknown, and the word is Consorte", () => {
    const sut = load({
        spouses: { [LORD]: [{ steamId: WIFE, name: "", relation: null }], [KNIGHT]: [{ steamId: WIFE, name: "Dorota", relation: "esposa" }] },
        genders: { [LORD]: "male", [KNIGHT]: "male" },
        names: { [WIFE]: "Dorota Capon" },
        titles: { [LORD]: ["lorde"], [KNIGHT]: ["cavaleiro"] },
    });
    assert.deepEqual(plain(sut.consortsOf(LORD)), [{ label: "Consorte", name: "Dorota Capon", courtesy: false, text: "Dorota Capon (consorte)", steamId: WIFE }], "another tree names her and her body's gender is not known: no style is guessed");

    const known = load({
        spouses: { [LORD]: [{ steamId: WIFE, name: "", relation: null }, { steamId: KNIGHT, name: "Ivan", relation: "esposa" }] },
        genders: { [LORD]: "male", [WIFE]: "female", [KNIGHT]: "male" },
        names: { [WIFE]: "Dorota Capon", [KNIGHT]: "Ivan Kovar" },
        titles: { [LORD]: ["lorde"] },
    });
    assert.deepEqual(plain(known.consortsOf(LORD).map((one) => one.text)), ["Lady Dorota Capon", "Ivan Kovar (esposo)"], "her body is a woman's: a Lady; his is a man's, whatever the tree wrote");
});

test("nobody is nobody's consort, and a player with no Steam id has none; the style is a pure rule of the catalog", () => {
    const sut = load();
    assert.deepEqual(plain(sut.consortsOf("")), []);
    assert.deepEqual(plain(sut.consortsOf(LORD)), []);
    const { consortStyle, titleById } = nobility.exports;
    assert.equal(consortStyle(titleById("lorde"), false, true), "Lady");
    assert.equal(consortStyle(titleById("lorde"), false, null), "Consorte");
    assert.equal(consortStyle(titleById("lorde"), true, true), "Esposa", "a woman lord's wife: no courtesy");
    assert.equal(consortStyle(titleById("burgrave"), false, true), "Esposa", "an office is no rank of the blood");
    assert.equal(consortStyle(null, false, false), "Esposo");
});

test("with the real family book and the real titles: a lord whose wife accepted the link has a Lady, and a wife marked dead leaves him none (2026-10-25)", () => {
    const files = new Map();
    const fakeFs = { readFileSync(file) { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); }, writeFileSync(file, data) { files.set(file, data); }, mkdirSync() {} };
    const family = { exports: {} };
    vm.runInNewContext(dist("family.js"), { exports: family.exports, require: () => fakeFs });
    const fakeStore = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, body) => files.set(file, JSON.stringify(body)),
    };
    const genders = { [LORD]: "male", [WIFE]: "female" };
    const characters = { getCharacter: (steamId) => (genders[steamId] ? { appearance: { gender: genders[steamId] } } : null) };
    const titles = { exports: {} };
    vm.runInNewContext(dist("titles.js"), {
        exports: titles.exports,
        require: (id) => (id === "./nobility.js" ? nobility.exports : id === "./characters.js" ? characters : id === "./store.js" ? fakeStore : id === "./thieves.js" ? { onThiefChange() {}, thiefMark: () => null } : assert.fail(`titles: unexpected ${id}`)),
        console: { log() {}, error() {} },
    });
    titles.exports.addTitle(LORD, "Gunther", "lorde", { steamId: "admin", name: "a Coroa" });
    const requires = {
        "./characters.js": characters,
        "./family.js": family.exports,
        "./guild-members.js": { nameOfMember: (steamId) => (steamId === WIFE ? "Elisabeth iii von Silberhände" : "Gunther von Silberhände") },
        "./nobility.js": nobility.exports,
        "./titles.js": titles.exports,
    };
    const sandbox = { exports: {}, require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`) };
    vm.runInNewContext(dist("consort.js"), sandbox);

    // He writes her in his tree, she says yes: both trees have the link.
    const asked = family.exports.addPerson(LORD, "esposa", undefined, "Elizabeth III", WIFE, { name: "Gunther", gender: "male" });
    assert.equal(asked.ok, true);
    assert.deepEqual(plain(sandbox.exports.consortsOf(LORD)).map((one) => one.text), ["Lady Elizabeth III"], "asked, not linked yet: she is the name he gave, and his \"esposa\" is a lord's wife all the same");
    const key = JSON.parse(files.get("playerdata/family.json"))[LORD].persons[0].invite.key;
    assert.equal(family.exports.answerInvite(WIFE, key, true).ok, true);
    assert.deepEqual(plain(sandbox.exports.consortsOf(LORD)).map((one) => one.text), ["Lady Elisabeth iii von Silberhände"], "she said yes: her own name, and the lord's wife is a Lady");
    assert.deepEqual(plain(sandbox.exports.consortsOf(WIFE)).map((one) => one.text), ["Gunther von Silberhände (esposo)"], "and he is her husband, with no courtesy");

    const mine = JSON.parse(files.get("playerdata/family.json"))[LORD].persons[0].id;
    family.exports.editPerson(LORD, mine, { deceased: true });
    assert.deepEqual(plain(sandbox.exports.consortsOf(LORD)), [], "a widower has no lady");
});
