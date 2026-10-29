"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// /gesto (src/server/commands/gesto.ts): the administrators' list, switch and, since 2026-10-27, the place of each model in the hand (the standard has two: the pole and the cloth).

function load() {
    const lines = [];
    const calls = [];
    const gestures = {
        1: { name: "Acenar", group: "saudacoes" },
        121: { name: "Flauta", group: "festa", props: [{}] },
        130: { name: "Estandarte", group: "objetos", props: [{}, {}] },
    };
    const tuned = [{ id: 130, piece: 2, position: { x: 0.5, y: 0, z: 2 }, rotation: { x: 90, y: 0, z: 0 } }, { id: 121, piece: 1, position: { x: 0, y: 0, z: 0.1 }, rotation: { x: 0, y: 0, z: 0 } }];
    const emotes = {
        tunedList: () => tuned,
        untune: (id, piece) => { calls.push(["untune", id, piece]); return id === 130; },
        tune: (id, position, rotation, piece) => { calls.push(["tune", id, position, rotation, piece]); return true; },
        preview: (player, id) => { calls.push(["preview", id]); return true; },
        isOff: () => false,
        setOff: () => true,
    };
    const context = {
        exports: {},
        Number,
        Object,
        Math,
        require: (id) => ({ "../emotes.js": { emotes, GESTURES: gestures, GROUPS: [{ id: "festa", name: "Festa" }] } })[id] ?? assert.fail(`unexpected require ${id}`),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/gesto.js"), "utf8"), context);
    let usages = 0;
    const run = (...args) => context.exports.gestoCommand.run({ player: { nickname: "Boss" }, args, reply: { line: (text) => lines.push(text), lines: (list) => lines.push(...list) }, usage: () => { usages += 1; } });
    return { api: context.exports, run, lines, calls, usages: () => usages };
}

test("/gesto ajustar moves the first model of a gesture, and <number>.2 the second one (the standard's cloth); the gesture is played again to be seen", () => {
    const sut = load();
    sut.run("ajustar", "121", "0,1", "0", "0.2");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls)), [["tune", 121, { x: 0.1, y: 0, z: 0.2 }, { x: 0, y: 0, z: 0 }, 1], ["preview", 121]]);
    assert.match(sut.lines.at(-1), /^Flauta: objeto em x 0\.1 y 0 z 0\.2, giro 0 0 0; guardado para todos\.$/);

    sut.run("ajustar", "130.2", "0.5", "0", "2", "90", "0", "180");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.slice(-2))), [["tune", 130, { x: 0.5, y: 0, z: 2 }, { x: 90, y: 0, z: 180 }, 2], ["preview", 130]]);
    assert.match(sut.lines.at(-1), /^Estandarte \(objeto 2\): objeto em x 0\.5 y 0 z 2, giro 90 0 180; guardado para todos\./);

    sut.run("ajustar", "130", "0", "0", "-0.7");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.at(-2))), ["tune", 130, { x: 0, y: 0, z: -0.7 }, { x: 0, y: 0, z: 0 }, 1]);
    assert.match(sut.lines.at(-1), /^Estandarte \(objeto 1\): /);
});

test("/gesto ajustar says what is wrong: no number, a gesture with nothing in the hand, a model the gesture does not have, numbers that are none", () => {
    const sut = load();
    sut.run("ajustar");
    assert.match(sut.lines.at(-1), /^Diga o número de um gesto com objeto na mão/);
    sut.run("ajustar", "1", "0", "0", "0");
    assert.match(sut.lines.at(-1), /^Diga o número de um gesto com objeto na mão/, "a wave has nothing to move");
    sut.run("ajustar", "130.3", "0", "0", "0");
    assert.equal(sut.lines.at(-1), "Estandarte tem 2 objeto(s) na mão: 130, 130.2.");
    sut.run("ajustar", "121.2", "0", "0", "0");
    assert.equal(sut.lines.at(-1), "Flauta tem 1 objeto(s) na mão: 121.");
    sut.run("ajustar", "130", "0", "0", "9");
    assert.match(sut.lines.at(-1), /^Números fora do razoável/);
    const before = sut.usages();
    sut.run("ajustar", "130", "1", "2");
    assert.equal(sut.usages(), before + 1, "two numbers are neither a place nor a place and a turn");
    assert.deepEqual(sut.calls, [], "nothing was moved by any of these");
});

test("/gesto ajustar <number> padrao gives every model of the gesture back, <number>.2 padrao only the second", () => {
    const sut = load();
    sut.run("ajustar", "130", "padrao");
    assert.deepEqual(sut.calls.at(-1), ["untune", 130, undefined], "no model named: all of them");
    assert.equal(sut.lines.at(-1), "Estandarte: os objetos voltaram ao lugar de fábrica.");
    sut.run("ajustar", "130.2", "padrao");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.calls.at(-1))), ["untune", 130, 2]);
    assert.equal(sut.lines.at(-1), "Estandarte (objeto 2): o objeto voltou ao lugar de fábrica.");
    sut.run("ajustar", "121", "padrão");
    assert.equal(sut.lines.at(-1), "Flauta já está no lugar de fábrica.");
});

test("/gesto ajustes lists what was moved, the second model of a gesture as <number>.2", () => {
    const sut = load();
    sut.run("ajustes");
    assert.deepEqual(sut.lines, ["130.2 Estandarte: x 0.5 y 0 z 2 | rx 90 ry 0 rz 0", "121 Flauta: x 0 y 0 z 0.1 | rx 0 ry 0 rz 0"]);
});
