const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const SAVED = { gender: "male", head: "m_head_032_b00", hair: "m_hair_006_dark_brown", beard: "m_beard_19", body: "henry_injured_left_shoulder_ingame" };
const DEFAULT_HENRY = { gender: "male", head: "", hair: "", beard: "", body: "" };

function load(savedLook, { behindDoor = false, incomplete = false } = {}) {
    const handlers = new Map();
    /** The door of the server (entry.ts): whoever is behind it waits, and the callback runs when it opens. */
    const door = { waiting: new Map(), pending: behindDoor };
    const state = {
        now: 1_000_000,
        ticks: new Map(),
        nextTimer: 1,
        chat: [],
        opened: [],
        // A character of these tests says its age and height (2026-11-02), unless the test is about one that does not.
        store: savedLook ? { 765: { appearance: savedLook, ...(incomplete ? {} : { age: 30, height: 175 }) } } : {},
        players: new Map(),
        logs: [],
    };

    const modules = {
        "./characters.js": { getCharacter: (steamId) => state.store[steamId] ?? null },
        "./creator.js": { openCreatorFor: (player, genders) => state.opened.push({ player, genders }) },
        "./entry.js": { whenAdmitted: (player, then) => (door.pending ? door.waiting.set(player.id, then) : then()) },
        "./character-details.js": (() => {
            const box = { exports: {} };
            vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/character-details.js"), "utf8"), box);
            return box.exports;
        })(),
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
    return { handlers, state, advance, door };
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
    assert.equal(world.state.ticks.size, 1, "the watch goes on, in case a slow client dresses Henry after the moments");
    assert.equal(player.sends.length, 5);
    player.appearance = { ...DEFAULT_HENRY };
    world.advance(4000);
    assert.equal(player.sends.length, 6, "and a look the client no longer reports is sent again");
    player.appearance = { ...SAVED };
    world.advance(100_000);
    assert.equal(world.state.ticks.size, 0, "the watch ends");
    assert.equal(player.sends.length, 6);
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

test("nothing is sent before the body is ready; a body that is ready late is given its look, the moments counted from then", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...SAVED });
    player.ready = false;
    spawn(world, player);

    world.advance(14_000);
    assert.equal(player.sends.length, 0);

    player.ready = true;
    world.advance(2000);
    assert.equal(player.sends.length, 0, "just ready: the game has not yet dressed Henry");
    world.advance(2000);
    assert.equal(player.sends.length, 1, "the first moment after it");
});

test("a body that takes over a minute to be ready (a slow machine, a late server) still gets the look, and is watched from then on (2026-10-25)", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...DEFAULT_HENRY });
    player.ready = false;
    spawn(world, player);

    world.advance(100_000);
    assert.equal(player.sends.length, 0);
    assert.equal(world.state.ticks.size, 1, "the old 36 s watch would have ended long ago, with `sent 0 time(s)`");

    player.ready = true;
    world.advance(2000);
    assert.equal(player.sends.length, 1, "at once, the client reporting Henry");
    assert.deepEqual(player.sends[0], SAVED);
    world.advance(60_000);
    assert.ok(player.sends.length >= 4, "and at the moments after it");
    world.advance(100_000);
    assert.equal(world.state.ticks.size, 0, "then the watch ends");
});

test("a body that is never ready is given up after five minutes", () => {
    const world = load(SAVED);
    const player = makePlayer({ ...DEFAULT_HENRY });
    player.ready = false;
    spawn(world, player);
    world.advance(5 * 60_000 + 4000);
    assert.equal(world.state.ticks.size, 0);
    assert.equal(player.sends.length, 0);
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

test("a character an administrator asked to be made again opens the creator at the next entry, and the old look is not forced on", () => {
    const world = load(SAVED);
    world.state.store[765].redo = true;
    const player = makePlayer({ ...DEFAULT_HENRY });
    spawn(world, player);

    assert.equal(world.state.opened.length, 1);
    assert.match(world.state.chat[0], /refaça o seu personagem/);
    assert.equal(world.state.ticks.size, 0, "no watch pressing the old look over the creator's");
    world.advance(10_000);
    assert.equal(player.sends.length, 0);
    assert.ok(world.state.logs.some((line) => /Mauro vai refazer o personagem/.test(line)));
});

test("a newcomer behind the door of the server (the questions) gets the creator only when the door opens; a returning player's look is sent meanwhile (2026-10-29)", () => {
    const behind = load(null, { behindDoor: true });
    const newcomer = makePlayer(DEFAULT_HENRY);
    behind.handlers.get("playerSpawned")(newcomer);
    assert.equal(behind.state.opened.length, 0, "no creator while the questions are open");
    assert.equal(behind.door.waiting.size, 1);
    behind.handlers.get("playerSpawned")(newcomer);
    assert.equal(behind.door.waiting.size, 1, "asked again at a respawn: still one wait");
    behind.door.waiting.get(newcomer.id)();
    assert.equal(behind.state.opened.length, 1, "the door opened: the creator");
    assert.match(behind.state.chat[0], /Vamos criar o seu personagem/);

    const returning = load(SAVED, { behindDoor: true });
    const old = makePlayer(DEFAULT_HENRY);
    spawn(returning, old);
    returning.advance(8_000);
    assert.ok(old.sends.length > 0, "the saved look goes on the body behind the page of the door, as before");
    assert.equal(returning.door.waiting.size, 0, "and no creator waits for him");
});

test("a character made before the age and the height were asked gets the creator once the door lets it through, and its saved look is not pushed over the creator's (2026-11-02)", () => {
    const sut = load(SAVED, { incomplete: true, behindDoor: true });
    const player = makePlayer(DEFAULT_HENRY);
    sut.state.players.set(player.id, player);
    sut.handlers.get("playerSpawned")(player);
    assert.equal(sut.state.opened.length, 0, "not before the door");
    sut.door.waiting.get(player.id)();
    assert.equal(sut.state.opened.length, 1);
    assert.equal(sut.state.opened[0].genders, "both");
    assert.ok(sut.state.chat.some((line) => /agora tem idade e altura/.test(line)), sut.state.chat.join("|"));
    assert.ok(sut.state.logs.some((line) => /vai completar o personagem/.test(line)));
    sut.advance(40_000);
    assert.equal(player.sends.length, 0, "the creator puts the look on, not the watch of the saved one");
});
