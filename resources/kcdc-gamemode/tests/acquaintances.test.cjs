const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

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

const NAMES = (() => {
    const box = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-name.js"), "utf8"), box);
    return box.exports;
})();

/** surnames, genders and names map Steam ids to what family.ts and characters.ts would say (a name is { name, epithet }). */
function load({ seed = {}, surnames = {}, genders = {}, names = {} } = {}) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return storeSandbox.exports;
            if (id === "./family.js") return { getSurname: (steamId) => surnames[steamId] ?? null };
            if (id === "./character-name.js") return NAMES;
            if (id === "./characters.js") return { getCharacter: (steamId) => (genders[steamId] || names[steamId] ? { appearance: { gender: genders[steamId] ?? "male" }, ...names[steamId] } : null) };
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line), error: (line) => logs.push(line) },
        Date,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/acquaintances.js"), "utf8"), context);
    return { api: context.exports, disk, logs };
}

const player = (id, nickname, steamId = `7656119800000000${id}`, appearance = { gender: "male" }) => ({ id, nickname, steamId, appearance });

test("a stranger is Desconhecido or Desconhecida, by the body they chose", () => {
    const sut = load({ genders: { "76561198000000002": "female" } });
    const hans = player(1, "Hans");
    const kat = player(2, "Katerina");
    assert.equal(sut.api.labelFor(hans, kat), "Desconhecida");
    assert.equal(sut.api.labelFor(kat, hans), "Desconhecido");
    const noSave = player(3, "Ana", "76561198000000003", { gender: "female" });
    assert.equal(sut.api.labelFor(hans, noSave), "Desconhecida", "without a saved look, the body's own");
    assert.equal(sut.api.labelFor(hans, hans), "Hans", "everybody knows themselves");
});

test("an introduction goes one way, once, and is kept on disk", () => {
    const sut = load();
    const hans = player(1, "Hans");
    const kat = player(2, "Katerina");
    assert.equal(sut.api.introduce(hans, kat, 1234), true);
    assert.equal(sut.api.introduce(hans, kat), false, "she already knows");
    assert.equal(sut.api.knows(kat, hans), true);
    assert.equal(sut.api.knows(hans, kat), false, "he still does not know her");
    assert.equal(sut.api.labelFor(kat, hans), "Hans");
    const saved = JSON.parse(sut.disk.files.get("playerdata/acquaintances.json"));
    assert.deepEqual(saved, { "76561198000000002": { "76561198000000001": 1234 } });

    const again = load({ seed: { "playerdata/acquaintances.json": JSON.stringify(saved) } });
    assert.equal(again.api.knows(kat, hans), true, "and remembered after a restart");
});

test("the name is the nickname and the family's surname, read when shown", () => {
    const surnames = {};
    const sut = load({ surnames });
    const hans = player(1, "Hans");
    const kat = player(2, "Katerina");
    sut.api.introduce(hans, kat);
    assert.equal(sut.api.nameOf(hans), "Hans");
    surnames["76561198000000001"] = "Capon";
    assert.equal(sut.api.labelFor(kat, hans), "Hans Capon");
});

test("the name is the one given in the creator, then the alcunha, then the family's surname; a character without one goes by its nickname", () => {
    const sut = load({
        names: { "76561198000000001": { name: "Henry", epithet: "ii" }, "76561198000000002": { name: "Katerina", epithet: "" } },
        surnames: { "76561198000000001": "Capon" },
    });
    const hans = player(1, "Hans");
    const kat = player(2, "Mauro");
    const old = player(3, "Ivan");
    assert.equal(sut.api.nameOf(hans), "Henry II Capon", "what the creator asked, not the account's nickname");
    assert.equal(sut.api.nameOf(kat), "Katerina");
    assert.equal(sut.api.nameOf(old), "Ivan", "made before the names were asked for");
    sut.api.introduce(hans, old);
    assert.equal(sut.api.labelFor(old, hans), "Henry II Capon");
    assert.equal(sut.api.labelFor(kat, hans), "Desconhecido");
});

test("an administrator reads the character's name with the account's in brackets, when they are not the same", () => {
    const sut = load({ names: { "76561198000000001": { name: "Henry", epithet: "ii" } }, surnames: { "76561198000000001": "Capon" } });
    assert.equal(sut.api.adminLabel(player(1, "Hans")), "Henry II Capon (Hans)");
    assert.equal(sut.api.adminLabel(player(2, "Ivan")), "Ivan", "nothing to add for a character that goes by its nickname");
});

test("a player without a Steam id can neither be known nor know anybody", () => {
    const sut = load();
    const hans = player(1, "Hans");
    const nobody = player(2, "Sem Steam", "");
    assert.equal(sut.api.introduce(nobody, hans), false);
    assert.equal(sut.api.introduce(hans, nobody), false);
    assert.equal(sut.api.labelFor(hans, nobody), "Desconhecido");
});

test("a file with odd entries keeps what makes sense, and an unreadable one is left alone", () => {
    const sut = load({ seed: { "playerdata/acquaintances.json": JSON.stringify({ a: { b: 5, c: "x" }, d: 7 }) } });
    assert.equal(sut.api.knows({ id: 1, steamId: "a" }, { id: 2, steamId: "b" }), true);
    assert.equal(sut.api.knows({ id: 1, steamId: "a" }, { id: 3, steamId: "c" }), false);

    const broken = load({ seed: { "playerdata/acquaintances.json": "{ not json" } });
    assert.equal(broken.api.knows({ id: 1, steamId: "a" }, { id: 2, steamId: "b" }), false);
    assert.ok(broken.logs.some((line) => /ilegível/.test(line)));
    assert.equal(broken.disk.files.get("playerdata/acquaintances.json"), "{ not json", "not overwritten by the read");
});
