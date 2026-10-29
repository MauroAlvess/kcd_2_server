"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The lockpick that breaks (src/server/lockpick-wear.ts): since 2026-10-28 only AFTER the minigame, once the lock has opened (2026-10-26: "Lockpick não está quebrando,
// fica infinito o arrombar"; 2026-10-28, a player: "gazuas estão quebrando sem fazer o minijogo").

function load({ rolls = [], picks = 1, ready = true } = {}) {
    const handlers = new Map();
    const chat = [];
    const logs = [];
    const taken = [];
    const queue = [...rolls];
    const clock = { t: 1_000_000 };
    const state = { doorLocked: true, stashLocked: true, doorGone: false, tick: null, stopped: false, players: new Map() };
    const player = {
        nickname: "Ladrão",
        id: 7,
        takeItem: (item, amount) => {
            taken.push([item, amount]);
            return Promise.resolve({ removed: amount, requested: amount, ok: true, reason: "" });
        },
    };
    state.players.set(7, player);
    const door = { guid: "00000000000000aa", get locked() { return state.doorLocked; } };
    const stash = { id: 41, get locked() { return state.stashLocked; } };
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (_player, text) => chat.push(text) },
        Inventory: {
            get: () => ({ ready, items: picks > 0 ? [{ id: "1", name: "player_lockpick", amount: picks }, { id: "2", name: "bread", amount: 3 }] : [{ id: "2", name: "bread", amount: 3 }] }),
        },
        Door: { find: (guid) => (guid === door.guid && !state.doorGone ? door : null) },
        Stash: { getById: (id) => (id === stash.id ? stash : null) },
        Player: { getById: (id) => state.players.get(id) ?? null },
        setInterval: (fn) => { state.tick = fn; return 1; },
        clearInterval: () => { state.stopped = true; },
        Math,
        Number,
        String,
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/lockpick-wear.js"), "utf8"), context);
    context.exports.installLockpickWear(() => (queue.length > 0 ? queue.shift() : 0.99), () => clock.t);
    return { api: context.exports, handlers, chat, logs, taken, player, door, stash, state, clock };
}

const flush = () => new Promise((resolve) => setImmediate(resolve));

test("the attempt is never refused and costs nothing at the start: the minigame is played first (2026-10-28)", () => {
    const sut = load({ rolls: [0, 0] });
    assert.equal(sut.handlers.get("doorInteract")(sut.player, sut.door, "lockpick", true), undefined);
    assert.equal(sut.handlers.get("stashInteract")(sut.player, sut.stash, "lockpick"), undefined);
    assert.deepEqual(sut.taken, [], "a roll of 0 would have broken it at the start before");
    assert.deepEqual(sut.chat, []);
});

test("a chest that opens after the pick may break it: the lockpick goes out of the bag, the player is told, and it is seen from the lock's own state", async () => {
    const sut = load({ rolls: [0.1] });
    sut.handlers.get("stashInteract")(sut.player, sut.stash, "lockpick");
    sut.state.tick();
    assert.deepEqual(sut.taken, [], "still locked: the minigame goes on");
    sut.state.stashLocked = false;
    sut.state.tick();
    await flush();
    assert.deepEqual(sut.taken, [["player_lockpick", 1]]);
    assert.equal(sut.chat.length, 1);
    assert.match(sut.chat[0], /abriu, mas a gazua quebrou/);
    assert.ok(sut.logs.some((line) => /Ladrão quebrou uma gazua ao abrir a fechadura/.test(line)));
    sut.state.tick();
    assert.equal(sut.taken.length, 1, "once: the attempt is over");
});

test("a door that opens after the pick may break it too, and so does the first thing done at the door or the chest just opened", async () => {
    const door = load({ rolls: [0.2] });
    door.handlers.get("doorInteract")(door.player, door.door, "lockpick", true);
    door.state.doorLocked = false;
    door.state.tick();
    assert.deepEqual(door.taken, [["player_lockpick", 1]]);

    const viaOpen = load({ rolls: [0.2] });
    viaOpen.handlers.get("doorInteract")(viaOpen.player, viaOpen.door, "lockpick", true);
    viaOpen.handlers.get("doorInteract")(viaOpen.player, viaOpen.door, "open", true);
    assert.deepEqual(viaOpen.taken, [["player_lockpick", 1]], "the door's own open that follows the pick");

    const viaStash = load({ rolls: [0.2] });
    viaStash.handlers.get("stashInteract")(viaStash.player, viaStash.stash, "lockpick");
    viaStash.handlers.get("stashOpen")(viaStash.stash, viaStash.player);
    assert.deepEqual(viaStash.taken, [["player_lockpick", 1]], "the chest's open that a successful pick brings");
});

test("a pick that holds costs nothing, and neither does an attempt that fails or is given up", () => {
    const holds = load({ rolls: [0.9] });
    holds.handlers.get("stashInteract")(holds.player, holds.stash, "lockpick");
    holds.state.stashLocked = false;
    holds.state.tick();
    assert.deepEqual(holds.taken, []);
    assert.deepEqual(holds.chat, []);

    const gaveUp = load({ rolls: [0] });
    gaveUp.handlers.get("stashInteract")(gaveUp.player, gaveUp.stash, "lockpick");
    for (let look = 0; look < 5; look += 1) {
        gaveUp.clock.t += 60_000;
        gaveUp.state.tick();
    }
    gaveUp.state.stashLocked = false;
    gaveUp.state.tick();
    assert.deepEqual(gaveUp.taken, [], "followed for three minutes, then forgotten: a lock opened by someone else later is not this player's");
});

test("only an attempt is followed: a door or a chest opened with no pick is never touched, and other actions leave the attempt alone", () => {
    const sut = load({ rolls: [0, 0, 0, 0] });
    for (const action of ["open", "close", "unlock"]) {
        assert.equal(sut.handlers.get("doorInteract")(sut.player, sut.door, action, true), undefined);
    }
    assert.equal(sut.handlers.get("stashInteract")(sut.player, sut.stash, "open"), undefined);
    sut.handlers.get("stashOpen")(sut.stash, sut.player);
    sut.state.doorLocked = false;
    sut.state.tick();
    assert.deepEqual(sut.taken, []);

    // An attempt at one door is not ended by another door's opening.
    const other = load({ rolls: [0] });
    other.handlers.get("doorInteract")(other.player, other.door, "lockpick", true);
    other.handlers.get("doorInteract")(other.player, { guid: "00000000000000bb" }, "open", true);
    assert.deepEqual(other.taken, []);
});

test("a player with no lockpick in the bag, or an inventory that is not ready, is never followed", () => {
    const none = load({ rolls: [0], picks: 0 });
    none.handlers.get("doorInteract")(none.player, none.door, "lockpick", true);
    none.state.doorLocked = false;
    none.state.tick();
    const notReady = load({ rolls: [0], ready: false });
    notReady.handlers.get("stashInteract")(notReady.player, notReady.stash, "lockpick");
    notReady.state.stashLocked = false;
    notReady.state.tick();
    assert.deepEqual(none.taken.concat(notReady.taken), []);
});

test("a player who leaves, a door that is gone and a chest that is gone end the attempt quietly", () => {
    const left = load({ rolls: [0] });
    left.handlers.get("stashInteract")(left.player, left.stash, "lockpick");
    left.handlers.get("playerDisconnect")(left.player);
    left.state.stashLocked = false;
    left.state.tick();
    assert.deepEqual(left.taken, []);

    const gone = load({ rolls: [0] });
    gone.handlers.get("doorInteract")(gone.player, gone.door, "lockpick", true);
    gone.state.doorGone = true;
    gone.state.tick();
    gone.state.doorGone = false;
    gone.state.doorLocked = false;
    gone.state.tick();
    assert.deepEqual(gone.taken, [], "forgotten when it could not be read");

    const away = load({ rolls: [0] });
    away.handlers.get("stashInteract")(away.player, away.stash, "lockpick");
    away.state.players.clear();
    away.state.stashLocked = false;
    away.state.tick();
    assert.deepEqual(away.taken, []);
});

test("the chance is the one the settings say, and the game's XP for a lock is written down for the first few", () => {
    const sut = load({ rolls: [0.29, 0.31] });
    assert.equal(sut.api.lockpickWear.breakChance, 0.3);
    for (const [total, why] of [[1, "29 in 100 is under 30"], [1, "31 in 100 is not: still the one from before"]]) {
        sut.handlers.get("stashInteract")(sut.player, sut.stash, "lockpick");
        sut.state.stashLocked = false;
        sut.state.tick();
        sut.state.stashLocked = true;
        assert.equal(sut.taken.length, total, why);
    }
    sut.handlers.get("stashInteract")(sut.player, sut.stash, "lockpick");
    assert.equal(sut.handlers.get("playerXpGaining")(sut.player, "thievery", 6, "LockpickingResult"), undefined, "never refused");
    assert.equal(sut.handlers.get("playerXpGaining")(sut.player, "weapon_sword", 3, "Attack"), undefined);
    assert.equal(sut.logs.filter((line) => /deu 6 de experiência em thievery por arrombar \(tentativa seguida\)/.test(line)).length, 1);
    assert.equal(sut.logs.filter((line) => /por arrombar/.test(line)).length, 1, "only the lock's XP");
});

test("it stops with the resource", () => {
    const sut = load();
    sut.handlers.get("resourceStop")("outro");
    assert.equal(sut.state.stopped, false);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.state.stopped, true);
});
