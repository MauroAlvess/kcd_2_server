"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The client side of the G wheel (src/client/emotes.ts, 2026-10-26): G opens the page, which says it is up; the server says which gestures this body may
// play, and what it said is handed to the page whenever the page is there to hear it; a click on a gesture goes to the server, "Parar" too.

function load({ busy = false } = {}) {
    const state = { handlers: new Map(), pageEvents: new Map(), views: [], shown: [], hidden: [], focused: [], emitted: [], sent: [], disabled: [], enabled: [], errors: [], keys: new Map(), now: 5_000_000, busy };
    const me = { ready: true, alive: true };
    const restraintBox = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/restraint.js"), "utf8"), restraintBox);
    const restraint = restraintBox.exports;
    const context = {
        exports: {},
        console: { log() {}, error: (line) => state.errors.push(line) },
        JSON,
        Date: { now: () => state.now },
        LocalPlayer: me,
        Hud: { isInDialogue: () => false },
        Controls: { isEnabled: () => true, disableAction: (name) => state.disabled.push(name), enableAction: (name) => state.enabled.push(name) },
        Key: { bind: (key, mode, fn) => state.keys.set(key, fn) },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push({ name, payload: JSON.parse(payload) }) },
        Web: {
            getScreenSize: () => ({ width: 1920, height: 1080 }),
            createView: (url, options) => {
                state.views.push({ url, options });
                return state.views.length;
            },
            on: (view, name, fn) => state.pageEvents.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => state.sent.push({ view, name, payload: JSON.parse(JSON.stringify(payload)) }),
            showView: (view) => state.shown.push(view),
            hideView: (view) => state.hidden.push(view),
            focusView: (view, on) => state.focused.push([view, on]),
            resizeView() {},
            destroyView() {},
        },
        require: (id) => (id === "./furniture.js" ? { furnitureBusy: () => state.busy } : id === "./restraint.js" ? restraint : assert.fail(`unexpected require ${id}`)),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/emotes.js"), "utf8"), context);
    context.exports.installEmotes();
    return { api: context.exports, state, me, restraint, g: () => state.keys.get("g")(), page: (view, name, payload) => state.pageEvents.get(`${view}:${name}`)(payload), told: (ids) => state.handlers.get("kcdc-gamemode:emote.list")(JSON.stringify({ ids })) };
}

test("the framework's own wheel is held off, and G opens ours: the page is made once, shown, given the keyboard, and the server is asked what this body may play", () => {
    const sut = load();
    assert.deepEqual(sut.state.disabled, ["kcdc_emote_wheel"]);
    sut.g();
    assert.equal(sut.state.views.length, 1);
    assert.match(sut.state.views[0].url, /ui\/emotes\.html$/);
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [[1, true]]);
    assert.deepEqual(sut.state.emitted, [{ name: "kcdc-gamemode:emote.list", payload: {} }]);
    sut.g();
    assert.deepEqual(sut.state.hidden, [1], "G again closes it");
    sut.g();
    assert.equal(sut.state.views.length, 1, "and opens the same page");
});

test("what the server says is handed to the page as soon as the page is there, whichever comes first", () => {
    const sut = load();
    sut.g();
    sut.told([1, 2, 128]);
    assert.equal(sut.state.sent.length, 0, "the page has not said it is up: what is sent now would not be heard");
    sut.page(1, "emotes:ready", {});
    assert.deepEqual(sut.state.sent, [{ view: 1, name: "emotes:list", payload: { ids: [1, 2, 128] } }], "told when it says so");

    sut.told([1, 2, 3, "x", 1.5, 130]);
    assert.deepEqual(sut.state.sent.at(-1), { view: 1, name: "emotes:list", payload: { ids: [1, 2, 3, 130] } }, "only whole numbers are handed on");
    sut.state.handlers.get("kcdc-gamemode:emote.list")("not json");
    sut.state.handlers.get("kcdc-gamemode:emote.list")(JSON.stringify({ ids: "all" }));
    assert.equal(sut.state.sent.length, 2, "an answer that is no list is let go");
});

test("each time the wheel opens it goes back to its groups, hands over what it knows, and asks again", () => {
    const sut = load();
    sut.g();
    sut.page(1, "emotes:ready", {});
    sut.told([6, 128]);
    sut.g();
    const before = sut.state.sent.length;
    sut.state.now += 1000;
    sut.g();
    assert.deepEqual(sut.state.sent.slice(before).map((one) => one.name), ["emotes:open", "emotes:list"], "to the groups first, then the list it has");
    assert.deepEqual(sut.state.sent.at(-1).payload, { ids: [6, 128] });
    assert.equal(sut.state.emitted.length, 2, "and the server is asked once more: a body that changed is offered other gestures");
});

test("a click on a gesture goes to the server and closes the wheel; \"Parar\" is the number 0; what is no whole number is let go", () => {
    const sut = load();
    sut.g();
    sut.page(1, "emotes:play", { id: 128 });
    assert.deepEqual(sut.state.emitted.at(-1), { name: "kcdc-gamemode:emote.play", payload: { id: 128 } });
    assert.deepEqual(sut.state.hidden, [1]);
    sut.state.now += 1000;
    sut.g();
    sut.page(1, "emotes:play", { id: 0 });
    assert.deepEqual(sut.state.emitted.at(-1), { name: "kcdc-gamemode:emote.play", payload: { id: 0 } });
    sut.state.now += 1000;
    sut.g();
    const asked = sut.state.emitted.length;
    for (const bad of [{ id: 1.5 }, { id: "1" }, {}, null]) {
        sut.page(1, "emotes:play", bad);
    }
    assert.equal(sut.state.emitted.length, asked, "nothing is sent for them");
});

test("the same G that opened the wheel, heard by the page as it comes up, does not close it", () => {
    const sut = load();
    sut.g();
    sut.page(1, "emotes:close", {});
    assert.equal(sut.state.hidden.length, 0);
    sut.state.now += 300;
    sut.page(1, "emotes:close", {});
    assert.deepEqual(sut.state.hidden, [1]);
});

test("not while the player is down, in a dialogue, or sitting: G does nothing", () => {
    const sut = load({ busy: true });
    sut.g();
    assert.equal(sut.state.views.length, 0);
    sut.state.busy = false;
    sut.me.alive = false;
    sut.g();
    assert.equal(sut.state.views.length, 0);
});

test("in handcuffs or in the pillory G opens nothing; a wheel that was up when the cuffs went on can still be put away (arrest.ts, 2026-10-29)", () => {
    const sut = load();
    sut.restraint.setRestrained(true);
    sut.g();
    assert.equal(sut.state.views.length, 0, "no page is even made");
    assert.deepEqual(sut.state.emitted, []);
    sut.restraint.setRestrained(false);
    sut.g();
    assert.deepEqual(sut.state.shown, [1]);
    sut.restraint.setRestrained(true);
    sut.g();
    assert.deepEqual(sut.state.hidden, [1], "G closes the wheel that was open");
    sut.g();
    assert.deepEqual(sut.state.shown, [1], "and does not open it again");
    sut.restraint.setRestrained(false);
    sut.g();
    assert.deepEqual(sut.state.shown, [1, 1], "free again, the wheel opens");
});
