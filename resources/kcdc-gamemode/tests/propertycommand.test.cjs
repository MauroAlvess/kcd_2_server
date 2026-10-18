const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/** `/propriedade` over a property menu that keeps what it was told; the rest of the command's modules are never reached by `olhar`. */
function load({ on = true, seen = { doors: 0, holds: 0, leaks: 0 } } = {}) {
    const calls = { set: [], usage: 0, lines: [] };
    const menus = {
        gazeLockOn: () => on,
        setGazeLock: (value) => { calls.set.push(value); on = value; },
        gazing: () => seen,
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "../property-menu.js") return { propertyMenus: menus };
            return new Proxy({}, { get: () => () => undefined });
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/commands/properties.js"), "utf8"), context);
    const run = (...args) => context.exports.propertyCommand.run({
        player: {},
        args,
        reply: { line: (text) => calls.lines.push(text), lines: (texts) => calls.lines.push(...texts) },
        usage: () => { calls.usage += 1; },
    });
    return { run, calls, command: context.exports.propertyCommand };
}

test("/propriedade olhar says whether the lock at a look is on and what it has done since the server started", async () => {
    const sut = load({ seen: { doors: 2, holds: 31, leaks: 4, sides: 7, releases: 3 } });
    await sut.run("olhar");
    assert.deepEqual(sut.calls.set, [], "asking changes nothing");
    assert.equal(sut.calls.lines.length, 3);
    assert.match(sut.calls.lines[0], /^Trava ao olhar: ligada\..*Por dentro a porta abre direto\.$/);
    assert.match(sut.calls.lines[1], /^Portas travadas agora: 2\. Desde que o servidor ligou: 31 travas, e 4 vezes o jogo ofereceu a porta mesmo travada/);
    assert.match(sut.calls.lines[1], /; 3 travas soltas pelo cliente/);
    assert.equal(sut.calls.lines[2], "Portas sem área do jogo com o lado já aprendido pelo uso: 7.");
});

test("/propriedade olhar desligar and ligar turn it off and on, and say so", async () => {
    const sut = load();
    await sut.run("olhar", "desligar");
    assert.deepEqual(sut.calls.set, [false]);
    assert.match(sut.calls.lines[0], /^Trava ao olhar: desligada\./);

    await sut.run("olhar", "LIGAR");
    assert.deepEqual(sut.calls.set, [false, true]);
    assert.match(sut.calls.lines.at(-3), /^Trava ao olhar: ligada\./);
});

test("/propriedade olhar with anything else is the usage, and changes nothing", async () => {
    const sut = load();
    await sut.run("olhar", "talvez");
    assert.equal(sut.calls.usage, 1);
    assert.deepEqual(sut.calls.set, []);
    assert.deepEqual(sut.calls.lines, []);
});

test("the usage lists the switch, and the command stays the administrators' (it is not among the common ones)", () => {
    const sut = load();
    assert.ok(sut.command.usage.some((line) => /^\/propriedade olhar \[ligar\|desligar\]/.test(line)));
    const auth = fs.readFileSync(path.join(__dirname, "../dist/server/auth.js"), "utf8");
    assert.ok(!/COMMON_COMMANDS = new Set\(\[[^\]]*"propriedade"/.test(auth));
});
