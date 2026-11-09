"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The door of the server on the player's machine (src/client/entry.ts, 2026-10-29), over fakes of the framework: the server puts the page up, the page's messages go to the server
// cleaned, the server's answers go to the page, and a page that cannot come up is given up on and reported.

const R = "kcdc-gamemode:";
const PAGE = "fw://resources/kcdc-gamemode/ui/entry.html";
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ ready = true } = {}) {
    const state = {
        now: 1_000_000, me: { ready }, screen: { width: 1920, height: 1080 },
        views: [], emitted: [], shown: [], focused: [], destroyed: [], sent: [], logs: [], errors: [], timers: [], createFails: false,
    };
    const events = new Map();
    const page = new Map();
    const intervals = [];
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        Web: {
            getScreenSize: () => state.screen,
            createView: (url, options) => {
                if (state.createFails) throw new Error("no browser");
                state.views.push({ url, options: plain(options) });
                return state.views.length;
            },
            on: (view, name, fn) => page.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => { state.emitted.push({ view, name, payload: plain(payload ?? null) }); return true; },
            showView: (view) => { state.shown.push(view); return true; },
            focusView: (view, on) => { state.focused.push([view, on]); return true; },
            destroyView: (view) => { state.destroyed.push(view); return true; },
            resizeView() { return true; },
        },
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, payload) => state.sent.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }) },
        get LocalPlayer() { return state.me; },
        require: (id) => (id === "./ui-scale.js" ? { scaleView() {}, onUiScale() {}, uiFactor: () => 1, installUiScale() {} } : assert.fail(`unexpected require ${id}`)),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/entry.js"), "utf8"), context);
    context.exports.installEntry();
    const tick = (advance = 1_000) => { state.now += advance; intervals[0].fn(); };
    const fromServer = (name, payload) => events.get(`${R}${name}`)(payload === undefined ? undefined : JSON.stringify(payload));
    const fromPage = (name, payload, view = 1) => page.get(`${view}:${name}`)?.(payload);
    const sentNames = () => state.sent.map((entry) => entry.name.replace(R, ""));
    return { api: context.exports, state, tick, fromServer, fromPage, events, sentNames };
}

const ASK = { lang: "pt", need: 7, total: 10 };

test("nothing is made until the server asks; then the page is made hidden, and shown and focused with the ask once it says it has drawn; the server is told it is up", () => {
    const sut = load();
    sut.tick();
    assert.equal(sut.state.views.length, 0);
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, PAGE);
    assert.deepEqual(sut.state.views[0].options, { width: 1920, height: 1080, x: 0, y: 0, zIndex: 300, visible: false, focus: false });
    assert.deepEqual(sut.state.shown, [], "not before the page has drawn");
    sut.fromPage("entry:ready");
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [[1, true]], "the keyboard goes to the page: the character stands still");
    assert.deepEqual(plain(sut.state.emitted.find((entry) => entry.name === "entry:open").payload), ASK);
    assert.deepEqual(sut.sentNames(), ["entry.shown"]);
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 1, "asked again while it is up: nothing new");
});

test("an ask before the body is ready waits for the next one", () => {
    const sut = load({ ready: false });
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 0);
    sut.state.me.ready = true;
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 1);
});

test("what the page says goes to the server cleaned: the start, the answers as numbers, the end, and a language of the two", () => {
    const sut = load();
    sut.fromServer("entry.open", ASK);
    sut.fromPage("entry:ready");
    sut.state.sent.length = 0;
    sut.fromPage("entry:start");
    sut.fromPage("entry:answer", { picks: [0, 1, 2, "x", null, 3.5, 3] });
    sut.fromPage("entry:answer", { picks: new Array(21).fill(0) });
    sut.fromPage("entry:answer", { picks: "no" });
    sut.fromPage("entry:finish");
    sut.fromPage("entry:lang", { lang: "en" });
    sut.fromPage("entry:lang", { lang: "xx" });
    assert.deepEqual(plain(sut.state.sent), [
        { name: `${R}entry.start`, payload: {} },
        { name: `${R}entry.answer`, payload: { picks: [0, 1, 2, -1, -1, 3.5, 3] } },
        { name: `${R}entry.finish`, payload: {} },
        { name: `${R}status.lang`, payload: { lang: "en" } },
    ]);
});

test("the server's questions and result go to the page once it is up, and only then", () => {
    const sut = load();
    sut.fromServer("entry.questions", { questions: [] });
    assert.equal(sut.state.emitted.length, 0, "no page");
    sut.fromServer("entry.open", ASK);
    sut.fromServer("entry.questions", { questions: [] });
    assert.equal(sut.state.emitted.length, 0, "the page has not drawn");
    sut.fromPage("entry:ready");
    sut.fromServer("entry.questions", { total: 10, questions: [{ id: "x" }] });
    sut.fromServer("entry.result", { score: 7, passed: true });
    const names = sut.state.emitted.map((entry) => entry.name);
    assert.deepEqual(names, ["entry:open", "entry:questions", "entry:result"]);
    assert.equal(sut.state.emitted[2].payload.passed, true);
});

test("when the door opens the page is told to fade and taken down a moment later; a new ask after that makes a new page", () => {
    const sut = load();
    sut.fromServer("entry.open", ASK);
    sut.fromPage("entry:ready");
    sut.fromServer("entry.close");
    assert.ok(sut.state.emitted.some((entry) => entry.name === "entry:close"));
    assert.deepEqual(sut.state.destroyed, [], "not inside the same breath");
    sut.state.timers.at(-1).fn();
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.deepEqual(sut.state.focused.at(-1), [1, false], "the keyboard goes back to the game");
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 2);
});

test("a page that cannot come up is reported to the server, and the next ask tries again", () => {
    const sut = load();
    sut.state.createFails = true;
    sut.fromServer("entry.open", ASK);
    assert.deepEqual(sut.sentNames(), ["entry.failed"]);
    assert.match(sut.state.sent[0].payload.why, /a página não abriu/);
    sut.state.createFails = false;
    sut.tick();
    sut.fromServer("entry.open", ASK);
    assert.equal(sut.state.views.length, 1, "the server asked again: it is tried again");

    const silent = load();
    silent.fromServer("entry.open", ASK);
    silent.tick(16_000);
    assert.deepEqual(silent.state.destroyed, [1], "a page that never says it drew is taken down");
    assert.ok(silent.sentNames().includes("entry.failed"));

    const broken = load();
    broken.fromServer("entry.open", ASK);
    broken.events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 1, description: "404" });
    assert.ok(broken.state.sent.some((entry) => entry.name === `${R}entry.failed` && /não carregou/.test(entry.payload.why)));
});
