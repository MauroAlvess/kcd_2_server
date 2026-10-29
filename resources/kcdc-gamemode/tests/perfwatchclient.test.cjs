"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Where the client scripts' time goes (src/client/perf-watch.ts, 2026-10-26): timers and handlers are wrapped, timed by where they were registered, and the
// heaviest written to the client log once a minute.

function load(options = {}) {
    const state = { logs: [], timers: [], handlers: [], pageHandlers: [] };
    const root = {
        setInterval: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        setTimeout: (fn) => { state.timers.push({ fn, ms: 0, once: true }); return state.timers.length; },
    };
    let clock = 0;
    const events = {
        on(name, fn) { state.handlers.push({ name, fn }); return () => {}; },
        onLocal(name, fn) { state.handlers.push({ name, fn, local: true }); return () => {}; },
    };
    const web = { on(view, name, fn) { state.pageHandlers.push({ view, name, fn }); } };
    if (options.frozenEvents) {
        Object.freeze(events);
    }
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => 1_000_000 + clock },
        performance: options.noClock ? undefined : { now: () => clock },
        globalThis: root,
        Events: events,
        Web: web,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/perf-watch.js"), "utf8"), context);
    return { api: context.exports, state, root, context, spend: (ms) => { clock += ms; } };
}

test("a timer and the handlers registered after the install are timed; what they do is unchanged, a throw included", () => {
    const sut = load();
    sut.api.installPerfWatch();
    sut.api.installPerfWatch();
    assert.equal(sut.state.logs.filter((line) => /timing every timer/.test(line)).length, 1, "installed once");

    let ran = 0;
    sut.root.setInterval(() => { ran += 1; sut.spend(40); }, 250);
    sut.context.Events.on("chatMessage", () => { sut.spend(5); return "answer"; });
    sut.context.Events.onLocal("followStarted", () => { throw new Error("boom"); });
    sut.context.Web.on(7, "freecam:look", (payload) => { sut.spend(2); return payload; });
    const interval = sut.state.timers.find((timer) => timer.ms === 250);
    interval.fn();
    interval.fn();
    assert.equal(ran, 2);
    assert.equal(sut.state.handlers.find((handler) => handler.name === "chatMessage").fn(), "answer", "the answer goes back");
    assert.throws(() => sut.state.handlers.find((handler) => handler.local).fn(), /boom/);
    assert.equal(sut.state.pageHandlers[0].view, 7, "the view id still goes first");
    assert.equal(sut.state.pageHandlers[0].fn("hello"), "hello", "and the page's payload reaches its handler");

    const text = sut.api.report();
    assert.match(text, /^perf-watch: \d+ s, ours 0\.09 s/);
    assert.match(text, /setInterval 250 ms: 0\.08 s in 2 x \(max 40 ms\)/);
    assert.match(text, /Events\.on chatMessage: 0\.01 s in 1 x/);
    assert.match(text, /Events\.onLocal followStarted: 0\.00 s in 1 x/);
    assert.match(text, /Web\.on freecam:look: 0\.00 s in 1 x/);
    assert.ok(text.indexOf("setInterval 250") < text.indexOf("Events.on chatMessage"), "the heaviest first");
    assert.equal(sut.api.lastReport(), text);
    assert.equal(sut.api.report(), "", "a minute with nothing in it is not worth a line");
});

test("the report goes to the log once a minute, and only when our callbacks took any time (2026-10-26)", () => {
    const sut = load();
    sut.api.installPerfWatch();
    const reporter = sut.state.timers.find((timer) => timer.ms === 60_000);
    assert.ok(reporter, "one timer writes the report");

    const logged = sut.state.logs.length;
    reporter.fn();
    assert.equal(sut.state.logs.length, logged, "a quiet minute writes nothing");

    sut.root.setInterval(() => sut.spend(30), 100);
    sut.state.timers.find((timer) => timer.ms === 100).fn();
    reporter.fn();
    assert.equal(sut.state.logs.length, logged + 1);
    assert.match(sut.state.logs[logged], /^perf-watch: \d+ s, ours 0\.03 s .*setInterval 100 ms: 0\.03 s in 1 x \(max 30 ms\)$/);
});

test("the place that registered a callback names it: the script, the line and the column, the watch's own frames skipped", () => {
    const sut = load();
    sut.api.installPerfWatch();
    // A callback registered from another script of the client, as the compiled code does it: one long line.
    const script = new vm.Script("(function install(setIntervalOf, spend) { setIntervalOf(function tick() { spend(30); }, 500); })", { filename: "kcdc-gamemode/client/hud.js" });
    const install = script.runInContext(vm.createContext({}));
    install(sut.context.globalThis.setInterval, sut.spend);
    sut.state.timers.find((timer) => timer.ms === 500).fn();
    assert.match(sut.api.report(), /hud\.js:\d+:\d+ setInterval 500 ms: 0\.03 s in 1 x \(max 30 ms\)/);
});

test("with no clock finer than a millisecond the callbacks are still counted and timed to the millisecond", () => {
    const sut = load({ noClock: true });
    sut.api.installPerfWatch();
    sut.root.setTimeout(() => sut.spend(20), 10);
    sut.state.timers.find((timer) => timer.once).fn();
    assert.match(sut.api.report(), /setTimeout: 0\.02 s in 1 x \(max 20 ms\)/);
});

test("when the runtime will not let the events be wrapped, the timers still are and the report still comes (2026-10-26)", () => {
    const sut = load({ frozenEvents: true });
    sut.api.installPerfWatch();
    assert.ok(sut.state.logs.some((line) => /could not wrap Events\.on/.test(line)), "said so");
    assert.ok(sut.state.timers.some((timer) => timer.ms === 60_000), "the report is still written");
    sut.root.setInterval(() => sut.spend(25), 100);
    sut.state.timers.find((timer) => timer.ms === 100).fn();
    assert.match(sut.api.report(), /setInterval 100 ms: 0\.03 s in 1 x/);
});
