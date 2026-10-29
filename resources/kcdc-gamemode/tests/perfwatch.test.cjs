"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Where the main thread's time goes (src/server/perf-watch.ts): timers and handlers are wrapped, timed by where they were registered, and the heaviest reported.

function load() {
    const state = { logs: [], timers: [], handlers: [] };
    const root = {
        setInterval: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        setTimeout: (fn) => { state.timers.push({ fn, ms: 0, once: true }); return state.timers.length; },
    };
    let clock = 0;
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => 1_000_000 + clock },
        performance: { now: () => clock },
        globalThis: root,
        Events: {
            on(name, fn) { state.handlers.push({ name, fn }); },
            onClient(name, fn) { state.handlers.push({ name, fn, client: true }); },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/perf-watch.js"), "utf8"), context);
    return { api: context.exports, state, root, context, spend: (ms) => { clock += ms; } };
}

test("a timer and a handler registered after the install are timed; what they do is unchanged, a throw included", () => {
    const sut = load();
    sut.api.installPerfWatch();
    sut.api.installPerfWatch();
    assert.equal(sut.state.logs.filter((line) => /medindo o tempo/.test(line)).length, 1, "installed once");

    let ran = 0;
    sut.root.setInterval(() => { ran += 1; sut.spend(40); }, 1000);
    sut.context.Events.on("playerChat", () => { sut.spend(5); return "answer"; });
    sut.context.Events.onClient("kcdc-gamemode:thing", () => { throw new Error("boom"); });
    const interval = sut.state.timers.find((timer) => timer.ms === 1000);
    interval.fn();
    interval.fn();
    assert.equal(ran, 2);
    assert.equal(sut.state.handlers.find((handler) => handler.name === "playerChat").fn(), "answer", "the answer goes back");
    assert.throws(() => sut.state.handlers.find((handler) => handler.client).fn(), /boom/);

    const text = sut.api.report();
    assert.match(text, /^perf-watch: \d+ s, nossos 0,09 s/);
    assert.match(text, /setInterval 1000 ms: 0,08 s em 2 x \(máx 40 ms\)/);
    assert.match(text, /on playerChat: 0,01 s em 1 x/);
    assert.match(text, /onClient kcdc-gamemode:thing: 0,00 s em 1 x/);
    assert.ok(text.indexOf("setInterval 1000") < text.indexOf("on playerChat"), "the heaviest first");
    assert.equal(sut.api.lastReport(), text);
    assert.match(sut.api.report(), /nenhum$/, "the account starts again after a report");
});

test("a module can hand in how long a part of its callback took; the report shows those apart and does not count them twice (2026-10-25)", () => {
    const sut = load();
    assert.equal(sut.root.__kcdcSection, undefined, "nothing is offered before the watch is installed");
    sut.api.installPerfWatch();
    assert.equal(typeof sut.root.__kcdcSection, "function");

    sut.root.setInterval(() => {
        sut.spend(30);
        sut.root.__kcdcSection("animals.malha", 12);
        sut.root.__kcdcSection("animals.malha", 8.5);
        sut.root.__kcdcSection("animals.passeio", 3);
    }, 1000);
    sut.state.timers.find((timer) => timer.ms === 1000).fn();

    const text = sut.api.report();
    assert.match(text, /nossos 0,03 s/, "only the callback counts toward the total");
    assert.match(text, /; por dentro: animals\.malha 0,02 s em 2 x \(máx 12,0 ms\) \| animals\.passeio 0,00 s em 1 x \(máx 3,0 ms\)$/);
    assert.doesNotMatch(sut.api.report(), /por dentro/, "and they start again with the account");
});

test("the report says what a look at everybody costs, once a minute, with the players in it; and nothing when nobody is here (2026-10-27)", () => {
    const sut = load();
    sut.api.installPerfWatch();
    sut.context.Player = { all: () => [] };
    assert.doesNotMatch(sut.api.report(), /leitura/, "nobody here: nothing to measure");

    const body = () => ({
        get ready() { sut.spend(0.002); return true; },
        get alive() { sut.spend(0.002); return true; },
        get position() { sut.spend(0.006); return { x: 0, y: 0, z: 0 }; },
    });
    sut.context.Player = { all: () => [body(), body(), body(), body()] };
    const text = sut.api.report();
    assert.match(text, /; leitura: 4 jogador\(es\), 3,33 us por leitura, 0,04 ms para olhar todos/);
});

test("what the kept lists of the engine did is added to the report when listings.ts has handed its account in", () => {
    const sut = load();
    sut.api.installPerfWatch();
    assert.doesNotMatch(sut.api.report(), /listas/);
    sut.root.__kcdcListings = () => "; listas: Player.all() 3 no motor de 900 pedidos (1,41 ms cada)";
    assert.match(sut.api.report(), /; listas: Player\.all\(\) 3 no motor de 900 pedidos \(1,41 ms cada\)/);
    sut.root.__kcdcListings = () => { throw new Error("broken"); };
    assert.doesNotThrow(() => sut.api.report());
});
