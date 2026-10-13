const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load() {
    const events = new Map(), accepted = [], timers = new Map();
    const state = { opened: 0, closed: 0, now: 1000, nextTimer: 1, local: { ready: true }, info: [] };
    const context = {
        exports: {},
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, value) => accepted.push({ name, value }) },
        CharacterCreator: { open: () => { state.opened++; return true; }, close: () => state.closed++ },
        Hud: { showInfoText: (text) => state.info.push(text) },
        console: { log() {} },
        Date: { now: () => state.now },
        setInterval: (fn) => { const id = state.nextTimer++; timers.set(id, fn); return id; },
        clearInterval: (id) => timers.delete(id),
        get LocalPlayer() { return state.local; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/creator.js"), "utf8"), context);
    context.exports.installCreator();
    const advance = (ms) => {
        for (let spent = 0; spent < ms; spent += 500) {
            state.now += 500;
            for (const fn of [...timers.values()]) fn();
        }
    };
    return { events, accepted, state, advance };
}

test("sample creator only accepts and closes stages it opened", () => {
    const { events, accepted, state, advance } = load();
    events.get("characterCreatorClosed")({ gender: "female" }, "accepted");
    events.get("kcdc-gamemode:creator.close")();
    assert.equal(accepted.length, 0); assert.equal(state.closed, 0);

    events.get("kcdc-gamemode:creator.open")({ genders: "both" });
    advance(11000);
    assert.equal(state.opened, 1);
    events.get("characterCreatorClosed")({ gender: "male" }, "accepted");
    assert.equal(accepted.length, 1);

    events.get("characterCreatorClosed")({ gender: "female" }, "accepted");
    events.get("kcdc-gamemode:creator.close")();
    assert.equal(accepted.length, 1); assert.equal(state.closed, 0);
});

test("creator request waits for the local body and the settle time", () => {
    const { events, state, advance } = load();
    state.local = null;
    events.get("kcdc-gamemode:creator.open")({ genders: "both" });
    advance(15000);
    assert.equal(state.opened, 0);

    state.local = { ready: false };
    advance(2000);
    assert.equal(state.opened, 0);

    state.local = { ready: true };
    advance(1000);
    assert.equal(state.opened, 1);
});

test("a creator ended as interrupted is reopened a few times, then reported", () => {
    const { events, state, advance } = load();
    events.get("kcdc-gamemode:creator.open")({ genders: "both" });
    advance(11000);
    assert.equal(state.opened, 1);

    events.get("characterCreatorClosed")(null, "interrupted");
    assert.equal(state.info.length, 0);
    advance(5000);
    assert.equal(state.opened, 2);

    events.get("characterCreatorClosed")(null, "interrupted");
    advance(5000);
    events.get("characterCreatorClosed")(null, "unavailable");
    advance(5000);
    assert.equal(state.opened, 4);
    assert.equal(state.info.length, 0);

    events.get("characterCreatorClosed")(null, "interrupted");
    advance(10000);
    assert.equal(state.opened, 4);
    assert.equal(state.info.length, 1);
});

test("backing out of the creator is reported without a retry", () => {
    const { events, state, advance } = load();
    events.get("kcdc-gamemode:creator.open")({ genders: "both" });
    advance(11000);
    events.get("characterCreatorClosed")(null, "cancelled");
    advance(10000);
    assert.equal(state.opened, 1);
    assert.equal(state.info.length, 1);
});
