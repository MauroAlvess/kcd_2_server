"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The death screen, the client's half (src/client/death-screen.ts, 2026-10-31): the camera round the body, a page with a verse and the counter, the HUD put away and given back.

const PAGE = fs.readFileSync(path.join(__dirname, "../ui-src/death.html"), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function load({ createFails = false, wall = null, pose = { position: { x: 13.3, y: 20, z: 7 } } } = {}) {
    const state = {
        handlers: new Map(), local: [], timers: [], intervals: [], logs: [], shots: [], cleared: [], hud: new Map([["Compass", true], ["Stats", true], ["Hints", false]]), hudCalls: [],
        chat: true, chatCalls: [], views: [], webHandlers: new Map(), emitted: [], shown: [], destroyed: [], shotAnswer: true, free: 0, rays: [],
    };
    const me = { ready: true, alive: false, position: { x: 10, y: 20, z: 5 } };
    const context = {
        exports: {},
        require: (id) => ({
            "./camera.js": { PHOTO_HIDDEN: ["Compass", "Stats", "Hints"] },
            "./chat-state.js": { chatShown: () => state.chat, showChat: (visible) => { state.chat = visible; state.chatCalls.push(visible); } },
            "./ui-scale.js": { scaleView: (view) => state.emitted.push({ view, name: "ui:scale" }) },
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date,
        Math,
        JSON,
        Number,
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        LocalPlayer: me,
        Hud: {
            isElementVisible: (name) => state.hud.get(name) === true,
            setElementVisible: (name, visible) => { state.hud.set(name, visible); state.hudCalls.push([name, visible]); return true; },
        },
        Camera: {
            getPose: () => pose,
            setShot: (options) => { state.shots.push({ position: { ...options.position }, lookAt: { ...options.lookAt }, duration: options.duration, fov: options.fov }); return state.shotAnswer; },
            clearShot: (duration) => state.cleared.push(duration),
        },
        World: {
            raycast: (from, to) => { state.rays.push({ from: { ...from }, to: { ...to } }); return wall === null ? null : { distance: wall }; },
        },
        Web: {
            getScreenSize: () => ({ width: 1920, height: 1080 }),
            createView: (page, options) => {
                if (createFails) throw new Error("no browser");
                state.views.push({ page, options });
                return state.views.length;
            },
            on: (view, name, fn) => state.webHandlers.set(`${view}:${name}`, fn),
            emit: (view, name, payload) => { state.emitted.push({ view, name, payload: payload === undefined ? undefined : plain(payload) }); return true; },
            showView: (view) => state.shown.push(view),
            destroyView: (view) => state.destroyed.push(view),
        },
        Events: {
            on: (name, fn) => state.handlers.set(name, fn),
            emitLocal: (name) => { state.local.push(name); return Promise.resolve(); },
        },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms, cleared: false }); return state.intervals.length; },
        clearInterval: (handle) => { if (state.intervals[handle - 1]) state.intervals[handle - 1].cleared = true; },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms, cleared: false }); return state.timers.length; },
        clearTimeout: (handle) => { if (state.timers[handle - 1]) state.timers[handle - 1].cleared = true; },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/death-screen.js"), "utf8"), context);
    context.exports.installDeathScreen();
    const begin = (payload = { seconds: 10, text: "O Senhor é o meu pastor.", ref: "Salmo 23:1", label: "Você volta a si em" }) => state.handlers.get("kcdc-gamemode:death.begin")(JSON.stringify(payload));
    const end = () => state.handlers.get("kcdc-gamemode:death.end")("{}");
    const stepper = () => state.intervals.find((interval) => interval.ms === 250 && !interval.cleared);
    const page = () => state.webHandlers.get("1:death:ready");
    return { api: context.exports, state, me, begin, end, stepper, page, context };
}

test("the counter reads minutes and seconds, whole seconds rounded up: 00:10 down to 00:01, and 00:00 only when the wait is over", () => {
    const { api } = load();
    assert.equal(api.countdownText(10_000), "00:10");
    assert.equal(api.countdownText(9_001), "00:10");
    assert.equal(api.countdownText(9_000), "00:09");
    assert.equal(api.countdownText(1), "00:01");
    assert.equal(api.countdownText(0), "00:00");
    assert.equal(api.countdownText(-50), "00:00");
    assert.equal(api.countdownText(Number.NaN), "00:00");
    assert.equal(api.countdownText(65_000), "01:05");
});

test("the camera is on a circle round the body, a man's height and a half above its feet, looking at the body, and turns nine degrees a second", () => {
    const { api } = load();
    const center = { x: 10, y: 20, z: 5 };
    const at = (ms, radius = 3.3) => api.orbitShot(center, 0, ms, radius);
    const first = at(0);
    assert.deepEqual(plain(first.position), { x: 13.3, y: 20, z: 6.9 });
    assert.deepEqual(plain(first.lookAt), { x: 10, y: 20, z: 5.45 });
    const quarter = api.orbitShot(center, 0, 10_000, 3.3);
    const turned = (Math.atan2(quarter.position.y - 20, quarter.position.x - 10) * 180) / Math.PI;
    assert.ok(Math.abs(turned - 90) < 1e-9, "ten seconds at nine degrees a second: ninety degrees");
    for (const ms of [0, 1_000, 4_000, 9_999]) {
        const shot = at(ms);
        assert.ok(Math.abs(Math.hypot(shot.position.x - 10, shot.position.y - 20) - 3.3) < 1e-9, `${ms} ms: still 3.3 m from the body`);
    }
    // Nearer where a wall is, never nearer than the least, never farther than the most.
    assert.ok(Math.abs(Math.hypot(at(0, 2).position.x - 10, at(0, 2).position.y - 20) - 2) < 1e-9);
    assert.ok(Math.abs(Math.hypot(at(0, 0.2).position.x - 10, at(0, 0.2).position.y - 20) - 1.4) < 1e-9);
    assert.ok(Math.abs(Math.hypot(at(0, 40).position.x - 10, at(0, 40).position.y - 20) - 3.3) < 1e-9);
    // The orbit starts where the view was.
    assert.equal(api.startAngle(center, { x: 10, y: 25, z: 7 }), 90);
    assert.equal(api.startAngle(center, null), 0);
    assert.equal(api.startAngle(center, { x: 10.01, y: 20, z: 7 }), 0, "a view over the body has no side to start from");
});

test("what the server sends is read and bounded: seconds between three and sixty, the texts cut, anything else refused", () => {
    const { api } = load();
    assert.deepEqual(plain(api.askOf({ seconds: 10, text: "a", ref: "b", label: "c" })), { seconds: 10, text: "a", ref: "b", label: "c", standing: false });
    assert.deepEqual(plain(api.askOf(JSON.stringify({ seconds: 1 }))), { seconds: 3, text: "", ref: "", label: "", standing: false });
    assert.equal(api.askOf({ standing: true }).standing, true, "an execution's screen");
    assert.equal(api.askOf({ standing: "yes" }).standing, false, "only a true");
    assert.equal(api.askOf({ seconds: 9999 }).seconds, 60);
    assert.equal(api.askOf({}).seconds, 10, "no word of it: the ten seconds");
    assert.equal(api.askOf({ text: "x".repeat(900) }).text.length, 400);
    assert.equal(api.askOf("nonsense"), null);
    assert.equal(api.askOf(null), null);
    assert.equal(api.askOf(7), null);
});

test("when the body falls the screen goes up: the page over the whole screen, the HUD and the chat put away, the camera sent to the first spot of the orbit, a step every quarter of a second", () => {
    const sut = load();
    sut.begin();
    assert.equal(sut.state.views.length, 1);
    assert.equal(sut.state.views[0].page, "fw://resources/kcdc-gamemode/ui/death.html");
    assert.deepEqual(plain(sut.state.views[0].options), { width: 1920, height: 1080, x: 0, y: 0, zIndex: 85, visible: false, focus: false });
    assert.deepEqual(sut.state.local, ["camera.stopFree"], "a free camera that flies is stopped first");
    // Only what was up is put away, and the chat.
    assert.deepEqual(plain(sut.state.hudCalls), [["Compass", false], ["Stats", false]]);
    assert.equal(sut.state.chat, false);
    // The first shot glides from the view over the body round to the circle, slowly.
    assert.equal(sut.state.shots.length, 1);
    assert.equal(sut.state.shots[0].duration, 1_800);
    assert.equal(sut.state.shots[0].fov, 42);
    assert.deepEqual(sut.state.shots[0].lookAt, { x: 10, y: 20, z: 5.45 });
    assert.ok(Math.abs(Math.hypot(sut.state.shots[0].position.x - 10, sut.state.shots[0].position.y - 20) - 3.3) < 1e-9);
    assert.equal(sut.stepper().ms, 250);
    // The page says it has drawn: it is given the verse, its reference, the line and the time left, and shown.
    sut.page()();
    const state = sut.state.emitted.find((entry) => entry.name === "death:state");
    assert.equal(state.payload.text, "O Senhor é o meu pastor.");
    assert.equal(state.payload.ref, "Salmo 23:1");
    assert.equal(state.payload.label, "Você volta a si em");
    assert.ok(state.payload.left > 9_000 && state.payload.left <= 10_000);
    assert.deepEqual(sut.state.shown, [1]);
    assert.ok(sut.state.emitted.some((entry) => entry.name === "ui:scale"), "told the player's own size");
});

test("an execution's screen is the same, for a body on its feet: the camera higher and the aim at the chest, and it does not end because the body is alive (2026-11-04)", () => {
    const sut = load();
    sut.me.alive = true;
    sut.begin({ seconds: 9, standing: true, text: "Você foi executado.", ref: "Por ordem da administração do reino", label: "De volta ao menu principal em" });
    assert.equal(sut.state.shots[0].lookAt.z, 5 + 1.1);
    assert.ok(Math.abs(sut.state.shots[0].position.z - (5 + 2.5)) < 1e-9);
    sut.page()();
    const state = sut.state.emitted.find((entry) => entry.name === "death:state");
    assert.equal(state.payload.text, "Você foi executado.");
    assert.ok(state.payload.left > 8_000 && state.payload.left <= 9_000);
    // A death's screen would end here (the body is on its feet again); an execution's does not.
    const realNow = Date.now;
    Date.now = () => realNow() + 3_000;
    try {
        sut.stepper().fn();
    } finally {
        Date.now = realNow;
    }
    assert.equal(sut.state.cleared.length, 0, "the camera is still where the screen put it");
    assert.equal(sut.state.destroyed.length, 0);
    const lying = load();
    lying.me.alive = true;
    lying.begin();
    const dateNow = Date.now;
    Date.now = () => dateNow() + 3_000;
    try {
        lying.stepper().fn();
    } finally {
        Date.now = dateNow;
    }
    assert.ok(lying.state.cleared.length > 0, "a death's screen goes when the body is up");
});

test("every step moves the camera a little further round, with a glide a little longer than the step, and the circle is kept off the walls", () => {
    const sut = load({ wall: 2.1 });
    sut.begin();
    const before = sut.state.shots.length;
    sut.stepper().fn();
    sut.stepper().fn();
    assert.equal(sut.state.shots.length, before + 2);
    const [first, second, third] = sut.state.shots.slice(-3);
    assert.equal(second.duration, 330);
    assert.equal(third.duration, 330);
    // The wall in the way at 2.1 m, less the gap: 1.75 m from the body.
    for (const shot of [first, second, third]) {
        assert.ok(Math.abs(Math.hypot(shot.position.x - 10, shot.position.y - 20) - 1.75) < 1e-9, `${Math.hypot(shot.position.x - 10, shot.position.y - 20)}`);
    }
    assert.ok(sut.state.rays.length >= 3, "a wall is looked for at every step");
    assert.deepEqual(sut.state.rays[0].from, { x: 10, y: 20, z: 6 });
    // No wall: the whole radius.
    const open = load();
    open.begin();
    open.stepper().fn();
    assert.ok(Math.abs(Math.hypot(open.state.shots.at(-1).position.x - 10, open.state.shots.at(-1).position.y - 20) - 3.3) < 1e-9);
});

test("the server ends it: the camera glides back, the HUD and the chat come back, the page fades and goes, and the steps stop", () => {
    const sut = load();
    sut.begin();
    sut.page()();
    const stepper = sut.stepper();
    sut.end();
    assert.deepEqual(sut.state.cleared, [800]);
    assert.equal(stepper.cleared, true);
    assert.deepEqual(plain(sut.state.hudCalls.slice(-2)), [["Compass", true], ["Stats", true]], "what was put away is given back");
    assert.equal(sut.state.hud.get("Hints"), false, "and what was not up is left as it was");
    assert.equal(sut.state.chat, true);
    assert.ok(sut.state.emitted.some((entry) => entry.name === "death:leave"));
    sut.state.timers.filter((timer) => timer.ms === 700).forEach((timer) => timer.fn());
    sut.state.timers.filter((timer) => timer.ms === 0).forEach((timer) => timer.fn());
    assert.deepEqual(sut.state.destroyed, [1]);
    assert.match(sut.state.logs.at(-1), /terminou \(servidor\)/);
    // A second end is nothing.
    const calls = sut.state.cleared.length;
    sut.end();
    assert.equal(sut.state.cleared.length, calls);
});

test("a body that stands up before the time is up (somebody raised it) ends the screen by itself, but not in the first moments, when the game has not yet laid it down", () => {
    const sut = load();
    sut.begin();
    sut.me.alive = true;
    sut.stepper().fn();
    assert.equal(sut.state.cleared.length, 0, "inside the first two seconds and a half a body that is up has not yet fallen");
    const realNow = Date.now;
    Date.now = () => realNow() + 3_000;
    try {
        sut.stepper().fn();
    } finally {
        Date.now = realNow;
    }
    assert.deepEqual(sut.state.cleared, [800]);
    assert.match(sut.state.logs.at(-1), /terminou \(de pé\)/);
});

test("the time given plus a grace ends it if the server never says so, so that nobody is left with the camera", () => {
    const sut = load();
    sut.begin({ seconds: 10, text: "t", ref: "r", label: "l" });
    const ender = sut.state.timers.find((timer) => timer.ms === 16_000);
    assert.ok(ender, "ten seconds and six of grace");
    ender.fn();
    assert.deepEqual(sut.state.cleared, [800]);
    assert.equal(sut.state.chat, true);
    assert.match(sut.state.logs.at(-1), /terminou \(tempo\)/);
});

test("a second death while the first screen is up starts over; and one with a free camera or a shot the game will not take still shows the page", () => {
    const sut = load();
    sut.begin();
    sut.begin({ seconds: 5, text: "outra", ref: "r2", label: "l2" });
    assert.equal(sut.state.views.length, 2);
    assert.ok(sut.state.logs.some((line) => /terminou \(outra morte\)/.test(line)));
    sut.state.webHandlers.get("2:death:ready")();
    assert.equal(sut.state.emitted.filter((entry) => entry.name === "death:state").at(-1).payload.text, "outra");

    const flying = load();
    flying.state.shotAnswer = false;
    flying.begin();
    flying.stepper().fn();
    flying.end();
    assert.deepEqual(flying.state.cleared, [], "no shot was taken, so none is given back");
    assert.equal(flying.state.views.length, 1, "but the page was up");
});

test("a page that cannot be made leaves the camera alone; one that never says it has drawn is given up on; and a nonsense word starts nothing", () => {
    const broken = load({ createFails: true });
    broken.begin();
    assert.equal(broken.state.views.length, 0);
    assert.ok(broken.state.logs.some((line) => /a página não abriu \((Error: )?no browser\); fica só a câmera/.test(line)));
    assert.equal(broken.state.shots.length, 1, "the camera goes on");
    broken.end();
    assert.deepEqual(broken.state.cleared, [800]);

    const slow = load();
    slow.begin();
    const waiter = slow.state.timers.find((timer) => timer.ms === 8_000);
    assert.ok(waiter);
    waiter.fn();
    assert.ok(slow.state.logs.some((line) => /não disse que desenhou/.test(line)));

    const none = load();
    none.state.handlers.get("kcdc-gamemode:death.begin")("nonsense");
    assert.equal(none.state.shots.length, 0);
    assert.equal(none.state.views.length, 0);
});

test("a stop of the resource gives everything back", () => {
    const sut = load();
    sut.begin();
    sut.state.handlers.get("resourceStop")("another");
    assert.equal(sut.state.cleared.length, 0, "another resource's stop is not ours");
    sut.state.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.state.cleared, [800]);
    assert.equal(sut.state.chat, true);
});

test("the page: a verse over the middle, where it is written, the counter at the foot reading 00:10, and no key, no pointer and no way out; it says it has drawn and listens for the client's two words", () => {
    assert.match(PAGE, /id="text"/);
    assert.match(PAGE, /id="ref"/);
    assert.match(PAGE, /id="clock">00:10</);
    assert.match(PAGE, /send\("death:ready"\)/);
    assert.match(PAGE, /addEventListener\("death:state"/);
    assert.match(PAGE, /addEventListener\("death:leave"/);
    assert.match(PAGE, /addEventListener\("ui:scale"/);
    assert.ok(!/<button|<input|keydown|addEventListener\("click"/.test(PAGE), "nothing to press");
    assert.match(PAGE, /Math\.ceil\(ms \/ 1000\)/, "whole seconds rounded up, as the client's own counter");
    // The page's script is a script.
    const script = PAGE.slice(PAGE.indexOf("<script>") + 8, PAGE.indexOf("</script>"));
    assert.doesNotThrow(() => new vm.Script(script));
    // And the page and the client speak the same events.
    const client = fs.readFileSync(path.join(__dirname, "../src/client/death-screen.ts"), "utf8");
    for (const word of ["death:ready", "death:state", "death:leave"]) assert.ok(client.includes(`"${word}"`), word);
});
