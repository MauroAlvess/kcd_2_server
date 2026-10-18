const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const RESOURCE = "kcdc-gamemode";

/** The server half of the F4 panel, with auth.ts reduced to "these steam ids are admins". */
function loadServer(admins = ["admin-1"]) {
    const handlers = new Map();
    const chat = [];
    const clock = { now: 1_000_000 };
    const player = (steamId, id) => {
        const sent = [];
        return { id, steamId, nickname: steamId, playerIndex: id, ready: true, alive: true, healthPercent: 1, mounted: false, position: { x: 1, y: 2, z: 3 }, sent, emit: (event, payload) => sent.push({ event, payload }) };
    };
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "./auth.js");
            return { isAdmin: (who) => admins.includes(who.steamId) };
        },
        console: { log() {} },
        Date: { now: () => clock.now },
        Events: { onClient: (name, fn) => handlers.set(name, fn), on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (who, text) => chat.push(text) },
        World: { day: 1, hour: 12, timeScale: 1, weather: "clear", previousWeather: "clear", weatherBlending: false, weatherRemaining: 0, rainIntensity: 0, rainAmount: 0, wetness: 0, puddles: 0 },
        Player: { all: () => [] },
        Horse: { all: () => [] },
        Prop: { all: () => [] },
        GroundItem: { all: () => [] },
        Door: { all: () => [] },
        Gate: { all: () => [] },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/panel.js"), "utf8"), context);
    context.exports.installDebugPanel({ all: () => [{ name: "give", summary: "x", usage: ["/give"] }] });
    return { handlers, chat, clock, player };
}

test("an administrator's F4 is answered with the panel", () => {
    const sut = loadServer();
    const admin = sut.player("admin-1", 1);
    sut.handlers.get(`${RESOURCE}:panel.request`)(admin);
    assert.deepEqual(admin.sent, [{ event: `${RESOURCE}:panel.open`, payload: "" }]);
    assert.equal(sut.chat.length, 0);
});

test("a player's F4 opens nothing and is told why, once in a while rather than on every press", () => {
    const sut = loadServer();
    const player = sut.player("player-1", 2);
    const request = sut.handlers.get(`${RESOURCE}:panel.request`);

    request(player);
    assert.deepEqual(player.sent, []);
    assert.deepEqual(sut.chat, ["O painel F4 é só para administradores."]);

    request(player);
    request(player);
    assert.equal(sut.chat.length, 1, "held down, it does not flood the chat");

    sut.clock.now += 9_000;
    request(player);
    assert.equal(sut.chat.length, 2);
});

test("the roster and command list go to an administrator who asks, and to nobody else", () => {
    const sut = loadServer();
    const poll = sut.handlers.get(`${RESOURCE}:panel.poll`);

    const admin = sut.player("admin-1", 1);
    poll(admin);
    assert.equal(admin.sent.length, 1);
    assert.equal(admin.sent[0].event, `${RESOURCE}:panel.realm`);
    assert.deepEqual(JSON.parse(admin.sent[0].payload).commands, [{ name: "give", summary: "x", usage: ["/give"] }]);

    const player = sut.player("player-1", 2);
    poll(player);
    assert.deepEqual(player.sent, [], "a modified client that polls anyway learns nothing");
});

test("a player who left is forgotten, so a new one with the same id is told again at once", () => {
    const sut = loadServer();
    const request = sut.handlers.get(`${RESOURCE}:panel.request`);
    const player = sut.player("player-1", 2);
    request(player);
    sut.handlers.get("playerDisconnect")(player);
    request(player);
    assert.equal(sut.chat.length, 2);
});

/** The client half: F4 asks the server rather than opening the panel itself. */
function loadClient() {
    const keys = new Map();
    const events = new Map();
    const emitted = [];
    const panelState = { visible: false, hides: 0, opens: 0 };
    const stub = new Proxy({}, { get: () => () => undefined });
    const modules = {
        "./book.js": stub, "./build.js": stub, "./camera.js": stub, "./carts.js": stub, "./creator.js": stub, "./creator-page.js": stub, "./dice.js": stub, "./follow.js": stub,
        "./combat.js": stub, "./cook-hint.js": stub, "./hud.js": stub, "./property-labels.js": stub, "./notify.js": stub, "./pick.js": stub, "./posture.js": stub, "./screen.js": stub, "./status.js": stub, "./voice.js": stub, "./skill-books.js": stub, "./item-uses.js": stub, "./skip-time.js": stub, "./whistle.js": stub,
        "./snapshot.js": { readSelf: () => ({}) },
        "./switches.js": { describeAll: () => [], flip: () => null },
        "./panel.js": {
            isVisible: () => panelState.visible,
            hide: () => { panelState.visible = false; panelState.hides += 1; },
            open: () => { panelState.visible = true; panelState.opens += 1; return true; },
            toggle: () => assert.fail("F4 must not toggle the panel by itself"),
            push() {}, markReady() {}, blur() {}, describe: () => ({}), owns: () => false, destroy() {},
        },
    };
    const context = {
        exports: {},
        require: (id) => modules[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log() {}, error() {} },
        setInterval: () => 1,
        clearInterval() {},
        Key: { bind: (key, mode, fn) => keys.set(key, fn) },
        Events: { on: (name, fn) => events.set(name, fn), emitServer: (name, payload) => emitted.push({ name, payload }) },
        Web: { getScreenSize: () => ({ width: 1920, height: 1080 }), emit() {} },
        Chat: { send() {} },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/index.js"), "utf8"), context);
    return { keys, events, emitted, panelState };
}

test("F4 on the client asks the server instead of opening the panel", () => {
    const sut = loadClient();
    sut.keys.get("f4")();
    assert.deepEqual(sut.emitted, [{ name: `${RESOURCE}:panel.request`, payload: undefined }]);
    assert.equal(sut.panelState.opens, 0, "nothing opens until the server says so");
});

test("the panel opens when the server sends panel.open, and F4 closes it without asking anybody", () => {
    const sut = loadClient();
    sut.events.get(`${RESOURCE}:panel.open`)();
    assert.equal(sut.panelState.opens, 1);
    assert.deepEqual(sut.emitted.map((entry) => entry.name), [`${RESOURCE}:panel.poll`], "it asks for its data once it is up");

    sut.emitted.length = 0;
    sut.keys.get("f4")();
    assert.equal(sut.panelState.hides, 1);
    assert.deepEqual(sut.emitted, []);
});
