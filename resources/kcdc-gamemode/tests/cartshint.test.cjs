// The client's "[E] Subir na carroça" hint (src/client/carts.ts): up while the server says a cart is near, and a press asks for the seats.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// The client's reach (src/client/reach.ts): it requires nothing.
const reachBox = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/reach.js"), "utf8"), reachBox);

function load({ hintThrows = false, me = { x: 0, y: 0, z: 10 }, carts = {} } = {}) {
    const handlers = new Map();
    const intervals = [];
    const created = [];
    const removed = [];
    /** Hints the game took down by itself. */
    const gone = new Set();
    const emitted = [];
    const context = {
        exports: {},
        require: (id) => (id === "./reach.js" ? reachBox.exports : assert.fail(`unexpected require ${id}`)),
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        LocalPlayer: { ready: true, position: me },
        // What this game sees of a cart: where its front axle is and which way it heads (degrees as Euler angles).
        Entity: class {
            constructor(id) { this.id = id; }
            get position() { const cart = carts[this.id]; if (cart === undefined) throw new Error("not streamed"); return { x: cart.x, y: cart.y, z: cart.z }; }
            get rotation() { return { x: 0, y: 0, z: carts[this.id]?.yaw ?? 0 }; }
        },
        Math,
        Number,
        Array,
        JSON,
        Infinity,
        Events: { on: (name, fn) => handlers.set(name, fn), emitServer: (name, payload) => emitted.push({ name, payload }) },
        ActionHint: {
            create: (options, press) => {
                if (hintThrows) throw new Error("no such key");
                created.push({ options, press });
                return created.length;
            },
            remove: (id) => removed.push(id),
            setText: (id) => id >= 1 && id <= created.length && !removed.includes(id) && !gone.has(id),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/carts.js"), "utf8"), context);
    context.exports.installCarts();
    return { api: context.exports, near: (payload) => handlers.get("kcdc-gamemode:cart.near")(payload), created, removed, emitted, handlers, gone, intervals, carts, me: context.LocalPlayer };
}

test("the hint goes up once when a cart is near, on the interaction key, and comes down when none is", () => {
    const sut = load();
    sut.near(JSON.stringify({ id: 300 }));
    sut.near(JSON.stringify({ id: 300 }));
    sut.near({ id: 301 });
    assert.equal(sut.created.length, 1, "one hint, however many times the server says it");
    assert.equal(sut.created[0].options.key, "primary_action");
    assert.equal(sut.created[0].options.text, "Subir na carroça");
    assert.deepEqual(sut.removed, []);

    sut.near(JSON.stringify({ id: 0 }));
    assert.deepEqual(sut.removed, [1]);
    sut.near(JSON.stringify({ id: 0 }));
    assert.deepEqual(sut.removed, [1], "nothing to take down twice");
    sut.near(JSON.stringify({ id: 302 }));
    assert.equal(sut.created.length, 2, "and up again at the next cart");
});

test("the press asks the server for the seats of the cart it was for, and where this game sees it", () => {
    const sut = load();
    sut.near(JSON.stringify({ id: 300 }));
    sut.created[0].press();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.emitted)), [{ name: "kcdc-gamemode:cart.use", payload: { id: 300 } }], "a cart this game does not stream: its id alone");
    sut.carts[300] = { x: 1.24, y: 2.06, z: 10, yaw: 0 };
    sut.created[0].press();
    assert.deepEqual(JSON.parse(JSON.stringify(sut.emitted[1].payload)), { id: 300, x: 1.2, y: 2.1 });
});

test("beside a cart where this game sees it, the hint is up even when the server's sight of the cart lags behind; and down again away from it (2026-11-02, Jaromir's wagon)", () => {
    // The server's sight: no cart beside the player; the carts round them: 300 (a carpet wagon, its body 8 m behind the axle) and 301.
    const sut = load({ carts: { 300: { x: 0, y: 7, z: 10, yaw: 0 }, 301: { x: 30, y: 0, z: 10, yaw: 90 } } });
    sut.near(JSON.stringify({ id: 0, around: [[300, 8], [301, 5.5]] }));
    // Heading +Y (yaw 0), the axle at y 7: the body runs from y -1 to y 8.5, and the player at (0, 0) stands by its tail.
    assert.equal(sut.created.length, 1);
    assert.equal(sut.api.cartIsNear(), true);
    sut.created[0].press();
    assert.equal(sut.emitted.at(-1).payload.id, 300);
    // Walking off: the quarter-second look takes it down.
    sut.me.position = { x: 0, y: -10, z: 10 };
    sut.intervals.find((interval) => interval.ms === 250).fn();
    assert.equal(sut.api.cartIsNear(), false);
    assert.deepEqual(sut.removed, [1]);
    // 2.5 m from the carpet wagon's tail (y -1) is beside it; the same spot is 5 m from a covered wagon's (y 1.5), out of the 3 m reach.
    const long = load({ me: { x: 0, y: -3.5, z: 10 }, carts: { 300: { x: 0, y: 7, z: 10, yaw: 0 } } });
    long.near(JSON.stringify({ id: 0, around: [[300, 8]] }));
    assert.equal(long.api.cartIsNear(), true);
    const short = load({ me: { x: 0, y: -3.5, z: 10 }, carts: { 300: { x: 0, y: 7, z: 10, yaw: 0 } } });
    short.near(JSON.stringify({ id: 0, around: [[300, 5.5]] }));
    assert.equal(short.api.cartIsNear(), false);
    // A floor apart is not beside it.
    const above = load({ me: { x: 0, y: 3, z: 20 }, carts: { 300: { x: 0, y: 7, z: 10, yaw: 0 } } });
    above.near(JSON.stringify({ id: 0, around: [[300, 8]] }));
    assert.equal(above.api.cartIsNear(), false);
});

test("a message that is not one, or a key the game refuses, changes nothing", () => {
    const sut = load();
    sut.near("not json");
    sut.near(null);
    sut.near(JSON.stringify({ id: "300" }));
    assert.equal(sut.created.length, 0);

    const broken = load({ hintThrows: true });
    assert.doesNotThrow(() => broken.near(JSON.stringify({ id: 300 })));
    assert.equal(broken.created.length, 0);
    assert.doesNotThrow(() => broken.near(JSON.stringify({ id: 0 })));
    assert.deepEqual(broken.removed, []);
});

test("a hint the game took down is put back the next time the server says the cart is there", () => {
    const sut = load();
    sut.near(JSON.stringify({ id: 300 }));
    assert.equal(sut.api.cartIsNear(), true);
    sut.gone.add(1);
    sut.near(JSON.stringify({ id: 300 }));
    assert.equal(sut.created.length, 2, "up again");
    sut.near(JSON.stringify({ id: 300 }));
    assert.equal(sut.created.length, 2, "and only once");
    sut.near(JSON.stringify({ id: 0 }));
    assert.equal(sut.api.cartIsNear(), false);
    assert.deepEqual(sut.removed, [2]);
});
