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

test("a drunk faint's own effects are taken off by name, and only from a drunk body (2026-11-01: Václav lay 643 s, the families never woke him)", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const removed = [];
    const player = body(11, {
        consciousness: 0,
        drunkenness: 1,
        buffs: [{ name: "unconscious_alcohol", aiTag: null }, { name: "drunkenness", aiTag: null }, { name: "overeat", aiTag: null }],
        removeBuff(name) {
            removed.push(name);
            return true;
        },
    });
    watch.tick([player], 0);
    watch.tick([player], sut.WAKE_DRUNK_MS);
    assert.deepEqual(removed, ["unconscious_alcohol", "drunkenness"], "the faint and the drink, not the full belly");

    const struck = body(12, { consciousness: 0, buffs: [{ name: "unconscious_alcohol", aiTag: null }], removeBuff: (name) => removed.push(`struck:${name}`) });
    struck.buffs = [{ name: "knocked_out", aiTag: "unconscious" }];
    watch.tick([struck], 0);
    watch.tick([struck], sut.WAKE_OTHER_MS);
    assert.equal(removed.filter((name) => name.startsWith("struck:")).length, 0, "a blow's knockout keeps its effects");
});

test("a drunk body wakes where it fell: carried a little it is followed, and one the game took far while it lay is put back (2026-11-01)", () => {
    const { sut, logs } = load();
    const watch = new sut.FaintWatch();
    const sent = [];
    const player = body(13, {
        position: { x: 100, y: 100, z: 10 },
        teleport(at) {
            sent.push({ ...at });
            this.position = { ...at };
            return true;
        },
    });
    watch.tick([player], 0);
    // The game takes the falling body away at once: where it stood a look ago is kept.
    player.consciousness = 0;
    player.drunkenness = 1;
    player.position = { x: 400, y: 400, z: 50 };
    watch.tick([player], 2_000);
    // Dragged a couple of metres while it lies: followed.
    player.position = { x: 102, y: 100, z: 10 };
    watch.tick([player], 4_000);
    // It comes round in the inn's corner, far away.
    player.consciousness = 1;
    player.position = { x: 300, y: 300, z: 20 };
    watch.tick([player], 6_000);
    assert.deepEqual(sent, [{ x: 102, y: 100, z: 10 }]);
    assert.ok(logs.some((line) => /Jogador13 acordou a \d+ m de onde caiu: posto de volta lá/.test(line)));

    // Waking where it lay asks nothing: it falls again where it was put back, and comes round a metre off.
    player.consciousness = 0;
    watch.tick([player], 8_000);
    player.consciousness = 1;
    player.position = { x: 103, y: 100, z: 10 };
    watch.tick([player], 10_000);
    assert.equal(sent.length, 1, "within three metres of where it lay");
});

test("a body struck down is never moved when it comes round, and a body whose place cannot be read is left where it is", () => {
    const { sut } = load();
    const watch = new sut.FaintWatch();
    const sent = [];
    const fighter = body(14, { position: { x: 0, y: 0, z: 0 }, teleport: (at) => sent.push(at) });
    watch.tick([fighter], 0);
    fighter.consciousness = 0;
    watch.tick([fighter], 2_000);
    fighter.consciousness = 1;
    fighter.position = { x: 50, y: 0, z: 0 };
    watch.tick([fighter], 4_000);
    const lost = body(15, { consciousness: 0, drunkenness: 1, teleport: (at) => sent.push(at) });
    watch.tick([lost], 0);
    lost.consciousness = 1;
    lost.position = { x: 9, y: 9, z: 9 };
    watch.tick([lost], 2_000);
    assert.deepEqual(sent, []);
});
