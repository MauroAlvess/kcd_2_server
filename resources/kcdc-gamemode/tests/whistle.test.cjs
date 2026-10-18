const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

// X calls the player's horse (src/client/whistle.ts), and only while the player is in the world: not on a game screen,
// in a conversation, with a book open or with one of the mod's pages up.

function load() {
    const state = { now: 1_000_000, server: [], dialogue: false, controls: true, book: null, visible: new Set(), keys: new Map() };
    const context = {
        exports: {},
        Date: { now: () => state.now },
        get LocalPlayer() { return { ready: true, alive: true }; },
        Key: { bind: (key, phase, fn) => { state.keys.set(key, fn); return true; } },
        Hud: { isInDialogue: () => state.dialogue },
        Controls: { isEnabled: () => state.controls },
        Book: { getOpenBook: () => state.book },
        NativeUI: { element: (name) => ({ visible: state.visible.has(name), valid: true }) },
        Events: { emitServer: (name) => state.server.push(name) },
    };
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../dist/client/whistle.js"), "utf8"), context);
    context.exports.installWhistle();
    const press = () => {
        state.now += 3_000;
        state.keys.get("x")();
    };
    return { state, press, api: context.exports };
}

test("X calls the horse, once for a press held or repeated at once", () => {
    const sut = load();
    sut.press();
    assert.deepEqual(sut.state.server, ["kcdc-gamemode:horse.whistle"]);
    sut.state.keys.get("x")();
    assert.equal(sut.state.server.length, 1, "pressed again at once");
});

test("X confirming on one of the game's screens does not call the horse", () => {
    for (const screen of ["ItemSelection", "ItemTransfer", "SkipTime", "GeneralBook", "LockPicking", "HorseInspect"]) {
        const sut = load();
        sut.state.visible.add(screen);
        sut.press();
        assert.deepEqual(sut.state.server, [], screen);
        sut.state.visible.clear();
        sut.press();
        assert.equal(sut.state.server.length, 1, `${screen} closed: X calls again`);
    }
});

test("in the pause menu, where the inventory is, X calls the horse, with the game holding the input there; a screen over the menu still wins", () => {
    const sut = load();
    sut.state.visible.add("Menu");
    sut.state.controls = false;
    sut.press();
    assert.deepEqual(sut.state.server, ["kcdc-gamemode:horse.whistle"], "to bring the horse close and store things on it");
    sut.state.visible.add("ItemSelection");
    sut.press();
    assert.equal(sut.state.server.length, 1, "but not to confirm on a selection screen opened from there");
});

test("nor in a conversation, with a book open, or with one of the mod's pages holding the keyboard", () => {
    const talking = load();
    talking.state.dialogue = true;
    talking.press();
    const reading = load();
    reading.state.book = 41;
    reading.press();
    const panel = load();
    panel.state.controls = false;
    panel.press();
    assert.deepEqual([talking.state.server, reading.state.server, panel.state.server], [[], [], []]);
});
