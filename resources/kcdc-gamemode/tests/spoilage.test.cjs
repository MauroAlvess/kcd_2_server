const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Food spoils with the world's clock (src/server/spoilage.ts; user, 2026-10-19: "existe algum sistema que estraga as comidas ativo
// no servidor? se não, ative-o").

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const MEAT = "45f9883e-73b1-429f-a127-34fbfd7084aa"; // roeDeerLoin, 36 h
const WINE = "WINE";
const ROCK = "not-a-food";

function load() {
    const state = { clock: 100, chat: [], set: [], refuse: false };
    const data = { exports: {} };
    vm.runInNewContext(dist("food-decay-data.js"), data);
    data.exports.FOOD_DECAY[WINE.toLowerCase()] = ["wine", 780];
    const inventories = new Map();
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./food-decay-data.js") return data.exports;
            if (id === "./item-names.js") return { itemLine: (row) => `${row.amount}x ${row.name}` };
            return assert.fail(`unexpected require ${id}`);
        },
        console: { log() {} },
        Chat: { sendToPlayer: (player, text) => state.chat.push({ to: player.steamId, text }) },
        Inventory: {
            get: (player) => ({ items: inventories.get(player.steamId) ?? [] }),
            setProperties: (player, request) => {
                if (state.refuse) return { ok: false, code: "staleRevision" };
                state.set.push({ to: player.steamId, ...JSON.parse(JSON.stringify(request)) });
                const row = (inventories.get(player.steamId) ?? []).find((one) => one.id === request.id);
                row.condition = request.metadata.condition;
                row.metadata = request.metadata;
                return { ok: true, code: "" };
            },
        },
        Events: { on() {} },
        setInterval: () => 1,
        clearInterval() {},
    };
    vm.runInNewContext(dist("spoilage.js"), context);
    const spoil = new context.exports.Spoilage(() => state.clock);
    const player = (steamId, rows, extra = {}) => {
        inventories.set(steamId, rows);
        return { id: 1, steamId, ready: true, alive: true, emit() {}, ...extra };
    };
    const row = (id, item, condition = 1, name = "food") => ({ id, item, name, amount: 2, condition, metadata: { quality: 1, health: condition, condition } });
    return { api: context.exports, spoil, state, player, row, inventories };
}

test("raw meat loses as much as the game hours gone take from its 36: written with its condition alone, and nothing else is touched", () => {
    const sut = load();
    const hans = sut.player("hans", [sut.row("a", MEAT, 1, "roeDeerLoin"), sut.row("b", ROCK)]);
    assert.equal(sut.spoil.tick([hans]), 0, "the first look only reads the clock");
    sut.state.clock += 1.8;
    assert.equal(sut.spoil.tick([hans]), 1);
    assert.equal(sut.state.set.length, 1);
    assert.deepEqual(sut.state.set[0].metadata, { quality: 1, condition: 0.95 }, "a twentieth of 36 hours; no absolute health beside it");
});

test("what is less than a step waits for the next minutes, and is not lost", () => {
    const sut = load();
    const ana = sut.player("ana", [sut.row("w", WINE, 1, "wine")]);
    sut.spoil.tick([ana]);
    for (let minute = 0; minute < 20; minute += 1) {
        sut.state.clock += 0.375; // a minute of daylight
        sut.spoil.tick([ana]);
    }
    assert.equal(sut.state.set.length, 0, "7.5 hours of 780 are under a step");
    sut.state.clock += 0.375;
    sut.spoil.tick([ana]);
    assert.equal(sut.state.set.length, 1, "the owed share is written once it is a step");
    assert.ok(Math.abs(sut.state.set[0].metadata.condition - (1 - 21 * 0.375 / 780)) < 0.001);
});

test("a food that turns spoiled is told once; spoiled food keeps going down to nothing and no further", () => {
    const sut = load();
    const hans = sut.player("hans", [sut.row("a", MEAT, 0.21, "roeDeerLoin")]);
    sut.spoil.tick([hans]);
    sut.state.clock += 1;
    sut.spoil.tick([hans]);
    assert.equal(sut.state.chat.length, 1);
    assert.match(sut.state.chat[0].text, /^Estragou: 2x roeDeerLoin\. Comer comida estragada faz mal\.$/);
    sut.state.clock += 3;
    sut.spoil.tick([hans]);
    assert.equal(sut.state.chat.length, 1, "told once");
    sut.state.clock += 3;
    sut.spoil.tick([hans]);
    sut.state.clock += 3;
    sut.spoil.tick([hans]);
    const last = sut.state.set.at(-1).metadata.condition;
    assert.equal(last, 0);
    const before = sut.state.set.length;
    sut.state.clock += 3;
    sut.spoil.tick([hans]);
    assert.equal(sut.state.set.length, before, "nothing below nothing");
});

test("a clock set back, or a long stall, spoils nothing or no more than the cap; nobody away, dead or loading", () => {
    const sut = load();
    const hans = sut.player("hans", [sut.row("a", MEAT, 1)]);
    sut.spoil.tick([hans]);
    sut.state.clock -= 10;
    assert.equal(sut.spoil.tick([hans]), 0);
    sut.state.clock += 100;
    sut.spoil.tick([hans]);
    assert.ok(Math.abs(sut.state.set[0].metadata.condition - (1 - sut.api.spoilage.maxStepHours / 36)) < 0.001, "the cap");

    const other = load();
    const dead = other.player("d", [other.row("a", MEAT)], { alive: false });
    const loading = other.player("l", [other.row("a", MEAT)], { ready: false });
    other.spoil.tick([dead, loading]);
    other.state.clock += 3;
    assert.equal(other.spoil.tick([dead, loading]), 0);
});

test("a refused write changes nothing and is tried again; switched off, nothing spoils", () => {
    const sut = load();
    const hans = sut.player("hans", [sut.row("a", MEAT, 1)]);
    sut.spoil.tick([hans]);
    sut.state.refuse = true;
    sut.state.clock += 3.6;
    assert.equal(sut.spoil.tick([hans]), 0);
    sut.state.refuse = false;
    sut.state.clock += 3.6;
    assert.equal(sut.spoil.tick([hans]), 1);
    sut.api.spoilage.enabled = false;
    sut.state.clock += 3.6;
    assert.equal(sut.spoil.tick([hans]), 0);
});

test("the table holds the game's own numbers: raw meat 36 h, bread 96 h, apples 120 h; dried and smoked never spoil", () => {
    const sut = load();
    assert.equal(sut.api.decayHours(MEAT), 36);
    assert.equal(sut.api.decayHours("86E4FF24-88DB-4024-ABE6-46545FA0FBD1"), 96, "any case");
    assert.equal(sut.api.decayHours("2264f217-590e-4c0f-a4c6-f50c6532b9f6"), 120);
    assert.equal(sut.api.decayHours(ROCK), undefined);
});
