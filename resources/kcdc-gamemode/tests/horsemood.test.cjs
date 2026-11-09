"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The horses' mood (src/server/horse-mood.ts, 2026-11-04): the owner's blows sour it, a bad mood stops it, and the last blow makes it leave; time brings it back.

const OWNER = "76561198000000001";
const OTHER = "76561198000000002";

function load() {
    const state = { handlers: new Map(), abandoned: [], chat: [], emitted: [], logs: [], records: new Map(), bodies: new Map(), keys: new Map(), saves: 0, stopped: [], registered: [], players: [], intervals: [] };
    const horsesStub = {
        BAD_MOOD_BELOW: 30,
        CALM_MOOD_FROM: 60,
        abandonHorse: (key, from) => { state.abandoned.push({ key, from: { ...from } }); state.records.delete(key); return true; },
        allHorses: () => [...state.records.values()].map((record) => ({ record, horse: state.bodies.get(record.key) ?? null })),
        keyOfHorse: (horse) => state.keys.get(horse.id) ?? null,
        moodOf: (record) => (typeof record?.mood === "number" ? Math.max(0, Math.min(100, record.mood)) : 100),
        recordOf: (key) => state.records.get(key) ?? null,
        saveHorseRecords: () => { state.saves += 1; },
    };
    const context = {
        exports: {},
        require: (id) => ({
            "./horses.js": horsesStub,
        })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Date, Set, Map, Math, JSON, Number, Object,
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Player: { all: () => state.players },
        Buffs: { register: (id, definition) => { state.registered.push([id, JSON.parse(JSON.stringify(definition))]); return `guid:${id}`; } },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
        setInterval: (fn, ms) => { state.intervals.push({ fn, ms }); return state.intervals.length; },
        clearInterval() {},
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/horse-mood.js"), "utf8"), context);
    let nextId = 1;
    const horse = (name = "Kari", owner = OWNER, mood = undefined) => {
        const id = nextId++;
        const key = `k${id}`;
        const record = { key, owner, ownerName: "Hans", name, ...(mood === undefined ? {} : { mood }) };
        state.records.set(key, record);
        state.keys.set(id, key);
        const buffs = new Set();
        const body = {
            id, name, alive: true, rider: null, thrown: 0, dismounted: 0, held: 0, position: { x: 100, y: 100, z: 5 },
            hasBuff: (buff) => buffs.has(buff), addBuff: (buff) => { buffs.add(buff); return true; }, removeBuff: (buff) => buffs.delete(buff),
            rearAndThrowDown() { this.thrown += 1; this.rider = null; return true; }, dismountRider() { this.dismounted += 1; return null; }, hold() { this.held += 1; },
            buffs,
        };
        state.bodies.set(key, body);
        return { body, record };
    };
    const player = (steamId = OWNER, nickname = "Hans") => {
        const body = { steamId, nickname, ready: true, position: { x: 98, y: 99, z: 5 }, emit: (event, payload) => state.emitted.push({ event, payload: JSON.parse(payload) }) };
        state.players.push(body);
        return body;
    };
    return { api: context.exports, state, horse, player };
}

const plain = (value) => JSON.parse(JSON.stringify(value));

test("each blow of the owner takes twenty points: irritated at the third, in a bad mood at the fourth, and the fifth makes the horse leave, with the owner's name for it in the message", () => {
    const sut = load();
    sut.api.installHorseMood();
    const { body, record } = sut.horse();
    const hans = sut.player();
    assert.equal(sut.api.struckBy(body, hans, 12, "combat"), false);
    assert.equal(record.mood, 80);
    assert.equal(sut.api.struckBy(body, hans, 12, "combat"), false);
    assert.deepEqual(sut.state.chat, [], "calm still: no word");
    sut.api.struckBy(body, hans, 12, "combat");
    assert.equal(record.mood, 40);
    assert.equal(sut.state.chat.at(-1), `Seu cavalo Kari ${sut.api.IRRITATED}`);
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-irritado"), true, "less wind at once");
    sut.api.struckBy(body, hans, 12, "combat");
    assert.equal(record.mood, 20);
    assert.equal(sut.state.chat.at(-1), `Seu cavalo Kari ${sut.api.SULKING}`);
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-mau-humor"), true, "no wind, no gallop");
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-irritado"), false, "the milder effect is taken off");
    assert.equal(body.held, 1, "and stands where it is");
    assert.deepEqual(sut.state.abandoned, []);
    assert.equal(sut.api.struckBy(body, hans, 12, "combat"), true);
    assert.deepEqual(plain(sut.state.abandoned), [{ key: record.key, from: { x: 98, y: 99, z: 5 } }], "it runs off from the owner's place");
    assert.equal(sut.state.chat.at(-1), "Seu cavalo Kari não gosta mais de você e te abandonou.");
    assert.equal(sut.state.emitted.at(-1).payload.text, sut.state.chat.at(-1), "the screen's notice says it too");
    assert.ok(sut.state.logs.some((line) => /horse-mood: Hans bateu em Kari \(k1\) até o humor chegar a 0%: o cavalo o abandonou/.test(line)));
    assert.ok(sut.state.saves >= 5, "every blow is filed");
});

test("a rider on a horse that turns sulky is thrown, and a horse with no rider is not thrown at", () => {
    const sut = load();
    sut.api.installHorseMood();
    const { body, record } = sut.horse("Kari", OWNER, 40);
    const hans = sut.player();
    body.rider = { id: 9 };
    sut.api.struckBy(body, hans, 12, "combat");
    assert.equal(record.mood, 20);
    assert.equal(body.thrown, 1);
    assert.equal(body.held, 1, "once the rider is down it stands where it is");
    const second = sut.horse("Pé", OWNER, 40);
    sut.api.struckBy(second.body, hans, 12, "combat");
    assert.equal(second.body.thrown, 0);
    assert.equal(second.body.held, 1);
});

test("only the owner's own blows on a kept horse count: another player's, no one's, a fall, a collision, poison, no damage, a horse nobody keeps", () => {
    const sut = load();
    sut.api.installHorseMood();
    const { body, record } = sut.horse();
    const hans = sut.player();
    const stranger = sut.player(OTHER, "Greta");
    for (let blow = 0; blow < 8; blow += 1) {
        sut.api.struckBy(body, stranger, 10, "combat");
        sut.api.struckBy(body, null, 10, "combat");
        sut.api.struckBy(body, hans, 10, "fall");
        sut.api.struckBy(body, hans, 10, "collision");
        sut.api.struckBy(body, hans, 10, "poison");
        sut.api.struckBy(body, hans, 0, "combat");
        sut.api.struckBy({ id: 99, name: "", position: { x: 0, y: 0, z: 0 } }, hans, 10, "combat");
    }
    assert.equal(record.mood, undefined);
    assert.deepEqual(sut.state.chat, []);
    // An arrow, a shot and a blow the game does not name count.
    for (const reason of ["gunshot", "unknown"]) sut.api.struckBy(body, hans, 10, reason);
    assert.equal(record.mood, 60);
});

test("a horse recovers with time, only while its owner is in the game, and is said to have calmed when it is no longer in a bad mood", () => {
    const sut = load();
    sut.api.installHorseMood();
    const { body, record } = sut.horse("Kari", OWNER, 20);
    const hans = sut.player();
    sut.api.moodTick(1_000_000);
    assert.equal(record.mood, 20, "the first look charges no time");
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-mau-humor"), true);
    assert.equal(body.held, 1, "a sulking horse is held where it stands");
    sut.api.moodTick(1_015_000);
    assert.equal(record.mood, 21, "four points a minute: fifteen seconds, one point");
    sut.state.players.length = 0;
    sut.api.moodTick(1_030_000);
    assert.equal(record.mood, 21, "nothing with the owner away");
    sut.state.players.push(hans);
    for (let step = 1; step <= 9; step += 1) sut.api.moodTick(1_030_000 + step * 15_000);
    assert.ok(record.mood >= 30 && record.mood < 60, `${record.mood}`);
    assert.equal(sut.state.chat.at(-1), `Seu cavalo Kari ${sut.api.CALMED}`);
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-mau-humor"), false);
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-irritado"), true, "irritated still");
    for (let step = 1; step <= 120; step += 1) sut.api.moodTick(1_200_000 + step * 15_000);
    assert.equal(record.mood, 100);
    assert.equal(body.hasBuff("guid:kcdc-gamemode:cavalo-irritado"), false, "all effects off at the best");
});

test("a tick leaves alone the horses at their best, and a stall of the server is not charged more than three looks", () => {
    const sut = load();
    sut.api.installHorseMood();
    const best = sut.horse("Kari");
    const hans = sut.player();
    sut.api.moodTick(1_000_000);
    assert.equal(best.body.buffs.size, 0);
    const sour = sut.horse("Pé", OWNER, 30);
    sut.api.moodTick(1_015_000);
    sut.api.moodTick(1_615_000);
    assert.equal(sour.record.mood, 30 + 1 + 3, "ten minutes of stall counted as three looks (three points more)");
    assert.equal(hans.steamId, OWNER);
});

test("the effects are registered, and the game's refusal of a modifier falls back to the plain one", () => {
    const sut = load();
    sut.api.installHorseMood();
    const names = sut.state.registered.map(([id]) => id);
    assert.deepEqual(names, ["kcdc-gamemode:cavalo-irritado", "kcdc-gamemode:cavalo-mau-humor"]);
    const bad = sut.state.registered[1][1];
    assert.ok(bad.modifiers.maxStamina.value <= 0.25 && bad.modifiers.runSpeed.value <= -0.4, "no wind, no gallop");
    assert.ok(sut.state.logs.some((line) => /2 de 2 efeitos registrados/.test(line)));
});

test("installed: the game's damage event counts, and a horse that is destroyed is forgotten", () => {
    const sut = load();
    sut.api.installHorseMood();
    const { body, record } = sut.horse();
    const hans = sut.player();
    const damage = sut.state.handlers.get("horseDamage");
    damage(body, hans, 10, "combat");
    damage(body, hans, 10, "combat");
    assert.equal(record.mood, 60);
    assert.equal(sut.state.intervals.find((one) => one.ms === 15_000) !== undefined, true, "the look");
    sut.state.handlers.get("horseDestroy")(body);
    sut.api.moodTick(2_000_000);
});
