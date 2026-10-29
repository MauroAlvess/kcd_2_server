"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// "Animal preso" (src/server/animal-stuck.ts, 2026-10-27): a bugged horse, dog or cart put in front of its owner, once an hour each.

const OWNER = "76561198000000001";

function load({ seed } = {}) {
    const files = new Map(seed === undefined ? [] : [["playerdata/animal-stuck.json", JSON.stringify(seed)]]);
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, value) => files.set(file, JSON.stringify(value)),
    };
    const logs = [];
    const brought = [];
    const state = { horses: [], carts: [], dog: "supporter", cartFails: false, dogBack: true, now: 1_000_000_000 };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./store.js") return store;
            if (id === "./place.js") return { inFrontOf: (player, distance) => ({ position: { x: player.position.x, y: player.position.y + distance, z: 0 }, rotation: "turned back" }) };
            if (id === "./horses.js") return { horsesOf: () => state.horses };
            if (id === "./carts.js") {
                return {
                    cartsOf: () => state.carts,
                    bringCart: (player, key, now, force) => {
                        brought.push({ key, force });
                        return state.cartFails ? { ok: false, message: "A carroça está com gente: espere que desçam." } : { ok: true, message: "Carroça está ao seu lado." };
                    },
                };
            }
            if (id === "./supporters.js") {
                return { supporters: { get: () => (state.dog === "supporter" ? { dogName: "Rex" } : null), bringDog: (player) => { if (!state.dogBack) return null; const dog = { position: null, rotation: null }; player.dog = dog; return dog; } } };
            }
            assert.fail(`unexpected require ${id}`);
        },
        console: { log: (line) => logs.push(line) },
        Date: { now: () => state.now },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/animal-stuck.js"), "utf8"), context);
    context.exports.installAnimalStuck();
    const player = { steamId: OWNER, nickname: "Mauro", ready: true, alive: true, position: { x: 10, y: 20, z: 0 }, dog: null };
    const horse = (key, name, extra = {}) => ({ record: { key, name }, horse: { alive: true, rider: null, position: { x: 500, y: 500, z: 0 }, rotation: null, ...extra } });
    return { api: context.exports, files, logs, brought, state, player, horse };
}

test("a bugged horse is put in front of its owner, and cannot be again for an hour; another horse is not held by it", () => {
    const sut = load();
    const first = sut.horse("h1", "Trovão");
    const second = sut.horse("h2", "Pardo");
    sut.state.horses = [first, second];

    const done = sut.api.unstickAnimal(sut.player, "horse", "h1", sut.state.now);
    assert.equal(done.ok, true);
    assert.match(done.message, /Trovão está ao seu lado/);
    assert.deepEqual(first.horse.position, { x: 10, y: 23, z: 0 }, "three metres in front");
    assert.equal(first.horse.rotation, "turned back");
    assert.deepEqual(JSON.parse(sut.files.get("playerdata/animal-stuck.json")), { "horse:h1": sut.state.now });

    sut.state.now += 10 * 60_000;
    const again = sut.api.unstickAnimal(sut.player, "horse", "h1", sut.state.now);
    assert.equal(again.ok, false);
    assert.match(again.message, /de novo em 50 minutos/);
    assert.equal(sut.api.stuckIn("horse", "h1", OWNER), 50 * 60);
    assert.equal(sut.api.stuckIn("horse", "h2", OWNER), 0, "the other horse is free");
    assert.equal(sut.api.unstickAnimal(sut.player, "horse", "h2", sut.state.now).ok, true);

    sut.state.now += 51 * 60_000;
    assert.equal(sut.api.unstickAnimal(sut.player, "horse", "h1", sut.state.now).ok, true, "an hour later it is free again");
});

test("the wait survives a restart, and what has run out is not kept", () => {
    const now = 1_000_000_000;
    const sut = load({ seed: { "horse:h1": now - 20 * 60_000, "cart:c1": now - 3 * 3_600_000, "dog:x": "bad" } });
    assert.ok(sut.api.stuckIn("horse", "h1", OWNER) > 39 * 60 && sut.api.stuckIn("horse", "h1", OWNER) <= 40 * 60);
    assert.equal(sut.api.stuckIn("cart", "c1", OWNER), 0, "three hours ago is over");
});

test("a horse that is ridden, dead, not in the world, not the player's, or a player who is dead, is refused and the wait is not spent", () => {
    const sut = load();
    sut.state.horses = [sut.horse("h1", "Trovão", { rider: { id: 9 } }), sut.horse("h2", "Pardo", { alive: false }), { record: { key: "h3", name: "Baio" }, horse: null }];
    assert.match(sut.api.unstickAnimal(sut.player, "horse", "h1").message, /está montado/);
    assert.match(sut.api.unstickAnimal(sut.player, "horse", "h2").message, /está morto/);
    assert.match(sut.api.unstickAnimal(sut.player, "horse", "h3").message, /não está no mundo/);
    assert.match(sut.api.unstickAnimal(sut.player, "horse", "nope").message, /não é seu/);
    sut.player.alive = false;
    assert.match(sut.api.unstickAnimal(sut.player, "horse", "h1").message, /não pode fazer isto/);
    sut.player.alive = true;
    for (const bad of [undefined, null, "bird", 3]) assert.equal(sut.api.unstickAnimal(sut.player, bad, "h1").ok, false);
    assert.equal(sut.files.has("playerdata/animal-stuck.json"), false, "nothing was spent");
    assert.equal(sut.api.stuckIn("horse", "h1", OWNER), 0);
});

test("a cart is brought by the cart module without waiting for its own bring, and a cart with people on it is refused without spending the wait", () => {
    const sut = load();
    sut.state.carts = [{ record: { key: "c1", name: "Carroça do Pardo" } }];
    sut.state.cartFails = true;
    assert.equal(sut.api.unstickAnimal(sut.player, "cart", "c1", sut.state.now).ok, false);
    assert.equal(sut.api.stuckIn("cart", "c1", OWNER), 0);

    sut.state.cartFails = false;
    const done = sut.api.unstickAnimal(sut.player, "cart", "c1", sut.state.now);
    assert.equal(done.ok, true);
    assert.deepEqual(sut.brought.at(-1), { key: "c1", force: true });
    assert.equal(sut.api.stuckIn("cart", "c1", OWNER), 3600);
    assert.match(sut.api.unstickAnimal(sut.player, "cart", "zz").message, /não é sua/);
});

test("the dog is put in front of its owner, or brought back when it is not in the world; somebody with no dog is told", () => {
    const sut = load();
    sut.player.dog = { position: null, rotation: null };
    const first = sut.api.unstickAnimal(sut.player, "dog", undefined, sut.state.now);
    assert.equal(first.ok, true);
    assert.deepEqual(sut.player.dog.position, { x: 10, y: 23, z: 0 });
    assert.equal(sut.api.stuckIn("dog", "", OWNER), 3600);

    const other = load();
    assert.equal(other.api.unstickAnimal(other.player, "dog", undefined).message, "Seu cão voltou para perto de você.");
    assert.notEqual(other.player.dog, null);

    const lost = load();
    lost.state.dogBack = false;
    assert.equal(lost.api.unstickAnimal(lost.player, "dog", undefined).ok, false);
    assert.equal(lost.api.stuckIn("dog", "", OWNER), 0, "and the wait is not spent");

    const none = load();
    none.state.dog = "none";
    assert.match(none.api.unstickAnimal(none.player, "dog", undefined).message, /não tem um cão/);
});

test("a player with no Steam id cannot be given the wait, since it could not be kept", () => {
    const sut = load();
    sut.player.steamId = "";
    assert.equal(sut.api.unstickAnimal(sut.player, "dog", undefined).ok, false);
});
