"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// /nivel (src/server/commands/nivel.ts, 2026-10-23): an administrator's look at a character's levels and the way to give back a level that
// was lost, upward only, for a player who is in (the game is asked to take it) and for one who is not (the file is changed).

const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ online = [], characters = [], saved = {}, raise = {} } = {}) {
    const lines = [];
    const logs = [];
    const calls = { raised: [] };
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Object,
        Number,
        require: (id) =>
            ({
                "../character-state.js": {
                    savedProgression: (steamId) => saved[steamId] ?? null,
                    raiseSavedTrack: (steamId, track, level) => { calls.raised.push([steamId, track, level]); return raise[steamId] ?? "feito"; },
                },
                "../characters.js": { allCharacters: () => characters },
                "../players.js": {
                    findPlayer: (query) => {
                        const player = online.find((one) => one.nickname.toLowerCase() === query.toLowerCase());
                        return player === undefined ? { error: `Nobody called '${query}' is online.` } : { player };
                    },
                },
            })[id] ?? assert.fail(`unexpected require ${id}`),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/nivel.js"), "utf8"), context);
    let usages = 0;
    const run = (...args) => context.exports.nivelCommand.run({ args, reply: { line: (text) => lines.push(text), lines: (list) => lines.push(...list) }, usage: () => { usages += 1; } });
    return { api: context.exports, run, lines, logs, calls, usages: () => usages };
}

const TRACKS = { alchemy: { level: 5, xp: 0 }, survival: { level: 6, xp: 12 }, weapon_sword: { level: 5, xp: 0 } };

function body(nickname, tracks = TRACKS) {
    const restored = [];
    return {
        nickname,
        restored,
        progression: { tracks: plain(tracks), perks: ["p1"], perkPoints: { main: 1 } },
        restoreProgression(snapshot) { restored.push(plain(snapshot)); return this.accept !== false; },
    };
}

test("a player who is in: the levels are listed, only those above the starting 5 named", () => {
    const luance = body("Luance");
    const sut = load({ online: [luance] });
    sut.run("Luance");
    assert.deepEqual(sut.lines, ["Luance: survival 6 (de 3 trilhas)."]);
    const fresh = body("Novo", { alchemy: { level: 5, xp: 0 } });
    const other = load({ online: [fresh] });
    other.run("Novo");
    assert.deepEqual(other.lines, ["Novo: nenhuma trilha acima do 5 do começo (de 1 trilhas)."]);
    assert.equal(sut.api.levelsLine({}), "nenhuma trilha acima do 5 do começo (de 0 trilhas)");
});

test("a level is put in exactly for a player who is in: the track alone changes, with no XP into the next, the perks and points as they are; and only upward", () => {
    const luance = body("Luance");
    const sut = load({ online: [luance] });
    sut.run("Luance", "alchemy", "20");
    assert.equal(luance.restored.length, 1);
    assert.deepEqual(luance.restored[0].tracks.alchemy, { level: 20, xp: 0 });
    assert.deepEqual(luance.restored[0].tracks.survival, { level: 6, xp: 12 }, "the others as they were");
    assert.equal(luance.restored[0].perks, undefined, "the perks stay as they are: a restore that carried them would drop the blocked ones, the combos (KCDC 1.7.2)");
    assert.equal(luance.restored[0].perkPoints, undefined);
    assert.deepEqual(sut.lines, ["Luance: alchemy do nível 5 para o 20."]);
    assert.ok(sut.logs.some((line) => /nivel: alchemy de Luance: 5 -> 20 \(feito\)/.test(line)));

    sut.lines.length = 0;
    sut.run("Luance", "survival", "6");
    sut.run("Luance", "survival", "3");
    assert.equal(luance.restored.length, 1, "the same level and a lower one are not set");
    assert.match(sut.lines[0], /já está no nível 6 de survival: o comando só sobe/);
    assert.match(sut.lines[1], /já está no nível 6/);
});

test("a name with a space in it, a track nobody knows, a level out of 1-30, a game that refuses, and a player whose game has not reported", () => {
    const patrik = body("Patrik Ondřej");
    const sut = load({ online: [patrik] });
    sut.run("Patrik", "Ondřej", "weapon_sword", "10");
    assert.deepEqual(patrik.restored.at(-1).tracks.weapon_sword, { level: 10, xp: 0 }, "the words before the track are the name");

    sut.lines.length = 0;
    sut.run("Patrik", "Ondřej", "dancing", "10");
    assert.match(sut.lines[0], /Trilha desconhecida: dancing\. Elas são: alchemy, survival, weapon_sword\./);
    sut.run("Patrik", "Ondřej", "alchemy", "31");
    sut.run("Patrik", "Ondřej", "alchemy", "0");
    assert.equal(sut.usages(), 2, "only 1 to 30");
    sut.run();
    assert.equal(sut.usages(), 3);

    patrik.accept = false;
    sut.lines.length = 0;
    sut.run("Patrik", "Ondřej", "alchemy", "12");
    assert.match(sut.lines[0], /O jogo não aceitou devolver o nível de Patrik Ondřej agora/);

    const silent = body("Mudo");
    silent.progression = null;
    const quiet = load({ online: [silent] });
    quiet.run("Mudo");
    assert.match(quiet.lines[0], /ainda não disse os níveis/);
});

test("a character who is not in: the levels of the file are listed, and a level is put in the file for the next entry", () => {
    const entry = { steamId: "76561198000000001", name: "Luance", nickname: "Luance" };
    const sut = load({ characters: [entry], saved: { [entry.steamId]: { tracks: plain(TRACKS), perks: [], perkPoints: {} } } });
    sut.run("Luance");
    assert.deepEqual(sut.lines, ["Luance (no arquivo): survival 6 (de 3 trilhas)."]);
    sut.lines.length = 0;
    sut.run("luance", "alchemy", "20");
    assert.deepEqual(sut.calls.raised, [[entry.steamId, "alchemy", 20]]);
    assert.match(sut.lines[0], /Luance não está no servidor: alchemy vai para o nível 20 no arquivo dele, e ele a terá na próxima entrada/);
    assert.ok(sut.logs.some((line) => /nivel: alchemy de Luance \(no arquivo\): 5 -> 20/.test(line)));
});

test("a character who is not in, told no: no file, no such track, already there; and two of the same name are not guessed between", () => {
    const entry = { steamId: "76561198000000001", name: "Luance", nickname: "Luance" };
    const base = { characters: [entry], saved: { [entry.steamId]: { tracks: plain(TRACKS), perks: [], perkPoints: {} } } };
    for (const [outcome, pattern] of [["sem personagem", /não tem arquivo de personagem/], ["sem trilha", /Trilha desconhecida: alchemy\. Elas são: alchemy, survival, weapon_sword/], ["já está", /já está no nível 5 de alchemy: o comando só sobe/]]) {
        const sut = load({ ...base, raise: { [entry.steamId]: outcome } });
        sut.run("Luance", "alchemy", "20");
        assert.match(sut.lines[0], pattern, outcome);
        assert.ok(!sut.logs.some((line) => /^nivel:/.test(line)), "nothing logged as done");
    }

    const nothing = load({ characters: [entry] });
    nothing.run("Luance");
    assert.match(nothing.lines[0], /Luance não tem níveis guardados/);

    const twins = load({ characters: [entry, { ...entry, steamId: "76561198000000002" }] });
    twins.run("Luance");
    assert.match(twins.lines[0], /Mais de um personagem com "Luance": use o Steam id/);

    const nobody = load();
    nobody.run("Ninguém");
    assert.match(nobody.lines[0], /Nobody called 'Ninguém' is online/);
});
