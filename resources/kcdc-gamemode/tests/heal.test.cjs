const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

function load(files = new Map()) {
    const handlers = new Map();
    const timers = [];
    const players = new Map();
    const logs = [];
    const store = {
        ensureDir() {},
        read: (file) => (files.has(file) ? { status: "ok", value: JSON.parse(files.get(file)), fromBackup: false } : { status: "missing" }),
        write: (file, value) => files.set(file, JSON.stringify(value)),
    };
    const heal = { exports: {}, require: (id) => (id === "./store.js" ? store : assert.fail(`unexpected ${id}`)), console: { log: (line) => logs.push(line) }, Events: { on: (name, fn) => handlers.set(name, fn) }, setTimeout: (fn, ms) => timers.push({ fn, ms }), Chat: { sendToPlayer: (player, text) => player.chat.push(text) }, Player: { getById: (id) => players.get(id) ?? null } };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/heal.js"), "utf8"), heal);
    heal.exports.installHeal();
    const makePlayer = (id, steamId, nickname) => {
        const player = { id, steamId, nickname, chat: [], heals: [], cleared: [], heal(options) { this.heals.push(options); return true; }, clearBuffs(tag) { this.cleared.push(tag); return true; } };
        players.set(id, player);
        return player;
    };
    return { api: heal.exports, handlers, timers, files, makePlayer, logs };
}

test("/curar's cure stops the bleeding and closes the injuries, or heals everything", () => {
    const sut = load();
    const maxx = sut.makePlayer(1, "765", "Maxxtro");
    assert.equal(sut.api.cure(maxx, "sangramento"), true);
    assert.deepEqual(JSON.parse(JSON.stringify(maxx.heals[0])), { health: false, injuries: true, poisons: false, bleeding: true });
    assert.deepEqual(Array.from(maxx.cleared), ["bleed"]);
    sut.api.cure(maxx, "tudo");
    assert.deepEqual(JSON.parse(JSON.stringify(maxx.heals[1])), {});
});

test("a cure kept for somebody away is given a few seconds after their next entry, once", () => {
    const files = new Map();
    const first = load(files);
    first.api.cureLater("765", "sangramento");
    const sut = load(files);
    const maxx = sut.makePlayer(3, "765", "Maxxtro");
    sut.handlers.get("playerSpawned")(maxx);
    assert.equal(maxx.heals.length, 0, "not before the body is dressed");
    assert.equal(sut.timers[0].ms, 8000);
    sut.timers[0].fn();
    assert.equal(maxx.heals.length, 1);
    assert.match(maxx.chat[0], /estancou o seu sangramento/);
    assert.deepEqual(JSON.parse(files.get("playerdata/heal-on-join.json")), {});
    sut.handlers.get("playerSpawned")(maxx);
    assert.equal(sut.timers.length, 1, "nothing waits any more");
});
