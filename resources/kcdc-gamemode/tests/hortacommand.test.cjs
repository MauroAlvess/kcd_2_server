"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// /horta (src/server/commands/horta.ts): what everybody may ask of the gardens, and the administrators' part: ripening, emptying and,
// since 2026-10-23, marking a bed where the level has none and taking a marked one away.

function load({ admin = true } = {}) {
    const lines = [];
    const calls = [];
    const context = {
        exports: {},
        Number,
        String,
        require: (id) =>
            ({
                "../auth.js": { isAdmin: () => admin },
                "../farm.js": {
                    MARK_LENGTH: { min: 1.5, max: 8, normal: 3 },
                    FIELD_ROWS: { min: 2, max: 12, normal: 6, spacingM: 1.6 },
                    markField: (player, rows, length) => { calls.push(["campo", rows, length]); return rows > 12 ? { ok: false, why: "Um campo tem de ter de 2 a 12 fileiras." } : rows === 7 ? { ok: false, why: "Aqui já há canteiros: ande para um chão livre." } : { ok: true, made: rows - 1, skipped: 1, first: "Horta de Suchdol 4", last: "Horta de Suchdol 8" }; },
                    farmSummary: () => ["resumo"],
                    nearestGardens: () => ["perto"],
                    ripenAll: () => { calls.push("crescer"); return 2; },
                    clearAll: () => { calls.push("limpar"); return 3; },
                    markBed: (player, length) => { calls.push(["aqui", length]); return length > 8 ? { ok: false, why: "A fileira tem de ter de 1,5 a 8 m." } : { ok: true, name: "Horta de Suchdol 9", bed: "suchdol-9:1" }; },
                    unmarkBed: () => { calls.push("tirar"); return calls.filter((one) => one === "tirar").length === 1 ? { ok: true, name: "Horta de Suchdol 9", lost: "Hans" } : { ok: false, why: "Nenhum canteiro marcado a até 4 m." }; },
                },
            })[id] ?? assert.fail(`unexpected require ${id}`),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/horta.js"), "utf8"), context);
    let usages = 0;
    const run = (...args) => context.exports.hortaCommand.run({ player: { nickname: "Boss" }, args, reply: { line: (text) => lines.push(text), lines: (list) => lines.push(...list) }, usage: () => { usages += 1; } });
    return { api: context.exports, run, lines, calls, usages: () => usages };
}

test("everybody may ask what they have sown and where the nearest gardens are; an unknown word shows the usage", () => {
    const sut = load({ admin: false });
    sut.run();
    sut.run("perto");
    assert.deepEqual(sut.lines, ["resumo", "perto"]);
    sut.run("plantar");
    assert.equal(sut.usages(), 1);
    assert.ok(sut.api.hortaCommand.usage.some((line) => line.startsWith("/horta aqui [metros]")) && sut.api.hortaCommand.usage.some((line) => line.startsWith("/horta tirar")));
});

test("ripening, emptying, marking and taking a marked bed are an administrator's: anybody else is told so and nothing is done", () => {
    const sut = load({ admin: false });
    for (const word of ["crescer", "limpar", "aqui", "tirar"]) {
        sut.run(word);
    }
    assert.deepEqual(sut.lines, Array(4).fill("Só um administrador faz isso."));
    assert.deepEqual(sut.calls, []);
});

test("/horta aqui marks a bed of three metres, or the length said (a comma is a point); a word that is no number is the usage; the reason is told when it is refused", () => {
    const sut = load();
    sut.run("aqui");
    sut.run("aqui", "4,5");
    sut.run("aqui", "2.5");
    assert.deepEqual(sut.calls, [["aqui", 3], ["aqui", 4.5], ["aqui", 2.5]]);
    assert.equal(sut.lines[0], "Canteiro marcado: Horta de Suchdol 9, fileira de 3 m para onde você olha. Quem é agricultor já o vê.");
    assert.match(sut.lines[1], /fileira de 4,5 m|fileira de 4.5 m/);
    sut.run("aqui", "muito");
    assert.equal(sut.usages(), 1);
    sut.lines.length = 0;
    sut.run("aqui", "9");
    assert.deepEqual(sut.lines, ["A fileira tem de ter de 1,5 a 8 m."]);
});

test("/horta tirar says what was taken and whose sowing was undone, or why nothing was", () => {
    const sut = load();
    sut.run("tirar");
    sut.run("tirar");
    assert.deepEqual(sut.lines, ["Canteiro tirado: Horta de Suchdol 9. A plantação de Hans nele se desfez.", "Nenhum canteiro marcado a até 4 m."]);
    sut.run("crescer");
    sut.run("limpar");
    assert.deepEqual(sut.lines.slice(2), ["2 plantação(ões) prontas para colher.", "3 canteiro(s) esvaziados."]);
});

test("/horta campo marks a field of six rows of eight metres, or the rows and the length said; only an administrator; the reason when it is refused (2026-10-27)", () => {
    const sut = load();
    sut.run("campo");
    assert.deepEqual(sut.calls.at(-1), ["campo", 6, 8]);
    assert.match(sut.lines.at(-1), /^Campo marcado: 5 canteiro\(s\) de 8 m lado a lado \(Horta de Suchdol 4 a Horta de Suchdol 8\), para a sua direita\. 1 ficou\(aram\) de fora: já havia canteiro ali\./);
    sut.run("campo", "4", "5,5");
    assert.deepEqual(sut.calls.at(-1), ["campo", 4, 5.5], "a comma is a point");
    sut.run("campo", "13");
    assert.equal(sut.lines.at(-1), "Um campo tem de ter de 2 a 12 fileiras.");
    sut.run("campo", "7");
    assert.equal(sut.lines.at(-1), "Aqui já há canteiros: ande para um chão livre.");
    const before = sut.usages();
    sut.run("campo", "seis");
    assert.equal(sut.usages(), before + 1, "a word that is no number is the usage");
    assert.ok(sut.api.hortaCommand.usage.some((line) => line.startsWith("/horta campo [fileiras] [metros]")));

    const player = load({ admin: false });
    player.run("campo");
    assert.equal(player.lines.at(-1), "Só um administrador faz isso.");
    assert.equal(player.calls.length, 0);
});
