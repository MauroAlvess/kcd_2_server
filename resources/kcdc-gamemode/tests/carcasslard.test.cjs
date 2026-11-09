"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The lard in the pigs the hunters butcher (src/server/carcass-lard.ts, 2026-11-04): beside the meat and the hide of the carcass, for a hunter only.

function load({ hunter = true, fails = false, throws = false } = {}) {
    const state = { adds: [], logs: [], handlers: new Map() };
    const context = {
        exports: {},
        require: (id) => ({ "./guild-crafts.js": { mayCraft: (player, craft) => craft === "abate" && hunter } })[id] ?? assert.fail(`unexpected require ${id}`),
        console: { log: (line) => state.logs.push(line) },
        Math,
        Inventory: {
            add: (owner, request) => {
                if (throws) throw new Error("gone");
                state.adds.push({ ...request });
                return fails ? { ok: false, code: "inventoryUnavailable" } : { ok: true, code: "" };
            },
        },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/carcass-lard.js"), "utf8"), context);
    return { api: context.exports, state };
}

const hunter = { nickname: "Jan" };
const plain = (value) => JSON.parse(JSON.stringify(value));

test("a farm pig's carcass holds one to three lards and a boar's one or two, with the hunter's name in the log", () => {
    const sut = load();
    assert.equal(sut.api.carcassLard({ actorClass: "Pig" }, hunter, () => 0), 1);
    assert.equal(sut.api.carcassLard({ actorClass: "Pig" }, hunter, () => 0.99), 3);
    assert.equal(sut.api.carcassLard({ actorClass: "Boar" }, hunter, () => 0), 1);
    assert.equal(sut.api.carcassLard({ actorClass: "Boar" }, hunter, () => 0.99), 2);
    assert.deepEqual(plain(sut.state.adds), [
        { item: "special_lard", amount: 1, notify: false },
        { item: "special_lard", amount: 3, notify: false },
        { item: "special_lard", amount: 1, notify: false },
        { item: "special_lard", amount: 2, notify: false },
    ]);
    assert.ok(sut.state.logs.some((line) => /abate: Jan abateu um porco: 3x banha na carcaça/.test(line)));
    assert.ok(sut.state.logs.some((line) => /abate: Jan abateu um javali: 2x banha na carcaça/.test(line)));
});

test("no lard in any other body, in a carcass of somebody who is no hunter, or when the stock turns it down", () => {
    const sut = load();
    for (const actorClass of ["CattleCow", "SheepEwe", "RoeDeerHind", "RedDeerStag", "Hare", "Wolf", "NPC"]) {
        assert.equal(sut.api.carcassLard({ actorClass }, hunter), 0, actorClass);
    }
    assert.deepEqual(sut.state.adds, []);

    const stranger = load({ hunter: false });
    assert.equal(stranger.api.carcassLard({ actorClass: "Pig" }, hunter), 0);
    assert.deepEqual(stranger.state.adds, []);

    const refusing = load({ fails: true });
    assert.equal(refusing.api.carcassLard({ actorClass: "Pig" }, hunter), 0);
    assert.ok(refusing.state.logs.some((line) => /a banha não entrou na carcaça \(inventoryUnavailable\)/.test(line)));

    const broken = load({ throws: true });
    assert.equal(broken.api.carcassLard({ actorClass: "Pig" }, hunter), 0);
    assert.ok(broken.state.logs.some((line) => /a banha não entrou na carcaça: .*gone/.test(line)));
});

test("installed: the butchering of a pig adds the lard", () => {
    const sut = load();
    sut.api.installCarcassLard();
    sut.state.handlers.get("npcHarvested")({ actorClass: "Pig" }, hunter);
    assert.equal(sut.state.adds.length, 1);
    assert.equal(sut.state.adds[0].item, "special_lard");
});
