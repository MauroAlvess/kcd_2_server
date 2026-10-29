"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The engine's lists of players, horses and carts (src/server/listings.ts): each call walks all the engine's entities (about 1.4 ms in the live world, whoever is
// in it), and some thirty calls a second asked only who is online. Kept for a couple of seconds, ended at once by the events that change who is in them.

function load({ horses = true, carts = true } = {}) {
    const state = { now: 1_000_000, logs: [] };
    const handlers = new Map();
    const fire = (name, ...args) => (handlers.get(name) ?? []).forEach((fn) => fn(...args));

    /** A listing like the engine's: it counts the calls that reach it and says who is in it now. */
    const listing = (members) => {
        const owner = {
            real: 0,
            members,
            all(world) {
                owner.real += 1;
                return owner.members.filter((member) => world === undefined || member.world === world).map((member) => ({ ...member }));
            },
        };
        return owner;
    };
    const Player = listing([{ id: 1, name: "a" }, { id: 2, name: "b" }]);
    const Horse = listing([{ id: 10 }]);
    const Cart = listing([{ id: 20, world: 0 }, { id: 21, world: 5 }]);
    const original = { player: Player.all, horse: Horse.all, cart: Cart.all };

    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        Events: { on: (name, fn) => handlers.set(name, [...(handlers.get(name) ?? []), fn]) },
        Player,
    };
    if (horses) context.Horse = Horse;
    if (carts) context.Cart = Cart;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/listings.js"), "utf8"), context);
    context.exports.installListings();
    const report = () => context.globalThis?.__kcdcListings?.() ?? vm.runInContext("globalThis.__kcdcListings ? globalThis.__kcdcListings() : null", context);
    return { api: context.exports, state, fire, Player, Horse, Cart, original, report };
}

test("a thousand calls for the players reach the engine once, and each is given an array of its own", () => {
    const sut = load();
    const first = sut.Player.all();
    for (let i = 0; i < 999; i += 1) sut.Player.all();
    assert.equal(sut.Player.real, 1);
    assert.deepEqual(first.map((p) => p.id), [1, 2]);

    first.length = 0;
    first.push({ id: 99 });
    assert.deepEqual(sut.Player.all().map((p) => p.id), [1, 2], "a caller that cut or sorted its array changed nobody else's");
    const a = sut.Player.all();
    const b = sut.Player.all();
    assert.notEqual(a, b);
    assert.equal(a[0], b[0], "the same body objects, though");
});

test("an answer is kept for two seconds and no longer", () => {
    const sut = load();
    sut.Player.all();
    sut.state.now += 1_999;
    sut.Player.all();
    assert.equal(sut.Player.real, 1);
    sut.state.now += 2;
    sut.Player.all();
    assert.equal(sut.Player.real, 2);
});

test("somebody connecting ends the kept answer, so the new body is in the next one", () => {
    const sut = load();
    assert.equal(sut.Player.all().length, 2);
    sut.Player.members.push({ id: 3, name: "c" });
    assert.equal(sut.Player.all().length, 2, "kept: nothing said that anybody came");
    sut.fire("playerConnect", { id: 3 });
    assert.deepEqual(sut.Player.all().map((p) => p.id), [1, 2, 3]);
});

test("a body that is leaving is the engine's own answer to every call until the engine stops listing it", () => {
    const sut = load();
    sut.Player.all();
    assert.equal(sut.Player.real, 1);
    // The event comes before the engine has taken the body away: it is still in the list, as before.
    sut.fire("playerDisconnect", { id: 2 });
    for (let i = 0; i < 5; i += 1) assert.deepEqual(sut.Player.all().map((p) => p.id), [1, 2]);
    assert.equal(sut.Player.real, 6, "every call reached the engine, none was answered from before");

    sut.Player.members.splice(1, 1);
    assert.deepEqual(sut.Player.all().map((p) => p.id), [1], "the engine let go of it: the answer is true at once");
    const real = sut.Player.real;
    sut.Player.all();
    sut.Player.all();
    assert.equal(sut.Player.real, real, "and answers are kept again");
});

test("a leaving body the engine never lets go of is given up on after five seconds", () => {
    const sut = load();
    sut.fire("playerDisconnect", { id: 2 });
    sut.Player.all();
    sut.state.now += 5_001;
    sut.Player.all();
    const real = sut.Player.real;
    sut.Player.all();
    sut.Player.all();
    assert.equal(sut.Player.real, real, "kept again");
});

test("the carts are kept for each world apart, and a cart appearing or going ends them all", () => {
    const sut = load();
    assert.deepEqual(sut.Cart.all().map((c) => c.id), [20, 21]);
    assert.deepEqual(sut.Cart.all(5).map((c) => c.id), [21]);
    assert.deepEqual(sut.Cart.all(0).map((c) => c.id), [20]);
    for (let i = 0; i < 20; i += 1) {
        sut.Cart.all();
        sut.Cart.all(5);
        sut.Cart.all(0);
    }
    assert.equal(sut.Cart.real, 3, "one real call for each of the three questions");
    sut.fire("cartSpawn", { id: 22 });
    sut.Cart.all();
    sut.Cart.all(5);
    assert.equal(sut.Cart.real, 5);
});

test("the horses are kept for a second, and a horse destroyed is the engine's own answer until it is gone", () => {
    const sut = load();
    sut.Horse.all();
    sut.Horse.all();
    assert.equal(sut.Horse.real, 1);
    sut.state.now += 1_001;
    sut.Horse.all();
    assert.equal(sut.Horse.real, 2);
    sut.fire("horseDestroy", { id: 10 });
    sut.Horse.all();
    sut.Horse.all();
    assert.equal(sut.Horse.real, 4);
    sut.Horse.members.length = 0;
    assert.deepEqual(sut.Horse.all(), []);
    sut.Horse.all();
    assert.equal(sut.Horse.real, 5);
});

test("installed twice, the lists are not kept twice; the resource stopping gives the engine's own back", () => {
    const sut = load();
    const kept = sut.Player.all;
    assert.notEqual(kept, sut.original.player);
    sut.api.installListings();
    assert.equal(sut.Player.all, kept, "the first keeper stays, no second one in front of it");
    sut.fire("resourceStop", "another-resource");
    assert.equal(sut.Player.all, kept);
    sut.fire("resourceStop", "kcdc-gamemode");
    assert.equal(sut.Player.all, sut.original.player);
    assert.equal(sut.Horse.all, sut.original.horse);
    assert.equal(sut.Cart.all, sut.original.cart);
});

test("a server with no horses or carts in its api keeps only what it has", () => {
    const sut = load({ horses: false, carts: false });
    sut.Player.all();
    sut.Player.all();
    assert.equal(sut.Player.real, 1);
});

test("the performance report says how many calls were asked and how many reached the engine, then starts again", () => {
    const sut = load();
    for (let i = 0; i < 40; i += 1) sut.Player.all();
    sut.Horse.all();
    const line = sut.report();
    assert.match(line, /^; listas: Player\.all\(\) 1 no motor de 40 pedidos \(\d+,\d\d ms cada\) \| Horse\.all\(\) 1 no motor de 1 pedidos/);
    assert.equal(sut.report(), "", "nothing asked since: nothing said");
    sut.Player.all();
    assert.match(sut.report(), /^; listas: Player\.all\(\) 0 no motor de 1 pedidos$/);
});

test("a list that is not there does not stop the server from starting", () => {
    const context = { exports: {}, console: { log() {} }, Date, Events: { on() {} }, Player: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/listings.js"), "utf8"), context);
    assert.doesNotThrow(() => context.exports.installListings());
});
