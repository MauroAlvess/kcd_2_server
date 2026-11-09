"use strict";

// The lanterns' light drawn by each client (src/client/lamps.ts, 2026-11-02: "os lampiões do emote: a luz está artificial, com cara de LED piscando; o correto é uma cor mais quente,
// passando sensação de fogo natural"): a local light on each carrier near the player, moved with the body and breathing like a flame.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load({ me = { id: 7, position: { x: 0, y: 0, z: 0 } }, bodies = {} } = {}) {
    const handlers = new Map();
    const intervals = [];
    const lights = [];
    const context = {
        exports: {},
        Math,
        Number,
        Array,
        JSON,
        Date: { now: () => 1_000_000 },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        Vector3: class { constructor(x, y, z) { this.x = x; this.y = y; this.z = z; } },
        LocalPlayer: me,
        Entity: class {
            constructor(id) { this.id = id; }
            get position() { const at = bodies[this.id]; if (at === undefined) throw new Error("not streamed"); return at; }
        },
        Light: {
            spawn: (position, options) => {
                const light = { position, options, intensity: options.intensity, valid: true, destroyed: false, destroy() { this.destroyed = true; this.valid = false; } };
                lights.push(light);
                return light;
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/lamps.js"), "utf8"), context);
    context.exports.installLamps();
    const tell = (payload) => handlers.get("kcdc-gamemode:lamp")(JSON.stringify(payload));
    return { api: context.exports, tell, lights, intervals, bodies, me };
}

const WARM = [1, 0.5, 0.16];

test("a flame breathes: it wavers a few in a hundred round its mean, smoothly, never on and off", () => {
    const { api } = load();
    let low = Infinity;
    let high = -Infinity;
    let jump = 0;
    let before = api.flame(0, 1.3);
    for (let step = 1; step <= 3_000; step += 1) {
        const now = api.flame(step * 0.066, 1.3);
        low = Math.min(low, now);
        high = Math.max(high, now);
        jump = Math.max(jump, Math.abs(now - before));
        before = now;
    }
    assert.ok(low > 0.84 && high < 1.16, `${low}..${high}`);
    assert.ok(jump < 0.06, `from one look to the next at most ${jump}`);
    assert.notEqual(api.flame(10, 0), api.flame(10, 2.5), "two lamps are not in step");
});

test("a lamp lit on a carrier near the player gets a light of this client's own, warm, on the hand's height, moved with the body; put out, it goes", () => {
    const sut = load({ bodies: { 3: { x: 10, y: 0, z: 5 } } });
    sut.tell({ on: [3, WARM, 1.1, 6, 0.9] });
    assert.equal(sut.lights.length, 1);
    const [light] = sut.lights;
    assert.deepEqual({ ...light.position }, { x: 10, y: 0, z: 5.9 });
    assert.deepEqual({ ...light.options.color }, { x: 1, y: 0.5, z: 0.16 });
    assert.equal(light.options.radius, 6);
    assert.equal(light.options.castShadows, false);
    // The carrier walks: at the next look the light is on him.
    sut.bodies[3] = { x: 11, y: 0.5, z: 5 };
    sut.intervals.find((interval) => interval.ms === 66).fn();
    assert.deepEqual({ ...light.position }, { x: 11, y: 0.5, z: 5.9 });
    assert.ok(light.intensity > 1.1 * 0.84 && light.intensity < 1.1 * 1.16);
    sut.tell({ off: 3 });
    assert.equal(light.destroyed, true);
});

test("the player's own lamp is drawn on themselves; a lamp far off, or whose carrier is not seen, is not drawn; all at once replaces what was known", () => {
    const sut = load({ me: { id: 7, position: { x: 0, y: 0, z: 0 } }, bodies: { 4: { x: 200, y: 0, z: 0 } } });
    sut.tell({ on: [7, WARM, 1.1, 6, 0.9] });
    assert.equal(sut.lights.length, 1, "their own");
    sut.tell({ on: [4, WARM, 1.1, 6, 0.9] });
    sut.tell({ on: [5, WARM, 1.1, 6, 0.9] });
    assert.equal(sut.lights.length, 1, "200 m off, and one not streamed: none");
    sut.tell({ all: [[4, WARM, 1.1, 6, 0.9]] });
    assert.equal(sut.lights[0].destroyed, true, "the lamps known before are put out");
    sut.bodies[4] = { x: 20, y: 0, z: 0 };
    sut.intervals.find((interval) => interval.ms === 66).fn();
    assert.equal(sut.lights.length, 2);
    // A message that is not one changes nothing.
    sut.tell({ on: [4, [2, 0, 0], 1, 6, 0.9] });
    sut.tell({ on: "x" });
    assert.equal(sut.lights[1].destroyed, false);
});
