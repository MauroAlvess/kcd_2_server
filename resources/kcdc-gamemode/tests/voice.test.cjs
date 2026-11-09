"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The microphone and the voice indicator, the client's half of the voice (src/client/voice.ts, 2026-10-23), over fakes of the framework: how the
// microphone is opened and what it does until the server has answered, what the panel's choice does, where the indicator goes, when it is
// shown, and what happens when its page does not come up.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/client", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

const STATE = "kcdc-gamemode:voice.state";
const GET = "kcdc-gamemode:voice.get";
const SET = "kcdc-gamemode:voice.set";
const PAGE = "fw://resources/kcdc-gamemode/ui/voice.html";

function load({ screen = { width: 1920, height: 1080 }, refuseMode = false, refuseIndicator = false } = {}) {
    const state = {
        now: 1_000_000, screen: { ...screen }, me: { ready: false }, chat: true,
        mode: "voiceActivity", key: "h", keyCalls: 0, modeCalls: [], thresholds: [], noise: false, indicator: true, enabled: true,
        talking: false, level: 0, tier: 1, throwOnEmit: false,
        views: [], emitted: [], shown: [], hidden: [], destroyed: [], resized: [], moved: [], server: [], local: [], logs: [], errors: [], cleared: [],
    };
    const events = new Map();
    const locals = new Map();
    const page = new Map();
    const intervals = [];
    const Chat = { isUIVisible: () => state.chat, setUIVisible: (visible) => { state.chat = visible; } };
    const chatState = { exports: {}, Chat };
    vm.runInNewContext(dist("chat-state.js"), chatState);
    const context = {
        exports: {},
        require: (id) => (id === "./chat-state.js" ? chatState.exports : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => { state.cleared.push(id); },
        Voice: {
            setTransmitMode: (mode) => {
                if (refuseMode) throw new Error("no microphone");
                state.mode = mode;
                state.modeCalls.push(mode);
            },
            getTransmitMode: () => state.mode,
            setActivationThreshold: (level) => { state.thresholds.push(level); },
            setNoiseSuppression: (on) => { state.noise = on; },
            getPushToTalkKey: () => state.key,
            setPushToTalkKey: (key) => { state.keyCalls += 1; state.key = key; },
            setIndicatorVisible: (visible) => {
                if (refuseIndicator) throw new Error("not in this build");
                state.indicator = visible;
            },
            isEnabled: () => state.enabled,
            isTalking: () => state.talking,
            getInputLevel: () => state.level,
            getTier: () => state.tier,
        },
        Web: {
            getScreenSize: () => state.screen,
            createView: (url, options) => {
                state.views.push({ url, options: plain(options) });
                return state.views.length;
            },
            on: (view, name, fn) => page.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => {
                if (state.throwOnEmit) throw new Error("the view is gone");
                state.emitted.push({ view, name, payload: plain(payload ?? null) });
                return true;
            },
            showView: (view) => { state.shown.push(view); return true; },
            hideView: (view) => { state.hidden.push(view); return true; },
            destroyView: (view) => { state.destroyed.push(view); return true; },
            resizeView: (view, width, height) => { state.resized.push([view, width, height]); return true; },
            setViewPosition: (view, x, y) => { state.moved.push([view, x, y]); return true; },
        },
        Events: {
            on: (name, fn) => events.set(name, fn),
            onLocal: (name, fn) => locals.set(name, fn),
            emitLocal: (name, payload) => { state.local.push({ name, payload: plain(payload ?? null) }); return Promise.resolve(); },
            emitServer: (name, payload) => { state.server.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }); },
        },
        get LocalPlayer() { return state.me; },
    };
    vm.runInNewContext(dist("voice.js"), context);
    context.exports.installVoice();
    const tick = (advance = 66) => {
        state.now += advance;
        intervals[0].fn();
    };
    const fromServer = (payload) => events.get(STATE)(JSON.stringify(payload));
    const choose = (payload) => locals.get("voice.choose")(payload);
    const fromPage = (name, view = 1) => page.get(`${view}:${name}`)?.();
    /** The player is in the world, the indicator's view is made, and its page has drawn. */
    const up = (kept = { mic: "apertar", sensitivity: "media", ranges: [3, 15, 25] }) => {
        state.me = { ready: true };
        tick();
        fromServer(kept);
        fromPage("voice:ready");
    };
    const states = () => state.emitted.filter((entry) => entry.name === "voice:state").map((entry) => entry.payload);
    const announced = () => state.local.filter((entry) => entry.name === "voice.state").map((entry) => entry.payload);
    return { api: context.exports, state, events, locals, intervals, tick, fromServer, choose, fromPage, up, states, announced };
}

test("the indicator is a small icon at the bottom centre, a hand above the health bar where the plate stood, and grows with the screen within limits", () => {
    const { hudGeometry } = load().api;
    assert.deepEqual(plain(hudGeometry({ width: 1920, height: 1080 })), { x: 934, y: 916, width: 52, height: 37 });
    assert.deepEqual(plain(hudGeometry({ width: 1280, height: 720 })), { x: 619, y: 605, width: 42, height: 30 });
    assert.deepEqual(plain(hudGeometry({ width: 3840, height: 2160 })), { x: 1889, y: 1861, width: 62, height: 44 });
    for (const [width, height] of [[1920, 1080], [1280, 720], [2560, 1440], [3840, 2160], [1366, 768]]) {
        const spot = hudGeometry({ width, height });
        assert.ok(Math.abs(spot.x + spot.width / 2 - width / 2) <= 0.5, `${width}x${height}: in the middle`);
        assert.ok(spot.y + spot.height < height * 0.89, `${width}x${height}: well above the bottom edge, where the health bar stands`);
        assert.ok(spot.y > height * 0.7, `${width}x${height}: and still in the lower part of the screen`);
    }
});

test("the bars follow the microphone on a decibel scale: nothing for no sound, everything for a shout, a low voice lower than a loud one", () => {
    const { levelScale } = load().api;
    for (const raw of [0, -0.4, Number.NaN, 0.0001, 0.008]) {
        assert.ok(levelScale(raw) < 0.01, `${raw} is nothing`);
    }
    assert.equal(levelScale(1), 1);
    assert.equal(levelScale(0.32), 1);
    const quiet = levelScale(0.02);
    const middle = levelScale(0.08);
    const loud = levelScale(0.2);
    assert.ok(quiet > 0.15 && quiet < middle && middle < loud && loud < 1, [quiet, middle, loud].join(" < "));
});

test("until the server has said what the player chose, the microphone sends only while the key is held, and the key is the mod's own H, which this module never sets (2026-11-09)", () => {
    const sut = load();
    assert.deepEqual(sut.state.modeCalls, ["pushToTalk"]);
    assert.equal(sut.state.key, "h", "the voice key is the mod's own");
    assert.equal(sut.state.keyCalls, 0, "and was never put by this module: what the player chose in the mod's menu stands");
    assert.deepEqual(sut.state.thresholds, []);
    assert.equal(sut.state.indicator, true, "the mod's own indicator is still the one in use");
    assert.deepEqual(sut.state.errors, []);
});

test("the server is asked once the player is in the world, and only once", () => {
    const sut = load();
    sut.tick();
    assert.deepEqual(sut.state.server, [], "not before the player is in the world");
    sut.state.me = { ready: true };
    sut.tick();
    sut.tick();
    sut.tick();
    assert.deepEqual(sut.state.server, [{ name: GET, payload: undefined }]);
});

test("what the server keeps is put on the microphone: open with the sensitivity chosen, or held; a wrong field changes nothing", () => {
    const sut = load();
    sut.fromServer({ mic: "aberto", sensitivity: "alta", ranges: [3, 15, 25] });
    assert.equal(sut.state.mode, "voiceActivity");
    assert.deepEqual(sut.state.thresholds, [0.02]);
    assert.equal(sut.state.noise, true, "the noise of the room is filtered");

    sut.fromServer({ mic: "aberto", sensitivity: "baixa" });
    sut.fromServer({ mic: "aberto", sensitivity: "baixa" });
    assert.deepEqual(sut.state.thresholds, [0.02, 0.08], "the same thing said twice is put on once");

    sut.fromServer({ mic: "turbo", sensitivity: "x", ranges: [0, 1] });
    assert.deepEqual(sut.state.thresholds, [0.02, 0.08]);
    assert.equal(sut.state.mode, "voiceActivity");

    sut.fromServer({ mic: "apertar", sensitivity: "baixa" });
    assert.equal(sut.state.mode, "pushToTalk");
    assert.equal(sut.state.key, "h", "held on the mod's key whichever way it goes");
    assert.equal(sut.state.keyCalls, 0);
    assert.equal(sut.state.errors.length, 0);
    assert.deepEqual(sut.announced().at(-1), { mic: "apertar", sensitivity: "baixa", ranges: [3, 15, 25] }, "the panel is told");
});

test("a server that says nothing for ten seconds leaves the microphone held on the mod's key, as the defaults have it", () => {
    const sut = load();
    sut.state.me = { ready: true };
    sut.tick();
    sut.tick(9_000);
    assert.equal(sut.state.mode, "pushToTalk");
    sut.tick(2_000);
    assert.equal(sut.state.mode, "pushToTalk", "the defaults stand: nothing opens by itself");
    assert.equal(sut.state.key, "h");
    assert.deepEqual(sut.state.thresholds, []);
    sut.tick(20_000);
    assert.deepEqual(sut.state.modeCalls, ["pushToTalk", "pushToTalk"], "the defaults are put on once");
});

test("a choice from the panel is put on at once and kept by the server; the same choice, or a wrong one, is not sent", () => {
    const sut = load();
    sut.up();
    sut.state.server.length = 0;

    sut.choose({ mic: "aberto" });
    assert.equal(sut.state.mode, "voiceActivity");
    assert.deepEqual(sut.state.server, [{ name: SET, payload: { mic: "aberto", sensitivity: "media" } }]);

    sut.choose({ mic: "aberto" });
    sut.choose({ mic: "turbo", sensitivity: "enorme" });
    sut.choose("not an object");
    sut.choose(null);
    assert.equal(sut.state.server.length, 1);

    sut.choose({ mic: "apertar", sensitivity: "alta" });
    assert.equal(sut.state.mode, "pushToTalk");
    assert.equal(sut.state.key, "h");
    assert.deepEqual(sut.state.server.at(-1), { name: SET, payload: { mic: "apertar", sensitivity: "alta" } });
    assert.deepEqual(sut.announced().at(-1), { mic: "apertar", sensitivity: "alta", ranges: [3, 15, 25] });
});

test("only the answer to the newest choice is applied: an older answer does not undo it", () => {
    const sut = load();
    sut.up({ mic: "aberto", sensitivity: "media", ranges: [3, 15, 25] });
    sut.choose({ sensitivity: "alta" });
    sut.choose({ sensitivity: "baixa" });
    assert.deepEqual(sut.state.thresholds, [0.04, 0.02, 0.08]);

    sut.fromServer({ mic: "aberto", sensitivity: "alta" });
    assert.deepEqual(sut.state.thresholds, [0.04, 0.02, 0.08], "the first answer is the older choice");
    sut.fromServer({ mic: "aberto", sensitivity: "baixa" });
    assert.deepEqual(sut.state.thresholds, [0.04, 0.02, 0.08], "and the last is the one already in use");
    sut.fromServer({ mic: "aberto", sensitivity: "media" });
    assert.deepEqual(sut.state.thresholds, [0.04, 0.02, 0.08, 0.04], "an answer to nothing the player did (another computer) is applied");
});

test("the panel is told the state when it asks", () => {
    const sut = load();
    sut.up({ mic: "apertar", sensitivity: "alta", ranges: [3, 12, 40] });
    sut.state.local.length = 0;
    sut.locals.get("voice.ask")();
    assert.deepEqual(sut.announced(), [{ mic: "apertar", sensitivity: "alta", ranges: [3, 12, 40] }]);
});

test("the indicator's view is made once the player is in the world, hidden; the mod's own is put away only when the page says it has drawn", () => {
    const sut = load();
    sut.tick();
    assert.equal(sut.state.views.length, 0, "not before the player is in the world");

    sut.state.me = { ready: true };
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, PAGE);
    assert.deepEqual(sut.state.views[0].options, { width: 52, height: 37, x: 934, y: 916, zIndex: 55, visible: false, focus: false });
    assert.equal(sut.state.indicator, true, "the mod's indicator stays until the page is up");

    sut.fromPage("voice:ready");
    assert.equal(sut.state.indicator, false);
    sut.state.indicator = true;
    sut.fromPage("voice:ready");
    assert.equal(sut.state.indicator, true, "a page that says it twice changes nothing");
});

test("a page that never says it has drawn is given up on, and the mod's indicator stays", () => {
    const sut = load();
    sut.state.me = { ready: true };
    sut.tick();
    sut.tick(7_000);
    assert.deepEqual(sut.state.destroyed, []);
    sut.tick(2_000);
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal(sut.state.indicator, true);
    assert.ok(sut.state.logs.some((line) => /a página não respondeu/.test(line)), sut.state.logs.join("|"));
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 1, "no second try");
});

test("a page that fails to load is given up on, and the mod's indicator comes back", () => {
    const sut = load();
    sut.up();
    assert.equal(sut.state.indicator, false);
    sut.events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 7, description: "other view" });
    sut.events.get("browserLoadingFailed")({ isMainFrame: false, viewId: 1, description: "a frame" });
    assert.deepEqual(sut.state.destroyed, []);
    sut.events.get("browserLoadingFailed")({ isMainFrame: true, viewId: 1, description: "net::ERR_FILE_NOT_FOUND" });
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal(sut.state.indicator, true);
    assert.ok(sut.state.logs.some((line) => /a página não carregou/.test(line)));
});

test("a build that cannot hide the mod's indicator, or cannot make the view, is reported and does not stop the rest", () => {
    const stubborn = load({ refuseIndicator: true });
    assert.doesNotThrow(() => stubborn.up());
    assert.ok(stubborn.state.errors.some((line) => /not in this build/.test(line)), stubborn.state.errors.join("|"));
    assert.doesNotThrow(() => stubborn.events.get("resourceStop")("kcdc-gamemode"));

    const sut = load({ refuseMode: true });
    assert.equal(sut.state.errors.length, 1);
    assert.match(sut.state.errors[0], /no microphone/);
    assert.doesNotThrow(() => sut.fromServer({ mic: "aberto", sensitivity: "alta" }));
    assert.equal(sut.state.errors.length, 2);
});

test("it is shown while the player speaks, with the range's colour and the microphone's level, and hangs on a moment before it fades away", () => {
    const sut = load();
    sut.up();
    sut.tick();
    assert.deepEqual(sut.state.shown, [], "nobody speaks: nothing on the screen");
    assert.deepEqual(sut.states(), []);

    sut.state.talking = true;
    sut.state.level = 0.08;
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
    const spoken = sut.states().at(-1);
    assert.deepEqual({ ...spoken, level: undefined }, { on: true, talking: true, level: undefined, tier: 1, ranges: [3, 15, 25], flash: false });
    assert.ok(Math.abs(spoken.level - 0.627) < 0.01, `level ${spoken.level}`);

    sut.state.level = 0.2;
    sut.tick();
    assert.ok(sut.states().at(-1).level > spoken.level, "a louder voice is a taller bar");
    assert.deepEqual(sut.state.shown, [1], "shown once");

    sut.state.talking = false;
    sut.tick(100);
    assert.deepEqual({ ...sut.states().at(-1) }, { on: true, talking: false, level: 0, tier: 1, ranges: [3, 15, 25], flash: false }, "still there after the last word");

    sut.tick(700);
    assert.deepEqual(sut.states().at(-1), { on: false, talking: false, level: 0, tier: 1, ranges: [3, 15, 25], flash: false }, "then told to fade");
    assert.deepEqual(sut.state.hidden, [], "but the view is kept while it does");
    sut.tick(300);
    assert.deepEqual(sut.state.hidden, []);
    sut.tick(400);
    assert.deepEqual(sut.state.hidden, [1], "and put away, so that it paints nothing");

    sut.tick();
    const count = sut.states().length;
    sut.tick();
    assert.equal(sut.states().length, count, "asleep, it says nothing");
});

test("a word spoken while it fades brings it back without showing the view twice", () => {
    const sut = load();
    sut.up();
    sut.state.talking = true;
    sut.state.level = 0.1;
    sut.tick();
    sut.state.talking = false;
    sut.tick(800);
    assert.equal(sut.states().at(-1).on, false);
    sut.state.talking = true;
    sut.tick(200);
    assert.equal(sut.states().at(-1).on, true);
    sut.state.talking = false;
    sut.tick(5_000);
    sut.tick(5_000);
    assert.deepEqual(sut.state.shown, [1], "the view was never put away in between");
    assert.deepEqual(sut.state.hidden, [1]);
});

test("changing the range with Y shows the indicator in the new range's colour for a moment, even when nobody speaks", () => {
    const sut = load();
    sut.up();
    sut.tick();
    assert.deepEqual(sut.state.shown, [], "the range the player starts on is not news");

    sut.state.tier = 2;
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.states().at(-1), { on: true, talking: false, level: 0, tier: 2, ranges: [3, 15, 25], flash: true });

    sut.tick(2_000);
    assert.equal(sut.states().at(-1).flash, true, "still showing the range");
    sut.state.tier = 0;
    sut.tick(1_000);
    assert.deepEqual(sut.states().at(-1), { on: true, talking: false, level: 0, tier: 0, ranges: [3, 15, 25], flash: true }, "and a second change starts the moment again");
    sut.tick(2_500);
    assert.equal(sut.states().at(-1).on, false);
    sut.tick(700);
    assert.deepEqual(sut.state.hidden, [1]);
});

test("it is not shown while the chat is hidden (the free camera, the creator) or while the player has voice chat off", () => {
    const sut = load();
    sut.up();
    sut.state.talking = true;
    sut.state.level = 0.1;

    sut.state.chat = false;
    sut.tick();
    assert.deepEqual(sut.state.shown, []);
    sut.state.chat = true;
    sut.state.enabled = false;
    sut.tick();
    assert.deepEqual(sut.state.shown, []);

    sut.state.enabled = true;
    sut.tick();
    assert.deepEqual(sut.state.shown, [1]);
    sut.state.chat = false;
    sut.tick();
    assert.equal(sut.states().at(-1).on, false, "and it goes when the chat does");
});

test("the indicator follows a change of the screen's size, once", () => {
    const sut = load();
    sut.up();
    sut.tick();
    assert.deepEqual(sut.state.resized, []);
    sut.state.screen = { width: 1280, height: 720 };
    sut.tick();
    sut.tick();
    assert.deepEqual(sut.state.resized, [[1, 42, 30]]);
    assert.deepEqual(sut.state.moved, [[1, 619, 605]]);
});

test("an indicator whose view fails is given up on and the mod's indicator comes back; the microphone goes on as it was", () => {
    const sut = load();
    sut.up();
    assert.equal(sut.state.indicator, false);
    sut.state.talking = true;
    sut.state.throwOnEmit = true;
    assert.doesNotThrow(() => sut.tick());
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal(sut.state.indicator, true);
    assert.ok(sut.state.logs.some((line) => /o indicador falhou/.test(line)), sut.state.logs.join("|"));
    assert.equal(sut.state.mode, "pushToTalk");
    sut.state.throwOnEmit = false;
    sut.tick();
    sut.tick();
    assert.equal(sut.state.views.length, 1, "no second try");
});

test("the first spells of speech are written to the log, with the loudest level read, and no more than forty of them", () => {
    const sut = load();
    sut.up();
    sut.state.talking = true;
    sut.state.level = 0.05;
    sut.tick();
    sut.state.level = 0.173;
    sut.tick();
    sut.state.level = 0.1;
    sut.tick();
    sut.state.talking = false;
    sut.tick(1_000);
    const spoken = sut.state.logs.filter((line) => /^voice: falou /.test(line));
    assert.equal(spoken.length, 1);
    assert.match(spoken[0], /nível máximo 0\.173/);
    assert.match(spoken[0], /apertar, abre em 0\.04/);

    for (let n = 0; n < 60; n += 1) {
        sut.state.talking = true;
        sut.tick();
        sut.state.talking = false;
        sut.tick(1_000);
    }
    assert.equal(sut.state.logs.filter((line) => /^voice: falou /.test(line)).length, 40);
});

test("when the resource stops, the view is thrown away and the mod's indicator is given back; another resource stopping changes nothing", () => {
    const sut = load();
    sut.up();
    sut.events.get("resourceStop")("another-resource");
    assert.deepEqual(sut.state.destroyed, []);
    assert.equal(sut.state.indicator, false);

    sut.events.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal(sut.state.indicator, true);
    assert.deepEqual(sut.state.cleared, [1]);
});
