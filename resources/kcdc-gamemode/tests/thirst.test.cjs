const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { lowered, torch } = require("./torchstub.cjs");
require("./reachpatch.cjs");

// Thirst (src/server/thirst.ts): the measure that falls with the clock, the buffs at each step, the failing body, what quenches it (the
// game's drinks, a river), what is kept between sessions and what the panel is told.

const TICK = 15_000;
const WATER = "0cb47176-06c5-42a9-8d70-969e917eb999";
const BEER = "52afd6fa-9377-457c-83a2-b5b39321a4dc";

function load({ saved = null, registerThrowsWithModifiers = false, registerThrows = false, rows = [] } = {}) {
    const files = new Map();
    if (saved !== null) files.set("playerdata/thirst.json", JSON.stringify(saved));
    const writes = [];
    const handlers = new Map();
    const clientHandlers = new Map();
    const intervals = [];
    const cleared = [];
    const logs = [];
    const registered = [];
    const said = [];
    const clock = { now: 1_000_000 };
    const later = [];
    let players = [];
    const driver = {
        files,
        context: null,
    };
    const context = {
        exports: {},
        require: (id) => {
            if (id === "./torch-down.js") return torch;
            if (id === "./store.js") {
                return {
                    ensureDir() {},
                    read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)) } : { status: "missing" }),
                    write: (file, body) => { writes.push([file, body]); files.set(file, JSON.stringify(body)); },
                };
            }
            return vm.runInNewContext(`(function(){var exports={};${fs.readFileSync(path.join(__dirname, "../dist/server/drink-data.js"), "utf8")};return exports;})()`, {});
        },
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval: (id) => cleared.push(id),
        setTimeout: (fn, ms) => { later.push({ fn, ms }); },
        Events: {
            on: (name, fn) => handlers.set(name, fn),
            onClient: (name, fn) => clientHandlers.set(name, fn),
        },
        Player: { all: () => players },
        Chat: { sendToPlayer: (player, text) => said.push([player.id, text]) },
        Buffs: {
            register: (id, definition) => {
                if (registerThrows || (registerThrowsWithModifiers && definition.modifiers !== undefined)) throw new Error("no");
                registered.push([id, definition]);
                return `guid-of-${id}`;
            },
        },
        Animations: { list: (fragment) => rows.filter((row) => row.fragment.toLowerCase().includes(fragment.toLowerCase())) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/thirst.js"), "utf8"), context);
    const make = () => new context.exports.ThirstPace(() => clock.now, (fn, ms) => later.push({ fn, ms }), (player, text) => said.push([player.id, text]), (fragment) => rows.filter((row) => row.fragment === fragment));
    return { api: context.exports, handlers, clientHandlers, intervals, cleared, logs, writes, clock, make, registered, said, later, files, setPlayers: (list) => { players = list; }, driver };
}

let nextId = 1;
function body(over = {}) {
    const player = {
        id: nextId++,
        steamId: `7656119800000${String(nextId).padStart(4, "0")}`,
        ready: true,
        alive: true,
        health: 100,
        maxHealth: 100,
        mounted: false,
        sleeping: 0,
        position: { x: 10, y: 20, z: 5 },
        appearance: { gender: "male" },
        buffs: new Set(),
        sent: [],
        played: [],
        stopped: 0,
        setHealth(value) { this.health = value; return true; },
        hasBuff(buff) { return this.buffs.has(buff); },
        addBuff(buff) { this.buffs.add(buff); return true; },
        removeBuff(buff) { this.buffs.delete(buff); return true; },
        emit(event, payload) { this.sent.push([event, JSON.parse(payload)]); },
        playAnimation(fragment, options) { this.played.push([fragment, options]); return true; },
        stopAnimation() { this.stopped += 1; },
        ...over,
    };
    return player;
}

const minutes = (sut, count, pace, players) => {
    for (let i = 0; i < (count * 60_000) / TICK; i += 1) {
        sut.clock.now += TICK;
        pace.tick(players);
    }
};

test("a body is quenched at first, and the clock dries it: a hundred points in 150 minutes", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    assert.equal(pace.value(player), 100);

    pace.tick([player]);
    minutes(sut, 15, pace, [player]);
    assert.ok(Math.abs(pace.value(player) - 90) < 0.3, `${pace.value(player)}`);

    minutes(sut, 135, pace, [player]);
    assert.equal(pace.value(player), 0, "dry at the end, and never below");
});

test("asleep it dries half as fast, and a stall is not made up for", () => {
    const sut = load();
    const pace = sut.make();
    const player = body({ sleeping: 1 });
    pace.tick([player]);
    minutes(sut, 15, pace, [player]);
    assert.ok(Math.abs(pace.value(player) - 95) < 0.3, `${pace.value(player)}`);

    const stalled = load();
    const slow = stalled.make();
    const other = body();
    slow.tick([other]);
    stalled.clock.now += 60 * 60_000;
    slow.tick([other]);
    assert.ok(slow.value(other) >= 100 - (3 * 15 * 100) / (150 * 60) - 0.01, "one hour of silence is charged three ticks");
});

test("a body is thirsty under 30, parched under 10, with the buff of the step and a word, and is not thirsty again until 40", () => {
    const sut = load();
    const pace = sut.make();
    pace.buffs = { thirsty: "B1", parched: "B2" };
    const player = body();
    pace.tick([player]);

    pace.set(player, 29);
    pace.tick([player]);
    assert.deepEqual([...player.buffs], ["B1"]);
    assert.ok(sut.said.some(([, text]) => /sente sede/.test(text)));

    pace.set(player, 9);
    pace.tick([player]);
    assert.deepEqual([...player.buffs], ["B2"], "the other step goes");
    assert.ok(sut.said.some(([, text]) => /boca está seca/.test(text)));

    pace.set(player, 35);
    pace.tick([player]);
    assert.deepEqual([...player.buffs], ["B1"], "still thirsty between 30 and 40");

    pace.set(player, 41);
    pace.tick([player]);
    assert.deepEqual([...player.buffs], [], "recovered");
    assert.ok(sut.said.some(([, text]) => /sede passou/.test(text)));
});

test("a body that lost its buff (a new body, a death) is given it again at the next look", () => {
    const sut = load();
    const pace = sut.make();
    pace.buffs = { thirsty: "B1", parched: "B2" };
    const player = body();
    pace.set(player, 20);
    pace.tick([player]);
    player.buffs.clear();
    pace.tick([player]);
    assert.deepEqual([...player.buffs], ["B1"]);
});

test("at 0 the body fails: two in a hundred of its health at each look, never below a fifth", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    pace.tick([player]);
    pace.set(player, 0);
    pace.tick([player]);
    assert.equal(player.health, 98);
    for (let i = 0; i < 100; i += 1) {
        pace.tick([player]);
    }
    assert.equal(player.health, 20, "thirst alone does not kill");

    const well = body();
    pace.tick([well]);
    pace.tick([well]);
    assert.equal(well.health, 100, "a quenched body loses nothing");
});

test("the game's drinks quench by their kind, water most, and what is no drink does nothing", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    pace.set(player, 10);
    assert.equal(pace.consumed(player, WATER), 45);
    assert.equal(pace.value(player), 55);
    assert.equal(pace.consumed(player, BEER.toUpperCase()), 18, "the GUID in any case");
    assert.equal(pace.value(player), 73);
    assert.equal(pace.consumed(player, "00000000-0000-0000-0000-000000000000"), 0);
    assert.equal(pace.value(player), 73);
    pace.set(player, 95);
    pace.consumed(player, WATER);
    assert.equal(pace.value(player), 100, "never past full");
    assert.ok(sut.api.GAINS.water > sut.api.GAINS.milk && sut.api.GAINS.milk > sut.api.GAINS.beer && sut.api.GAINS.beer > sut.api.GAINS.wine && sut.api.GAINS.wine > sut.api.GAINS.liquor);
});

test("thirst switched off: everybody reads full, nothing dries and no buff stays", () => {
    const sut = load();
    const pace = sut.make();
    pace.buffs = { thirsty: "B1", parched: "B2" };
    const player = body();
    pace.set(player, 5);
    pace.tick([player]);
    assert.ok(player.buffs.has("B2"));

    pace.enabled = false;
    pace.tick([player]);
    assert.equal(pace.value(player), 100);
    assert.deepEqual([...player.buffs], []);
    assert.equal(pace.consumed(player, WATER), 0);
    assert.match(pace.describe(), /desligada/);
    assert.equal(pace.drinkFromWater(player, { x: 10, y: 20, z: 5 }), "A sede está desligada neste servidor.");
});

test("a body that dies comes back with at least a mouthful, and the panel is told the measure at each look", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    pace.tick([player]);
    pace.set(player, 3);
    pace.died(player);
    assert.equal(pace.value(player), 60);
    pace.set(player, 80);
    pace.died(player);
    assert.equal(pace.value(player), 80, "nothing taken from one who has more");

    const before = player.sent.length;
    pace.tick([player]);
    pace.tick([player]);
    assert.equal(player.sent.length, before + 2, "told at every look, for a client that came up late");
    assert.equal(player.sent.at(-1)[0], "kcdc-gamemode:thirst.value");
    assert.equal(typeof player.sent.at(-1)[1].v, "number");
});

test("a character's measure is kept by Steam id and comes back at the next entry; the file is written and read again", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    pace.tick([player]);
    pace.set(player, 42);
    assert.equal(pace.kept.get(player.steamId), 42);

    const back = body({ id: 999, steamId: player.steamId });
    pace.restore(back);
    assert.equal(pace.value(back), 42);

    const stranger = body({ id: 1000, steamId: "76561198000099999" });
    pace.restore(stranger);
    assert.equal(pace.value(stranger), 100, "a newcomer is quenched");
});

test("water drunk where it runs: one drink at a time, near enough, for one who is thirsty; the animation of the body, then the gain", () => {
    const rows = [
        { fragment: "WaterTubDrinking", tags: "female", duration: 5, oneShot: true, male: false, female: true },
        { fragment: "WaterTubDrinking", tags: "male", duration: 5.2, oneShot: true, male: true, female: false },
        { fragment: "WashFace", tags: "", duration: 4, oneShot: true, male: true, female: true },
    ];
    const sut = load({ rows });
    const pace = sut.make();
    const player = body();
    pace.set(player, 50);

    assert.equal(pace.drinkFromWater(player, { x: 40, y: 20, z: 5 }), "A água está longe demais.");
    assert.equal(pace.drinkFromWater(body({ mounted: true }), { x: 10, y: 20, z: 5 }), "Agora não.");
    const full = body();
    pace.set(full, 99);
    assert.equal(pace.drinkFromWater(full, { x: 10, y: 20, z: 5 }), "Você não está com sede.");
    assert.equal(pace.drinkFromWater(player, { x: NaN, y: 20, z: 5 }), "A água está longe demais.");

    const heldBefore = lowered.length;
    assert.equal(pace.drinkFromWater(player, { x: 12, y: 21, z: 4.5 }), null);
    assert.equal(lowered.length - heldBefore, 1, "a torch in the hand is put away before the drinking (2026-10-25)");
    assert.deepEqual(JSON.parse(JSON.stringify(player.played)), [["WaterTubDrinking", { tags: "male" }]], "the man's variant of the first fragment the body has");
    assert.equal(pace.drinkFromWater(player, { x: 12, y: 21, z: 4.5 }), "Com calma: um gole de cada vez.");
    assert.equal(pace.value(player), 50, "nothing yet: the drink takes its time");

    const wait = sut.later.at(-1);
    assert.equal(wait.ms, 5200);
    wait.fn();
    assert.equal(pace.value(player), 90);
    assert.equal(player.stopped, 1);
    assert.ok(sut.said.some(([id, text]) => id === player.id && /matou a sede na água \(90%\)/.test(text)));

    assert.equal(pace.drinkFromWater(player, { x: 12, y: 21, z: 4.5 }), "Com calma: um gole de cada vez.", "and not at once again");
    sut.clock.now += 7_000;
    assert.equal(pace.drinkFromWater(player, { x: 12, y: 21, z: 4.5 }), null, "90 is still a thirst a drink can ease");
    sut.later.at(-1).fn();
    assert.equal(pace.value(player), 100);
    sut.clock.now += 7_000;
    assert.equal(pace.drinkFromWater(player, { x: 12, y: 21, z: 4.5 }), "Você não está com sede.", "full is quenched enough");
});

test("a woman drinks with her own variant, and a body with no such animation still drinks, in three seconds", () => {
    const rows = [
        { fragment: "WaterTubDrinking", tags: "female", duration: 5, oneShot: true, male: false, female: true },
        { fragment: "CampDrinkSpruit", tags: "", duration: 30, oneShot: false, male: true, female: true },
    ];
    const sut = load({ rows });
    const pace = sut.make();
    const woman = body({ appearance: { gender: "female" } });
    pace.set(woman, 20);
    assert.equal(pace.drinkFromWater(woman, { x: 10, y: 20, z: 5 }), null);
    assert.deepEqual(JSON.parse(JSON.stringify(woman.played)), [["WaterTubDrinking", { tags: "female" }]]);

    const bare = load({ rows: [] });
    const other = bare.make();
    const man = body();
    other.set(man, 20);
    assert.equal(other.drinkFromWater(man, { x: 10, y: 20, z: 5 }), null);
    assert.deepEqual(man.played, [], "no animation to play");
    assert.equal(bare.later.at(-1).ms, 3000);
    bare.later.at(-1).fn();
    assert.equal(other.value(man), 60);

    const looped = load({ rows: [{ fragment: "WaterTubDrinking", tags: "", duration: 30, oneShot: false, male: true, female: true }] });
    assert.equal(looped.make().pick(body()), null, "a loop is not a drink: it would never end");
});

test("a player who leaves before the drink ends gets nothing and leaves nothing behind", () => {
    const sut = load();
    const pace = sut.make();
    const player = body();
    pace.set(player, 20);
    assert.equal(pace.drinkFromWater(player, { x: 10, y: 20, z: 5 }), null);
    pace.left(player);
    sut.later.at(-1).fn();
    assert.equal(pace.value(player), 100, "the full measure of one nothing is known of");
    assert.equal(player.stopped, 0);
});

test("starting registers the two buffs with the game's icon, and falls back to plain ones, or to none", () => {
    const sut = load();
    sut.api.installThirst();
    assert.deepEqual(sut.registered.map(([id]) => id), ["kcdc-gamemode:sede", "kcdc-gamemode:desidratacao"]);
    assert.equal(sut.registered[0][1].visual, "hangover");
    assert.equal(sut.registered[0][1].duration, -1);
    assert.deepEqual(Object.keys(sut.registered[1][1].modifiers).sort(), ["maxStamina", "runSpeed", "staminaRegeneration"]);
    assert.ok(["playerReady", "playerDisconnect", "playerDied", "playerConsumed", "resourceStop"].every((name) => sut.handlers.has(name)));
    assert.ok(sut.clientHandlers.has("kcdc-gamemode:thirst.drink"));
    assert.deepEqual(sut.intervals.map((one) => one.ms), [TICK, 60_000]);

    const plain = load({ registerThrowsWithModifiers: true });
    plain.api.installThirst();
    assert.equal(plain.registered.length, 2);
    assert.equal(plain.registered[0][1].modifiers, undefined);
    assert.ok(plain.logs.some((line) => /tento sem eles/.test(line)));

    const none = load({ registerThrows: true });
    none.api.installThirst();
    assert.equal(none.registered.length, 0);
    assert.ok(none.logs.some((line) => /não pôde ser registrado:/.test(line)));
});

test("installed: a drink consumed quenches, a client's drink at the river goes through the rules, and the measure is saved on a timer and at the end", () => {
    const sut = load({ saved: { enabled: true, players: { "76561198000000001": 33, "not a steam id": 5, "76561198000000002": "x" } } });
    sut.api.installThirst();
    assert.ok(sut.logs.some((line) => /Sede ligada/.test(line)));

    const player = body({ steamId: "76561198000000001" });
    sut.handlers.get("playerReady")(player);
    assert.equal(sut.api.thirstPace.value(player), 33, "the kept measure of that character");
    sut.handlers.get("playerConsumed")(player, { item: WATER });
    assert.equal(sut.api.thirstPace.value(player), 78);

    sut.clientHandlers.get("kcdc-gamemode:thirst.drink")(player, JSON.stringify({ x: 400, y: 20, z: 5 }));
    assert.deepEqual(sut.said.at(-1), [player.id, "A água está longe demais."]);

    sut.intervals[1].fn();
    const written = sut.writes.at(-1);
    assert.equal(written[0], "playerdata/thirst.json");
    assert.equal(written[1].players["76561198000000001"], 78);
    assert.equal("not a steam id" in written[1].players, false, "a key that is no Steam id is not kept");

    sut.handlers.get("playerDisconnect")(player);
    assert.equal(sut.writes.length >= 2, true);
    sut.handlers.get("resourceStop")("kcdc-gamemode");
    assert.deepEqual(sut.cleared, [1, 2]);

    sut.api.chooseEnabled(false);
    assert.equal(sut.writes.at(-1)[1].enabled, false);
});

test("the level of a measure: thirsty under 30, parched under 10, sticky up to 40", () => {
    const { api } = load();
    assert.equal(api.levelOf(80, 0), 0);
    assert.equal(api.levelOf(29.9, 0), 1);
    assert.equal(api.levelOf(9.9, 0), 2);
    assert.equal(api.levelOf(35, 1), 1);
    assert.equal(api.levelOf(35, 0), 0);
    assert.equal(api.levelOf(40, 1), 0);
    assert.match(api.feeling(90), /saciada/);
    assert.match(api.feeling(5), /desidratado/);
});
