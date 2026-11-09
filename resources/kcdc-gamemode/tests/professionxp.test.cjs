"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The trades' XP standard (src/server/profession-xp.ts, 2026-11-03): each trade's rate over the tables, a factor over all of them, the day's limit; and what is kept of them
// (src/server/profession-xp-settings.ts).
const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");
const plain = (value) => JSON.parse(JSON.stringify(value));

function load() {
    const sandbox = { exports: {} };
    vm.runInNewContext(dist("profession-xp.js"), sandbox);
    return sandbox.exports;
}

// 2026-11-03 12:00 in Brasília (15:00 UTC).
const NOON = Date.UTC(2026, 10, 3, 15, 0, 0);
const HOUR = 3_600_000;

test("every trade pays its standard: the forge, the alchemy table, the felling, the quarry and the work on the harvest the tables' XP, the fire, the smokehouse and the rack twice it, the gardens, the milking and the shearing four times, the needle five", () => {
    const xp = load();
    const rates = Object.fromEntries(Object.keys(xp.STANDARD_RATES).map((trade) => [trade, xp.paid(10, trade)]));
    assert.deepEqual(rates, { forja: 10, alquimia: 10, lenha: 10, mina: 10, beneficiar: 10, fogo: 20, defumador: 20, secador: 20, horta: 40, ordenha: 40, tosquia: 40, costura: 50 });
    assert.equal(xp.paid(0, "forja"), 0, "no XP for work that gives none");
    assert.equal(xp.paid(0.2, "forja"), 1, "at least 1 for work that gives some");
    xp.professionXp.rate = 1.5;
    assert.equal(xp.paid(10, "horta"), 60, "the administrators' factor is over every trade");
});

test("the day's limit: the first 2500 XP of a track are paid whole, then a quarter of each piece; each player and each track has its own; a quote says it without counting it", () => {
    const xp = load();
    assert.equal(xp.professionXp.dailyFull, 2_500);
    assert.equal(xp.award("hans", "craftsmanship", 2_400, NOON), 2_400);
    assert.equal(xp.quote("hans", "craftsmanship", 200, NOON), 125, "100 whole and a quarter of the other 100");
    assert.equal(xp.earnedToday("hans", "craftsmanship", NOON), 2_400, "a quote counts nothing");
    assert.equal(xp.award("hans", "craftsmanship", 200, NOON), 125);
    assert.equal(xp.award("hans", "craftsmanship", 40, NOON), 10, "past it, a quarter");
    assert.equal(xp.award("hans", "craftsmanship", 2, NOON), 1, "never nothing for work that gives some");
    assert.equal(xp.earnedToday("hans", "craftsmanship", NOON), 2_642, "what was earned counts whole");
    assert.equal(xp.award("hans", "survival", 40, NOON), 40, "another track is its own");
    assert.equal(xp.award("kat", "craftsmanship", 40, NOON), 40, "and another player");
    xp.professionXp.dailyFull = 0;
    assert.equal(xp.award("hans", "craftsmanship", 40, NOON), 40, "a limit of 0 is none");
});

test("the limit comes back at Brasília's midnight, 03:00 UTC", () => {
    const xp = load();
    const lateNight = Date.UTC(2026, 10, 4, 2, 59, 0);
    xp.award("hans", "alchemy", 3_000, NOON);
    assert.equal(xp.dayOf(NOON), "2026-11-03");
    assert.equal(xp.dayOf(lateNight), "2026-11-03", "23:59 in Brasília is still the 3rd");
    assert.equal(xp.quote("hans", "alchemy", 40, lateNight), 10);
    const morning = Date.UTC(2026, 10, 4, 3, 0, 0);
    assert.equal(xp.dayOf(morning), "2026-11-04");
    assert.equal(xp.quote("hans", "alchemy", 40, morning), 40);
    assert.equal(xp.award("hans", "alchemy", 40, morning), 40);
    assert.equal(xp.earnedToday("hans", "alchemy", morning), 40);
});

test("going past the limit is told once a day, for that track; the ledger's changes are told every time", () => {
    const xp = load();
    const crossed = [];
    let changes = 0;
    xp.ledgerHooks.crossed = (who, track) => crossed.push([who, track]);
    xp.ledgerHooks.changed = () => { changes += 1; };
    xp.award("hans", "survival", 2_000, NOON);
    xp.award("hans", "survival", 600, NOON);
    xp.award("hans", "survival", 600, NOON);
    xp.award("hans", "strength", 2_600, NOON);
    assert.deepEqual(crossed, [["hans", "survival"], ["hans", "strength"]]);
    assert.equal(changes, 4);
});

test("today's ledger is kept and taken back: a day gone or a number that is none is left out", () => {
    const xp = load();
    xp.award("hans", "survival", 1_234, NOON);
    xp.award("kat", "alchemy", 99, NOON);
    const kept = plain(xp.ledgerSnapshot(NOON));
    assert.deepEqual(kept, { hans: { day: "2026-11-03", tracks: { survival: 1_234 } }, kat: { day: "2026-11-03", tracks: { alchemy: 99 } } });
    const fresh = load();
    assert.equal(fresh.restoreLedger({ ...kept, old: { day: "2026-11-02", tracks: { survival: 50 } }, odd: { day: "2026-11-03", tracks: { survival: "a lot", alchemy: -3 } } }, NOON), 3);
    assert.equal(fresh.earnedToday("hans", "survival", NOON), 1_234);
    assert.equal(fresh.earnedToday("old", "survival", NOON), 0, "yesterday's is gone");
    assert.deepEqual(plain(fresh.ledgerSnapshot(NOON)).odd, { day: "2026-11-03", tracks: {} });
    assert.equal(fresh.earnedToday("hans", "survival", NOON + 24 * HOUR), 0, "and tomorrow it is nothing");
});

test("the tables as they are, for the tests of the work; and back to the standard", () => {
    const xp = load();
    xp.useTables();
    assert.equal(xp.paid(10, "costura"), 10);
    assert.equal(xp.award("hans", "craftsmanship", 9_000, NOON), 9_000, "no limit");
    xp.useStandard();
    assert.equal(xp.paid(10, "costura"), 50);
    assert.equal(xp.earnedToday("hans", "craftsmanship", NOON), 0);
    assert.equal(xp.professionXp.dailyFull, 2_500);
});

function loadSettings(files = {}) {
    const xp = load();
    const state = { files: new Map(Object.entries(files)), writes: [], logs: [], chats: [], timers: [] };
    const players = [{ id: 1, steamId: "hans", nickname: "Hans" }];
    const sandbox = {
        exports: {},
        require: (id) =>
            ({
                "./profession-xp.js": xp,
                "./store.js": {
                    ensureDir() {},
                    read: (file) => (state.files.has(file) ? { status: "ok", value: JSON.parse(state.files.get(file)) } : { status: "missing" }),
                    write: (file, value) => { state.writes.push([file, plain(value)]); state.files.set(file, JSON.stringify(value)); },
                },
            })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        Player: { all: () => players },
        Chat: { sendToPlayer: (p, text) => state.chats.push([p.steamId, text]) },
        Date,
        Math,
        Number,
        Object,
    };
    vm.runInNewContext(dist("profession-xp-settings.js"), sandbox);
    return { xp, settings: sandbox.exports, state };
}

test("the first file (2026-10-27) kept the times of the tables, 4 by default: that is the standard now, and 8 is twice it; a file of the standard keeps its factor and its limit", () => {
    const old = loadSettings({ "playerdata/profession-xp.json": JSON.stringify({ v: 1, rate: 4 }) });
    old.settings.installProfessionXp();
    assert.equal(old.xp.professionXp.rate, 1);
    const fast = loadSettings({ "playerdata/profession-xp.json": JSON.stringify({ v: 1, rate: 8 }) });
    fast.settings.installProfessionXp();
    assert.equal(fast.xp.professionXp.rate, 2);
    const now = loadSettings({ "playerdata/profession-xp.json": JSON.stringify({ v: 2, rate: 1.5, dailyFull: 3_000 }) });
    now.settings.installProfessionXp();
    assert.deepEqual([now.xp.professionXp.rate, now.xp.professionXp.dailyFull], [1.5, 3_000]);
    assert.match(now.state.logs.at(-1), /vale 1\.5 vez\(es\) o padrão; 3000 XP por habilidade e por dia rendem inteiros, depois 25%/);
});

test("the administrators' choices are kept; a number outside what is allowed is refused", () => {
    const { xp, settings, state } = loadSettings();
    settings.installProfessionXp();
    assert.equal(settings.chooseRate(2), true);
    assert.equal(settings.chooseRate(9), false);
    assert.equal(settings.chooseDailyFull(4_000), true);
    assert.equal(settings.chooseDailyFull(-1), false);
    assert.deepEqual(state.writes.at(-1), ["playerdata/profession-xp.json", { v: 2, rate: 2, dailyFull: 4_000 }]);
    assert.deepEqual([xp.professionXp.rate, xp.professionXp.dailyFull], [2, 4_000]);
});

test("today's ledger is kept a few seconds after a change and read again at the next start; a player who goes past the limit is told in the chat and the log says it", () => {
    const { xp, settings, state } = loadSettings();
    settings.installProfessionXp();
    xp.award("hans", "craftsmanship", 2_600);
    assert.equal(state.timers.length, 1);
    state.timers[0].fn();
    const [file, kept] = state.writes.at(-1);
    assert.equal(file, "playerdata/profession-day.json");
    assert.equal(kept.players.hans.tracks.craftsmanship, 2_600);
    assert.match(state.chats.at(-1)[1], /^Você já fez hoje o XP cheio de ofício manual \(forja e costura\) \(2.500\)\. Até a meia-noite, cada obra rende 25% do XP/);
    assert.ok(state.logs.some((line) => /Hans passou hoje de 2500 XP de craftsmanship/.test(line)));
    const again = loadSettings({ "playerdata/profession-day.json": JSON.stringify(kept) });
    again.settings.installProfessionXp();
    assert.equal(again.xp.earnedToday("hans", "craftsmanship"), 2_600);
});
