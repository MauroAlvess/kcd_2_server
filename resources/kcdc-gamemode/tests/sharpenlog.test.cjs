"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

// The game's own sharpening at a grindstone (src/server/sharpen-log.ts): written to the log and, since 2026-10-27, undone -- the bench of repair.ts is the only repair.

function load() {
    const state = { logs: [], chat: [], properties: [], refuse: false };
    let handler = null;
    const context = {
        exports: {},
        console: { log: (line) => state.logs.push(line) },
        Chat: { sendToPlayer: (player, text) => state.chat.push(text) },
        Events: { on: (name, fn) => { if (name === "playerInventoryChanged") handler = fn; } },
        Inventory: {
            setProperties: (player, request) => {
                state.properties.push(request);
                return { ok: !state.refuse, code: state.refuse ? "revisionMismatch" : "" };
            },
        },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/server/sharpen-log.js"), "utf8"), context);
    context.exports.installSharpenLog();
    return { state, change: (reason, items) => handler({ nickname: "Hans" }, { reason, items }) };
}

const row = (condition, extra = {}) => ({ name: "swordMilitary01", condition, metadata: { quality: 2, health: 50, condition, ...extra } });

test("a sharpening that raised a blade's condition is undone: the condition it had before is put back, the rest of the row as it is, and the player is told where to go", () => {
    const sut = load();
    sut.change("sharpen", [{ id: "r1", before: row(0.4), after: row(0.9, { custom: { data: { repairs: 1 } } }) }]);
    assert.equal(sut.state.properties.length, 1);
    const set = sut.state.properties[0];
    assert.equal(set.id, "r1");
    assert.equal(set.metadata.condition, 0.4);
    assert.equal(set.metadata.health, undefined, "not both condition and health");
    assert.equal(set.metadata.quality, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(set.metadata.custom)), { data: { repairs: 1 } }, "and the repair count it carries");
    assert.match(sut.state.chat.at(-1), /mesa de reparo dos ferreiros/);
    assert.ok(sut.state.logs.some((line) => /Hans afiou swordMilitary01: 40% -> 90%/.test(line)));
});

test("a change that is not a sharpening, or a sharpening that gained nothing, is left alone", () => {
    const sut = load();
    sut.change("repair", [{ id: "r1", before: row(0.4), after: row(1) }]);
    sut.change("wear", [{ id: "r1", before: row(0.9), after: row(0.8) }]);
    sut.change("sharpen", [{ id: "r1", before: row(0.5), after: row(0.5) }]);
    assert.deepEqual(sut.state.properties, []);
    assert.deepEqual(sut.state.chat, []);
});

test("when the game will not take the undo the player is not told it was done", () => {
    const sut = load();
    sut.state.refuse = true;
    sut.change("sharpen", [{ id: "r1", before: row(0.4), after: row(0.9) }]);
    assert.equal(sut.state.properties.length, 1);
    assert.deepEqual(sut.state.chat, []);
});
