"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The meat of a butchered animal (src/server/carcass.ts, 2026-10-22: "está vindo carne demais"): each raw meat or organ in the carcass is cut
// to a share of what the game put there, never below one of each; the hide and the rest are not touched.

const DEER_MEAT = "a0a6a756-e204-4943-b215-543471b5cc39";
const DEER_HEART = "537ef442-be44-4e97-85a4-cc02344d8a5e";
const HARE_MEAT = "6f1d0e9e-d532-4476-af7a-e24ea01da040";
const HIDE = "00000000-0000-4000-8000-000000000001";

function load(rows, { refuse = false } = {}) {
    const removed = [];
    const data = { exports: {} };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/cooking-data.js"), "utf8"), data);
    const context = {
        exports: {},
        require: (id) => (id === "./cooking-data.js" ? data.exports : assert.fail(`unexpected require ${id}`)),
        Math,
        String,
        Inventory: {
            get: () => ({ revision: 1, items: rows }),
            remove: (owner, request) => {
                removed.push(JSON.parse(JSON.stringify(request)));
                return { ok: !refuse, code: refuse ? "refused" : "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/carcass.js"), "utf8"), context);
    return { api: context.exports, removed };
}

test("each meat of the carcass is cut to half, never below one, and the hide is left as it is", () => {
    const sut = load([
        { id: "r1", item: DEER_MEAT, amount: 8 },
        { id: "r2", item: DEER_HEART, amount: 1 },
        { id: "r3", item: HARE_MEAT, amount: 3 },
        { id: "r4", item: HIDE, amount: 2 },
    ]);
    const trimmed = sut.api.trimCarcass({ id: 1 });
    assert.deepEqual(sut.removed, [{ units: [{ id: "r1", amount: 4 }, { id: "r3", amount: 1 }], notify: false }], "8 -> 4, 1 stays 1, 3 -> 2 (1.5 rounded up), the hide untouched");
    assert.deepEqual({ ...trimmed }, { before: 12, after: 7 });
});

test("the share can be changed, and a share of everything leaves the carcass as it is", () => {
    const rows = [{ id: "r1", item: DEER_MEAT, amount: 10 }];
    assert.equal(load(rows).api.carcassSettings.meatShare, 0.5);
    const sut = load(rows);
    sut.api.carcassSettings.meatShare = 0.2;
    assert.deepEqual({ ...sut.api.trimCarcass({ id: 1 }) }, { before: 10, after: 2 });
    const whole = load(rows);
    whole.api.carcassSettings.meatShare = 1;
    assert.deepEqual({ ...whole.api.trimCarcass({ id: 1 }) }, { before: 10, after: 10 });
    assert.deepEqual(whole.removed, [], "nothing to take out, nothing asked");
});

test("how many stay of a row: a share of it, rounded, at least one and never more than there were", () => {
    const { api } = load([]);
    assert.equal(api.keptOf(8, 0.5), 4);
    assert.equal(api.keptOf(1, 0.5), 1);
    assert.equal(api.keptOf(3, 0.5), 2);
    assert.equal(api.keptOf(5, 0.1), 1);
    assert.equal(api.keptOf(2, 3), 2);
});

test("a carcass the game will not take the meat out of, or one that cannot be read, is left as it is", () => {
    const refused = load([{ id: "r1", item: DEER_MEAT, amount: 8 }], { refuse: true });
    assert.deepEqual({ ...refused.api.trimCarcass({ id: 1 }) }, { before: 8, after: 8 });
    const empty = load([]);
    assert.deepEqual({ ...empty.api.trimCarcass({ id: 1 }) }, { before: 0, after: 0 });
});
