"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const dist = (name) => fs.readFileSync(path.join(__dirname, "../dist/server", name), "utf8");

// The places of the guild vendors (src/server/guild-posts-data.ts, made by tools/make-guild-posts.py from the level's own entities and the census).
const sandbox = { exports: {} };
vm.runInNewContext(dist("guild-posts-data.js"), sandbox);
const POSTS = sandbox.exports.GUILD_POSTS;

const TOWNS = ["suchdol", "wysoka", "opatowitz", "raborsch", "bohunowitz", "horschan", "malesov", "bylany", "rabstein", "stara-lhota", "kuttenberg", "stara-kutna", "danemark", "pschitoky", "miskowitz", "minas"];
const GUILDS = { ferreiro: "fabri-ferrarii", alquimista: "alchemistae", taberneiro: "tabernarii", cacador: "venatores", artesao: "artifices", coletor: "collectores", agricultor: "agricolae", domador: "domitores" };

test("each of the sixteen towns has one vendor for each of the eight guilds: 128 posts, named <trade>-<town>", () => {
    assert.equal(POSTS.length, TOWNS.length * Object.keys(GUILDS).length);
    assert.equal(new Set(POSTS.map((post) => post[0])).size, POSTS.length, "no id twice");
    for (const town of TOWNS) {
        for (const [trade, guild] of Object.entries(GUILDS)) {
            const post = POSTS.find((one) => one[0] === `${trade}-${town}`);
            assert.ok(post, `${trade}-${town}`);
            assert.equal(post[1], guild);
            assert.equal(post[2], town);
        }
    }
});

test("every post has a place of the world and a way to face, and says where it was taken from; no two vendors of a town stand on one spot", () => {
    for (const [id, , town, x, y, z, yaw, source] of POSTS) {
        for (const value of [x, y, z, yaw]) assert.ok(Number.isFinite(value), `${id}: ${value}`);
        assert.ok(x > 0 && x < 4096 && y > 0 && y < 4096, `${id} is on the map`);
        assert.ok(yaw >= -180 && yaw <= 180, `${id}: yaw ${yaw}`);
        assert.ok(typeof source === "string" && source.length > 0, `${id}: a source`);
        assert.ok(TOWNS.includes(town));
    }
    for (const town of TOWNS) {
        const here = POSTS.filter((post) => post[2] === town);
        for (let a = 0; a < here.length; a += 1) {
            for (let b = a + 1; b < here.length; b += 1) {
                const apart = Math.hypot(here[a][3] - here[b][3], here[a][4] - here[b][4]);
                assert.ok(apart >= 1.5, `${here[a][0]} and ${here[b][0]} are ${apart.toFixed(1)} m apart`);
            }
        }
    }
});

test("most vendors stand where the game puts their trade; the rest are on a ring round the middle of the town, for an administrator to move; Suchdol's five keep the places of the first vendors", () => {
    const atTheGame = POSTS.filter((post) => post[7] !== "ring").length;
    assert.ok(atTheGame >= 60, `only ${atTheGame} of ${POSTS.length} are at the game's places`);
    const place = (id) => POSTS.find((post) => post[0] === id);
    assert.deepEqual([place("ferreiro-suchdol")[3], place("ferreiro-suchdol")[4]], [662.34, 3258.94]);
    assert.deepEqual([place("alquimista-suchdol")[3], place("alquimista-suchdol")[4]], [612.3, 3285.57]);
    assert.deepEqual([place("taberneiro-suchdol")[3], place("taberneiro-suchdol")[4]], [604.01, 3277.69]);
    assert.deepEqual([place("cacador-suchdol")[3], place("cacador-suchdol")[4]], [577.06, 3275.52]);
    assert.deepEqual([place("artesao-suchdol")[3], place("artesao-suchdol")[4]], [590.5, 3276.6]);
    // The big towns have all their trades at the game's own places.
    for (const town of ["suchdol", "kuttenberg"]) {
        assert.ok(POSTS.filter((post) => post[2] === town).every((post) => post[7] !== "ring"), `${town}`);
    }
});
