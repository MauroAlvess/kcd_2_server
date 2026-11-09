"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// A character's age and height (src/server/character-details.ts, 2026-11-02: "idade com limite de uma idade razoável naquela época, tanto mínima quanto
// máxima; altura respeitando limites masculino e feminino"), kept with its look (characters.ts), and the level of the Personagem section (character-sheet.ts:
// "o nível é a soma de todos os níveis dele").

const plain = (value) => JSON.parse(JSON.stringify(value));
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

function details() {
    const box = { exports: {} };
    vm.runInNewContext(dist("character-details.js"), box);
    return box.exports;
}

test("an age is a whole number from 18 to 80; a man's height 1.55 to 2.00 m and a woman's 1.45 to 1.85 m, in centimetres", () => {
    const api = details();
    assert.equal(api.cleanAge(18), 18);
    assert.equal(api.cleanAge(80), 80);
    for (const bad of [17, 81, 25.5, "25", null, undefined, Number.NaN]) assert.equal(api.cleanAge(bad), null, String(bad));
    assert.equal(api.cleanHeight(155, "male"), 155);
    assert.equal(api.cleanHeight(200, "male"), 200);
    assert.equal(api.cleanHeight(154, "male"), null);
    assert.equal(api.cleanHeight(145, "female"), 145);
    assert.equal(api.cleanHeight(185, "female"), 185);
    assert.equal(api.cleanHeight(190, "female"), null, "a man's height is not a woman's");
    assert.equal(api.cleanHeight(172.5, "male"), null);
    assert.equal(api.heightText(174), "1,74 m");
    assert.equal(api.heightText(160), "1,60 m");
    assert.deepEqual(plain(api.detailsForPage().defaults), { age: 25, height: { male: 172, female: 162 } });
});

test("a saved character lacks them until it has both; nothing saved lacks nothing", () => {
    const api = details();
    assert.equal(api.lacksDetails({ appearance: {} }), true);
    assert.equal(api.lacksDetails({ age: 30 }), true);
    assert.equal(api.lacksDetails({ age: 30, height: 175 }), false);
    assert.equal(api.lacksDetails(null), false, "a newcomer is the creator's first time, not this");
});

test("the level is every track's level added up; unknown without tracks", () => {
    const api = details();
    assert.equal(api.levelOf({ tracks: { strength: { level: 24, xp: 3 }, alchemy: { level: 10, xp: 0 }, prestige: { level: 0, xp: 0 } } }), 34);
    assert.equal(api.levelOf({ tracks: { strength: { level: "x" }, agility: { level: 5 } } }), 5, "a level that is no number is left out");
    assert.equal(api.levelOf({ tracks: {} }), null);
    assert.equal(api.levelOf(null), null);
    assert.equal(api.levelOf(undefined), null);
});

test("the Personagem section is told the age, the height and the level: the game's report first, the saved progression before it, read once a minute", () => {
    const reads = [];
    const saved = { "76561198000000001": { appearance: {}, age: 33, height: 181 } };
    let payload = null;
    const box = {
        exports: {},
        require: (id) => ({
            "./character-details.js": details(),
            "./character-state.js": { savedProgression: (steamId) => { reads.push(steamId); return { tracks: { strength: { level: 20, xp: 0 }, agility: { level: 15, xp: 0 } }, perks: [], perkPoints: {} }; } },
            "./characters.js": { getCharacter: (steamId) => saved[steamId] ?? null },
            "./status.js": { addPayload: (fn) => { payload = fn; } },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        Events: { on() {} },
        Date,
    };
    vm.runInNewContext(dist("character-sheet.js"), box);
    box.exports.installCharacterSheet();
    const joining = { steamId: "76561198000000001", progression: null };
    assert.deepEqual(plain(payload(joining)), { sheet: { age: 33, height: 181, level: 35 } }, "before the game's report: the saved one");
    payload(joining);
    assert.equal(reads.length, 1, "read once");
    joining.progression = { tracks: { strength: { level: 21, xp: 0 }, agility: { level: 15, xp: 0 } } };
    assert.deepEqual(plain(payload(joining).sheet), { age: 33, height: 181, level: 36 }, "the game's report takes over");
    assert.deepEqual(plain(payload({ steamId: "76561198000000009", progression: null }).sheet), { age: null, height: null, level: 35 });
});

test("the look saved alone (a barber's work, the game's stage) keeps the age and the height said in the creator", () => {
    const files = new Map();
    const box = {
        exports: {},
        require: (id) => (id === "node:fs" ? {
            readFileSync: (file) => { if (!files.has(file)) throw new Error("ENOENT"); return files.get(file); },
            writeFileSync: (file, data) => files.set(file, data),
            mkdirSync() {},
        } : assert.fail(`unexpected require ${id}`)),
        Date,
        JSON,
    };
    vm.runInNewContext(dist("characters.js"), box);
    const api = box.exports;
    const look = { gender: "male", head: "m_head_000", hair: "", beard: "", body: "" };
    api.saveCharacter("76561198000000002", look, "Hans", { name: "Hans", epithet: "" }, { age: 40, height: 180 });
    api.saveCharacter("76561198000000002", { ...look, hair: "m_hair_barber_01" }, "Hans");
    const kept = api.getCharacter("76561198000000002");
    assert.equal(kept.age, 40);
    assert.equal(kept.height, 180);
    assert.equal(kept.name, "Hans");
    assert.equal(kept.appearance.hair, "m_hair_barber_01");
});
