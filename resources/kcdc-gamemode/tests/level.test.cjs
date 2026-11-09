"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// Which level the server runs (src/server/level.ts, 2026-11-09): `mod.level` of server.json, Kuttenberg when it says nothing or cannot be read.

function load(files) {
    const reads = [];
    const store = {
        read: (file) => {
            reads.push(file);
            const text = files[file];
            if (text === undefined) return { status: "missing" };
            if (text === "corrupt") return { status: "corrupt", reason: "bad" };
            return { status: "ok", value: JSON.parse(text), fromBackup: false };
        },
    };
    const context = { exports: {}, require: (id) => (id === "./store.js" ? store : assert.fail(`unexpected require ${id}`)), RegExp, String };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/level.js"), "utf8"), context);
    return { api: context.exports, reads };
}

test("the level is what server.json names, in small letters; only Kuttenberg's is Kuttenberg", () => {
    const trosky = load({ "server.json": JSON.stringify({ port: 27015, mod: { level: "trosecko", scoreboard: false } }) });
    assert.equal(trosky.api.levelName(), "trosecko");
    assert.equal(trosky.api.onKuttenberg(), false);
    const monastery = load({ "server.json": JSON.stringify({ mod: { level: " Klaster " } }) });
    assert.equal(monastery.api.levelName(), "klaster", "trimmed and lowered");
    assert.equal(monastery.api.onKuttenberg(), false);
    const home = load({ "server.json": JSON.stringify({ mod: { level: "kutnohorsko" } }) });
    assert.equal(home.api.onKuttenberg(), true);
});

test("a file that says nothing, is missing, is unreadable or names something that is no level is Kuttenberg, as the server has always run", () => {
    for (const files of [{}, { "server.json": "corrupt" }, { "server.json": JSON.stringify({}) }, { "server.json": JSON.stringify({ mod: {} }) }, { "server.json": JSON.stringify({ mod: { level: 7 } }) }, { "server.json": JSON.stringify({ mod: { level: "../x" } }) }, { "server.json": JSON.stringify({ mod: { level: "" } }) }]) {
        const sut = load(files);
        assert.equal(sut.api.levelName(), "kutnohorsko", JSON.stringify(files));
        assert.equal(sut.api.onKuttenberg(), true);
    }
});

test("the file is read once; forgetting what was read reads it again", () => {
    const files = { "server.json": JSON.stringify({ mod: { level: "trosecko" } }) };
    const sut = load(files);
    sut.api.levelName();
    sut.api.onKuttenberg();
    sut.api.levelName();
    assert.deepEqual(sut.reads, ["server.json"], "once");
    files["server.json"] = JSON.stringify({ mod: { level: "kutnohorsko" } });
    sut.api.forgetLevel();
    assert.equal(sut.api.levelName(), "kutnohorsko");
    assert.equal(sut.reads.length, 2);
});

test("the entry file puts into the world at Kuttenberg's coordinates only on Kuttenberg's level, and the other modules still start", () => {
    const source = fs.readFileSync(path.join(__dirname, "../src/server/index.ts"), "utf8");
    for (const call of ["installVendors", "installBarbers", "installTeachers", "installTravel", "installFarm", "installGuildVendors", "installWildHorses"]) {
        const at = source.indexOf(`    ${call}();`);
        assert.ok(at > 0, `${call}() is called`);
        const before = source.lastIndexOf("\n", source.lastIndexOf("\n", at) - 1);
        assert.match(source.slice(before, at), /if \(kuttenberg\) \{\s*$/, `${call}() is under the Kuttenberg switch`);
    }
    // What the level itself offers is not behind it.
    for (const call of ["installAnimalPopulation", "installBandits", "installNests", "installProperties", "installStatus", "installAuth", "installCitizenship"]) {
        assert.ok(new RegExp(`\\n${call}\\(`).test(source), `${call}() is not behind the switch`);
    }
});
