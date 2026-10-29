"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// A drunk body that lies black until the session is left (src/server/faint.ts, 2026-10-25): the pace wakes it, `/acordar` asks for it.

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

function load() {
    const logs = [];
    const sandbox = {
        exports: {},
        require: () => assert.fail("faint.js requires nothing"),
        console: { log: (line) => logs.push(line), error() {} },
        Date,
        Math,
    };
    vm.runInNewContext(dist("faint.js"), sandbox);
    return { sut: sandbox.exports, logs };
}

function body(id, state = {}) {
    const asked = [];
    const player = {
        id,
        nickname: `Jogador${id}`,
        ready: true,
        alive: true,
        consciousness: 1,
        drunkenness: 0,
        buffs: [],
        asked,
        healed: 0,
        clearBuffs(tag) {
            asked.push(tag);
            return true;
        },
        heal() {
            this.healed += 1;
            return true;
        },
        ...state,
    };
    return player;
}

const DRUNK_BUFFS = [{ name: "alcohol_drunk_3", aiTag: "alcohol_drunk" }, { name: "unconscious_drunk", aiTag: "unconscious" }];

test("a drunk body that stays down is woken after the short wait, by taking off the faint and the drink", () => {
    const { sut, logs } = load();
    const watch = new sut.FaintWatch();
    const player = body(1, { consciousness: 0, drunkenness: 0.9, buffs: DRUNK_BUFFS });
    watch.tick([player], 0);
    assert.deepEqual([...player.asked], [], "just fell: nothing yet");
    watch.tick([player], sut.WAKE_DRUNK_MS - 1);
    assert.deepEqual([...player.asked], []);
    watch.tick([player], sut.WAKE_DRUNK_MS);
    assert.deepEqual([...player.asked], ["unconscious", "alcohol_drunk"]);
    assert.ok(logs.some((line) => /Jogador1 caiu de bêbado/.test(line) && /alcohol_drunk_3/.test(line)), "the log says what held the body down");
    assert.ok(logs.some((line) => /acordando, tentativa 1/.test(line)));
    assert.ok(logs.every((line) => !/7656119/.test(line)), "no Steam id in the log");
});

test("a body struck down is left alone until it is plainly stuck, and a retry waits its turn", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const player = body(2, { consciousness: 0 });
    watch.tick([player], 0);
    watch.tick([player], sut.WAKE_DRUNK_MS + 1_000);
    assert.deepEqual([...player.asked], [], "a fight's knockout is not cut short as a drunk's is");
    watch.tick([player], sut.WAKE_OTHER_MS);
    assert.deepEqual([...player.asked], ["unconscious", "alcohol_drunk"]);
    watch.tick([player], sut.WAKE_OTHER_MS + sut.WAKE_RETRY_MS - 1);
    assert.equal(player.asked.length, 2, "not asked again before the retry time");
    watch.tick([player], sut.WAKE_OTHER_MS + sut.WAKE_RETRY_MS);
    assert.equal(player.asked.length, 4);
    assert.equal(player.healed, 0, "the cure is for the third try on");
    watch.tick([player], sut.WAKE_OTHER_MS + 2 * sut.WAKE_RETRY_MS);
    assert.equal(player.healed, 1, "third try: the game's own cure too");
});

test("coming round on their own ends the count, and finding drink on a body first seen as struck makes it a drunk one", () => {
    const { sut, logs } = load();
    const watch = new sut.FaintWatch();
    const player = body(3, { consciousness: 0 });
    watch.tick([player], 0);
    assert.equal(watch.downFor(3, 10_000), 10_000);
    player.drunkenness = 0.5;
    watch.tick([player], 10_000);
    watch.tick([player], sut.WAKE_DRUNK_MS);
    assert.equal(player.asked.length, 2, "drink found: the short wait counts from the fall");

    player.consciousness = 1;
    watch.tick([player], 60_000);
    assert.equal(watch.downFor(3, 61_000), null);
    assert.ok(logs.some((line) => /Jogador3 voltou a si depois de 60 s/.test(line) && /1 tentativa/.test(line)));
});

test("/acordar: only a drunk body, only after the short wait, and a body that is up or was struck down is told why not", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const up = body(4);
    watch.tick([up], 0);
    assert.equal(watch.ask(up, 0).ok, false);
    assert.match(watch.ask(up, 0).message, /não está desmaiado/);

    const struck = body(5, { consciousness: 0 });
    watch.tick([struck], 0);
    const refused = watch.ask(struck, sut.WAKE_ASKED_MS + 1);
    assert.equal(refused.ok, false);
    assert.match(refused.message, /derrubado/);
    assert.deepEqual([...struck.asked], [], "never shortened by the one on the ground");

    const drunk = body(6, { consciousness: 0, drunkenness: 1 });
    watch.tick([drunk], 100_000);
    const early = watch.ask(drunk, 100_000 + sut.WAKE_ASKED_MS - 5_000);
    assert.equal(early.ok, false);
    assert.match(early.message, /Espere mais 5 s/);
    const done = watch.ask(drunk, 100_000 + sut.WAKE_ASKED_MS);
    assert.equal(done.ok, true);
    assert.deepEqual([...drunk.asked], ["unconscious", "alcohol_drunk"]);
});

test("a player who is not ready, not alive or gone is not looked at, and the families are the game's own words", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const loading = body(7, { consciousness: 0, ready: false });
    const dead = body(8, { consciousness: 0, alive: false });
    watch.tick([loading, dead], 0);
    watch.tick([loading, dead], sut.WAKE_OTHER_MS * 2);
    assert.deepEqual([...loading.asked, ...dead.asked], []);

    const gone = body(9, { consciousness: 0, drunkenness: 1 });
    watch.tick([gone], 0);
    watch.tick([], 1_000);
    assert.equal(watch.downFor(9, 2_000), null, "a player who left is forgotten");
    assert.deepEqual(JSON.parse(JSON.stringify(sut.WAKE_FAMILIES)), ["unconscious", "alcohol_drunk"]);
});

test("a family the game's tables refuse does not stop the others from being asked", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const player = body(10, { consciousness: 0, drunkenness: 1 });
    player.clearBuffs = function (tag) {
        this.asked.push(tag);
        if (tag === "unconscious") {
            throw new Error("unknown family");
        }
        return true;
    };
    watch.tick([player], 0);
    watch.tick([player], sut.WAKE_DRUNK_MS);
    assert.deepEqual([...player.asked], ["unconscious", "alcohol_drunk"]);
});
