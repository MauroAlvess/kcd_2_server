const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// Only the approved accounts come in (src/server/whitelist.ts), from secrets/whitelist.json, read at every join.

const ME = "76561198000000001";
const OTHER = "76561198000000002";

function load(file) {
    const state = { file, logs: [], errors: [], handlers: new Map() };
    const context = {
        exports: {},
        require: (id) => {
            assert.equal(id, "node:fs");
            return {
                readFileSync: (name) => {
                    assert.equal(name, "secrets/whitelist.json");
                    if (state.file === undefined) {
                        throw Object.assign(new Error("no such file"), { code: "ENOENT" });
                    }
                    return state.file;
                },
            };
        },
        console: { log: (line) => state.logs.push(line), error: (line) => state.errors.push(line) },
        Events: { on: (name, fn) => state.handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/whitelist.js"), "utf8"), context);
    context.exports.installWhitelist();
    const join = (steamId, epicId = "") => {
        const connection = { nickname: "Hans", steamId, epicId, ip: "1.2.3.4", rejected: null, reject(reason) { this.rejected = reason; } };
        state.handlers.get("playerConnecting")(connection);
        return connection.rejected;
    };
    return { api: context.exports, state, join };
}

const listOf = (enforce, ...ids) => JSON.stringify({ enforce, accounts: ids.map((steamId) => ({ steamId, name: "x", addedAt: "2026-10-16" })) });

test("with the list on, an approved Steam account comes in and any other is turned away, told how to ask", () => {
    const sut = load(listOf(true, ME));
    assert.equal(sut.join(ME), null);
    assert.equal(sut.join(OTHER), sut.api.NOT_LISTED);
    assert.equal(sut.join("", "epic-account"), sut.api.NOT_LISTED, "an Epic account has no Steam id to be saved under");
    assert.match(sut.api.NOT_LISTED, /formulário.*discord\.gg\/p2wpuaGC3F/);
    assert.ok(sut.state.logs.some((line) => line === "whitelist: 1 conta(s) aprovada(s); quem não está na lista é recusado"));
    assert.ok(sut.state.logs.some((line) => line === `whitelist: recusei Hans (Steam ${OTHER}): não está na lista`));
});

test("the file is read at every join: an approval counts at the next try, without a restart", () => {
    const sut = load(listOf(true, ME));
    assert.equal(sut.join(OTHER), sut.api.NOT_LISTED);
    sut.state.file = listOf(true, ME, OTHER);
    assert.equal(sut.join(OTHER), null);
});

test("with no file everyone comes in; with the list off too, and the log names who is not on it", () => {
    const none = load(undefined);
    assert.equal(none.join(OTHER), null);
    assert.ok(none.state.logs.some((line) => /sem secrets\/whitelist\.json; entra quem souber a senha/.test(line)));
    const watching = load(listOf(false, ME));
    assert.equal(watching.join(OTHER), null);
    assert.ok(watching.state.logs.some((line) => /Hans \(Steam 76561198000000002\) não está na lista; entrou porque o bloqueio está desligado/.test(line)));
});

test("a file that cannot be understood turns everybody away and says why", () => {
    for (const bad of ["{ not json", JSON.stringify({ enforce: true, accounts: [{ steamId: "123" }] }), JSON.stringify({ enforce: true })]) {
        const sut = load(bad);
        assert.equal(sut.join(ME), sut.api.UNAVAILABLE, bad);
        assert.ok(sut.state.errors.some((line) => /ninguém entra até isso ser corrigido/.test(line)));
    }
});
