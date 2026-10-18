// The client's "[E] Subir na carroça" hint (src/client/carts.ts): up while the server says a cart is near, and a press asks for the seats.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load({ hintThrows = false } = {}) {
    const handlers = new Map();
    const created = [];
    const removed = [];
    const emitted = [];
    const context = {
        exports: {},
        Events: { on: (name, fn) => handlers.set(name, fn), emitServer: (name, payload) => emitted.push({ name, payload }) },
        ActionHint: {
            create: (options, press) => {
                if (hintThrows) throw new Error("no such key");
                created.push({ options, press });
                return created.length;
            },
            remove: (id) => removed.push(id),
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/carts.js"), "utf8"), context);
    context.exports.installCarts();
    return { near: (payload) => handlers.get("kcdc-gamemode:cart.near")(payload), created, removed, emitted, handlers };
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

test("the press asks the server for the seats, and says nothing else", () => {
    const sut = load();
    sut.near(JSON.stringify({ id: 300 }));
    sut.created[0].press();
    assert.deepEqual(sut.emitted, [{ name: "kcdc-gamemode:cart.use", payload: undefined }]);
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
