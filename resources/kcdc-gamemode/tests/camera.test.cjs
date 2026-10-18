const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

/**
 * The client camera module over fakes of the framework: the third-person camera, the free camera (NoClip), the HUD,
 * the chat, the keys and the events. `state` is what the fakes hold and what they were asked to do.
 */
function load({ thirdPersonOn = false, suppressed = [], chatVisible = true } = {}) {
    const state = {
        third: thirdPersonOn,
        thirdCalls: [],
        active: false,
        enableResult: "enabled",
        enabled: [],
        disabled: 0,
        camPos: { x: 0, y: 0, z: 1.6 },
        moved: [],
        moves: [],
        views: [],
        shown: [],
        hiddenViews: [],
        focused: [],
        destroyed: [],
        pageEmits: [],
        pageFails: false,
        timeouts: [],
        hidden: new Set(),
        suppressed: new Set(suppressed),
        hudCalls: [],
        chatVisible,
        chatCalls: [],
        notified: [],
        server: [],
        localEvents: [],
        me: { ready: true, alive: true, position: { x: 0, y: 0, z: 0 } },
        log: [],
        // Keys held down, as Key.isDown reads them; and the clock.
        down: new Set(),
        now: 1_000_000,
    };
    const events = new Map();
    const locals = new Map();
    const keys = new Map();
    const intervals = new Map();
    const pageHandlers = new Map();
    let nextInterval = 1;

    class Vector3 {
        constructor(x, y, z) {
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    const context = {
        exports: {},
        Vector3,
        Date: { now: () => state.now },
        console: { log: (line) => state.log.push(line), error: (line) => state.log.push(line) },
        setInterval: (fn, ms) => {
            const id = nextInterval++;
            intervals.set(id, { fn, ms });
            return id;
        },
        clearInterval: (id) => intervals.delete(id),
        setTimeout: (fn, ms) => { const timer = { fn, ms, done: false }; state.timeouts.push(timer); return timer; },
        clearTimeout: (timer) => { if (timer) timer.done = true; },
        get LocalPlayer() { return state.me; },
        Web: {
            getScreenSize: () => ({ width: 1920, height: 1080 }),
            createView: (url, options) => {
                if (state.pageFails) throw new Error("no browser");
                state.views.push({ url, options: { ...options } });
                pageHandlers.clear();
                return state.views.length;
            },
            on: (view, name, fn) => pageHandlers.set(`${view}:${name}`, fn),
            showView: (view) => state.shown.push(view),
            hideView: (view) => state.hiddenViews.push(view),
            focusView: (view, on) => state.focused.push({ view, on }),
            destroyView: (view) => state.destroyed.push(view),
            emit: (view, name, payload) => state.pageEmits.push({ view, name, payload: payload === undefined ? undefined : JSON.parse(JSON.stringify(payload)) }),
        },
        Camera: {
            setThirdPerson: (options) => {
                state.thirdCalls.push(options === null ? null : { ...options });
                state.third = options !== null;
            },
            isThirdPerson: () => state.third,
        },
        NoClip: {
            enable: (options) => {
                state.enabled.push({ ...options });
                if (state.enableResult === "enabled") state.active = true;
                return state.enableResult;
            },
            disable: () => { state.disabled += 1; state.active = false; },
            isActive: () => state.active,
            getPosition: () => (state.active ? { ...state.camPos } : null),
            setPosition: (position) => { state.moved.push(position); state.camPos = { x: position.x, y: position.y, z: position.z }; return true; },
            move: (input, delta) => { state.moves.push({ input: { ...input }, delta }); return !state.moveRefused; },
        },
        Hud: {
            isElementVisible: (element) => !state.suppressed.has(element),
            setElementVisible: (element, visible) => {
                state.hudCalls.push({ element, visible });
                if (visible) state.hidden.delete(element); else state.hidden.add(element);
                return true;
            },
            showNotification: (text) => { state.notified.push(text); return true; },
        },
        Chat: {
            isUIVisible: () => state.chatVisible,
            setUIVisible: (visible) => { state.chatCalls.push(visible); state.chatVisible = visible; },
        },
        Key: { bind: (key, phase, fn) => { keys.set(key, fn); return true; }, isDown: (key) => state.down.has(key) },
        Events: {
            on: (name, fn) => events.set(name, fn),
            onLocal: (name, fn) => locals.set(name, fn),
            emitLocal: (name, payload) => { state.localEvents.push({ name, payload: payload === undefined ? undefined : { ...payload } }); return Promise.resolve(); },
            emitServer: (name, payload) => state.server.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/camera.js"), "utf8"), context);
    context.exports.installCamera();

    /** Runs every interval whose period is `ms` (1000: the ask for the saved choice; 100: the free camera's watch). */
    const tick = (ms) => {
        for (const { fn, ms: period } of [...intervals.values()]) {
            if (period === ms) fn();
        }
    };
    /** What the free camera's page tells the client: the view is the newest one made. */
    const page = (name, payload) => pageHandlers.get(`${state.views.length}:freecam:${name}`)?.(payload === undefined ? undefined : JSON.stringify(payload));
    /** Runs the timeouts asked for with this delay (the browser's destroy is asked for with 0), once each. */
    const runTimeouts = (ms) => {
        for (const timer of state.timeouts.filter((entry) => entry.ms === ms && !entry.done)) {
            timer.done = true;
            timer.fn();
        }
    };
    const fromServer = (options) => events.get("kcdc-gamemode:options.state")(JSON.stringify(options));
    const choose = (fields) => locals.get("camera.choose")(fields);
    const lastState = () => [...state.localEvents].reverse().find((entry) => entry.name === "camera.state")?.payload;
    return { api: context.exports, state, events, locals, keys, intervals, tick, fromServer, choose, lastState, page, runTimeouts };
}

const VIEWS = { perto: { distance: 2.2, height: 1.65, shoulder: 0.5 }, normal: { distance: 3.2, height: 1.7, shoulder: 0.45 }, longe: { distance: 4.8, height: 1.85, shoulder: 0.35 } };

test("the saved choice is asked for once the player is in the world, and applied when it comes", () => {
    const sut = load();
    sut.state.me = { ready: false, alive: true, position: { x: 0, y: 0, z: 0 } };
    sut.tick(1000);
    assert.deepEqual(sut.state.server, []);

    sut.state.me = { ready: true, alive: true, position: { x: 0, y: 0, z: 0 } };
    sut.tick(1000);
    sut.tick(1000);
    assert.deepEqual(sut.state.server, [{ name: "kcdc-gamemode:options.get", payload: undefined }], "asked once");

    sut.fromServer({ thirdPerson: true, view: "longe" });
    assert.deepEqual(sut.state.thirdCalls, [VIEWS.longe]);
    assert.deepEqual(sut.lastState(), { thirdPerson: true, view: "longe", flying: false });
});

test("first person from the server leaves the game's own camera alone", () => {
    const sut = load();
    sut.fromServer({ thirdPerson: false, view: "normal" });
    assert.deepEqual(sut.state.thirdCalls, []);
});

test("a choice from the panel is applied at once and sent to be kept", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "perto" });

    assert.deepEqual(sut.state.thirdCalls, [VIEWS.perto]);
    assert.deepEqual(sut.state.server.at(-1), { name: "kcdc-gamemode:options.set", payload: { thirdPerson: true, view: "perto" } });
    assert.deepEqual(sut.lastState(), { thirdPerson: true, view: "perto", flying: false });

    sut.choose({ thirdPerson: 0 });
    assert.equal(sut.state.thirdCalls.at(-1), null, "the view goes back to the game");
    assert.deepEqual(sut.state.server.at(-1).payload, { thirdPerson: false, view: "perto" }, "the distance is kept for next time");
});

test("an older answer from the server does not undo a newer choice", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "normal" });
    sut.choose({ thirdPerson: 0, view: "normal" });
    const calls = sut.state.thirdCalls.length;

    sut.fromServer({ thirdPerson: true, view: "normal" });
    assert.equal(sut.state.thirdCalls.length, calls, "the answer to the first choice is not applied over the second");
    assert.equal(sut.lastState().thirdPerson, false);

    sut.fromServer({ thirdPerson: false, view: "normal" });
    assert.equal(sut.state.third, false);
});

test("an answer from the server that is not well-formed changes nothing", () => {
    const sut = load();
    sut.fromServer({ thirdPerson: "yes", view: "longe" });
    sut.fromServer({ thirdPerson: true, view: "far" });
    sut.events.get("kcdc-gamemode:options.state")("not json");
    assert.deepEqual(sut.state.thirdCalls, []);
});

test("/camera is the same choice the panel shows: toggle, a distance of its own, and back to first person", () => {
    const sut = load();
    const command = sut.events.get("kcdc-gamemode:camera.thirdPerson");

    command(JSON.stringify({ mode: "toggle" }));
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.normal);
    assert.deepEqual(sut.state.server.at(-1).payload, { thirdPerson: true, view: "normal" });

    command({ mode: "third", distance: 6 });
    assert.deepEqual(sut.state.thirdCalls.at(-1), { ...VIEWS.normal, distance: 6 });

    command({ mode: "third", distance: 500 });
    assert.equal(sut.state.thirdCalls.at(-1).distance, 20, "the framework's own limit");

    command({ mode: "first" });
    assert.equal(sut.state.thirdCalls.at(-1), null);
    assert.equal(sut.lastState().thirdPerson, false);
    assert.match(sut.state.notified.at(-1), /primeira pessoa/);
});

test("the free camera puts the third-person camera down, flies in camera mode with no built-in driver, makes its page, and hides the HUD and the chat", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "longe" });
    sut.state.thirdCalls.length = 0;

    sut.locals.get("camera.free")();

    assert.deepEqual(sut.state.thirdCalls, [null], "there is one view: the third person steps aside first");
    assert.deepEqual(sut.state.enabled, [{ mode: "camera", input: false, speed: 4 }], "the framework's own driver takes every key, Esc and F2 too");
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, "fw://resources/kcdc-gamemode/ui/freecam.html");
    assert.deepEqual(sut.state.views[0].options, { width: 1920, height: 1080, x: 0, y: 0, zIndex: 90, visible: false, focus: false });
    assert.deepEqual(sut.state.shown, [], "not shown before the page has drawn");
    assert.ok(sut.state.hidden.has("Compass") && sut.state.hidden.has("Stats") && sut.state.hidden.has("Hints"));
    assert.deepEqual(sut.state.chatCalls, [false]);
    assert.match(sut.state.notified.at(-1), /Esc, F2 ou o botão Sair voltam/);
    assert.match(sut.state.notified.at(-1), /5 minutos/);
    assert.equal(sut.lastState().flying, true);
});

test("the page says it has drawn: it is shown and given the keyboard, and the flying starts on its own beat", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    assert.equal([...sut.intervals.values()].filter((entry) => entry.ms === 16).length, 0, "nothing flies before the page");

    sut.page("ready");
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [{ view: 1, on: true }]);
    assert.equal([...sut.intervals.values()].filter((entry) => entry.ms === 16).length, 1);
});

test("what the page says is held flies the camera, and the mouse dragged turns it, once: nothing is sent while nothing is held", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.state.now += 16;
    sut.tick(16);
    assert.deepEqual(sut.state.moves, [], "idle: NoClip is not asked to move");

    sut.page("keys", { forward: 1, strafe: -1, lift: 0, boost: true, crawl: false });
    sut.state.now += 16;
    sut.tick(16);
    assert.deepEqual(sut.state.moves.at(-1), { input: { forward: 1, strafe: -1, lift: 0, boost: true, crawl: false, yaw: 0, pitch: 0 }, delta: 0.016 });

    // dragged 100 px to the right and 50 px down: a falling yaw (to the right), a falling pitch (down)
    sut.page("keys", { forward: 0, strafe: 0, lift: 0, boost: false, crawl: false });
    sut.page("look", { dx: 100, dy: 50 });
    sut.page("look", { dx: 20, dy: 10 });
    sut.state.now += 16;
    sut.tick(16);
    const turned = sut.state.moves.at(-1).input;
    assert.ok(Math.abs(turned.yaw - -14.4) < 1e-9 && Math.abs(turned.pitch - -7.2) < 1e-9, `${turned.yaw} ${turned.pitch}`);
    const count = sut.state.moves.length;
    sut.state.now += 16;
    sut.tick(16);
    assert.equal(sut.state.moves.length, count, "the drag was turned once, not again");

    // a stalled frame counts as a tenth of a second
    sut.page("keys", { forward: 1, strafe: 0, lift: 1, boost: false, crawl: true });
    sut.state.now += 2_000;
    sut.tick(16);
    assert.equal(sut.state.moves.at(-1).delta, 0.1);
    assert.deepEqual({ lift: sut.state.moves.at(-1).input.lift, crawl: sut.state.moves.at(-1).input.crawl }, { lift: 1, crawl: true });
});

test("the arrows on the page turn the camera at a steady rate, the mouse dragged on top", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");

    sut.page("keys", { forward: 0, strafe: 0, lift: 0, yaw: 1, pitch: -1, boost: false, crawl: false });
    sut.state.now += 100;
    sut.tick(16);
    const turned = sut.state.moves.at(-1);
    assert.equal(turned.delta, 0.1);
    assert.ok(Math.abs(turned.input.yaw - 7) < 1e-9 && Math.abs(turned.input.pitch - -7) < 1e-9, `left and down, seventy degrees a second: ${turned.input.yaw} ${turned.input.pitch}`);

    sut.page("look", { dx: 10, dy: 0 });
    sut.state.now += 100;
    sut.tick(16);
    assert.ok(Math.abs(sut.state.moves.at(-1).input.yaw - 5.8) < 1e-9, "the drag to the right takes off the arrow's turn to the left");

    sut.page("keys", { forward: 0, strafe: 0, lift: 0, yaw: 0, pitch: 0, boost: false, crawl: false });
    const count = sut.state.moves.length;
    sut.state.now += 100;
    sut.tick(16);
    assert.equal(sut.state.moves.length, count, "let go: it stops turning");
});

test("the first key or click the page hears is logged once, and the page keeps the keyboard", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");
    assert.ok(sut.state.log.includes("free camera: the page drew; it has the keyboard and the mouse"));

    sut.page("heard", { kind: "key", key: "w", code: "", keyCode: 87 });
    sut.page("heard", { kind: "mouse", key: "", code: "", keyCode: 0 });
    assert.deepEqual(sut.state.log.filter((line) => line.startsWith("free camera: the page hears")), ["free camera: the page hears the player (key: key 'w', code '', keyCode 87)"]);

    sut.runTimeouts(6_000);
    assert.deepEqual(sut.state.focused, [{ view: 1, on: true }], "a page that heard the player keeps the keyboard");
    assert.deepEqual(sut.state.pageEmits, []);
});

test("a page that hears nothing in six seconds gives the keyboard back, and the game's keys fly the camera, Esc and F2 ending it", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "longe" });
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.runTimeouts(6_000);

    assert.deepEqual(sut.state.focused, [{ view: 1, on: true }, { view: 1, on: false }]);
    assert.deepEqual(sut.state.pageEmits, [{ view: 1, name: "freecam:mode", payload: { mode: "keys" } }], "the page's help says the game's keys");
    assert.match(sut.state.notified.at(-1), /teclado do jogo/);
    assert.ok(sut.state.log.includes("free camera: the page heard nothing in 6 s; the game's keys fly it now"));
    assert.equal(sut.lastState().flying, true, "still flying");

    sut.state.down.add("w");
    sut.state.down.add("left");
    sut.state.down.add("shift");
    sut.state.now += 16;
    sut.tick(16);
    const input = sut.state.moves.at(-1).input;
    assert.deepEqual({ forward: input.forward, strafe: input.strafe, lift: input.lift, boost: input.boost, crawl: input.crawl }, { forward: 1, strafe: 0, lift: 0, boost: true, crawl: false });
    assert.ok(Math.abs(input.yaw - 1.12) < 1e-9 && input.pitch === 0, `${input.yaw} ${input.pitch}`);

    // what the page still says is not heard any more: the game's keys hold the flight
    sut.page("keys", { forward: -1, strafe: 1, lift: 1, yaw: 0, pitch: 0, boost: false, crawl: false });
    sut.state.down.clear();
    sut.state.now += 16;
    sut.tick(16);
    const count = sut.state.moves.length;
    sut.state.now += 16;
    sut.tick(16);
    assert.equal(sut.state.moves.length, count, "nothing held on the game's keys, nothing flies");

    sut.state.down.add("escape");
    sut.tick(100);
    assert.equal(sut.state.disabled, 1);
    assert.equal(sut.lastState().flying, false);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
    assert.ok(sut.state.log.includes("free camera: ended by escape"));
});

test("a flight that ends before the page's six seconds leaves nothing behind to take the keyboard later", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.page("exit", {});
    sut.runTimeouts(6_000);
    assert.deepEqual(sut.state.pageEmits, []);
    assert.equal(sut.state.log.some((line) => line.includes("the game's keys fly it now")), false);
});

test("a move NoClip refuses is said once a flight in the log, and said again in the next flight", () => {
    const sut = load();
    sut.state.moveRefused = true;
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.page("keys", { forward: 1, strafe: 0, lift: 0, yaw: 0, pitch: 0, boost: false, crawl: false });
    for (let beat = 0; beat < 3; beat += 1) {
        sut.state.now += 16;
        sut.tick(16);
    }
    assert.equal(sut.state.log.filter((line) => line === "free camera: NoClip.move refused to move the camera").length, 1);
    sut.page("exit", {});
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.page("keys", { forward: 1, strafe: 0, lift: 0, yaw: 0, pitch: 0, boost: false, crawl: false });
    sut.state.now += 16;
    sut.tick(16);
    assert.equal(sut.state.log.filter((line) => line === "free camera: NoClip.move refused to move the camera").length, 2);
});

test("what the page says that is not what it should be is ignored or kept within bounds", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.page("keys", { forward: 7, strafe: "up", lift: NaN, boost: "yes", crawl: 1 });
    sut.state.now += 16;
    sut.tick(16);
    assert.deepEqual(sut.state.moves.at(-1).input, { forward: 1, strafe: 0, lift: 0, boost: false, crawl: false, yaw: 0, pitch: 0 });

    sut.page("look", { dx: 1e9, dy: -1e9 });
    sut.page("look", { dx: "far", dy: null });
    sut.state.now += 16;
    sut.tick(16);
    const input = sut.state.moves.at(-1).input;
    assert.ok(Math.abs(input.yaw - -240) < 1e-9 && Math.abs(input.pitch - 240) < 1e-9, "at most two thousand pixels at a time");
});

test("Esc on the page ends the flight and puts back everything it changed, the third person included, and throws the page away", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "longe" });
    sut.locals.get("camera.free")();
    sut.page("ready");
    const hidden = [...sut.state.hidden];

    sut.page("exit", {});

    assert.equal(sut.state.disabled, 1);
    assert.equal(sut.state.hidden.size, 0);
    assert.deepEqual(sut.state.hudCalls.filter((call) => call.visible).map((call) => call.element), hidden);
    assert.deepEqual(sut.state.chatCalls, [false, true]);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
    assert.equal(sut.lastState().flying, false);
    assert.deepEqual(sut.state.focused.at(-1), { view: 1, on: false }, "the keyboard goes back to the game");
    assert.deepEqual(sut.state.hiddenViews, [1]);
    assert.deepEqual(sut.state.destroyed, [], "the browser goes on the next tick: the page is still inside its own event");
    sut.runTimeouts(0);
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.equal([...sut.intervals.values()].filter((entry) => entry.ms === 16).length, 0, "the beat stops with the flight");
    assert.deepEqual(sut.state.localEvents.filter((entry) => entry.name === "status.open"), [], "Esc brings no panel");
});

test("F2 or F3 on the page ends the flight and brings the panel up on that door; an old page's word counts for nothing", () => {
    for (const [panel, mode] of [["common", "common"], ["admin", "admin"]]) {
        const sut = load();
        sut.locals.get("camera.free")();
        sut.page("ready");
        sut.page("exit", { panel });
        assert.equal(sut.state.disabled, 1);
        assert.deepEqual(sut.state.localEvents.filter((entry) => entry.name === "status.open"), [], "not before the page is gone");
        sut.runTimeouts(200);
        assert.deepEqual(sut.state.localEvents.filter((entry) => entry.name === "status.open").map((entry) => entry.payload), [{ mode }]);
    }

    const sut = load();
    sut.locals.get("camera.free")();
    sut.page("ready");
    sut.page("exit", {});
    sut.locals.get("camera.free")();
    assert.equal(sut.state.views.length, 2, "a second flight, a second page");
    sut.page("ready");
    sut.state.moves.length = 0;
    sut.state.now += 16;
    sut.page("keys", { forward: 1 });
    sut.tick(16);
    assert.equal(sut.state.moves.length, 1, "the new page flies it");
});

test("a page that does not say it has drawn within five seconds gives the flight up, and nobody is left in it", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "longe" });
    sut.locals.get("camera.free")();
    sut.runTimeouts(4_000);
    assert.equal(sut.state.disabled, 0, "not yet");

    sut.runTimeouts(5_000);
    assert.equal(sut.state.disabled, 1);
    assert.equal(sut.state.hidden.size, 0);
    assert.deepEqual(sut.state.chatCalls, [false, true]);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
    assert.match(sut.state.notified.at(-1), /a página que a comanda não respondeu/);
    assert.equal(sut.lastState().flying, false);

    // a page that draws in time is not given up on later
    const fine = load();
    fine.locals.get("camera.free")();
    fine.page("ready");
    fine.runTimeouts(5_000);
    assert.equal(fine.state.disabled, 0);
});

test("a page the browser cannot make is no flight at all: the camera is put back at once and the player is told", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "perto" });
    sut.state.pageFails = true;
    sut.locals.get("camera.free")();

    assert.equal(sut.state.disabled, 1, "the flight that had begun is ended");
    assert.equal(sut.state.hidden.size, 0);
    assert.deepEqual(sut.state.chatCalls, [false, true]);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.perto);
    assert.match(sut.state.notified.at(-1), /a página que a comanda não abriu/);
    assert.equal(sut.lastState().flying, false);
    assert.equal(sut.state.views.length, 0);
});

test("Escape, bound, still ends a flight when the framework lets the mod hear it", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "longe" });
    sut.locals.get("camera.free")();
    sut.page("ready");
    const hidden = [...sut.state.hidden];

    sut.keys.get("escape")();

    assert.equal(sut.state.disabled, 1);
    assert.equal(sut.state.hidden.size, 0);
    assert.deepEqual(sut.state.hudCalls.filter((call) => call.visible).map((call) => call.element), hidden);
    assert.deepEqual(sut.state.chatCalls, [false, true]);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
    assert.equal(sut.lastState().flying, false);
    assert.equal([...sut.intervals.values()].filter((entry) => entry.ms === 100).length, 0, "the watch stops with the flight");
});

test("Escape on its own, with no flight, does nothing", () => {
    const sut = load();
    sut.keys.get("escape")();
    assert.equal(sut.state.disabled, 0);
    assert.deepEqual(sut.state.hudCalls, []);
});

test("an element something else had hidden, and a chat that was already hidden, are left as they were", () => {
    const sut = load({ suppressed: ["Compass"], chatVisible: false });
    sut.locals.get("camera.free")();
    sut.keys.get("escape")();

    assert.ok(!sut.state.hudCalls.some((call) => call.element === "Compass"), "never touched");
    assert.deepEqual(sut.state.chatCalls, [], "never shown by us");
});

test("the camera stays within 25 m of the player's eyes", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.state.camPos = { x: 40, y: 0, z: 1.6 };
    sut.tick(100);

    const moved = sut.state.moved.at(-1);
    assert.ok(moved, "pulled back");
    assert.ok(Math.abs(Math.hypot(moved.x, moved.y, moved.z - 1.6) - 25) < 1e-9);
    assert.ok(moved.x > 0, "along the same line");

    sut.state.moved.length = 0;
    sut.state.camPos = { x: 10, y: 10, z: 3 };
    sut.tick(100);
    assert.deepEqual(sut.state.moved, [], "inside the sphere it flies freely");
});

test("Esc, F2 or F3 held during a flight ends it on the flight's own tick, if the framework ever lets the mod see them", () => {
    for (const key of ["escape", "f2", "f3"]) {
        const sut = load();
        sut.choose({ thirdPerson: 1, view: "longe" });
        sut.locals.get("camera.free")();
        sut.tick(100);
        assert.equal(sut.state.disabled, 0, "nothing held yet");

        sut.state.down.add(key);
        sut.tick(100);

        assert.equal(sut.state.disabled, 1, key);
        assert.equal(sut.state.hidden.size, 0);
        assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
        assert.equal(sut.lastState().flying, false);
        assert.ok(sut.state.log.includes(`free camera: ended by ${key}`));
    }
});

test("no flight outlasts five minutes: a warning half a minute before, then the camera comes back by itself", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    assert.match(sut.state.notified.at(-1), /5 minutos/);

    sut.state.now += 4 * 60_000;
    sut.tick(100);
    assert.equal(sut.state.disabled, 0);
    assert.ok(!sut.state.notified.some((text) => /30 segundos/.test(text)));

    sut.state.now += 31_000;
    sut.tick(100);
    sut.tick(100);
    assert.equal(sut.state.notified.filter((text) => /30 segundos/.test(text)).length, 1, "warned once");
    assert.equal(sut.state.disabled, 0);

    sut.state.now += 30_000;
    sut.tick(100);
    assert.equal(sut.state.disabled, 1);
    assert.match(sut.state.notified.at(-1), /voltou sozinha/);
    assert.equal(sut.lastState().flying, false);
});

test("the flight ends by itself when the player dies", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.state.me = { ...sut.state.me, alive: false };
    sut.tick(100);
    assert.equal(sut.state.disabled, 1);
    assert.equal(sut.lastState().flying, false);
});

test("a flight ended from elsewhere (the map editor) puts everything back too", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "perto" });
    sut.locals.get("camera.free")();
    sut.state.active = false;
    sut.events.get("noclipChanged")(false, "mapEditor");

    assert.equal(sut.state.hidden.size, 0);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.perto);
    assert.equal(sut.lastState().flying, false);
});

test("a free camera the framework refuses says why and gives the third person back", () => {
    const sut = load();
    sut.choose({ thirdPerson: 1, view: "normal" });
    sut.state.enableResult = "cameraBusy";
    sut.locals.get("camera.free")();

    assert.match(sut.state.notified.at(-1), /editor de mapa/);
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.normal);
    assert.deepEqual(sut.state.hudCalls, [], "nothing hidden");
    assert.equal(sut.lastState().flying, false);
});

test("a dead player cannot start the free camera", () => {
    const sut = load();
    sut.state.me = { ready: true, alive: false, position: { x: 0, y: 0, z: 0 } };
    sut.locals.get("camera.free")();
    assert.deepEqual(sut.state.enabled, []);
    assert.match(sut.state.notified.at(-1), /vivo/);
});

test("a choice made during a flight waits for it to end", () => {
    const sut = load();
    sut.locals.get("camera.free")();
    sut.choose({ thirdPerson: 1, view: "longe" });
    assert.deepEqual(sut.state.thirdCalls, [], "the free camera has the view");

    sut.locals.get("camera.stopFree")();
    assert.deepEqual(sut.state.thirdCalls.at(-1), VIEWS.longe);
});

test("asked by the panel, the camera says what it holds", () => {
    const sut = load();
    sut.state.localEvents.length = 0;
    sut.locals.get("camera.ask")();
    assert.deepEqual(sut.lastState(), { thirdPerson: false, view: "normal", flying: false });
});
