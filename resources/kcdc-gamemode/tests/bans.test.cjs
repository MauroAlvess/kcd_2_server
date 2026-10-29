"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Banned Steam accounts (src/server/bans.ts, 2026-10-26): kept in playerdata/bans.json, turned away at the door, put out of a body that got in.

const BAD = "76561198000000666";
const GOOD = "76561198000000001";

function fakeDisk(seed) {
    const files = new Map(seed === undefined ? [] : [["playerdata/bans.json", JSON.stringify(seed)]]);
    return {
        files,
        fs: {
            readFileSync(file) {
                if (!files.has(file)) {
                    const error = new Error("ENOENT");
                    error.code = "ENOENT";
                    throw error;
                }
                return files.get(file);
            },
            writeFileSync(file, data) { files.set(file, data); },
            mkdirSync() {},
            renameSync(from, to) { files.set(to, files.get(from)); files.delete(from); },
            existsSync: (file) => files.has(file),
        },
    };
}

function load(seed) {
    const disk = fakeDisk(seed);
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const handlers = new Map();
    const logs = [];
    const players = [];
    const context = {
        exports: {},
        require: (id) => (id === "./store.js" ? storeSandbox.exports : assert.fail(`unexpected require ${id}`)),
        console: { log: (line) => logs.push(line) },
        Events: { on: (name, fn) => handlers.set(name, fn) },
        Player: { all: () => players },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/bans.js"), "utf8"), context);
    const kicked = [];
    const join = (steamId, nickname) => {
        const player = { steamId, nickname, kick: (message) => kicked.push([nickname, message]) };
        players.push(player);
        return player;
    };
    return { api: context.exports, disk, handlers, logs, kicked, join, saved: () => JSON.parse(disk.files.get("playerdata/bans.json")) };
}

test("a ban is kept by Steam id with who made it and when, and read back after a restart", () => {
    const sut = load();
    sut.api.installBans();
    const outcome = sut.api.bans.ban(BAD, "askelad", "Mauro", "matou cavalos");
    assert.equal(outcome.ok, true);
    assert.equal(sut.api.bans.isBanned(BAD), true);
    assert.equal(sut.api.bans.isBanned(GOOD), false);
    const file = sut.saved();
    assert.equal(file.v, 1);
    assert.equal(file.bans[BAD].name, "askelad");
    assert.equal(file.bans[BAD].by, "Mauro");
    assert.equal(file.bans[BAD].reason, "matou cavalos");
    assert.ok(file.bans[BAD].at > 0);

    const again = load(file);
    again.api.installBans();
    assert.equal(again.api.bans.isBanned(BAD), true, "after a restart");
    assert.ok(again.logs.some((line) => /1 conta\(s\) banida\(s\)/.test(line)));
});

test("a banned account is turned away at the door with the ban's words; others pass", () => {
    const sut = load({ v: 1, bans: { [BAD]: { name: "askelad", by: "Mauro", at: 1, reason: "" } } });
    sut.api.installBans();
    const rejected = [];
    sut.handlers.get("playerConnecting")({ steamId: BAD, nickname: "Player", reject: (message) => rejected.push(message) });
    sut.handlers.get("playerConnecting")({ steamId: GOOD, nickname: "Hans", reject: (message) => rejected.push(message) });
    sut.handlers.get("playerConnecting")({ steamId: "", nickname: "Sem Steam", reject: (message) => rejected.push(message) });
    assert.deepEqual(rejected, [sut.api.BANNED_MESSAGE]);
    assert.match(rejected[0], /banida/);
});

test("a banned account that got into a body is put out, and a ban made now puts out the player who is online (kickBanned)", () => {
    const sut = load();
    sut.api.installBans();
    const bad = sut.join(BAD, "askelad");
    const good = sut.join(GOOD, "Hans");
    sut.handlers.get("playerSpawned")(good);
    assert.deepEqual(sut.kicked, [], "an account not banned stays");

    sut.api.bans.ban(BAD, "askelad", "Mauro");
    assert.equal(sut.api.kickBanned(), 1);
    assert.deepEqual(sut.kicked, [["askelad", sut.api.BANNED_MESSAGE]]);

    const later = load(sut.saved());
    later.api.installBans();
    later.handlers.get("playerSpawned")(later.join(BAD, "askelad"));
    assert.equal(later.kicked.length, 1, "and at the spawn of a body that came in some other way");
    assert.ok(bad);
});

test("unbanning, double bans and accounts with no Steam id are answered, not crashed on", () => {
    const sut = load();
    sut.api.installBans();
    assert.equal(sut.api.bans.ban("", "Sem Steam", "Mauro").ok, false);
    assert.equal(sut.api.bans.ban("abc", "Estranho", "Mauro").ok, false);
    assert.equal(sut.api.bans.ban(BAD, "askelad", "Mauro").ok, true);
    assert.equal(sut.api.bans.ban(BAD, "askelad", "Mauro").ok, false, "already banned");
    assert.equal(sut.api.bans.unban(GOOD, "Hans", "Mauro").ok, false, "not banned");
    assert.equal(sut.api.bans.unban(BAD, "askelad", "Mauro").ok, true);
    assert.equal(sut.api.bans.isBanned(BAD), false);
    assert.deepEqual(sut.saved().bans, {});
});

test("a file that cannot be read bans nobody and is never written over", () => {
    const disk = fakeDisk();
    disk.files.set("playerdata/bans.json", "{ this is not json");
    const storeSandbox = { exports: {}, require: () => disk.fs };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/store.js"), "utf8"), storeSandbox);
    const logs = [];
    const context = {
        exports: {},
        require: () => storeSandbox.exports,
        console: { log: (line) => logs.push(line) },
        Events: { on() {} },
        Player: { all: () => [] },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/bans.js"), "utf8"), context);
    context.exports.installBans();
    assert.equal(context.exports.bans.isBanned(BAD), false);
    assert.equal(context.exports.bans.ban(BAD, "askelad", "Mauro").ok, false);
    assert.equal(disk.files.get("playerdata/bans.json"), "{ this is not json", "left exactly as it was");
    assert.ok(logs.some((line) => /ilegível/.test(line)));
});
