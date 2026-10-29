"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The chat of the game, drawn by a page of ours (src/client/chat-card.ts), over fakes of the framework: where the card goes, when
// it takes the game's overlay's place, what T and a submitted line do, and what happens when the page does not come up.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/client", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ screen = { width: 1920, height: 1080 } } = {}) {
    const state = {
        views: [], emitted: [], focused: [], shown: [], hidden: [], destroyed: [], resized: [], moved: [], sent: [], nativeVisible: true, nativeCalls: [],
        me: { ready: false }, dialogue: false, controls: true, logs: [], now: 1_000_000, screen: { ...screen }, createFails: false,
    };
    const events = new Map();
    const page = new Map();
    const keys = new Map();
    const intervals = [];
    const Chat = {
        send: (text) => state.sent.push(text),
        setUIVisible: (visible) => { state.nativeVisible = visible; state.nativeCalls.push(visible); },
        isUIVisible: () => state.nativeVisible,
    };
    const stateModule = { exports: {}, Chat };
    vm.runInNewContext(dist("chat-state.js"), stateModule);
    const context = {
        exports: {},
        require: (id) => (id === "./chat-state.js" ? stateModule.exports : id === "./ui-scale.js" ? { scaleView() {}, onUiScale() {}, uiFactor: () => 1, installUiScale() {} } : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Chat,
        Web: {
            getScreenSize: () => state.screen,
            createView: (url, options) => {
                if (state.createFails) throw new Error("no browser");
                state.views.push({ url, options: plain(options) });
                return state.views.length;
            },
            on: (view, name, fn) => page.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => { state.emitted.push({ view, name, payload: plain(payload ?? null) }); return true; },
            focusView: (view, on) => { state.focused.push([view, on]); return true; },
            showView: (view) => { state.shown.push(view); return true; },
            hideView: (view) => { state.hidden.push(view); return true; },
            destroyView: (view) => { state.destroyed.push(view); return true; },
            resizeView: (view, width, height) => { state.resized.push([view, width, height]); return true; },
            setViewPosition: (view, x, y) => { state.moved.push([view, x, y]); return true; },
        },
        Key: { bind: (key, phase, fn) => { keys.set(key, fn); return true; } },
        Events: { on: (name, fn) => events.set(name, fn) },
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => state.controls },
        get LocalPlayer() { return state.me; },
    };
    vm.runInNewContext(dist("chat-card.js"), context);
    context.exports.installChatCard();
    const tick = () => intervals.find((entry) => entry.ms === 500).fn();
    const fromPage = (name, payload, view = 1) => page.get(`${view}:${name}`)?.(payload === undefined ? undefined : JSON.stringify(payload));
    /** A payload handed over as it is, already read. */
    const fromPageRaw = (name, payload, view = 1) => page.get(`${view}:${name}`)?.(payload);
    const say = (message) => events.get("chatMessage")(message);
    /** The player is in the world, the card is made, and its page has drawn. */
    const up = () => {
        state.me = { ready: true };
        tick();
        fromPage("chat:ready");
    };
    return { api: context.exports, state, events, keys, tick, fromPage, fromPageRaw, say, up, state_: stateModule.exports };
}

test("the card goes to the left edge, a hand above the bottom where the framework's logo stands, and grows with the screen within limits", () => {
    const { cardGeometry } = load().api;
    assert.deepEqual(plain(cardGeometry({ width: 1920, height: 1080 })), { x: 23, y: 551, width: 518, height: 367 });
    assert.deepEqual(plain(cardGeometry({ width: 1280, height: 720 })), { x: 15, y: 367, width: 380, height: 245 });
    assert.deepEqual(plain(cardGeometry({ width: 3840, height: 2160 })), { x: 46, y: 1376, width: 720, height: 460 });
    for (const [width, height] of [[1920, 1080], [1280, 720], [2560, 1440], [3840, 2160]]) {
        const spot = cardGeometry({ width, height });
        assert.equal(spot.y + spot.height, Math.round(height * 0.85), "its foot stands 15% of the height above the bottom edge");
        assert.ok(spot.x + spot.width < width * 0.5, "and it never reaches the middle of the screen");
    }
});

test("the card is made once the player is in the world, and the game's overlay is hidden only when the page says it has drawn", () => {
    const sut = load();
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not before the player is in the world");

    sut.state.me = { ready: true };
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, "fw://resources/kcdc-gamemode/ui/chat.html");
    assert.deepEqual(sut.state.views[0].options, { width: 518, height: 367, x: 23, y: 551, zIndex: 60, visible: true, focus: false });
    assert.deepEqual(sut.state.nativeCalls, [], "the game's overlay stays until the page is up");

    sut.say({ author: "Hans", text: "Boa tarde.", color: 0 });
    sut.fromPage("chat:ready");
    assert.deepEqual(sut.state.nativeCalls, [false]);
    assert.deepEqual(sut.state.emitted.filter((entry) => entry.name === "chat:line").map((entry) => entry.payload), [{ author: "Hans", text: "Boa tarde.", color: 0 }], "what was said meanwhile is handed to the page");

    sut.fromPage("chat:ready");
    assert.deepEqual(sut.state.nativeCalls, [false], "a page that says it twice changes nothing");
});

test("the lines that arrive go to the page; what is not a line is ignored, and only the last hundred are kept for a page that is born again", () => {
    const sut = load();
    sut.up();
    sut.say({ author: "", text: "Aviso do reino.", color: 4294901760 });
    sut.say({ author: 5, text: "x" });
    sut.say({ text: "" });
    sut.say("text");
    sut.say(null);
    const lines = sut.state.emitted.filter((entry) => entry.name === "chat:line").map((entry) => entry.payload);
    assert.deepEqual(lines, [{ author: "", text: "Aviso do reino.", color: 4294901760 }, { author: "", text: "x", color: 0 }]);

    const early = load();
    for (let n = 0; n < 130; n += 1) early.say({ author: "A", text: `linha ${n}` });
    early.up();
    const flushed = early.state.emitted.filter((entry) => entry.name === "chat:line");
    assert.equal(flushed.length, 100);
    assert.equal(flushed[0].payload.text, "linha 30");
});

test("T focuses the writing line, once; not before the card is up, not over a conversation of the game, not while another page has the keys", () => {
    const sut = load();
    const t = sut.keys.get("t");
    t();
    assert.deepEqual(sut.state.focused, [], "no card yet");

    sut.up();
    sut.state.dialogue = true;
    t();
    sut.state.dialogue = false;
    sut.state.controls = false;
    t();
    sut.state.controls = true;
    assert.deepEqual(sut.state.focused, []);

    t();
    assert.deepEqual(sut.state.focused, [[1, true]]);
    assert.deepEqual(sut.state.emitted.filter((entry) => entry.name === "chat:open").length, 1);
    t();
    assert.equal(sut.state.focused.length, 1, "already open");
});

test("a submitted line is sent as typed, trimmed, and gives the keys back; an empty one or Esc only gives them back", () => {
    const sut = load();
    sut.up();
    sut.keys.get("t")();
    sut.fromPage("chat:submit", { text: "  /me acena  " });
    assert.deepEqual(sut.state.sent, ["/me acena"]);
    assert.deepEqual(sut.state.focused.at(-1), [1, false]);
    assert.equal(sut.state.emitted.at(-1).name, "chat:shut");

    sut.keys.get("t")();
    sut.fromPage("chat:submit", { text: "   " });
    sut.keys.get("t")();
    sut.fromPage("chat:close");
    assert.deepEqual(sut.state.sent, ["/me acena"], "nothing more was sent");
    assert.deepEqual(sut.state.focused.at(-1), [1, false]);

    sut.keys.get("t")();
    sut.fromPageRaw("chat:submit", { text: "ainda assim chega" });
    assert.deepEqual(sut.state.sent.at(-1), "ainda assim chega", "a payload that arrives already read is taken too");
    sut.fromPage("chat:submit", 42);
    sut.fromPage("chat:submit", "not json");
    assert.equal(sut.state.sent.length, 2);
});

test("the pictures hide the card and bring it back through the same switch the game's overlay used; the writing line is put away first", () => {
    const sut = load();
    assert.equal(sut.state_.chatShown(), true, "before the card: the game's overlay answers");
    sut.up();
    assert.equal(sut.state_.chatShown(), true);
    sut.keys.get("t")();
    sut.state_.showChat(false);
    assert.equal(sut.state_.chatShown(), false);
    assert.deepEqual(sut.state.hidden, [1]);
    assert.deepEqual(sut.state.focused.at(-1), [1, false], "the writing line is closed");
    sut.keys.get("t")();
    assert.equal(sut.state.focused.length, 2, "T does nothing while the card is hidden");

    sut.state_.showChat(true);
    assert.equal(sut.state_.chatShown(), true);
    assert.deepEqual(sut.state.shown, [1, 1], "shown again (once when the page drew, once now)");
    assert.deepEqual(sut.state.nativeCalls, [false], "the game's overlay was never touched by it");
});

test("a conversation of the game that comes up while the line is open closes it", () => {
    const sut = load();
    sut.up();
    sut.keys.get("t")();
    sut.state.dialogue = true;
    sut.tick();
    assert.deepEqual(sut.state.focused.at(-1), [1, false]);
});

test("a page that never says it drew, or that fails to load, is given up: the game's overlay stays, and the pictures work on it", () => {
    const slow = load();
    slow.state.me = { ready: true };
    slow.tick();
    slow.state.now += 7_000;
    slow.tick();
    assert.deepEqual(slow.state.destroyed, [], "not yet");
    slow.state.now += 2_000;
    slow.tick();
    assert.deepEqual(slow.state.destroyed, [1]);
    assert.ok(slow.state.logs.some((line) => /a página não respondeu; fica o chat do jogo/.test(line)));
    assert.equal(slow.state.nativeVisible, true);
    slow.tick();
    assert.equal(slow.state.views.length, 1, "no second try");
    slow.state_.showChat(false);
    assert.equal(slow.state.nativeVisible, false, "the switch works on the game's overlay again");

    const broken = load();
    broken.state.me = { ready: true };
    broken.tick();
    broken.events.get("browserLoadingFailed")({ viewId: 1, isMainFrame: true, description: "ERR_FILE_NOT_FOUND" });
    assert.deepEqual(broken.state.destroyed, [1]);
    assert.ok(broken.state.logs.some((line) => /não carregou \(ERR_FILE_NOT_FOUND\)/.test(line)));

    const other = load();
    other.up();
    other.events.get("browserLoadingFailed")({ viewId: 99, isMainFrame: true, description: "x" });
    other.events.get("browserLoadingFailed")({ viewId: 1, isMainFrame: false, description: "x" });
    assert.deepEqual(other.state.destroyed, [], "another view's failure, or a frame's, is none of its business");

    const nobrowser = load();
    nobrowser.state.createFails = true;
    nobrowser.state.me = { ready: true };
    nobrowser.tick();
    assert.ok(nobrowser.state.logs.some((line) => /a página não abriu \((Error: )?no browser\)/.test(line)), nobrowser.state.logs.join("|"));
    assert.equal(nobrowser.state.nativeVisible, true);
});

test("the card follows a change of the screen's size, and goes with the resource", () => {
    const sut = load();
    sut.up();
    sut.tick();
    assert.deepEqual(sut.state.resized, [], "the size has not changed");
    sut.state.screen = { width: 1280, height: 720 };
    sut.tick();
    assert.deepEqual(sut.state.resized, [[1, 380, 245]]);
    assert.deepEqual(sut.state.moved, [[1, 15, 367]]);

    sut.events.get("resourceStop")("another-resource");
    assert.deepEqual(sut.state.destroyed, []);
    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal(sut.state.nativeVisible, true, "the game's overlay is given back");
});

test("with nothing to show the card sleeps (hidden: it paints nothing) and wakes at the next line or at T (user, 2026-10-19: FPS)", () => {
    const sut = load();
    sut.up();
    const view = 1;
    sut.state.hidden.length = 0;
    sut.state.now += sut.api.IDLE_HIDE_MS - 1_000;
    sut.tick();
    assert.deepEqual(sut.state.hidden, [], "not yet");
    sut.state.now += 2_000;
    sut.tick();
    assert.deepEqual(sut.state.hidden, [view], "asleep after a quiet while");
    sut.tick();
    assert.deepEqual(sut.state.hidden, [view], "once");

    sut.state.shown.length = 0;
    sut.say({ author: "Hans", text: "Bom dia", color: 0 });
    assert.deepEqual(sut.state.shown, [view], "a line wakes it");
    assert.ok(sut.state.emitted.some((entry) => entry.name === "chat:line" && entry.payload.text === "Bom dia"), "and is shown");

    sut.state.now += sut.api.IDLE_HIDE_MS + 1_000;
    sut.tick();
    assert.deepEqual(sut.state.hidden, [view, view], "asleep again");
    sut.state.shown.length = 0;
    sut.keys.get("t")();
    assert.deepEqual(sut.state.shown, [view], "T wakes it");
    assert.ok(sut.state.focused.some(([id, on]) => id === view && on), "and gives it the keys");
    sut.state.now += sut.api.IDLE_HIDE_MS + 1_000;
    sut.tick();
    assert.deepEqual(sut.state.hidden, [view, view], "never while somebody is writing");
});

