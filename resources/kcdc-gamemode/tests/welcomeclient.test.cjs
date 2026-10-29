"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The welcome form on the player's machine (src/client/welcome.ts, 2026-10-24), over fakes of the framework: it comes up only once the server asks and
// the screen is free, it has no way out but its button, and a page that cannot open is given up on and reported.

const OPEN = "kcdc-gamemode:welcome.open";
const DONE = "kcdc-gamemode:welcome.done";
const ACCEPT = "kcdc-gamemode:welcome.accept";
const FAILED = "kcdc-gamemode:welcome.failed";
const PAGE = "fw://resources/kcdc-gamemode/ui/welcome.html";
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const state = {
        now: 1_000_000, me: { ready: true, alive: true }, shot: false, dialogue: false, controls: true, screen: { width: 1920, height: 1080 },
        views: [], emitted: [], shown: [], hidden: [], focused: [], destroyed: [], sent: [], logs: [], errors: [], timers: [], createFails: false,
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
            hideView: (view) => { state.hidden.push(view); return true; },
            focusView: (view, on) => { state.focused.push([view, on]); return true; },
            destroyView: (view) => { state.destroyed.push(view); return true; },
            resizeView() { return true; },
        },
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, payload) => state.sent.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }) },
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => state.controls },
        Camera: { isShotActive: () => state.shot },
        get LocalPlayer() { return state.me; },
        require: (id) => (id === "./ui-scale.js" ? { scaleView() {}, onUiScale() {}, uiFactor: () => 1, installUiScale() {} } : assert.fail(`unexpected require ${id}`)),
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/welcome.js"), "utf8"), context);
    context.exports.installWelcome();
    const tick = (advance = 500) => { state.now += advance; intervals[0].fn(); };
    const fromServer = (name, payload) => events.get(name)(payload === undefined ? undefined : JSON.stringify(payload));
    const fromPage = (name, view = 1) => page.get(`${view}:${name}`)?.();
    return { api: context.exports, state, tick, fromServer, fromPage, events };
}

test("nothing is made until the server asks; then the page is made hidden, and shown with the language and the picture once it says it has drawn", () => {
    const sut = load();
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not asked yet");

    sut.fromServer(OPEN, { lang: "en", img: "data:image/webp;base64,TITLE" });
    sut.tick();
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, PAGE);
    assert.deepEqual(sut.state.views[0].options, { width: 1920, height: 1080, x: 0, y: 0, zIndex: 110, visible: false, focus: false });
    sut.tick();
    assert.deepEqual(sut.state.shown, [], "not before the page has drawn");

    sut.fromPage("welcome:ready");
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [[1, true]], "the keyboard goes to the page");
    assert.deepEqual(plain(sut.state.emitted.find((entry) => entry.name === "welcome:open").payload), { lang: "en", img: "data:image/webp;base64,TITLE" });

    // The same ask again, a while later, changes nothing: the page is up.
    sut.fromServer(OPEN, { lang: "en" });
    sut.tick();
    sut.tick();
    assert.equal(sut.state.shown.length, 1);
    assert.equal(sut.state.views.length, 1);
});

test("it waits for the screen to be free: the creator's camera, a conversation, another page, a dead body", () => {
    const sut = load();
    sut.fromServer(OPEN, { lang: "pt" });
    sut.state.shot = true;
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not over the creator");
    sut.state.shot = false;
    sut.state.dialogue = true;
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not over a conversation");
    sut.state.dialogue = false;
    sut.state.controls = false;
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not while another page has the keyboard");
    sut.state.controls = true;
    sut.state.me = { ready: false, alive: true };
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not before the player is in the world");
    sut.state.me = { ready: true, alive: true };
    sut.tick();
    assert.equal(sut.state.views.length, 1);
    sut.fromPage("welcome:ready");
    sut.state.dialogue = true;
    sut.tick();
    assert.deepEqual(sut.state.shown, [], "the page is shown only when the screen is free");
    sut.state.dialogue = false;
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
});

test("a body that dies with the page up puts it away, and it comes back when the player is alive again", () => {
    const sut = load();
    sut.fromServer(OPEN, { lang: "pt" });
    sut.tick();
    sut.fromPage("welcome:ready");
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
    sut.state.me = { ready: true, alive: false };
    sut.tick();
    assert.deepEqual(sut.state.hidden, [1]);
    assert.deepEqual(sut.state.focused.at(-1), [1, false]);
    sut.state.me = { ready: true, alive: true };
    sut.tick();
    assert.deepEqual(sut.state.shown, [1, 1]);
});

test("the button is the way out: the page's agreement goes to the server once, and when the server says it is done the page leaves after the thanks", () => {
    const sut = load();
    sut.fromServer(OPEN, { lang: "pt" });
    sut.tick();
    sut.fromPage("welcome:ready");
    sut.tick();
    sut.fromPage("welcome:accept");
    assert.deepEqual(plain(sut.state.sent), [{ name: ACCEPT }]);

    sut.fromServer(DONE, {});
    assert.equal(sut.state.emitted.at(-1).name, "welcome:done");
    assert.deepEqual(sut.state.destroyed, [], "the thanks stay on the screen a moment");
    sut.fromPage("welcome:accept");
    assert.equal(sut.state.sent.length, 1, "no second agreement while it leaves");
    sut.state.timers.at(-1).fn();
    assert.deepEqual(sut.state.destroyed, [1]);
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 1, "and nothing is made again");
});

test("an agreement made by the chat's /aceitar while the page was not up takes the ask away", () => {
    const sut = load();
    sut.fromServer(OPEN, { lang: "pt" });
    sut.fromServer(DONE, {});
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 0);
});

test("a page that cannot be made, does not load or never answers is given up on, and the server is told", () => {
    const refused = load();
    refused.state.createFails = true;
    refused.fromServer(OPEN, { lang: "pt" });
    refused.tick();
    assert.equal(refused.state.sent[0].name, FAILED);
    assert.match(refused.state.sent[0].payload.why, /não abriu/);

    const lost = load();
    lost.fromServer(OPEN, { lang: "pt" });
    lost.tick();
    lost.events.get("browserLoadingFailed")({ isMainFrame: false, viewId: 1, description: "a frame" });
    assert.equal(lost.state.sent.length, 0);
    lost.events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 1, description: "net::ERR_FILE_NOT_FOUND" });
    assert.deepEqual(lost.state.destroyed, [1]);
    assert.match(lost.state.sent[0].payload.why, /não carregou/);

    const silent = load();
    silent.fromServer(OPEN, { lang: "pt" });
    silent.tick();
    silent.tick(14_000);
    assert.deepEqual(silent.state.destroyed, []);
    silent.tick(2_000);
    assert.deepEqual(silent.state.destroyed, [1]);
    assert.match(silent.state.sent.at(-1).payload.why, /não respondeu/);
    silent.tick();
    silent.tick();
    assert.equal(silent.state.views.length, 1, "no second try by itself");
});

test("when the resource stops the page is thrown away", () => {
    const sut = load();
    sut.fromServer(OPEN, { lang: "pt" });
    sut.tick();
    sut.events.get("resourceStop")("another-resource");
    assert.deepEqual(sut.state.destroyed, []);
    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.destroyed, [1]);
});
