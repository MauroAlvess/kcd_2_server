"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The bandits' shouts on the client (src/client/bandit-shouts.ts, 2026-11-01): the server names one of the game's voice triggers and where; this plays it there.

function load({ known = () => true } = {}) {
    const played = [];
    const handlers = new Map();
    const sandbox = {
        exports: {},
        require: () => assert.fail("bandit-shouts.js requires nothing"),
        Vector3: function (x, y, z) { return { x, y, z }; },
        Audio: {
            hasTrigger: (name) => known(name),
            playAt: (trigger, at) => { played.push([trigger, { x: at.x, y: at.y, z: at.z }]); return true; },
        },
        Events: { on: (name, fn) => handlers.set(name, fn) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/bandit-shouts.js"), "utf8"), sandbox);
    return { api: sandbox.exports, played, handlers };
}

test("a shout the server names is played where the man stands; anything else is not", () => {
    const sut = load();
    sut.api.installBanditShouts();
    const on = sut.handlers.get("kcdc-gamemode:bandit.shout");
    on(JSON.stringify({ t: "v_soldier_1_attack", x: 10, y: 20, z: 31.6 }));
    assert.deepEqual(JSON.parse(JSON.stringify(sut.played)), [["v_soldier_1_attack", { x: 10, y: 20, z: 31.6 }]]);
    assert.equal(sut.api.playShout({ t: "a_o_bell_kkut_kostelni", x: 1, y: 2, z: 3 }), false, "only the voice triggers of a fight");
    assert.equal(sut.api.playShout({ t: "v_attack", x: Number.NaN, y: 2, z: 3 }), false);
    assert.equal(sut.api.playShout("not json"), false);
    assert.equal(sut.played.length, 1);
});

test("a trigger the game's audio does not have is not played", () => {
    const sut = load({ known: () => false });
    assert.equal(sut.api.playShout({ t: "v_attack", x: 1, y: 2, z: 3 }), false);
    assert.equal(sut.played.length, 0);
});
