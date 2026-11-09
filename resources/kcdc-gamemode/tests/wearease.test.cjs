"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Wear that is gentler (src/server/wear-ease.ts, 2026-10-31): the server gives back part of the condition the game took off in use.

function load({ saved = null } = {}) {
    const state = { logs: [], properties: [], refuse: false, throws: false, files: new Map(), writes: [] };
    if (saved !== null) state.files.set("playerdata/wear-ease.json", JSON.stringify(saved));
    let handler = null;
    const store = {
        ensureDir() {},
        read: (file) => (state.files.has(file) ? { status: "ok", value: JSON.parse(state.files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, body) => { state.writes.push([file, body]); state.files.set(file, JSON.stringify(body)); },
    };
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? store : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => state.logs.push(line) },
        Events: { on: (name, fn) => { if (name === "playerInventoryChanged") handler = fn; } },
        Inventory: {
            setProperties: (player, request) => {
                if (state.throws) throw new Error("gone");
                state.properties.push(request);
                return { ok: !state.refuse, code: state.refuse ? "revisionMismatch" : "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/wear-ease.js"), "utf8"), context);
    context.exports.installWearEase();
    return { api: context.exports, state, change: (reason, items) => handler({ nickname: "Hans" }, { reason, items }) };
}

const row = (condition, extra = {}) => ({ name: "swordMilitary01", condition, metadata: { quality: 2, health: 50, condition, ...extra } });

test("of the condition the game takes off, only the share stays taken: the rest is put back, the row otherwise as it is", () => {
    const sut = load();
    assert.equal(sut.api.wearEase.share, 0.55);
    sut.change("wear", [{ id: "r1", before: row(0.9), after: row(0.8, { custom: { data: { repairs: 1 } } }) }]);
    assert.equal(sut.state.properties.length, 1);
    const set = sut.state.properties[0];
    assert.equal(set.id, "r1");
    assert.ok(Math.abs(set.metadata.condition - (0.9 - 0.1 * 0.55)) < 1e-4, `${set.metadata.condition}`);
    assert.equal(set.metadata.health, undefined, "the condition, not the health: they must not disagree");
    assert.equal(set.metadata.quality, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(set.metadata.custom)), { data: { repairs: 1 } });
});

test("every row of a wear is eased on its own; what did not wear, what has no before or after, and what is not a wear are left alone", () => {
    const sut = load();
    sut.change("wear", [
        { id: "a", before: row(1), after: row(0.9) },
        { id: "b", before: row(0.5), after: row(0.5) },
        { id: "c", before: null, after: row(0.3) },
        { id: "d", before: row(0.4), after: null },
        { id: "e", before: row(0.2), after: row(0.3) },
        { id: "f", before: row(0.5), after: row(0.4996) },
    ]);
    assert.deepEqual(sut.state.properties.map((request) => request.id), ["a"], "only the row that wore");
    sut.change("repair", [{ id: "g", before: row(0.4), after: row(0.1) }]);
    sut.change("sharpen", [{ id: "h", before: row(0.4), after: row(0.1) }]);
    sut.change("add", [{ id: "i", before: null, after: row(1) }]);
    assert.equal(sut.state.properties.length, 1);
});

test("the share is an administrator's: kept between starts, held between its limits, and 100 is the game's own wear (nothing is given back)", () => {
    const sut = load();
    assert.equal(sut.api.setWearShare(0.4), 0.4);
    assert.deepEqual(JSON.parse(JSON.stringify(sut.state.writes.at(-1))), ["playerdata/wear-ease.json", { v: 1, share: 0.4 }]);
    assert.equal(sut.api.setWearShare(5), 1, "never more than the game's own");
    assert.equal(sut.api.setWearShare(0), 0.05, "never none at all");
    assert.equal(sut.api.setWearShare("x"), 0.55, "what is no number is the default");
    sut.api.setWearShare(1);
    sut.change("wear", [{ id: "r1", before: row(0.9), after: row(0.8) }]);
    assert.deepEqual(sut.state.properties, [], "at 100 the game's wear stands");
    assert.match(sut.api.describeWear(), /o do jogo, sem amenizar/);

    const next = load({ saved: { v: 1, share: 0.3 } });
    assert.equal(next.api.wearEase.share, 0.3, "read at the next start");
    assert.ok(next.state.logs.some((line) => /Desgaste: .*30%/.test(line)));
    const odd = load({ saved: { v: 1, share: "lots" } });
    assert.equal(odd.api.wearEase.share, 0.55);
});

test("a row the game no longer has, or one it turns down, is no failure: nothing is counted and nothing breaks", () => {
    const sut = load();
    sut.state.throws = true;
    assert.equal(sut.api.easeWear({ nickname: "Hans" }, { reason: "wear", items: [{ id: "r1", before: row(0.9), after: row(0.8) }] }), 0);
    sut.state.throws = false;
    sut.state.refuse = true;
    assert.equal(sut.api.easeWear({ nickname: "Hans" }, { reason: "wear", items: [{ id: "r1", before: row(0.9), after: row(0.8) }] }), 0);
    sut.state.refuse = false;
    assert.equal(sut.api.easeWear({ nickname: "Hans" }, { reason: "wear", items: [{ id: "r1", before: row(0.9), after: row(0.8) }] }), 1);
});

test("a piece the wear leaves with nothing is given nothing back: it breaks and goes (wear-break.ts, 2026-11-04)", () => {
    const sut = load();
    sut.change("wear", [
        { id: "broken", before: row(0.004), after: row(0) },
        { id: "noise", before: row(0.003), after: row(0.0004) },
        { id: "worn", before: row(0.05), after: row(0.03) },
    ]);
    assert.deepEqual(sut.state.properties.map((request) => request.id), ["worn"], "only the piece with something left is eased");
});
