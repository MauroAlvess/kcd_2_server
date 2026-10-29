"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const inventoryAdd = require("./inventory-add-module.cjs");

// A big stack into an inventory (src/server/inventory-add.ts): the game takes 1 to 10,000 units of a class per call, and the money counts in tenths of a coin.

/** A fake `Inventory` that holds rows, refuses what the real one refuses, and writes down every call. */
function fakeGame({ failOnCall = 0 } = {}) {
    const rows = [];
    const calls = [];
    const removed = [];
    let next = 1;
    const Inventory = {
        add(owner, request) {
            calls.push({ amount: request.amount, notify: request.notify });
            if (!(request.amount >= 1 && request.amount <= 10_000)) return { ok: false, code: "invalidAmount", revision: 0, items: [] };
            if (failOnCall === calls.length) return { ok: false, code: "inventoryCapacity", revision: 0, items: [] };
            let row = rows.find((candidate) => candidate.item === request.item);
            if (row === undefined) {
                row = { id: `row${next++}`, item: request.item, amount: 0 };
                rows.push(row);
            }
            row.amount += request.amount;
            return { ok: true, code: "", revision: calls.length, items: [{ id: row.id, amount: request.amount }] };
        },
        remove(owner, request) {
            removed.push(request.units.map((unit) => ({ ...unit })));
            for (const unit of request.units) rows.find((row) => row.id === unit.id).amount -= unit.amount;
            return { ok: true, code: "", revision: 0, items: [] };
        },
    };
    const stash = {
        addItem: (request) => Inventory.add(null, request),
        removeItem: (request) => Inventory.remove(null, request),
    };
    return { Inventory, Stash: {}, stash, rows, calls, removed };
}

test("up to what one call takes, it is one call, as it was asked", () => {
    const game = fakeGame();
    const { addUnits, ADD_MAX } = inventoryAdd(game);
    assert.equal(ADD_MAX, 10_000);
    assert.equal(addUnits({}, { item: "money", amount: 10_000 }).ok, true);
    assert.deepEqual(game.calls, [{ amount: 10_000, notify: undefined }]);
});

test("a bigger pile goes in calls of 10,000, all of it in one row, and the game's toast comes once", () => {
    const game = fakeGame();
    const { addUnits } = inventoryAdd(game);
    const result = addUnits({}, { item: "money", amount: 24_102, metadata: { quality: 1 } });
    assert.equal(result.ok, true);
    assert.deepEqual(game.calls.map((call) => call.amount), [10_000, 10_000, 4_102]);
    assert.deepEqual(game.calls.map((call) => call.notify), [undefined, false, false], "the first call announces it, the rest do not");
    assert.equal(game.rows.length, 1);
    assert.equal(game.rows[0].amount, 24_102);
    assert.equal(result.items.reduce((sum, unit) => sum + unit.amount, 0), 24_102);

    const quiet = fakeGame();
    inventoryAdd(quiet).addUnits({}, { item: "money", amount: 15_000, notify: false });
    assert.deepEqual(quiet.calls.map((call) => call.notify), [false, false], "a silent add stays silent");
});

test("a refused call takes the earlier ones out again: a pile is never half given", () => {
    const game = fakeGame({ failOnCall: 3 });
    const { addUnits } = inventoryAdd(game);
    const result = addUnits({}, { item: "money", amount: 24_102 });
    assert.equal(result.ok, false);
    assert.equal(result.code, "inventoryCapacity");
    assert.equal(game.rows[0].amount, 0, "what the first two put in is taken out");
    assert.deepEqual(JSON.parse(JSON.stringify(game.removed)), [[{ id: "row1", amount: 10_000 }, { id: "row1", amount: 10_000 }]]);
});

test("the same for a container, which has no toast to say", () => {
    const game = fakeGame();
    const { addUnitsToStash } = inventoryAdd(game);
    assert.equal(addUnitsToStash(game.stash, { item: "money", amount: 12_000, notify: true }).ok, true);
    assert.deepEqual(game.calls.map((call) => call.amount), [10_000, 2_000]);
    assert.deepEqual(game.calls.map((call) => call.notify), [undefined, undefined], "a container has no toast: no notify goes to it");
    assert.equal(game.rows[0].amount, 12_000);
});

test("nothing that is not a positive amount is passed on as if it were fine", () => {
    const game = fakeGame();
    const { addUnits } = inventoryAdd(game);
    assert.equal(addUnits({}, { item: "money", amount: 0 }).ok, false);
    assert.equal(addUnits({}, { item: "money", amount: -5 }).ok, false);
    assert.equal(addUnits({}, { item: "money", amount: Number.NaN }).ok, false);
});
