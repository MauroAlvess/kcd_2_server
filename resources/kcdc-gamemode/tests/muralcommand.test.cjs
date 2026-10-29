"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// `/mural` (src/server/commands/mural.ts, 2026-10-24): the board near the player opens for everybody; the boards and their letters are listed and taken down
// by an administrator only.

function load({ admin = false, posters = [], boards = [], opens = { ok: true, message: "" } } = {}) {
    const calls = { opened: 0, removed: [] };
    const lines = [];
    const requires = {
        "../auth.js": { isAdmin: () => admin },
        "../guild-members.js": { nameOfMember: (steamId) => `Autor ${steamId.slice(-1)}` },
        "../mural.js": {
            adminRemove: (target, who) => { calls.removed.push([target, who]); return target === "nada" ? 0 : 2; },
            allPosters: (board) => posters.filter((poster) => board === undefined || poster.board === board),
            CATEGORIES: [{ id: "procurado", label: "Procurado" }, { id: "recursos", label: "Recursos" }, { id: "avisos", label: "Aviso" }],
            muralSettings: { feeCoins: 10, lifetimeMs: 7 * 86_400_000 },
            openMural: () => { calls.opened += 1; return opens; },
        },
        "../mural-places.js": { muralBoards: () => boards },
    };
    const context = { exports: {}, require: (id) => requires[id] ?? assert.fail(`unexpected require ${id}`), Date, Math, Number };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/mural.js"), "utf8"), context);
    const run = (...args) => {
        const sent = [];
        let usage = 0;
        context.exports.muralCommand.run({ player: { id: 1, nickname: "Hans" }, name: "mural", args, reply: { line: (text) => sent.push(text), lines: (texts) => sent.push(...texts) }, usage: () => { usage += 1; } });
        return { sent, usage };
    };
    return { run, calls, command: context.exports.muralCommand };
}

const NOW = Date.now();
const poster = (id, board, at = NOW - 3_600_000) => ({ id, board, category: "procurado", title: `Cartaz ${id}`, body: "x", owner: "76561198000000007", anonymous: id === "p2", at, until: at + 7 * 86_400_000 });

test("alone it opens the board near the player, and says why when there is none", () => {
    const sut = load();
    assert.deepEqual(sut.run().sent, []);
    assert.equal(sut.calls.opened, 1);
    const none = load({ opens: { ok: false, message: "Não há quadro de avisos por perto." } });
    assert.deepEqual(none.run().sent, ["Não há quadro de avisos por perto."]);
    assert.deepEqual(load({ opens: { ok: false, message: "" } }).run().sent, [], "a dead body is told nothing");
    assert.equal(sut.command.name, "mural");
});

test("the other forms are the administrator's: a player is told so, and nothing is touched", () => {
    const sut = load({ posters: [poster("p1", "suchdol")] });
    for (const sub of ["quadros", "lista", "remover", "limpar"]) {
        const { sent } = sut.run(sub, "suchdol");
        assert.match(sent[0], /Só o administrador/, sub);
    }
    assert.deepEqual(sut.calls.removed, []);
});

test("an administrator lists the boards with their letters' counts, and the letters with who put them up, even the anonymous", () => {
    const sut = load({ admin: true, posters: [poster("p1", "suchdol"), poster("p2", "suchdol", NOW - 7_200_000), poster("p3", "kuttenberg")], boards: [{ id: "suchdol", name: "Suchdol", x: 583.3, y: 3254.1, z: 146.9 }, { id: "kuttenberg", name: "Kuttenberg", x: 3157.6, y: 701.2, z: 53.3 }] });
    const boards = sut.run("quadros").sent;
    assert.match(boards[0], /Quadros de avisos \(2\)/);
    assert.match(boards[1], /suchdol -- Suchdol \(583, 3254, 147\): 2 cartaz\(es\)/);
    assert.match(boards[2], /kuttenberg -- Kuttenberg .*: 1 cartaz\(es\)/);

    const all = sut.run("lista").sent;
    assert.match(all[0], /Cartazes \(3; o mais novo primeiro\)/);
    assert.match(all[1], /p1 -- suchdol, Procurado: "Cartaz p1" de Autor 7, sai em 6 d/);
    assert.match(all.find((line) => line.includes("p2")), /p2 -- suchdol.* \(anônimo\)/, "the oldest is the last");
    assert.ok(all.findIndex((line) => line.includes("p2")) > all.findIndex((line) => line.includes("p3")));
    assert.match(sut.run("lista", "kuttenberg").sent[1], /p3 -- kuttenberg/);
    assert.match(sut.run("lista", "nenhum").sent[0], /Não há cartazes em 'nenhum'/);

    const empty = load({ admin: true });
    assert.match(empty.run("quadros").sent[0], /Nenhum quadro de avisos foi encontrado/);
    assert.match(empty.run("lista").sent[0], /Não há cartazes nos quadros/);
});

test("an administrator takes letters down by id or by board, and is told how many; the log says who", () => {
    const sut = load({ admin: true });
    assert.deepEqual(sut.run("remover", "p2").sent, ["2 cartaz(es) retirado(s)."]);
    assert.deepEqual(sut.run("limpar", "suchdol").sent, ["2 cartaz(es) retirado(s)."]);
    assert.deepEqual(sut.run("remover", "nada").sent, ["Não achei cartaz nem quadro 'nada'."]);
    assert.deepEqual(sut.calls.removed.map((call) => call[0]), ["p2", "suchdol", "nada"]);
    assert.match(sut.calls.removed[0][1], /Hans \(administrador\) retirou/);
    const bare = sut.run("remover");
    assert.equal(bare.usage, 1, "which letter? the forms are listed");
    const strange = sut.run("outra");
    assert.equal(strange.usage, 1);
    assert.match(strange.sent[0], /Um cartaz custa 10 moedas e fica 7 dias/);
});

test("it is a command everybody has, and it says what it does", () => {
    const { command } = load();
    assert.match(command.summary, /quadro de avisos/);
    assert.equal(command.usage.length, 5);
    const auth = fs.readFileSync(path.join(__dirname, "../src/server/auth.ts"), "utf8");
    assert.match(auth, /COMMON_COMMANDS[^\n]*"mural"/);
});
