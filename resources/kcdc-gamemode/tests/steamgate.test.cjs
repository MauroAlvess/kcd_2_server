"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// A join with no Steam account is turned away, and a character belongs to the account, never to the name typed in the menu (src/server/steam-gate.ts, 2026-10-25).

const FILE = "secrets/steam-gate.json";

function load(file) {
    const state = { file, logs: [], errors: [], handlers: new Map() };
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "node:fs");
            return {
                readFileSync: (name) => {
                    assert.equal(name, FILE);
                    if (state.file === undefined) throw Object.assign(new Error("no such file"), { code: "ENOENT" });
                    return state.file;
                },
            };
        },
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/steam-gate.js"), "utf8"), context);
    context.exports.installSteamGate();
    const join = (steamId, nickname = "Radovan") => {
        const connection = { nickname, steamId, ip: "1.2.3.4", hardwareId: "4241545015", rejected: null, reject(reason) { this.rejected = reason; } };
        state.handlers.get("playerConnecting")(connection);
        return connection.rejected;
    };
    const spawn = (steamId, nickname = "Radovan") => {
        const player = { nickname, steamId, hardwareId: "4241545015", kicked: null, kick(reason) { this.kicked = reason; } };
        state.handlers.get("playerSpawned")(player);
        return player.kicked;
    };
    return { api: context.exports, state, join, spawn };
}

test("a join with a Steam account comes in, whatever name was typed in the menu; one with none is turned away, told what to do", () => {
    const sut = load(undefined);
    assert.equal(sut.join("76561198000000001", "Player"), null);
    assert.equal(sut.join("76561198000000001", "Radovan"), null, "another name, the same account: nothing to say about it");
    assert.equal(sut.join("", "Radovan"), sut.api.STEAM_NEEDED);
    assert.equal(sut.join("", "Player"), sut.api.STEAM_NEEDED);
    assert.match(sut.api.STEAM_NEEDED, /conta Steam/);
    assert.match(sut.api.STEAM_NEEDED, /No Steam account reached the server/);
    assert.match(sut.api.STEAM_NEEDED, /não é a lista de aprovados/, "it says it is not about the approval list (2026-10-29)");
    assert.ok(Buffer.byteLength(sut.api.STEAM_NEEDED) <= 512, "the connecting screen takes 512 bytes at most");
    assert.ok(sut.state.logs.some((line) => /steam-gate: recusei Radovan de 1\.2\.3\.4: o cliente não informou uma conta Steam/.test(line)));
    assert.ok(sut.state.logs.every((line) => !/76561198/.test(line)), "no Steam id in the log");
});

test("the file can switch the demand off without a restart, and a file that cannot be read keeps it on", () => {
    const sut = load(JSON.stringify({ required: false }));
    assert.equal(sut.join(""), null);
    assert.ok(sut.state.logs.some((line) => /entrou porque a exigência está desligada/.test(line)));
    sut.state.file = JSON.stringify({ required: true });
    assert.equal(sut.join(""), sut.api.STEAM_NEEDED, "read again at every join");
    for (const bad of ["{ not json", "null", "42"]) {
        sut.state.file = bad;
        assert.equal(sut.join(""), sut.api.STEAM_NEEDED, bad);
    }
    assert.ok(sut.state.errors.some((line) => /não é um JSON válido: .*; a conta Steam continua sendo exigida/.test(line)));
    sut.state.file = undefined;
    assert.equal(sut.join(""), sut.api.STEAM_NEEDED, "no file: required");
});

test("a body that arrives in the world with no authenticated Steam account is sent out; one with an account is left alone", () => {
    const sut = load(undefined);
    assert.equal(sut.spawn("76561198000000001"), null);
    assert.equal(sut.spawn(""), sut.api.STEAM_NEEDED);
    assert.ok(sut.state.logs.some((line) => /chegou sem conta Steam autenticada/.test(line)));
    const off = load(JSON.stringify({ required: false }));
    assert.equal(off.spawn(""), null);
});

test("the gate is installed beside the whitelist, and the welcome names the character, never the menu's name", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/server/index.ts"), "utf8");
    // Before the whitelist since 2026-10-27: a client with no Steam account at all is told to open Steam, not that its (empty) id is not on the list.
    assert.match(source, /installSteamGate\(\);\s*(\/\/[^\n]*\s*)*installWhitelist\(\);/);
    assert.match(source, /nameOf\(player\)/);
    assert.doesNotMatch(source, /Bem-vindo, \$\{player\.nickname\}/);
});
