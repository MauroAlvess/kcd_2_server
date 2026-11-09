"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Worn to nothing, gone (src/server/wear-break.ts, 2026-11-04: "quando uma roupa, arma ou armadura chegar a 0 de durabilidade deve quebrar e sumir do inventário").

function load({ refuse = false, throws = false, bag = [], classes = [] } = {}) {
    const state = { logs: [], removed: [], chats: [], timers: [], bag, players: [] };
    const handlers = new Map();
    const names = { swordmilitary01: "Espada militar", bootsankle03_m01_d: "Botas de cano curto", carrot: "Cenoura", "guid-boots": "Botas de cano curto", "guid-coat": "Casaco", "guid-ring": "Anel do Hans" };
    const context = {
        exports: {},
        require: (id) => (id === "./item-names.js" ? { itemName: (row) => names[String(row.item).toLowerCase()] ?? row.name ?? "item" } : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line) },
        setTimeout: (fn, ms) => { state.timers.push({ fn, ms }); return state.timers.length; },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Chat: { sendToPlayer: (player, text) => state.chats.push([player.nickname, text]) },
        Player: { getById: (id) => state.players.find((player) => player.id === id) ?? null },
        Inventory: {
            classes: () => classes,
            get: () => ({ ready: true, revision: 1, items: state.bag }),
            remove: (player, request) => {
                if (throws) throw new Error("gone");
                state.removed.push(JSON.parse(JSON.stringify(request)));
                return { ok: !refuse, code: refuse ? "staleRevision" : "", revision: 2, items: [] };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/wear-break.js"), "utf8"), context);
    context.exports.installWearBreak();
    return { api: context.exports, state, handlers, change: (reason, items) => handlers.get("playerInventoryChanged")({ nickname: "Hans" }, { reason, items }) };
}

const row = (item, condition, extra = {}) => ({ item, name: item, amount: 1, equipped: 1, condition, metadata: { quality: 2, condition }, ...extra });

test("a piece the game's wear leaves at 0 breaks: it is taken out of the inventory, worn or not, and its owner is told", () => {
    const sut = load();
    assert.ok(sut.state.logs.some((line) => /quebra e sai do inventário/.test(line)), "the start says so");
    sut.change("wear", [{ id: "r1", before: row("swordMilitary01", 0.004), after: row("swordMilitary01", 0) }]);
    assert.deepEqual(sut.state.removed, [{ units: [{ id: "r1", amount: 1 }] }]);
    assert.deepEqual(sut.state.chats, [["Hans", "Espada militar quebrou de tanto uso e sumiu do seu inventário."]]);
    assert.ok(sut.state.logs.some((line) => /Hans: Espada militar \(swordMilitary01\) quebrou com o uso/.test(line)));
});

test("only the pieces at nothing go: one worn but not to 0 stays, and of one wear only the rows at 0 are taken", () => {
    const sut = load();
    sut.change("wear", [
        { id: "boots", before: row("BootsAnkle03_m01_D", 0.0009), after: row("BootsAnkle03_m01_D", 0.0003) },
        { id: "sword", before: row("swordMilitary01", 0.5), after: row("swordMilitary01", 0.49) },
        { id: "nearly", before: row("swordMilitary01", 0.02), after: row("swordMilitary01", 0.001) },
    ]);
    assert.deepEqual(sut.state.removed.map((request) => request.units[0].id), ["boots"], "the noise around 0 counts as 0; 0.1% does not");
    assert.equal(sut.state.chats.length, 1);
});

test("nothing but the game's wear breaks a piece: rotten food at 0, a piece added, bought or repaired at 0, or a row that went are left alone", () => {
    const sut = load();
    for (const reason of ["properties", "add", "set", "trade", "repair", "sharpen", "use", "transfer"]) {
        sut.change(reason, [{ id: "x", before: row("carrot", 0.2), after: row("carrot", 0) }]);
    }
    sut.change("wear", [
        { id: "new", before: null, after: row("swordMilitary01", 0) },
        { id: "gone", before: row("swordMilitary01", 0.001), after: null },
        { id: "unread", before: row("swordMilitary01", 0.1), after: { item: "swordMilitary01", amount: 1, metadata: {} } },
    ]);
    assert.deepEqual(sut.state.removed, []);
    assert.deepEqual(sut.state.chats, []);
});

test("the condition may come in the row or only in its properties; a whole row goes, whatever its count", () => {
    const sut = load();
    sut.change("wear", [{ id: "r2", before: row("swordMilitary01", 0.01), after: { item: "swordMilitary01", name: "swordMilitary01", amount: 2, metadata: { condition: 0 } } }]);
    assert.deepEqual(sut.state.removed, [{ units: [{ id: "r2", amount: 2 }] }]);
});

test("a removal the server refuses, or one that throws, is logged and the owner is not told of a break that did not happen", () => {
    for (const options of [{ refuse: true }, { throws: true }]) {
        const sut = load(options);
        sut.change("wear", [{ id: "r1", before: row("swordMilitary01", 0.004), after: row("swordMilitary01", 0) }]);
        assert.deepEqual(sut.state.chats, []);
        assert.ok(sut.state.logs.some((line) => /chegou a 0 de durabilidade, mas não saiu do inventário/.test(line)), JSON.stringify(options));
    }
});

test("brokenRows is pure: it names what would go and touches nothing", () => {
    const sut = load();
    const rows = sut.api.brokenRows({ reason: "wear", items: [{ id: "a", before: row("x", 0.1), after: row("x", 0) }, { id: "b", before: row("x", 0.1), after: row("x", 0.05) }] });
    // Arrays made in the module's own realm: compared by their contents.
    assert.deepEqual(Array.from(rows, (entry) => entry.id), ["a"]);
    assert.equal(sut.api.brokenRows({ reason: "add", items: [{ id: "a", before: row("x", 0.1), after: row("x", 0) }] }).length, 0);
    assert.equal(sut.api.BREAK_AT, 0.0005);
});

// The pieces already at 0 before the rule (96 in 67 characters on 2026-11-04) go at the owner's next entry.
const gear = [
    { id: "GUID-BOOTS", name: "BootsAnkle03_m01_D", category: "Armor", quest: false },
    { id: "guid-coat", name: "Coat05_m01_C", category: "Armor", quest: false },
    { id: "guid-ring", name: "questRing", category: "Armor", quest: true },
];
const bagRow = (id, item, condition, extra = {}) => ({ id, item, name: item, amount: 1, equipped: 1, condition, metadata: { condition }, ...extra });

test("at the entry, the equippable pieces already at 0 leave the bag in one go and the owner reads one line; food at 0, quest pieces and worn-but-not-0 pieces stay", () => {
    const bag = [
        bagRow("b1", "guid-boots", 0),
        bagRow("b2", "guid-coat", 0.0003, { equipped: 0 }),
        bagRow("b3", "guid-coat", 0.2),
        bagRow("b4", "guid-carrot", 0, { name: "carrot" }),
        bagRow("b5", "guid-ring", 0),
    ];
    const sut = load({ bag, classes: gear });
    const hans = { id: 7, nickname: "Hans", ready: true };
    sut.state.players.push(hans);
    sut.handlers.get("playerSpawned")(hans);
    assert.equal(sut.state.timers.length, 1);
    assert.equal(sut.state.timers[0].ms, 15_000, "fifteen seconds after the spawn: the saved bag is back by then");
    assert.deepEqual(sut.state.removed, [], "nothing before that");
    sut.state.timers[0].fn();
    assert.deepEqual(sut.state.removed.map((request) => request.units[0].id), ["b1", "b2"]);
    assert.deepEqual(sut.state.chats, [["Hans", "Peças que estavam com 0 de durabilidade quebraram e sumiram do seu inventário: Botas de cano curto, Casaco."]]);
    assert.ok(sut.state.logs.some((line) => /wear: Hans: 2 peça\(s\) com 0 de durabilidade saíram do inventário na entrada/.test(line)));
});

test("the bag is looked at once a session: a death's spawn does not look again; a new entry does, and one who left before the look is not looked at", () => {
    const sut = load({ bag: [bagRow("b1", "guid-boots", 0)], classes: gear });
    const hans = { id: 7, nickname: "Hans", ready: true };
    sut.state.players.push(hans);
    sut.handlers.get("playerSpawned")(hans);
    sut.handlers.get("playerSpawned")(hans);
    assert.equal(sut.state.timers.length, 1, "the respawn after a death is the same session");
    sut.handlers.get("playerDisconnect")(hans);
    sut.state.timers[0].fn();
    assert.deepEqual(sut.state.removed, [], "gone before the look");
    sut.handlers.get("playerSpawned")(hans);
    assert.equal(sut.state.timers.length, 2, "a new entry");
    sut.state.timers[1].fn();
    assert.equal(sut.state.removed.length, 1);
});

test("a bag with nothing at 0 says nothing; a removal refused is not told", () => {
    const quiet = load({ bag: [bagRow("b3", "guid-coat", 0.2)], classes: gear });
    assert.equal(quiet.api.sweepBroken({ id: 1, nickname: "Hans" }), 0);
    assert.deepEqual(quiet.state.chats, []);
    const refused = load({ bag: [bagRow("b1", "guid-boots", 0)], classes: gear, refuse: true });
    assert.equal(refused.api.sweepBroken({ id: 1, nickname: "Hans" }), 0);
    assert.deepEqual(refused.state.chats, []);
});
