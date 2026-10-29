"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
require("./reachpatch.cjs");

// The client's half of thirst (src/client/thirst.ts): the measure the server sends for the panel's bar, and the hint "Beber água" where a
// player stands at water and aims at it. The water is told by the surface the game's trace meets: the river's bed is `mat_mudwater` or
// `mat_rockwater`, a water volume `mat_water`.

function load() {
    const clock = { t: 1_000_000 };
    const state = { hints: [], removed: [], emitted: [], handlers: new Map(), tick: null, aim: null, ground: new Map(), grounds: [], busy: false, person: null, dialogue: false, controls: true };
    const me = { ready: true, alive: true, mounted: false, position: { x: 100, y: 200, z: 10 } };
    const context = {
        exports: {},
        require: (id) => (id === "./interaction.js" ? { getPersonInView: () => state.person } : id === "./furniture.js" ? { furnitureBusy: () => state.busy } : assert.fail(`unexpected require ${id}`)),
        console,
        Math,
        JSON,
        Number,
        Date: { now: () => clock.t },
        LocalPlayer: me,
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => state.controls },
        ActionHint: {
            create: (options, handler) => { state.hints.push({ options, handler }); return state.hints.length; },
            remove: (hint) => { state.removed.push(hint); return true; },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn), emitServer: (name, payload) => state.emitted.push({ name, payload }) },
        Camera: { screenRay: () => ({ origin: { x: 100, y: 200, z: 11.7 }, direction: { x: 0, y: 1, z: -0.2 }, target: { x: 100, y: 203, z: 11.1 } }) },
        World: {
            raycast: () => state.aim,
            resolveGround: (position) => {
                state.grounds.push([position.x, position.y]);
                return state.ground.get(`${Math.round(position.x)},${Math.round(position.y)}`) ?? null;
            },
        },
        Vector3: function (x, y, z) { this.x = x; this.y = y; this.z = z; },
        setInterval: (fn) => { state.tick = fn; return 1; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/thirst.js"), "utf8"), context);
    context.exports.installThirst();
    const told = (v) => state.handlers.get("kcdc-gamemode:thirst.value")(JSON.stringify({ v }));
    return { api: context.exports, state, me, clock, told };
}

const water = (surface, x = 100, y = 202, z = 9.4) => ({ surface, position: { x, y, z }, kind: "terrain" });

test("the bar reads \"—\" until the server has said, then the measure of a hundred", () => {
    const sut = load();
    assert.deepEqual(Array.from(sut.api.thirstGauge()), [0, 0]);
    sut.told(63);
    assert.deepEqual(Array.from(sut.api.thirstGauge()), [63, 100]);
    sut.told(250);
    assert.deepEqual(Array.from(sut.api.thirstGauge()), [100, 100], "never past full");
    sut.state.handlers.get("kcdc-gamemode:thirst.value")("not json");
    assert.deepEqual(Array.from(sut.api.thirstGauge()), [100, 100], "a message that cannot be read says nothing");
});

test("aiming at water puts up Beber água on F, and the press tells the server where the water is", () => {
    const sut = load();
    sut.told(40);
    sut.state.aim = water("mat_water", 100, 202, 9.4);
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.hints[0].options)), { key: "attack_special", text: "Beber água" });

    sut.state.tick();
    assert.equal(sut.state.hints.length, 1, "one hint");

    sut.state.hints[0].handler();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.emitted[0])), { name: "kcdc-gamemode:thirst.drink", payload: JSON.stringify({ x: 100, y: 202, z: 9.4 }) });
    sut.state.hints[0].handler();
    assert.equal(sut.state.emitted.length, 1, "not twice in a breath");
});

test("every surface of water counts, the ground does not, and neither does a body quenched or without a measure", () => {
    for (const surface of ["mat_water", "mat_mudwater", "mat_rockwater", "mat_slowwater"]) {
        const sut = load();
        sut.told(50);
        sut.state.aim = water(surface);
        sut.state.tick();
        assert.equal(sut.state.hints.length, 1, surface);
    }
    for (const surface of ["mat_grass", "mat_road", "mat_mud", "mat_rock"]) {
        const sut = load();
        sut.told(50);
        sut.state.aim = water(surface);
        sut.state.tick();
        assert.equal(sut.state.hints.length, 0, surface);
    }

    const quenched = load();
    quenched.told(97);
    quenched.state.aim = water("mat_water");
    quenched.state.tick();
    assert.equal(quenched.state.hints.length, 0, "no thirst, no hint");

    const unknown = load();
    unknown.state.aim = water("mat_water");
    unknown.state.tick();
    assert.equal(unknown.state.hints.length, 0, "no measure from the server yet");
});

test("looking over the water from its bank still finds it: the bed under the first steps ahead is read", () => {
    const sut = load();
    sut.told(30);
    sut.state.aim = { surface: "mat_grass", position: { x: 100, y: 203, z: 10 }, kind: "terrain" };
    sut.state.ground.set("100,202", water("mat_mudwater", 100, 201.7, 8.6));
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);
    assert.deepEqual(sut.state.grounds.map(([x, y]) => `${Math.round(x)},${Math.round(y)}`), ["100,200", "100,201", "100,201", "100,202"], "nearest first (0, 0.7, 1.4, 2 m ahead), and no more once it is found");
    sut.state.hints[0].handler();
    assert.deepEqual(JSON.parse(JSON.parse(JSON.stringify(sut.state.emitted[0])).payload), { x: 100, y: 201.7, z: 8.6 });
});

test("the hint goes when the water is out of sight, and when the player is on a horse, seated, in a dialogue or dead", () => {
    const sut = load();
    sut.told(30);
    sut.state.aim = water("mat_water");
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1);

    sut.state.aim = null;
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1]);

    const stops = {
        mounted: (other) => { other.me.mounted = true; },
        seated: (other) => { other.state.busy = true; },
        dialogue: (other) => { other.state.dialogue = true; },
        controls: (other) => { other.state.controls = false; },
        dead: (other) => { other.me.alive = false; },
    };
    for (const [name, stop] of Object.entries(stops)) {
        const other = load();
        other.told(30);
        other.state.aim = water("mat_water");
        stop(other);
        other.state.tick();
        assert.equal(other.state.hints.length, 0, name);
    }
});

test("the hint stays down a moment after a press, while the body kneels", () => {
    const sut = load();
    sut.told(30);
    sut.state.aim = water("mat_water");
    sut.state.tick();
    sut.state.hints[0].handler();
    sut.state.tick();
    assert.deepEqual(sut.state.removed, [1]);
    assert.equal(sut.state.hints.length, 1, "not put up again while it drinks");
    sut.clock.t += 3_000;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 2, "and again after");
});

test("the ground under and ahead of a player who stands still is traced once a second, not every look; the crosshair every time (2026-10-27)", () => {
    const sut = load();
    sut.told(40);
    sut.state.tick();
    const first = sut.state.grounds.length;
    assert.equal(first, 4, "the four spots under and ahead of the feet");
    sut.clock.t += 250;
    sut.state.tick();
    assert.equal(sut.state.grounds.length, first, "standing still: the same ground, not traced again");
    sut.state.aim = water("mat_water");
    sut.clock.t += 250;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 1, "the crosshair is looked at every time: water in front of the player shows at once");
    sut.state.aim = null;
    sut.clock.t += 1_000;
    sut.state.tick();
    assert.equal(sut.state.grounds.length, first + 4, "after a second it is traced again");
    sut.me.position = { x: 100.5, y: 200, z: 10 };
    sut.clock.t += 250;
    sut.state.tick();
    assert.equal(sut.state.grounds.length, first + 8, "a step: traced again at once");
    sut.state.ground.set("100,201", water("mat_mudwater", 100.5, 201, 9.6));
    sut.me.position = { x: 100.4, y: 200.2, z: 10 };
    sut.clock.t += 250;
    sut.state.tick();
    assert.equal(sut.state.hints.length, 2, "water under the feet after a step is found: the hint is up again");
});
