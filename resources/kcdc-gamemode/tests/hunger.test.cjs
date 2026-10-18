const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const TICK = 15_000;

function load({ saved = null } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/hunger.json", saved);
    const writes = [];
    const handlers = new Map();
    const intervals = [];
    const cleared = [];
    const logs = [];
    const clock = { now: 1_000_000 };
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "./store.js");
            return {
                ensureDir() {},
                read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
                write: (file, body) => { writes.push([file, body]); files.set(file, JSON.stringify(body)); },
            };
        },
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => cleared.push(id),
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => [] },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/hunger.js"), "utf8"), context);
    const pace = (level) => new context.exports.HungerPace(level, () => clock.now);
    return { api: context.exports, handlers, intervals, cleared, logs, writes, clock, pace, context };
}

let nextId = 1;
function eater(hunger = 100, over = {}) {
    return {
        id: nextId++,
        ready: true,
        alive: true,
        hunger,
        maxHunger: 100,
        sets: [],
        setHunger(value) { this.sets.push(value); this.hunger = value; return true; },
        ...over,
    };
}

test("levels are told by name, accents and all, and a word that is none is refused", () => {
    const { api } = load();
    for (const [word, level] of [["media", "media"], ["Média", "media"], ["MEDIO", "media"], ["leve", "leve"], ["forte", "forte"], ["difícil", "forte"], ["desligada", "desligada"], ["off", "desligada"]]) {
        assert.equal(api.parseLevel(word), level, word);
    }
    assert.equal(api.parseLevel("brutal"), null);
    assert.equal(api.parseLevel(""), null);
    assert.equal(api.HUNGER_LEVELS.media.minutes, 180);
    assert.equal(api.DEFAULT_LEVEL, "media");
});

test("the first look only notes the stomach; the next charges what the time that passed asks for", () => {
    const sut = load();
    const pace = sut.pace("media");
    const player = eater(100);

    pace.tick([player]);
    assert.deepEqual(player.sets, [], "nothing to charge on the first look");

    sut.clock.now += TICK;
    pace.tick([player]);
    assert.equal(player.sets.length, 1);
    // A full stomach lasts 180 minutes: 15 seconds of it is 100 * 15 / 10800.
    assert.ok(Math.abs(player.sets[0] - (100 - (100 * 15) / 10800)) < 1e-9);
});

test("a full stomach lasts the level's time, to within a hair", () => {
    for (const [level, minutes] of [["leve", 300], ["media", 180], ["forte", 100]]) {
        const sut = load();
        const pace = sut.pace(level);
        const player = eater(100);
        pace.tick([player]);
        for (let tick = 0; tick < (minutes * 60 * 1000) / TICK / 2; tick += 1) {
            sut.clock.now += TICK;
            pace.tick([player]);
        }
        assert.ok(Math.abs(player.hunger - 50) < 0.5, `${level}: half the time takes half the stomach, got ${player.hunger}`);
    }
});

test("eating raises it as usual, and the charge goes on from there", () => {
    const sut = load();
    const pace = sut.pace("media");
    const player = eater(40);
    pace.tick([player]);
    sut.clock.now += TICK;
    pace.tick([player]);
    const afterFirst = player.hunger;

    player.hunger = 90; // a meal
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.ok(player.hunger < 90 && player.hunger > 89.8, `charged from the meal, not from before it: ${player.hunger}`);
    assert.ok(afterFirst < 40);
});

test("what the game wore away by itself counts toward the charge, so the pace is the level's either way", () => {
    const sut = load();
    const pace = sut.pace("media");
    const player = eater(100);
    pace.tick([player]);

    // The game alone took more than the 0.139 this interval asks for.
    sut.sets = 0;
    player.hunger = 99.5;
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.deepEqual(player.sets, [], "nothing is added on top of what the game already took");

    // The game took part of it: only the rest is charged.
    player.hunger = player.hunger - 0.05;
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.equal(player.sets.length, 1);
    assert.ok(Math.abs(player.sets[0] - (99.45 - (100 * 15) / 10800 + 0.05)) < 1e-9, `the 0.05 the game took is not charged again: ${player.sets[0]}`);
});

test("a switched-off level charges nothing and a level change starts the looks afresh", () => {
    const sut = load();
    const pace = sut.pace("desligada");
    const player = eater(100);
    pace.tick([player]);
    sut.clock.now += TICK * 4;
    pace.tick([player]);
    assert.deepEqual(player.sets, []);

    pace.setLevel("forte");
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.deepEqual(player.sets, [], "the first look at a new level only notes");
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.equal(player.sets.length, 1);
});

test("nobody is charged while their body is not ready or they are dead, and they start afresh when they are back", () => {
    const sut = load();
    const pace = sut.pace("forte");
    const player = eater(80);
    pace.tick([player]);

    player.alive = false;
    sut.clock.now += TICK * 10;
    pace.tick([player]);
    assert.deepEqual(player.sets, []);

    player.alive = true;
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.deepEqual(player.sets, [], "back, and only looked at: the time they were dead is not charged");

    const loading = eater(80, { ready: false });
    pace.tick([loading]);
    sut.clock.now += TICK;
    pace.tick([loading]);
    assert.deepEqual(loading.sets, []);
});

test("an empty stomach is left as it is, for the game to deal with, and a stall is not made up for", () => {
    const sut = load();
    const pace = sut.pace("forte");
    const empty = eater(0);
    pace.tick([empty]);
    sut.clock.now += TICK;
    pace.tick([empty]);
    assert.deepEqual(empty.sets, []);

    const player = eater(100);
    pace.tick([player]);
    sut.clock.now += 20 * 60_000; // the server hung for twenty minutes
    pace.tick([player]);
    // Three ticks' worth at most: 100 * 45 / 6000 = 0.75
    assert.ok(Math.abs(100 - player.hunger - 0.75) < 1e-9, `charged ${100 - player.hunger}`);
});

test("a player who leaves is forgotten, and a scale other than 100 is respected", () => {
    const sut = load();
    const pace = sut.pace("media");
    const big = eater(500, { maxHunger: 500 });
    pace.tick([big]);
    sut.clock.now += TICK;
    pace.tick([big]);
    assert.ok(Math.abs(500 - big.hunger - (500 * 15) / 10800) < 1e-9, "the charge is a share of the stomach, whatever its size");

    pace.tick([]);
    sut.clock.now += TICK;
    pace.tick([big]);
    assert.equal(big.sets.length, 1, "after leaving and coming back it is only looked at");
});

test("the level is read from disk at start, kept when it is changed, and the timer stops with the resource", () => {
    const sut = load({ saved: JSON.stringify({ level: "forte", paused: false }) });
    sut.api.installHunger();
    assert.equal(sut.api.hungerPace.level, "forte");
    assert.equal(sut.intervals[0].ms, 15_000);
    assert.ok(sut.logs.some((line) => /hunger: Fome forte/.test(line)));

    sut.api.chooseLevel("leve");
    assert.equal(sut.api.hungerPace.level, "leve");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.writes.at(-1))), ["playerdata/hunger.json", { level: "leve", paused: false }]);

    sut.handlers.get("resourceStop")("outro-recurso");
    assert.equal(sut.cleared.length, 0);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.equal(sut.cleared.length, 1);
});

test("with nothing saved, or something unreadable, the level is the medium one", () => {
    const fresh = load();
    fresh.api.installHunger();
    assert.equal(fresh.api.hungerPace.level, "media");

    const odd = load({ saved: JSON.stringify({ level: "enorme", paused: false }) });
    odd.api.installHunger();
    assert.equal(odd.api.hungerPace.level, "media");
    assert.match(odd.api.hungerPace.describe(), /Fome média: um estômago cheio dura 3 h/);
});

test("a sleeping body pays only the pace: the hunger the game's sleep takes off for the hours it skips is put back", () => {
    const { clock, pace } = load();
    const sut = pace("media");
    const player = eater(100);
    sut.tick([player]);

    clock.now += TICK;
    player.sleeping = 1;
    player.hunger = 60; // the game ran 8 hours in a few minutes and took 40
    sut.tick([player]);
    assert.equal(player.sets.length, 1, "put back");
    assert.ok(Math.abs(player.sets[0] - (100 - (100 * 15) / (180 * 60))) < 1e-6, String(player.sets[0]));

    // The next look, still asleep, charges the pace alone again.
    clock.now += TICK;
    player.hunger = 20;
    sut.tick([player]);
    assert.equal(player.sets.length, 2);
    assert.ok(Math.abs(player.sets[0] - player.sets[1] - (100 * 15) / (180 * 60)) < 1e-6, "one more pace step, no more");
});

test("a sleeping body that eats is not put back: what is higher than the pace holds", () => {
    const { clock, pace } = load();
    const sut = pace("media");
    const player = eater(50);
    sut.tick([player]);
    clock.now += TICK;
    player.sleeping = 1;
    player.hunger = 80;
    sut.tick([player]);
    assert.deepEqual(player.sets, [], "fed meanwhile: nothing taken back");
});

test("hunger runs when nothing says otherwise, and a pause that was saved stays", () => {
    const fresh = load();
    fresh.api.installHunger();
    assert.equal(fresh.api.hungerPace.paused, false);

    const old = load({ saved: JSON.stringify({ level: "forte" }) });
    old.api.installHunger();
    assert.equal(old.api.hungerPace.paused, false, "a file written before the pause existed is not paused");
    assert.equal(old.api.hungerPace.level, "forte");

    const kept = load({ saved: JSON.stringify({ level: "leve", paused: true }) });
    kept.api.installHunger();
    assert.equal(kept.api.hungerPace.paused, true, "an administrator's pause is kept");
    assert.match(kept.api.hungerPace.describe(), /Fome pausada: a saciedade de todos fica em 100%/);
});

test("while paused every living, ready stomach is brought back to full and nothing is charged", () => {
    const sut = load();
    const pace = sut.pace("forte");
    pace.paused = true;

    const hungry = eater(37);
    const full = eater(100);
    const dead = eater(10, { alive: false });
    const loading = eater(10, { ready: false });
    const big = eater(120, { maxHunger: 500 });
    pace.tick([hungry, full, dead, loading, big]);
    assert.deepEqual(hungry.sets, [100]);
    assert.deepEqual(full.sets, [], "a full one is left alone");
    assert.deepEqual(dead.sets, []);
    assert.deepEqual(loading.sets, []);
    assert.deepEqual(big.sets, [500], "full is the player's own capacity");

    sut.clock.now += TICK * 20;
    pace.tick([hungry, full]);
    assert.equal(hungry.hunger, 100);
    assert.deepEqual(full.sets, [], "the time that passes charges nothing");
});

test("ending the pause lets the level charge again, from a fresh look", () => {
    const sut = load();
    const pace = sut.pace("media");
    const player = eater(100);
    pace.paused = true;
    pace.tick([player]);
    pace.paused = false;
    pace.tick([player]);
    assert.deepEqual(player.sets, [], "the first look only notes");
    sut.clock.now += TICK;
    pace.tick([player]);
    assert.equal(player.sets.length, 1);
});

test("choosing the pause is kept with the level, and the level chosen during a pause is kept too", () => {
    const sut = load();
    sut.api.installHunger();
    sut.api.choosePaused(false);
    assert.equal(sut.api.hungerPace.paused, false);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.writes.at(-1))), ["playerdata/hunger.json", { level: "media", paused: false }]);
    sut.api.choosePaused(true);
    sut.api.chooseLevel("leve");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.writes.at(-1))), ["playerdata/hunger.json", { level: "leve", paused: true }]);
});
