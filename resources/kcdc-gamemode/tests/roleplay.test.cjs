const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

function body(id, x, over = {}) {
    return { id, nickname: `conta${id}`, ready: true, virtualWorld: 0, position: { x, y: 0, z: 0 }, ...over };
}

function load(players, known = new Set()) {
    const sent = [];
    const exportsOf = {};
    const run = (file, extra) => {
        const exports = {};
        vm.runInNewContext(dist(file), {
            exports,
            Chat: { sendToPlayer: (player, text, options) => sent.push({ to: player.id, text, color: options?.color }) },
            Player: { all: () => players },
            require: (id) => extra(id),
        });
        return exports;
    };
    const place = run("place.js", () => ({}));
    const acquaintances = {
        labelFor: (viewer, target) => (viewer.id === target.id || known.has(`${viewer.id}>${target.id}`) ? `Nome${target.id}` : "Desconhecido"),
    };
    const roleplay = run("roleplay.js", (id) => (id === "./acquaintances.js" ? acquaintances : id === "./place.js" ? place : {}));
    const commands = run("commands/roleplay.js", (id) => (id === "../roleplay.js" ? roleplay : {}));
    Object.assign(exportsOf, { roleplay, commands });
    return { ...exportsOf, sent };
}

function context(player, words) {
    const lines = [];
    return {
        lines,
        context: { player, name: "x", args: words, reply: { line: (text) => lines.push(text), lines: (texts) => lines.push(...texts) }, usage: () => lines.push("USAGE") },
    };
}

test("the three lines read as the chat's roleplay lines do", () => {
    const { roleplay } = load([]);
    assert.equal(roleplay.lineFor("me", "Jan", "saca a espada"), "* Jan saca a espada");
    assert.equal(roleplay.lineFor("do", "Jan", "A porta está entreaberta"), "* A porta está entreaberta (( Jan ))");
    assert.equal(roleplay.lineFor("try", "Jan", "arrombar a porta", true), "* Jan tenta arrombar a porta e consegue.");
    assert.equal(roleplay.lineFor("try", "Jan", "arrombar a porta", false), "* Jan tenta arrombar a porta e falha.");
});

test("an attempt works on the low half of the roll, and the odds are even", () => {
    const { roleplay } = load([]);
    assert.equal(roleplay.TRY_SUCCESS_CHANCE, 0.5);
    assert.equal(roleplay.attemptWorks(0), true);
    assert.equal(roleplay.attemptWorks(0.4999), true);
    assert.equal(roleplay.attemptWorks(0.5), false);
    assert.equal(roleplay.attemptWorks(0.99), false);
});

test("what is typed is folded to one clean line", () => {
    const { roleplay } = load([]);
    assert.equal(roleplay.tidyText(["  abre ", "", "a   porta\n\u0007 "]), "abre a porta");
    assert.equal(roleplay.tidyText([]), "");
    assert.equal(roleplay.tidyText(["   "]), "");
});

test("only the speaker and the players near them in the same world hear it", () => {
    const speaker = body(1, 0);
    const near = body(2, 29);
    const far = body(3, 31);
    const otherWorld = body(4, 1, { virtualWorld: 7 });
    const loading = body(5, 1, { ready: false });
    const { roleplay, sent } = load([speaker, near, far, otherWorld, loading]);
    const heard = roleplay.say(speaker, "me", "acena", 0);
    assert.equal(heard, 2);
    assert.deepEqual(sent.map((line) => line.to).sort(), [1, 2]);
});

test("each listener reads the name they know the speaker by, never the account's", () => {
    const speaker = body(1, 0);
    const friend = body(2, 3);
    const stranger = body(3, 4);
    const { roleplay, sent } = load([speaker, friend, stranger], new Set(["2>1"]));
    roleplay.say(speaker, "me", "acena", 0);
    const lineOf = (id) => sent.find((line) => line.to === id).text;
    assert.equal(lineOf(1), "* Nome1 acena", "the speaker reads their own name");
    assert.equal(lineOf(2), "* Nome1 acena", "somebody introduced to them reads it");
    assert.equal(lineOf(3), "* Desconhecido acena", "a stranger reads a stranger");
    assert.ok(!sent.some((line) => /conta1/.test(line.text)), "the account's nickname never reaches the chat");
});

test("an attempt is told in green when it works and in red when it fails", () => {
    const speaker = body(1, 0);
    const { roleplay, sent } = load([speaker]);
    roleplay.say(speaker, "try", "saltar o muro", 0.1);
    roleplay.say(speaker, "try", "saltar o muro", 0.9);
    assert.match(sent[0].text, /consegue\.$/);
    assert.equal(sent[0].color, roleplay.COLOURS.success);
    assert.match(sent[1].text, /falha\.$/);
    assert.equal(sent[1].color, roleplay.COLOURS.failure);
});

test("the commands answer a bare call with their usage, refuse a long line, and say the rest", () => {
    const speaker = body(1, 0);
    const { commands, roleplay, sent } = load([speaker]);
    assert.deepEqual([commands.meCommand.name, commands.doCommand.name, commands.tryCommand.name], ["me", "do", "try"]);

    const bare = context(speaker, []);
    commands.meCommand.run(bare.context);
    assert.deepEqual(bare.lines, ["USAGE"]);
    assert.equal(sent.length, 0);

    const long = context(speaker, ["x".repeat(roleplay.TEXT_MAX + 1)]);
    commands.doCommand.run(long.context);
    assert.match(long.lines[0], /Muito longo/);
    assert.equal(sent.length, 0);

    const ok = context(speaker, ["sorri", "para", "o", "ferreiro"]);
    commands.meCommand.run(ok.context);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].text, "* Nome1 sorri para o ferreiro");

    const early = context(body(9, 0, { ready: false }), ["olha"]);
    commands.meCommand.run(early.context);
    assert.match(early.lines[0], /ainda não entrou/);
});
