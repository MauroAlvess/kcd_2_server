// The creator's client half (src/client/creator-page.ts): the camera, the light, the HUD, the page, and every way out.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const plain = (value) => JSON.parse(JSON.stringify(value));
const SOURCE = fs.readFileSync(path.join(__dirname, "../dist/client/creator-page.js"), "utf8");

class Vector3 {
    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

function load({ look = { x: 0, y: 1, z: 0 }, walls = {} } = {}) {
    const serverEvents = new Map();
    const pageEvents = new Map();
    const timers = new Map();
    const state = {
        now: 100_000,
        nextTimer: 1,
        sent: [],
        shots: [],
        cleared: [],
        lights: [],
        hudHidden: new Set(),
        hudSet: [],
        chat: true,
        chatSet: [],
        notes: [],
        views: [],
        pageSent: [],
        shown: [],
        focused: [],
        hidden: [],
        destroyed: [],
        logs: [],
        createFails: false,
        shot: false,
        shotRefused: false,
        stopFree: 0,
        screen: { width: 1920, height: 1080 },
        raycasts: [],
        local: { ready: true, alive: true, mounted: false, position: { x: 100, y: 200, z: 10 }, rotation: { w: 1, x: 0, y: 0, z: 0 }, lookDirection: look },
    };
    const camera = { PHOTO_HIDDEN: ["Compass", "Stats", "Hints"] };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./camera.js") return camera;
            if (id === "./ui-scale.js") return { scaleView() {}, onUiScale() {}, uiFactor: () => 1, installUiScale() {} };
            if (id === "./big-events.js") return { onLarge: (name, fn) => serverEvents.set(`kcdc-gamemode:${name}`, fn) };
            if (id === "./chat-state.js") {
                // The real module over the test's own fake of the game's chat, so the assertions on `Chat` still read what happened.
                const sandbox = { exports: {}, Chat: context.Chat };
                vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/chat-state.js"), "utf8"), sandbox);
                return sandbox.exports;
            }
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => state.logs.push(line), error: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        Vector3,
        Quaternion: class {},
        Events: {
            on: (name, fn) => serverEvents.set(name, fn),
            emitServer: (name, payload) => state.sent.push({ name, payload: payload === undefined ? undefined : JSON.parse(payload) }),
            emitLocal: (name) => { if (name === "camera.stopFree") state.stopFree += 1; return Promise.resolve(); },
        },
        Web: {
            getScreenSize: () => state.screen,
            createView: (url, options) => {
                if (state.createFails) throw new Error("no browser");
                state.views.push({ url, options });
                return state.views.length;
            },
            on: (view, name, fn) => pageEvents.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => state.pageSent.push({ view, name, payload }),
            showView: (view) => state.shown.push(view),
            hideView: (view) => state.hidden.push(view),
            focusView: (view, on) => state.focused.push({ view, on }),
            destroyView: (view) => state.destroyed.push(view),
        },
        Camera: {
            setShot: (shot) => { state.shots.push(shot); return !state.shotRefused; },
            clearShot: (duration) => state.cleared.push(duration),
            isShotActive: () => state.shot,
        },
        Light: {
            spawn: (position, options) => {
                const light = { position, options, valid: true, destroy() { light.valid = false; } };
                state.lights.push(light);
                return light;
            },
        },
        Hud: {
            isElementVisible: (element) => !state.hudHidden.has(element),
            setElementVisible: (element, on) => {
                state.hudSet.push([element, on]);
                if (on) state.hudHidden.delete(element);
                else state.hudHidden.add(element);
                return true;
            },
            showNotification: (text) => state.notes.push(text),
        },
        Chat: { isUIVisible: () => state.chat, setUIVisible: (on) => { state.chat = on; state.chatSet.push(on); } },
        World: {
            raycast: (from, to) => {
                state.raycasts.push({ from, to });
                const wall = walls(from, to);
                return wall === undefined ? null : { distance: wall };
            },
        },
        get LocalPlayer() {
            return state.local;
        },
        setInterval: (fn, ms) => {
            const id = state.nextTimer++;
            timers.set(id, { fn, every: ms, due: state.now + ms });
            return id;
        },
        clearInterval: (id) => timers.delete(id),
        setTimeout: (fn, ms) => {
            const id = state.nextTimer++;
            timers.set(id, { fn, every: 0, due: state.now + ms });
            return id;
        },
        clearTimeout: (id) => timers.delete(id),
    };
    context.walls = undefined;
    if (typeof walls !== "function") {
        context.World.raycast = (from, to) => {
            state.raycasts.push({ from, to });
            return null;
        };
    }
    vm.runInNewContext(SOURCE, context);
    context.exports.installCreatorPage();
    const advance = (ms) => {
        const until = state.now + ms;
        for (;;) {
            const next = [...timers.entries()].filter(([, t]) => t.due <= until).sort((a, b) => a[1].due - b[1].due)[0];
            if (next === undefined) break;
            const [id, timer] = next;
            state.now = Math.max(state.now, timer.due);
            if (timer.every > 0) timer.due += timer.every;
            else timers.delete(id);
            timer.fn();
        }
        state.now = until;
    };
    const server = (name, payload) => serverEvents.get(`kcdc-gamemode:creator.${name}`)(payload === undefined ? undefined : JSON.stringify(payload));
    const page = (name, payload) => pageEvents.get(`${state.views.length}:creator:${name}`)?.(payload);
    return { api: context.exports, state, advance, server, page, serverEvents, pageEvents };
}

const BEGIN = { genders: "both", look: { gender: "male" }, identity: { name: "", epithet: "", locked: false, suggestion: "" }, mandatory: false };
const NEWCOMER = { ...BEGIN, firstTime: true, mandatory: true };

/** The scene is up and the page has drawn. */
function open(world, payload = BEGIN) {
    world.server("begin", payload);
    world.advance(20_000);
    world.page("ready", {});
    return world;
}

const near = (actual, expected, margin = 1e-6) => assert.ok(Math.abs(actual - expected) <= margin, `${actual} is not ${expected}`);

test("the creator waits for the body to be ready, and ready for a while, before anything is put up", () => {
    const sut = load();
    sut.state.local = null;
    sut.server("begin", BEGIN);
    sut.advance(30_000);
    assert.equal(sut.state.views.length, 0);
    assert.equal(sut.state.shots.length, 0);

    sut.state.local = { ...load().state.local, ready: false };
    sut.advance(10_000);
    assert.equal(sut.state.shots.length, 0, "a body that is not ready");

    sut.state.local = load().state.local;
    sut.advance(5_000);
    assert.equal(sut.state.shots.length, 0, "ready, but the game dresses its default over a look asked for at the end of loading");
    sut.advance(2_000);
    assert.equal(sut.state.shots.length, 1);
    assert.equal(sut.state.views.length, 1);
});

test("the scene: a shot from the front, the light, the HUD and the chat put away, the page made hidden and shown once it says it has drawn", () => {
    const sut = load();
    sut.server("begin", BEGIN);
    sut.advance(20_000);

    assert.equal(sut.state.shots.length, 1);
    const shot = sut.state.shots[0];
    assert.equal(shot.fov, 36);
    assert.equal(shot.duration, 900);
    // the player is at (100, 200) looking along +Y: the camera is in front of them, 3.5 m on, and looks back
    near(shot.position.x, 100);
    near(shot.position.y, 203.5);
    assert.ok(shot.position.z > 10.9 && shot.position.z < 11.3, "about the body's waist");
    assert.ok(shot.lookAt.y < 200.001, "it looks at the body");
    // the camera looks along -Y, so its right is -X: the aim is moved that way and the figure stands left of the middle
    assert.ok(shot.lookAt.x < 100 - 0.5 && shot.lookAt.x > 100 - 1.5, `aim shifted to the camera's right: ${shot.lookAt.x}`);

    assert.equal(sut.state.lights.length, 1);
    assert.deepEqual(plain(sut.state.lights[0].options.color), { x: 1, y: 0.86, z: 0.62 });
    assert.deepEqual([...sut.state.hudHidden].sort(), ["Compass", "Hints", "Stats"]);
    assert.equal(sut.state.chat, false);

    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].url, "fw://resources/kcdc-gamemode/ui/creator.html");
    assert.deepEqual(plain(sut.state.views[0].options), { width: 1920, height: 1080, x: 0, y: 0, zIndex: 100, visible: false, focus: false });
    assert.deepEqual(sut.state.shown, [], "not shown before the page has drawn");

    sut.page("ready", {});
    assert.deepEqual(sut.state.shown, [1]);
    assert.deepEqual(sut.state.focused, [{ view: 1, on: true }]);
    const sent = sut.state.pageSent.find((entry) => entry.name === "creator:begin");
    assert.equal(sent.payload.genders, "both");
    near(sent.payload.aspect, 16 / 9, 1e-9);
});

test("the camera stands where the player looks, whatever way that is, and the figure is always to the left of the middle", () => {
    for (const [look, expectCamera] of [
        [{ x: 1, y: 0, z: 0 }, { x: 103.5, y: 200 }],
        [{ x: 0, y: -1, z: 0.4 }, { x: 100, y: 196.5 }],
        [{ x: -0.6, y: 0.8, z: 0 }, { x: 100 - 0.6 * 3.5, y: 200 + 0.8 * 3.5 }],
    ]) {
        const sut = load({ look });
        sut.server("begin", BEGIN);
        sut.advance(20_000);
        const shot = sut.state.shots[0];
        near(shot.position.x, expectCamera.x, 1e-6);
        near(shot.position.y, expectCamera.y, 1e-6);
        // The camera's right, looking from the camera to the body, is where the aim has been moved to.
        const toBody = { x: 100 - shot.position.x, y: 200 - shot.position.y };
        const len = Math.hypot(toBody.x, toBody.y);
        const right = { x: toBody.y / len, y: -toBody.x / len };
        const offset = { x: shot.lookAt.x - 100, y: shot.lookAt.y - 200 };
        assert.ok(offset.x * right.x + offset.y * right.y > 0.5, "aim is on the camera's right");
    }
});

test("the pure geometry: a body looking straight up or down is read from its rotation; a wider screen moves the aim further", () => {
    const { frontOf, shotFor } = load().api;
    assert.deepEqual(plain(frontOf({ x: 0, y: 0, z: 1 }, { w: 1, x: 0, y: 0, z: 0 })), { x: 0, y: 1 }, "the body's +Y axis");
    const quarter = { w: Math.SQRT1_2, x: 0, y: 0, z: Math.SQRT1_2 };
    const turned = frontOf({ x: 0, y: 0, z: -1 }, quarter);
    near(turned.x, -1);
    near(turned.y, 0, 1e-9);
    const narrow = shotFor({ x: 0, y: 0, z: 0 }, { x: 0, y: 1 }, 0, 3.1, 4 / 3);
    const wide = shotFor({ x: 0, y: 0, z: 0 }, { x: 0, y: 1 }, 0, 3.1, 21 / 9);
    assert.ok(Math.abs(wide.lookAt.x) > Math.abs(narrow.lookAt.x));
    const close = shotFor({ x: 0, y: 0, z: 0 }, { x: 0, y: 1 }, 0, 1.5, 16 / 9);
    assert.ok(close.lookAt.z > narrow.lookAt.z, "near: the face, not the waist");
});

test("a wall in front turns the camera to the nearest side with room, and one close behind pulls it in", () => {
    // the front (+Y) is blocked at 1 m; the first turn (30 degrees) is free
    const blockedFront = load({ walls: (_from, to) => (to.y > 200.5 && Math.abs(to.x - 100) < 0.5 ? 1.0 : undefined) });
    blockedFront.server("begin", BEGIN);
    blockedFront.advance(20_000);
    const shot = blockedFront.state.shots[0];
    assert.ok(Math.abs(shot.position.x - 100) > 1, `turned away from the wall: ${shot.position.x}`);
    near(Math.hypot(shot.position.x - 100, shot.position.y - 200), 3.5, 1e-6);

    // wall everywhere at 2 m: the camera stands 1.7 m away (a wall's gap kept)
    const closed = load({ walls: () => 2 });
    closed.server("begin", BEGIN);
    closed.advance(20_000);
    const near1 = closed.state.shots[0];
    near(Math.hypot(near1.position.x - 100, near1.position.y - 200), 1.7, 1e-6);
});

test("what the page picks goes to the server, and a message that is not what it should be goes nowhere", () => {
    const sut = open(load());
    const look = { gender: "male", head: 2, hair: 1, tone: 0, beard: -1, skin: 3 };
    sut.page("preview", { look });
    sut.page("preview", { look: "x" });
    sut.page("preview", null);
    sut.page("check", { name: "Henry", epithet: "ii" });
    sut.page("check", { name: 5, epithet: "" });
    sut.page("check", { name: "x".repeat(41), epithet: "" });
    sut.page("accept", { look, name: "Henry", epithet: "" });
    sut.page("accept", { look: null, name: "Henry", epithet: "" });
    sut.page("accept", { look, name: "Henry" });
    assert.deepEqual(plain(sut.state.sent), [
        { name: "kcdc-gamemode:creator.preview", payload: { look } },
        { name: "kcdc-gamemode:creator.check", payload: { name: "Henry", epithet: "ii" } },
        { name: "kcdc-gamemode:creator.accept", payload: { look, name: "Henry", epithet: "" } },
    ]);
});

test("the accept carries the age and the height to the server, and the clothes marked; what is not a whole number, or not a gender's, stays behind (2026-11-02)", () => {
    const sut = load();
    const look = { gender: "male", head: 2, hair: 1, tone: 0, beard: -1, skin: 3 };
    sut.server("begin", BEGIN);
    sut.advance(20_000);
    sut.page("ready", {});
    sut.state.sent.length = 0;
    sut.page("accept", { look, name: "Henry", epithet: "", age: 32, height: 170, clothes: { gender: "male", top: 1, legs: -1, feet: 0 } });
    sut.page("accept", { look, name: "Henry", epithet: "", age: "32", height: 170.5, clothes: { gender: "x", top: 1 } });
    sut.page("accept", { look, name: "Henry", epithet: "", age: 32, height: 170, clothes: { gender: "female", top: 99, legs: 2 } });
    assert.deepEqual(plain(sut.state.sent), [
        { name: "kcdc-gamemode:creator.accept", payload: { look, name: "Henry", epithet: "", age: 32, height: 170, clothes: { gender: "male", top: 1, legs: -1, feet: 0 } } },
        { name: "kcdc-gamemode:creator.accept", payload: { look, name: "Henry", epithet: "" } },
        { name: "kcdc-gamemode:creator.accept", payload: { look, name: "Henry", epithet: "", age: 32, height: 170, clothes: { gender: "female", legs: 2 } } },
    ]);
});

test("the accept carries no place of birth any more: a field of that name does not reach the server (2026-11-09)", () => {
    const sut = open(load());
    const look = { gender: "male", head: 2, hair: 1, tone: 0, beard: -1, skin: 3 };
    sut.state.sent.length = 0;
    sut.page("accept", { look, name: "Henry", epithet: "", birth: "corvos" });
    assert.deepEqual(plain(sut.state.sent), [{ name: "kcdc-gamemode:creator.accept", payload: { look, name: "Henry", epithet: "" } }]);
    assert.equal(sut.serverEvents.get("kcdc-gamemode:creator.birth"), undefined, "the places of birth are not listened for");
});

test("the server's answers about the name, and its refusals, reach the page", () => {
    const sut = open(load());
    sut.server("name", { ok: false, message: "Já existe um Henry." });
    sut.server("refused", { message: "Esse visual não é válido.", field: "name" });
    const channels = sut.state.pageSent.map((entry) => [entry.name, plain(entry.payload)]);
    assert.deepEqual(channels.slice(-2), [["creator:name", { ok: false, message: "Já existe um Henry." }], ["creator:refused", { message: "Esse visual não é válido.", field: "name" }]]);
});

test("dragging turns the camera round the figure, and the wheel brings it near or far, within limits", () => {
    const sut = open(load());
    const before = sut.state.shots.length;
    sut.page("orbit", { dx: 90 });
    assert.equal(sut.state.shots.length, before + 1);
    const turned = sut.state.shots.at(-1);
    assert.equal(turned.duration, 90);
    // 90 px at 0.4 degrees: 36 degrees round, the camera is on a circle of 3.5 m
    near(Math.hypot(turned.position.x - 100, turned.position.y - 200), 3.5, 1e-6);
    near(Math.atan2(turned.position.y - 200, turned.position.x - 100) * 180 / Math.PI, 90 + 36, 1e-6);

    sut.page("zoom", { dy: 100 });
    near(Math.hypot(sut.state.shots.at(-1).position.x - 100, sut.state.shots.at(-1).position.y - 200), 3.5 + 0.25, 1e-6);
    for (let i = 0; i < 40; i++) sut.page("zoom", { dy: 400 });
    near(Math.hypot(sut.state.shots.at(-1).position.x - 100, sut.state.shots.at(-1).position.y - 200), 5.6, 1e-6);
    for (let i = 0; i < 80; i++) sut.page("zoom", { dy: -400 });
    near(Math.hypot(sut.state.shots.at(-1).position.x - 100, sut.state.shots.at(-1).position.y - 200), 1.5, 1e-6);

    const count = sut.state.shots.length;
    sut.page("orbit", { dx: "a lot" });
    sut.page("zoom", { dy: NaN });
    assert.equal(sut.state.shots.length, count, "what is not a number is ignored");
});

test("the light follows the camera", () => {
    const sut = open(load());
    const first = { ...sut.state.lights[0].position };
    sut.page("orbit", { dx: 200 });
    assert.notDeepEqual({ ...sut.state.lights[0].position }, first);
});

test("leaving from the page tells the server, gives back the camera, the HUD, the chat and the keyboard, and throws the page away", () => {
    const sut = open(load());
    sut.page("cancel", {});
    assert.deepEqual(plain(sut.state.sent.at(-1)), { name: "kcdc-gamemode:creator.cancel" });
    assert.deepEqual(sut.state.cleared, [600]);
    assert.equal(sut.state.lights[0].valid, false);
    assert.deepEqual([...sut.state.hudHidden], []);
    assert.equal(sut.state.chat, true);
    assert.deepEqual(sut.state.focused.at(-1), { view: 1, on: false });
    assert.deepEqual(sut.state.hidden, [1]);
    sut.advance(10);
    assert.deepEqual(sut.state.destroyed, [1], "on the next tick: the page is still inside its own event");
    // and nothing from the old page counts any more
    sut.page("preview", { look: { gender: "male" } });
    assert.equal(sut.state.sent.filter((entry) => entry.name.endsWith("preview")).length, 0);
});

test("accepted: the server's word closes it with a welcome; its stop word closes it quietly; neither asks the server anything", () => {
    const done = open(load());
    done.server("done", { full: "Henry II" });
    assert.deepEqual(done.state.notes, ["Bem-vindo, Henry II."]);
    assert.deepEqual(done.state.cleared, [600]);
    assert.equal(done.state.sent.filter((entry) => entry.name.endsWith("cancel")).length, 0);

    const stopped = open(load());
    stopped.server("end");
    assert.deepEqual(stopped.state.cleared, [600]);
    assert.deepEqual(stopped.state.notes, []);
    assert.equal(stopped.state.sent.length, 0);
});

test("something the player did not hold the HUD back for is not given back by us", () => {
    const sut = load();
    sut.state.hudHidden.add("Compass");
    sut.state.chat = false;
    open(sut);
    sut.server("end");
    assert.ok(sut.state.hudHidden.has("Compass"), "hidden by somebody else, stays hidden");
    assert.ok(!sut.state.hudHidden.has("Stats"));
    assert.equal(sut.state.chat, false);
    assert.deepEqual(sut.state.chatSet, [], "the chat was not ours to touch");
});

test("a page that cannot be made, does not say it has drawn, or does not load is reported, everything is given back, and the server falls back", () => {
    const broken = load();
    broken.state.createFails = true;
    broken.server("begin", BEGIN);
    broken.advance(20_000);
    assert.match(broken.state.sent.at(-1).payload.reason, /createView: .*no browser/);
    assert.equal(broken.state.sent.at(-1).name, "kcdc-gamemode:creator.failed");
    assert.deepEqual(broken.state.cleared, [600]);
    assert.deepEqual([...broken.state.hudHidden], []);

    const silent = load();
    silent.server("begin", BEGIN);
    silent.advance(20_000);
    silent.advance(6_000);
    assert.equal(silent.state.sent.length, 0, "fifteen seconds are given from the page being made");
    silent.advance(2_000);
    assert.match(silent.state.sent.at(-1).payload.reason, /não disse que estava pronta/);
    assert.deepEqual(silent.state.cleared, [600]);
    assert.deepEqual(silent.state.destroyed, [1], "the page is thrown away");

    const missing = open(load());
    const loading = [...missing.serverEvents.keys()].includes("browserLoadingFailed");
    assert.equal(loading, true);
    missing.serverEvents.get("browserLoadingFailed")({ isMainFrame: true, url: "fw://resources/kcdc-gamemode/ui/creator.html", description: "ERR_FILE_NOT_FOUND" });
    assert.match(missing.state.sent.at(-1).payload.reason, /não carregou \(ERR_FILE_NOT_FOUND\)/);
    missing.serverEvents.get("browserLoadingFailed")({ isMainFrame: true, url: "fw://resources/other/ui/x.html", description: "x" });
    assert.equal(missing.state.sent.filter((entry) => entry.name.endsWith("failed")).length, 1, "somebody else's page is not ours");
});

test("a body that never gets ready is given up on after ninety seconds", () => {
    const sut = load();
    sut.state.local = null;
    sut.server("begin", BEGIN);
    sut.advance(89_000);
    assert.equal(sut.state.sent.length, 0);
    sut.advance(2_000);
    assert.match(sut.state.sent.at(-1).payload.reason, /corpo do jogador não ficou pronto/);
});

test("on a horse there is no creator for somebody who only meant to change their look: they are told, and the server is told", () => {
    const horse = load();
    horse.state.local.mounted = true;
    horse.server("begin", BEGIN);
    horse.advance(20_000);
    assert.deepEqual(horse.state.notes, ["Desça do cavalo para criar o personagem."]);
    assert.equal(horse.state.sent.at(-1).name, "kcdc-gamemode:creator.cancel");
    assert.deepEqual(horse.state.sent.at(-1).payload, { forced: true });
    assert.equal(horse.state.views.length, 0);
    assert.equal(horse.state.shots.length, 0);
});

test("a body that dies ends the creator, and the server is told it was not the player's choice", () => {
    const dies = open(load());
    dies.state.local = { ...dies.state.local, alive: false };
    dies.advance(1_500);
    assert.equal(dies.state.sent.at(-1).name, "kcdc-gamemode:creator.cancel");
    assert.deepEqual(dies.state.sent.at(-1).payload, { forced: true });
    assert.deepEqual(dies.state.cleared, [600]);
});

test("the first time, nothing the page says can take the player out of the creator", () => {
    const sut = open(load(), NEWCOMER);
    const sentBefore = sut.state.sent.length;
    sut.page("cancel", {});
    assert.equal(sut.state.sent.length, sentBefore, "the server is not told of a leave");
    assert.deepEqual(sut.state.cleared, [], "the camera stays");
    assert.deepEqual(sut.state.destroyed, [], "so does the page");
    assert.deepEqual(sut.state.hidden, []);
    assert.deepEqual(sut.state.focused.at(-1), { view: 1, on: true });
    assert.equal(sut.state.pageSent.find((entry) => entry.name === "creator:begin").payload.mandatory, true, "and the page is told, to show no way out");
    // it is the server's word that ends it
    sut.server("done", { full: "Henry II" });
    assert.deepEqual(sut.state.cleared, [600]);
});

test("the first time, on a horse the creator waits for the player to get down, and the server is not told to give up", () => {
    const sut = load();
    sut.state.local.mounted = true;
    sut.server("begin", NEWCOMER);
    sut.advance(30_000);
    assert.deepEqual(sut.state.notes, ["Desça do cavalo para criar o personagem."], "told once");
    assert.equal(sut.state.views.length, 0);
    assert.equal(sut.state.sent.length, 0);
    sut.state.local.mounted = false;
    sut.advance(8_000);
    assert.equal(sut.state.views.length, 1, "on foot: the creator goes up");
    assert.equal(sut.state.shots.length, 1);
});

test("the first time, a body that dies still ends it, for the next spawn to open it again", () => {
    const sut = open(load(), NEWCOMER);
    sut.state.local = { ...sut.state.local, alive: false };
    sut.advance(1_500);
    assert.deepEqual(sut.state.sent.at(-1).payload, { forced: true });
    assert.deepEqual(sut.state.cleared, [600]);
});

test("asked again while open, the page starts over with what the server sent; the stop of the resource gives everything back", () => {
    const sut = open(load());
    const shots = sut.state.shots.length;
    sut.server("begin", { ...BEGIN, genders: "female" });
    assert.equal(sut.state.shots.length, shots, "no second scene");
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.pageSent.filter((entry) => entry.name === "creator:begin").at(-1).payload.genders, "female");

    sut.serverEvents.get("resourceStop")("someone-else");
    assert.equal(sut.state.cleared.length, 0);
    sut.serverEvents.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.cleared, [600]);
});

test("a creator can be opened again after it was closed", () => {
    const sut = open(load());
    sut.server("end");
    sut.advance(100);
    sut.server("begin", BEGIN);
    sut.advance(20_000);
    assert.equal(sut.state.views.length, 2);
    sut.page("ready", {});
    assert.deepEqual(sut.state.shown, [1, 2]);
});

test("the free camera is put down first, and a camera that will not take the shot is a creator that failed", () => {
    const sut = load();
    sut.state.shotRefused = true;
    sut.server("begin", BEGIN);
    sut.advance(20_000);
    assert.equal(sut.state.stopFree, 1, "a shot cannot start while the free camera flies");
    assert.match(sut.state.sent.at(-1).payload.reason, /o jogo não aceitou a câmera do criador/);
    assert.equal(sut.state.sent.at(-1).name, "kcdc-gamemode:creator.failed");
    assert.equal(sut.state.views.length, 0, "no page over a screen that is not filmed");
    assert.deepEqual([...sut.state.hudHidden], [], "the HUD is back");
    assert.equal(sut.state.chat, true);
    assert.equal(sut.state.lights[0].valid, false, "and the light is gone");
});

test("an administrator's numbers move the camera at once, are clamped, stay for the next creator, and an empty message gives the defaults back", () => {
    const sut = open(load());
    const distanceOf = (shot) => Math.hypot(shot.position.x - 100, shot.position.y - 200);
    sut.server("tune", { distance: 4.5, light: 5, fov: 50 });
    assert.deepEqual(sut.state.notes.at(-1), "Câmera do criador: distância 4.5, figura 0.4, fov 50, altura 0, luz 5.");
    const shot = sut.state.shots.at(-1);
    assert.equal(shot.duration, 300);
    assert.equal(shot.fov, 50);
    near(distanceOf(shot), 4.5, 1e-6);
    assert.equal(sut.state.lights[0].intensity, 5);

    sut.server("tune", { figure: 0.2 });
    assert.equal(sut.state.notes.at(-1), "Câmera do criador: distância 4.5, figura 0.2, fov 50, altura 0, luz 5.", "the numbers not given stay as they were");
    sut.server("tune", { distance: 99, fov: 3, aim: -9, light: 50, figure: 4 });
    assert.equal(sut.state.notes.at(-1), "Câmera do criador: distância 6, figura 0.9, fov 20, altura -0.6, luz 20.", "kept within what the camera can do");
    sut.server("tune", { distance: "far", light: NaN });
    assert.equal(sut.state.notes.at(-1), "Câmera do criador: distância 6, figura 0.9, fov 20, altura -0.6, luz 20.", "what is not a number is ignored");

    sut.server("tune", {});
    assert.equal(sut.state.notes.at(-1), "Câmera do criador: distância 3.5, figura 0.4, fov 36, altura 0, luz 2.2.");
    near(distanceOf(sut.state.shots.at(-1)), 3.5, 1e-6);

    // they stay for the next creator
    sut.server("tune", { distance: 2.5 });
    sut.server("end");
    sut.advance(100);
    sut.server("begin", BEGIN);
    sut.advance(20_000);
    near(distanceOf(sut.state.shots.at(-1)), 2.5, 1e-6);
    assert.equal(sut.state.shots.at(-1).fov, 36);
});

test("the aim height and the figure's place change where the camera looks", () => {
    const { shotFor, DEFAULT_FRAMING } = load().api;
    const plainFoot = { x: 0, y: 0, z: 0 };
    const base = shotFor(plainFoot, { x: 0, y: 1 }, 0, 3.5, 16 / 9, DEFAULT_FRAMING);
    const higher = shotFor(plainFoot, { x: 0, y: 1 }, 0, 3.5, 16 / 9, { ...DEFAULT_FRAMING, aim: 0.3 });
    near(higher.lookAt.z - base.lookAt.z, 0.3, 1e-9);
    const centred = shotFor(plainFoot, { x: 0, y: 1 }, 0, 3.5, 16 / 9, { ...DEFAULT_FRAMING, figure: 0 });
    near(centred.lookAt.x, 0, 1e-9);
    assert.ok(Math.abs(base.lookAt.x) > 0.5, "the default stands the figure to the left");
});

