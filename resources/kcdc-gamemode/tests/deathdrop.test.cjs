"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const inventoryAdd = require("./inventory-add-module.cjs");

// What dying costs (src/server/death-drop.ts): the pockets fall in a chest at the body, the worn gear stays, and the one who
// died may take it all back for 30 minutes (2026-10-18 night: "eles deviam conseguir abrir e pegar os itens de volta"). The
// chest is marked on their map, survives a restart, and is remembered so an administrator can give back what was lost.

const WORLD = 4294967295;
const MINUTE = 60_000;
const MALESOV = { x: 550, y: 330, z: 110 };

function rowsOf(list) {
    return list.map((row) => ({ item: row.item, name: row.name, amount: row.amount, metadata: row.metadata ?? {} }));
}

function load(files = new Map(), clock = { now: 1_000_000_000 }) {
    const handlers = new Map();
    const timers = [];
    const intervals = [];
    const logs = [];
    const players = new Map();
    const blips = [];
    const spawned = [];
    const drops = [];
    let nextStash = 500;

    const makeStash = (position, world, rows) => ({
        id: nextStash++,
        position: { ...position },
        virtualWorld: world,
        rows: rowsOf(rows),
        destroyed: false,
        getInventory() {
            return this.destroyed ? null : { revision: 1, items: this.rows.map((row, index) => ({ id: `r${index}`, ...row, quality: 1, health: 1, condition: 1, equipped: 0 })) };
        },
        setInventory({ items }) {
            this.rows = items.map((row) => ({ item: row.item, name: row.item.toUpperCase(), amount: row.amount, metadata: row.metadata ?? {} }));
            return { ok: true, code: "", revision: 2, items: [] };
        },
        addItem(row) {
            this.rows.push({ item: row.item, name: row.item.toUpperCase(), amount: row.amount, metadata: row.metadata ?? {} });
            return { ok: true, code: "", revision: 3, items: [] };
        },
        destroy() {
            this.destroyed = true;
        },
    });

    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, value) => files.set(file, JSON.stringify(value)),
    };
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? store : id === "./inventory-add.js" ? inventoryAdd(context) : assert.fail(`unexpected ${id}`)),
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setTimeout: (fn, ms) => timers.push({ fn, ms }),
        setInterval: (fn, ms) => intervals.push({ fn, ms }),
        clearInterval() {},
        Chat: { sendToPlayer: (player, text) => player.chat.push(text) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => [...players.values()], getById: (id) => players.get(id) ?? null },
        Blip: {
            create: (options) => {
                const blip = { options, removed: false, remove() { this.removed = true; } };
                blips.push(blip);
                return blip;
            },
        },
        Vector3: class {
            constructor(x, y, z) {
                Object.assign(this, { x, y, z });
            }
        },
        Stash: {
            spawn: (position, rotation, world) => {
                const stash = makeStash(position, world, []);
                spawned.push(stash);
                return stash;
            },
        },
        Inventory: {
            add: (player, request) => {
                if (player.full) {
                    return { ok: false, code: "inventoryCapacity" };
                }
                player.received.push(JSON.parse(JSON.stringify(request)));
                return { ok: true, code: "" };
            },
        },
        Area: {
            all: () => [
                { location: "Maleshov", bounds: { min: { x: 430, y: 225 }, max: { x: 660, y: 410 } } },
                { location: "Suchdol", bounds: { min: { x: 430, y: 3140 }, max: { x: 900, y: 3480 } } },
            ],
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/death-drop.js"), "utf8"), context);
    context.exports.installDeathDrops();

    const makePlayer = (id, steamId, nickname, pockets = [], position = MALESOV) => {
        const player = {
            id,
            steamId,
            nickname,
            position: { ...position },
            virtualWorld: WORLD,
            chat: [],
            received: [],
            emit() {},
            dropInventory(options) {
                this.dropOptions = options;
                if (pockets.length === 0) {
                    return null;
                }
                const stash = makeStash(this.position, WORLD, pockets);
                drops.push(stash);
                return stash;
            },
        };
        players.set(id, player);
        return player;
    };

    /** A player taking `amount` of row `index` out of a drop, as the game reports it. */
    const take = (stash, player, index, amount) => {
        const before = { id: `r${index}`, ...stash.rows[index] };
        const left = before.amount - amount;
        const after = left > 0 ? { ...before, amount: left } : null;
        if (left > 0) {
            stash.rows[index] = { ...stash.rows[index], amount: left };
        } else {
            stash.rows.splice(index, 1);
        }
        handlers.get("stashInventoryChanged")(stash, player, { reason: "withdraw", revision: 9, items: [{ id: before.id, before, after }] });
    };
    const runTimers = () => {
        while (timers.length > 0) {
            timers.shift().fn();
        }
    };
    const sweep = () => intervals[0].fn();
    const saved = (file) => JSON.parse(files.get(file) ?? "null");

    return { api: context.exports, handlers, timers, runTimers, sweep, logs, players, blips, spawned, drops, files, clock, makePlayer, take, saved };
}

const POCKETS = [
    { item: "bread", name: "Pão", amount: 3 },
    { item: "sword", name: "Espada", amount: 1, metadata: { quality: 2, health: 40 } },
    { item: "money", name: "Groschen", amount: 120 },
];

test("at death the pockets fall in a chest at the body and the worn gear stays; the owner is told where and for how long, and gets a grave on their map", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    sut.handlers.get("playerDied")(hans);

    assert.deepEqual(JSON.parse(JSON.stringify(hans.dropOptions)), { keepEquipped: true });
    assert.equal(hans.chat.at(-1), sut.api.leftText("em Malešov"));
    assert.match(hans.chat.at(-1), /30 minutos/);
    assert.match(hans.chat.at(-1), /marcado no seu mapa/);

    assert.equal(sut.blips.length, 1);
    assert.equal(sut.blips[0].options.type, "Grave");
    assert.equal(sut.blips[0].options.player, hans, "on the owner's map alone");
    assert.deepEqual({ ...sut.blips[0].options.position }, { x: 550, y: 330, z: 110 });

    const live = sut.saved("playerdata/death-drops.json").live;
    assert.equal(live.length, 1);
    assert.equal(live[0].owner, "765");
    assert.equal(live[0].expiresAt, sut.clock.now + 30 * MINUTE);
    assert.deepEqual(live[0].fell.map((row) => [row.item, row.amount]), [["bread", 3], ["sword", 1], ["money", 120]]);
    assert.ok(sut.logs.some((line) => /Hans caiu em Malešov .*baú #1 com 124 item\(ns\): 3 Pão, 1 Espada, 120 Groschen/.test(line)));
});

test("nothing refuses the one who died: they may open their own drop, like anybody else", () => {
    const sut = load();
    assert.equal(sut.handlers.has("stashInteract"), false);
});

test("the owner taking everything back ends the drop as recovered: the chest and the grave go, and nothing was lost", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    sut.handlers.get("playerDied")(hans);
    const stash = sut.drops[0];
    sut.take(stash, hans, 0, 3);
    sut.take(stash, hans, 0, 1);
    sut.take(stash, hans, 0, 120);
    sut.runTimers();

    assert.equal(stash.destroyed, true);
    assert.equal(sut.blips[0].removed, true);
    assert.equal(hans.chat.at(-1), sut.api.RECOVERED_TEXT);
    assert.deepEqual(sut.saved("playerdata/death-drops.json").live, []);
    const past = sut.saved("playerdata/death-drops-past.json").past;
    assert.equal(past[0].end, "recuperado");
    assert.equal(past[0].recovered, 124);
    assert.deepEqual(past[0].lost, []);
});

test("what somebody else takes is lost to the owner, with who took it; what is left after 30 minutes goes, after a warning at 5", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    const bandit = sut.makePlayer(2, "999", "Bandido");
    sut.handlers.get("playerDied")(hans);
    const stash = sut.drops[0];
    sut.take(stash, bandit, 2, 100);
    sut.take(stash, hans, 0, 3);

    sut.clock.now += 25 * MINUTE + 1;
    sut.sweep();
    assert.equal(hans.chat.at(-1), sut.api.warnText("em Malešov"));
    sut.sweep();
    assert.equal(hans.chat.filter((line) => line === sut.api.warnText("em Malešov")).length, 1, "warned once");

    sut.clock.now += 5 * MINUTE;
    sut.sweep();
    sut.runTimers();
    assert.equal(stash.destroyed, true);
    assert.equal(hans.chat.at(-1), sut.api.GONE_TEXT);
    const record = sut.saved("playerdata/death-drops-past.json").past[0];
    assert.equal(record.end, "expirou");
    assert.deepEqual(record.lost.map((row) => [row.item, row.amount]).sort(), [["money", 120], ["sword", 1]]);
    assert.deepEqual(record.takers.map((taker) => [taker.name, taker.units]), [["Bandido", 100], ["Hans", 3]]);
    assert.ok(sut.logs.some((line) => /Bandido levou do baú #1 de Hans: 100 Groschen/.test(line)));
});

test("a restart puts a live drop back where it stood, with what was left, for at least 10 more minutes, and marks it again", () => {
    const files = new Map();
    const before = load(files);
    const hans = before.makePlayer(1, "765", "Hans", POCKETS);
    before.handlers.get("playerDied")(hans);
    before.take(before.drops[0], hans, 0, 3);
    before.handlers.get("resourceStop")("kcdc-gamemode");
    // The server going down takes the chest away and reports it emptied: what was saved in it stays.
    before.handlers.get("stashInventoryChanged")(before.drops[0], null, { reason: "destroy", revision: 10, items: [] });
    assert.equal(before.drops[0].destroyed, true);

    const clock = { now: before.clock.now + 28 * MINUTE };
    const after = load(files, clock);
    assert.equal(after.spawned.length, 1);
    const stash = after.spawned[0];
    assert.deepEqual(stash.position, { x: 550, y: 330, z: 110 });
    assert.equal(stash.virtualWorld, WORLD);
    assert.deepEqual(stash.rows.map((row) => [row.item, row.amount, row.metadata]), [
        ["sword", 1, { quality: 2, health: 40 }],
        ["money", 120, {}],
    ]);
    const live = after.saved("playerdata/death-drops.json").live;
    assert.equal(live[0].expiresAt, clock.now + 10 * MINUTE);

    const back = after.makePlayer(7, "765", "Hans");
    after.handlers.get("playerSpawned")(back);
    assert.equal(after.blips.at(-1).options.player, back);
    assert.equal(back.chat.at(-1), after.api.stillThereText(10, "em Malešov"));
});

test("a drop whose time ran out while the server was down is remembered as lost, not put back", () => {
    const files = new Map();
    const before = load(files);
    before.handlers.get("playerDied")(before.makePlayer(1, "765", "Hans", POCKETS));
    const after = load(files, { now: before.clock.now + 31 * MINUTE });
    assert.equal(after.spawned.length, 0);
    const record = after.saved("playerdata/death-drops-past.json").past[0];
    assert.equal(record.end, "expirou");
    assert.equal(record.lost.length, 3);
});

test("/mortes devolver gives the owner what they lost: now if they are here, at their next entry if not, once", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    sut.handlers.get("playerDied")(hans);
    sut.clock.now += 31 * MINUTE;
    sut.sweep();

    sut.players.delete(1);
    const away = sut.api.giveBack(1, sut.clock.now);
    assert.equal(away.ok, true);
    assert.match(away.message, /próxima entrada/);
    assert.equal(sut.api.giveBack(1, sut.clock.now).ok, false, "not twice");

    const back = sut.makePlayer(9, "765", "Hans");
    sut.handlers.get("playerSpawned")(back);
    const wait = sut.timers.find((timer) => timer.ms === sut.api.RETURN_AFTER_SPAWN_MS);
    assert.ok(wait, "given a few seconds after the body is in the world");
    wait.fn();
    assert.deepEqual(back.received.map((row) => [row.item, row.amount, row.metadata]), [
        ["bread", 3, {}],
        ["sword", 1, { quality: 2, health: 40 }],
        ["money", 120, {}],
    ]);
    assert.equal(back.chat.at(-1), sut.api.returnedText(124));
    assert.deepEqual(sut.saved("playerdata/death-drops-past.json").returns, {});
});

test("a drop still in the world can be given back directly: what is in it goes to its owner, and the chest goes", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    sut.handlers.get("playerDied")(hans);
    const result = sut.api.giveBack(1, sut.clock.now);
    sut.runTimers();
    assert.equal(result.ok, true);
    assert.equal(sut.drops[0].destroyed, true);
    assert.equal(hans.received.length, 3);
    assert.equal(sut.saved("playerdata/death-drops-past.json").past[0].end, "devolvido");
});

test("what a full inventory cannot take now waits for the next entry", () => {
    const sut = load();
    const hans = sut.makePlayer(1, "765", "Hans", POCKETS);
    sut.handlers.get("playerDied")(hans);
    sut.clock.now += 31 * MINUTE;
    sut.sweep();
    hans.full = true;
    const result = sut.api.giveBack(1, sut.clock.now);
    assert.match(result.message, /não couberam agora/);
    assert.equal(sut.saved("playerdata/death-drops-past.json").returns["765"].length, 3);
});

test("the place a drop is told by: in a town, near one, or nothing far from every town", () => {
    const sut = load();
    assert.equal(sut.api.placeNear({ x: 550, y: 300 }), "em Malešov");
    assert.equal(sut.api.placeNear({ x: 900, y: 300 }), "perto de Malešov");
    assert.equal(sut.api.placeNear({ x: 3000, y: 1800 }), "");
});
