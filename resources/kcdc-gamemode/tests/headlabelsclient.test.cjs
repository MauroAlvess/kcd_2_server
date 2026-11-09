"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The labels over the heads of the players this player knows, on the client (src/client/head-labels.ts, 2026-11-04): the server says which, and this hangs each on its player's nametag.

function load({ ready = true, throwing = false } = {}) {
    const calls = [];
    const handlers = new Map();
    const intervals = [];
    const cleared = [];
    const emitted = [];
    const state = { ready };
    const sandbox = {
        exports: {},
        require: () => assert.fail("head-labels.js requires nothing"),
        console: { error: (line) => calls.push(["error", line]) },
        Nametags: {
            setLabel: (id, text, duration, colour) => { if (throwing) throw new Error("no body"); calls.push(["set", id, text, duration, colour]); },
            clearLabel: (id) => calls.push(["clear", id]),
            clearLabels: () => calls.push(["clearAll"]),
        },
        LocalPlayer: { get ready() { return state.ready; } },
        Events: { on: (name, fn) => handlers.set(name, fn), emitServer: (name) => emitted.push(name) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => cleared.push(id),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/head-labels.js"), "utf8"), sandbox);
    sandbox.exports.installHeadLabels();
    const tell = (labels) => handlers.get("kcdc-gamemode:head.labels")(JSON.stringify({ labels }));
    return { api: sandbox.exports, calls, handlers, intervals, cleared, emitted, state, tell };
}

const label = (id, text = "Cavaleiro", colour = 0xffd5a156) => ({ id, text, colour });

test("the server's list is hung on the players' nametags, held until taken off, in the colour it says", () => {
    const sut = load();
    sut.tell([label(101), label(102, "Ladrão", 0xffd23c32)]);
    assert.deepEqual(sut.calls, [["set", 101, "Cavaleiro", 0, 0xffd5a156], ["set", 102, "Ladrão", 0, 0xffd23c32]]);
});

test("the whole list each time: one that is gone is taken off, one that changed is hung again, one that did not is left alone", () => {
    const sut = load();
    sut.tell([label(101), label(102)]);
    sut.calls.length = 0;
    sut.tell([label(101), label(103, "Burgrave")]);
    assert.deepEqual(sut.calls, [["clear", 102], ["set", 103, "Burgrave", 0, 0xffd5a156]], "101 is as it was");
    sut.calls.length = 0;
    sut.tell([label(101, "Cavaleiro de Suchdol"), label(103, "Burgrave")]);
    assert.deepEqual(sut.calls, [["set", 101, "Cavaleiro de Suchdol", 0, 0xffd5a156]]);
    sut.calls.length = 0;
    sut.tell([]);
    assert.deepEqual(sut.calls, [["clear", 101], ["clear", 103]], "told nobody: every label comes off");
});

test("what the server sends is read with care: a list that is not a list, a label with no id, no line or no colour, or a line too long is left out", () => {
    const sut = load();
    for (const bad of [null, "nonsense", { labels: "x" }, {}, [], 5]) {
        assert.doesNotThrow(() => sut.handlers.get("kcdc-gamemode:head.labels")(typeof bad === "string" ? bad : JSON.stringify(bad)));
    }
    assert.deepEqual(sut.calls, [], "nothing was hung");
    sut.tell([{ text: "Sem id", colour: 1 }, { id: 1.5, text: "x", colour: 1 }, { id: 7, text: "", colour: 1 }, { id: 8, text: "x".repeat(65), colour: 1 }, { id: 9, text: "Sem cor" }, { id: 10, text: "Boa", colour: 7 }, "texto", null]);
    assert.deepEqual(sut.calls, [["set", 10, "Boa", 0, 7]]);
    assert.equal(sut.api.parseLabels("{ not json").size, 0);
});

test("a body the client has not made yet is no failure: the label is tried again every twenty seconds", () => {
    const sut = load({ throwing: true });
    sut.tell([label(101)]);
    assert.ok(sut.calls.some((entry) => entry[0] === "error" && /head labels: .*no body/.test(entry[1])), "logged, not thrown");
    const again = sut.intervals.find((interval) => interval.ms === sut.api.REAPPLY_MS);
    assert.ok(again, "a timer puts them on again");
    const ok = load();
    ok.tell([label(101)]);
    ok.calls.length = 0;
    ok.intervals.find((interval) => interval.ms === ok.api.REAPPLY_MS).fn();
    assert.deepEqual(ok.calls, [["set", 101, "Cavaleiro", 0, 0xffd5a156]]);
    assert.equal(ok.api.REAPPLY_MS, 20_000);
});

test("the list is asked for once, when the player is in the world, and not before", () => {
    const sut = load({ ready: false });
    const asking = sut.intervals.find((interval) => interval.ms === 1000);
    assert.ok(asking);
    asking.fn();
    assert.deepEqual(sut.emitted, [], "still loading");
    sut.state.ready = true;
    asking.fn();
    assert.deepEqual(sut.emitted, ["kcdc-gamemode:head.ask"]);
    assert.deepEqual(sut.cleared, [1], "and not asked again");
});

test("when the resource stops every label comes off and the timers stop", () => {
    const sut = load();
    sut.tell([label(101)]);
    sut.calls.length = 0;
    sut.handlers.get("resourceStop")("another-resource");
    assert.deepEqual(sut.calls, []);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.calls, [["clearAll"]]);
    assert.equal(sut.cleared.length, 2);
});
