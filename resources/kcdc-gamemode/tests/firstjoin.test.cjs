const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SAVED = { gender: "male", head: "m_head_032_b00", hair: "m_hair_006_dark_brown", beard: "m_beard_19", body: "henry_injured_left_shoulder_ingame" };
const DEFAULT_HENRY = { gender: "male", head: "", hair: "", beard: "", body: "" };

function load(savedLook) {
    const handlers = new Map();
    const state = {
        now: 1_000_000,
        ticks: new Map(),
        nextTimer: 1,
        chat: [],
        opened: [],
        store: savedLook ? { 765: { appearance: savedLook } } : {},
        players: new Map(),
        logs: [],
    };

    const modules = {
        "./characters.js": { getCharacter: (steamId) => state.store[steamId] ?? null },
        "./creator.js": { openCreatorFor: (player, genders) => state.opened.push({ player, genders }) },
    };
    const context = {
        exports: {},
        require: (id) => modules[id],
        console: { log: (line) => state.logs.push(line) },
        Date: { now: () => state.now },
        setInterval: (fn) => {
            const id = state.nextTimer++;
            state.ticks.set(id, fn);
            return id;
        },
        clearInterval: (id) => state.ticks.delete(id),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Player: { getById: (id) => state.players.get(id) ?? null },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/first-join.js"), "utf8"), context);
    context.exports.installFirstJoin();

    /** Moves the clock in the watch's own two second steps. */
    const advance = (ms) => {
        for (let spent = 0; spent < ms; spent += 2000) {
            state.now += 2000;
            for (const tick of [...state.ticks.values()]) tick();
        }
    };
    return { handlers, state, advance };
}

function makePlayer(published, { accepts = true } = {}) {
    const player = {
        id: 4143,
        steamId: "765",
        nickname: "Mauro",
        ready: true,
        appearance: published,
        sends: [],
        setAppearance(look) {
            player.sends.push(look);
            return accepts;
        },
    };
    return player;
}

function spawn(load, player) {
    load.state.players.set(player.id, player);
    load.handlers.get("playerSpawned")(player);
}

test("a returning player's look is sent at once when the client reports something else, then again at fixed moments", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...DEFAULT_HENRY });
    spawn(world, player);

    world.advance(2000);
    assert.equal(player.sends.length, 1);
    assert.deepEqual(player.sends[0], SAVED);

    // the client now says the look is on, but the game may still dress Henry at the end of loading,
    // so the moments at 6, 12, 20 and 30 seconds send it anyway
    player.appearance = { ...SAVED };
    world.advance(4000);
    assert.equal(player.sends.length, 2);
    world.advance(6000);
    assert.equal(player.sends.length, 3);
    world.advance(8000);
    assert.equal(player.sends.length, 4);
    world.advance(10_000);
    assert.equal(player.sends.length, 5);

    world.advance(10_000);
    assert.equal(world.state.ticks.size, 0, "the watch ends");
    assert.equal(player.sends.length, 5);
    assert.equal(world.state.opened.length, 0);
});

test("a look the client stops reporting is sent again, but never more often than every four seconds", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...SAVED });
    spawn(world, player);

    world.advance(4000);
    assert.equal(player.sends.length, 0);

    player.appearance = { ...DEFAULT_HENRY };
    world.advance(2000);
    assert.equal(player.sends.length, 1, "the 6 second moment");

    world.advance(2000);
    assert.equal(player.sends.length, 1, "too soon after the last send");
    world.advance(2000);
    assert.equal(player.sends.length, 2);
});

test("a part the saved look leaves empty is not compared against what the client reports", () => {
    const partial = { gender: "male", head: "m_head_032_b00", hair: "", beard: "", body: "" };
    const world = load(partial);
    const player = makePlayer({ gender: "male", head: "m_head_032_b00", hair: "m_hair_001", beard: "m_beard_02", body: "henry_default" });
    spawn(world, player);

    world.advance(4000);
    assert.equal(player.sends.length, 0);
    world.advance(2000);
    assert.equal(player.sends.length, 1);
});

test("a look the game keeps refusing is written off after three tries", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...DEFAULT_HENRY }, { accepts: false });
    spawn(world, player);

    world.advance(60_000);
    assert.equal(player.sends.length, 3);
    assert.equal(world.state.ticks.size, 0);
    assert.ok(world.state.logs.some((line) => line.includes("refused")));
});

test("nothing is sent before the body is ready, and the moments that went by count as one", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...SAVED });
    player.ready = false;
    spawn(world, player);

    world.advance(14_000);
    assert.equal(player.sends.length, 0);

    player.ready = true;
    world.advance(2000);
    assert.equal(player.sends.length, 1);
});

test("the watch ends when the player leaves", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...DEFAULT_HENRY });
    spawn(world, player);
    world.advance(2000);

    world.state.players.delete(player.id);
    world.advance(2000);
    assert.equal(world.state.ticks.size, 0);
});

test("a look accepted in the creator during the watch is the one that gets sent next", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...SAVED });
    spawn(world, player);

    const newLook = { ...SAVED, hair: "m_hair_010_blond" };
    world.state.store[765] = { appearance: newLook };
    world.advance(6000);

    assert.ok(player.sends.length >= 1);
    for (const sent of player.sends) assert.deepEqual(sent, newLook);
});

test("a player with no saved look is asked for one and nothing is watched", () => {
    const world = load(null);
    const player = makePlayer({ ...DEFAULT_HENRY });
    spawn(world, player);

    assert.equal(world.state.opened.length, 1);
    assert.equal(world.state.opened[0].genders, "both");
    assert.equal(world.state.chat.length, 1);
    assert.equal(world.state.ticks.size, 0);
    world.advance(10_000);
    assert.equal(player.sends.length, 0);
});
