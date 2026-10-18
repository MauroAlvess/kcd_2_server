const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(existing = []) {
    const items = new Map();
    for (const id of existing) {
        items.set(id, { id, destroyed: false, destroy() { this.destroyed = true; items.delete(id); } });
    }
    const handlers = new Map();
    const intervals = [];
    const logs = [];
    const clock = { now: 0 };
    const context = {
        exports: {},
        console: { log: (line) => logs.push(line) },
        Date: { now: () => clock.now },
        setInterval: (fn, ms) => { intervals.push({ fn, ms }); return intervals.length; },
        clearInterval() {},
        Events: { on: (name, fn) => handlers.set(name, fn) },
        GroundItem: {
            all: () => [...items.values()],
            getById: (id) => items.get(id) ?? null,
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/ground-items.js"), "utf8"), context);
    const drop = (id) => {
        const item = {
            id,
            destroyed: false,
            destroy() { this.destroyed = true; items.delete(id); handlers.get("groundItemDestroy")?.(this); },
        };
        items.set(id, item);
        handlers.get("groundItemSpawn")?.(item);
        return item;
    };
    return { api: context.exports, items, handlers, intervals, logs, clock, drop };
}

test("a stack on the ground goes after thirty minutes, and not a minute before", () => {
    const sut = load();
    sut.api.installGroundItemExpiry();
    const bread = sut.drop(1);

    sut.clock.now = 29 * 60_000;
    sut.intervals[0].fn();
    assert.equal(bread.destroyed, false);

    sut.clock.now = 30 * 60_000;
    sut.intervals[0].fn();
    assert.equal(bread.destroyed, true);
    assert.ok(sut.logs.some((line) => /1 item\(ns\) no chão sumiram depois de 30 min/.test(line)));
});

test("each stack keeps its own time", () => {
    const sut = load();
    sut.api.installGroundItemExpiry();
    const early = sut.drop(1);
    sut.clock.now = 20 * 60_000;
    const late = sut.drop(2);

    sut.clock.now = 31 * 60_000;
    sut.intervals[0].fn();
    assert.equal(early.destroyed, true);
    assert.equal(late.destroyed, false);

    sut.clock.now = 51 * 60_000;
    sut.intervals[0].fn();
    assert.equal(late.destroyed, true);
});

test("a stack picked up in the meantime is forgotten, and a new one with the same id starts its own count", () => {
    const sut = load();
    sut.api.installGroundItemExpiry();
    const first = sut.drop(7);
    sut.clock.now = 10 * 60_000;
    first.destroy();
    assert.equal(sut.api.groundItemExpiry.tracked, 0);

    const again = sut.drop(7);
    sut.clock.now = 35 * 60_000;
    sut.intervals[0].fn();
    assert.equal(again.destroyed, false, "only 25 minutes on the ground");
});

test("stacks that were there before the script started are counted from the first sweep", () => {
    const sut = load([5]);
    const expiry = new sut.api.GroundItemExpiry(30 * 60_000, () => sut.clock.now);
    sut.clock.now = 1_000;
    assert.equal(expiry.sweep(), 0);
    sut.clock.now = 1_000 + 30 * 60_000;
    assert.equal(expiry.sweep(), 1);
});

test("the sweep runs every minute and stops with the resource", () => {
    const sut = load();
    sut.api.installGroundItemExpiry();
    assert.equal(sut.intervals[0].ms, 60_000);
    assert.doesNotThrow(() => sut.handlers.get("resourceStop")("kcdc-gamemode"));
});
